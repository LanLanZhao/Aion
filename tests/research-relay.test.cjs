/* global __dirname */
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const load = (relative) => import(pathToFileURL(path.resolve(__dirname, relative)).href);

async function startRelay(options = {}) {
  const app = await load("../relay/lib/app.mjs");
  const dataFile = path.join(mkdtempSync(path.join(tmpdir(), "quest-relay-")), "servers.json");
  const handler = app.createRelayHandler({ token: "secret", dataFile, ...options });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    dataFile,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const headers = { Authorization: "Bearer secret", "Content-Type": "application/json" };

test("server input is validated and option-like hosts rejected", async () => {
  const model = await load("../relay/lib/model.mjs");
  assert.deepEqual(
    model.validateServerInput({ name: " 4090 ", host: "10.0.0.5", port: "22", user: " lanlan " }),
    { name: "4090", host: "10.0.0.5", port: 22, user: "lanlan", keyPath: "", condaEnv: "", rootDir: "" },
  );
  assert.throws(() => model.validateServerInput({ name: "x", host: "-oProxyCommand=calc", user: "u" }), /Host/);
  assert.throws(() => model.validateServerInput({ name: "x", host: "h", user: "-u" }), /用户名/);
  assert.throws(() => model.validateServerInput({ name: "", host: "h", user: "u" }), /名称/);
  assert.throws(() => model.validateServerInput({ name: "x", host: "h", port: "70000", user: "u" }), /端口/);
});

test("malformed saved servers are ignored", async () => {
  const model = await load("../relay/lib/model.mjs");
  const valid = { id: "s1", name: "A", host: "h", port: 22, user: "u", keyPath: "/k", createdAt: 1 };
  assert.equal(model.parseServersFile("not-json").length, 0);
  const parsed = model.parseServersFile(JSON.stringify([valid, { id: "bad" }]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].keyPath, "/k");
});

test("redaction never returns a key path", async () => {
  const model = await load("../relay/lib/model.mjs");
  const out = model.redactServer({ id: "s1", name: "A", host: "h", port: 22, user: "u", keyPath: "/home/u/.ssh/id_ed25519" });
  assert.equal(out.keyPath, undefined);
  assert.equal(out.hasKeyPath, true);
});

test("ssh config aliases skip wildcards", async () => {
  const model = await load("../relay/lib/model.mjs");
  assert.deepEqual(model.parseSshConfig("Host a b\n  HostName x\nHost *\nHost ?\n# Host c\nHost=A\nHost b\n"), ["a", "b", "A"]);
});

test("ssh args are an argv array with hardening options", async () => {
  const ssh = await load("../relay/lib/ssh.mjs");
  const args = ssh.buildSshTestArgs({ host: "h", port: 2222, user: "u", keyPath: "/k" });
  assert.ok(args.includes("BatchMode=yes"));
  assert.ok(args.includes("StrictHostKeyChecking=accept-new"));
  assert.ok(args.includes("-i"));
  assert.deepEqual(args.slice(-3), ["u@h", "printf", "ok"]);
});

test("relay requires the token and reports health", async () => {
  const relay = await startRelay();
  try {
    const denied = await fetch(`${relay.base}/health`);
    assert.equal(denied.status, 401);
    const ok = await fetch(`${relay.base}/health`, { headers });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, version: 1 });
  } finally {
    await relay.close();
  }
});

test("servers can be added, listed without secrets, and deleted", async () => {
  const relay = await startRelay();
  try {
    const created = await fetch(`${relay.base}/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "4090", host: "10.0.0.5", port: 22, user: "lanlan", keyPath: "/home/lanlan/.ssh/id_ed25519" }),
    });
    assert.equal(created.status, 201);
    const { server } = await created.json();
    assert.equal(server.name, "4090");
    assert.equal(server.keyPath, undefined);
    assert.equal(server.hasKeyPath, true);

    const list = await (await fetch(`${relay.base}/servers`, { headers })).json();
    assert.equal(list.servers.length, 1);
    assert.equal(list.servers[0].host, "10.0.0.5");

    const removed = await fetch(`${relay.base}/servers/${server.id}`, { method: "DELETE", headers });
    assert.equal(removed.status, 204);
    const empty = await (await fetch(`${relay.base}/servers`, { headers })).json();
    assert.equal(empty.servers.length, 0);
  } finally {
    await relay.close();
  }
});

test("bad input never reaches ssh and returns 400", async () => {
  let called = false;
  const relay = await startRelay({ sshTest: async () => { called = true; return { ok: true }; } });
  try {
    const injected = await fetch(`${relay.base}/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "x", host: "-oProxyCommand=calc", user: "u" }),
    });
    assert.equal(injected.status, 400);
    assert.equal(called, false);

    const malformed = await fetch(`${relay.base}/servers`, { method: "POST", headers, body: "{oops" });
    assert.equal(malformed.status, 400);
  } finally {
    await relay.close();
  }
});

test("servers can be updated and keep their key path when blank", async () => {
  const relay = await startRelay();
  try {
    const created = await (await fetch(`${relay.base}/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "box", host: "h", port: 22, user: "u", keyPath: "/k" }),
    })).json();
    const id = created.server.id;

    const patched = await fetch(`${relay.base}/servers/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "box2", host: "h2", port: 2222, user: "u2", keyPath: "", condaEnv: "env", rootDir: "~/runs" }),
    });
    assert.equal(patched.status, 200);
    const { server } = await patched.json();
    assert.equal(server.name, "box2");
    assert.equal(server.port, 2222);
    assert.equal(server.condaEnv, "env");
    assert.equal(server.hasKeyPath, true);

    const bad = await fetch(`${relay.base}/servers/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "x", host: "-oProxyCommand=calc", user: "u" }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await relay.close();
  }
});

test("server status is parsed from one ssh snapshot", async () => {
  const status = await load("../relay/lib/status.mjs");
  const fixture = [
    "@@host", "gpu-box",
    "@@uptime", " 15:20:00 up 12 days,  3:41,  2 users,  load average: 0.52, 0.61, 0.44",
    "@@cores", "32",
    "@@mem", "               total        used        free      shared  buff/cache   available",
    "Mem:    134217728000 67108864000 33554432000           0 33554432000 67108864000",
    "Swap:             0           0           0",
    "@@disk", "Filesystem 1B-blocks Used Available Capacity Mounted on",
    "/dev/nvme0n1p2 1000000000000 400000000000 600000000000 40% /",
    "/dev/nvme1n1p1 2000000000000 1500000000000 500000000000 75% /home",
    "@@cpu", "%Cpu(s):  4.0 us,  2.0 sy,  0.0 ni, 93.0 id,  1.0 wa",
    "@@gpu", "0, NVIDIA GeForce RTX 4090, 35, 12000, 24564, 62, 120.5, 450.0",
    "1, NVIDIA GeForce RTX 4090, 87, 22000, 24564, 71, 380.0, 450.0",
    "",
  ].join("\n");
  const parsed = status.parseStatus(fixture);
  assert.equal(parsed.host, "gpu-box");
  assert.equal(parsed.cores, 32);
  assert.equal(parsed.cpu.usagePercent, 7);
  assert.equal(Math.round(parsed.memory.percent), 50);
  assert.equal(parsed.disks.length, 2);
  assert.equal(parsed.disks[1].mount, "/home");
  assert.equal(parsed.gpus.length, 2);
  assert.equal(parsed.gpus[0].utilization, 35);
  assert.equal(parsed.gpus[1].temperature, 71);
  assert.deepEqual(parsed.load, [0.52, 0.61, 0.44]);
});

test("status endpoint returns parsed system usage", async () => {
  const relay = await startRelay({
    runCommand: async () => ({ ok: true, stdout: "@@host\nbox\n@@cores\n8\n@@gpu\n", latencyMs: 12 }),
  });
  try {
    const created = await (await fetch(`${relay.base}/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "a", host: "h", user: "u" }),
    })).json();
    const result = await (await fetch(`${relay.base}/servers/${created.server.id}/status`, { headers })).json();
    assert.equal(result.ok, true);
    assert.equal(result.status.host, "box");
    assert.equal(result.status.cores, 8);
    assert.deepEqual(result.status.gpus, []);
  } finally {
    await relay.close();
  }
});

test("gpu process snapshot is grouped by gpu uuid", async () => {
  const processes = await load("../relay/lib/processes.mjs");
  const fixture = [
    "@@gpu",
    "0, GPU-aaa, NVIDIA GeForce RTX 4090 D, 18000, 24564",
    "1, GPU-bbb, NVIDIA GeForce RTX 4090 D, 3000, 24564",
    "@@apps",
    "1234, /usr/bin/python3, 12000, GPU-aaa",
    "5678, /opt/conda/envs/torch/bin/python, 6000, GPU-aaa",
    "9012, node, 3000, GPU-bbb",
    "@@cmd",
    "1234 jenny 02:10:33 /usr/bin/python3 train.py --config base.yaml",
    "5678 jenny 00:12:01 /opt/conda/envs/torch/bin/python eval.py --split test",
    "9012 jenny 00:00:21 node server.js",
    "",
  ].join("\n");
  const parsed = processes.parseProcesses(fixture);
  assert.equal(parsed.gpus.length, 2);
  assert.equal(parsed.gpus[0].index, 0);
  assert.equal(parsed.gpus[0].processes.length, 2);
  assert.equal(parsed.gpus[0].processes[0].pid, 1234);
  assert.equal(parsed.gpus[0].processes[0].memoryUsed, 12000);
  assert.equal(Math.round(parsed.gpus[0].processes[0].memoryPercent), 49);
  assert.equal(parsed.gpus[0].processes[0].command, "/usr/bin/python3 train.py --config base.yaml");
  assert.equal(parsed.gpus[0].processes[0].user, "jenny");
  assert.equal(parsed.gpus[0].processes[0].elapsed, "02:10:33");
  assert.equal(parsed.gpus[1].processes[0].name, "node");
});

test("process endpoint returns the parsed snapshot", async () => {
  const relay = await startRelay({
    runCommand: async () => ({
      ok: true,
      stdout: "@@gpu\n0, GPU-aaa, RTX 4090, 12000, 24564\n@@apps\n42, python, 8000, GPU-aaa\n@@cmd\n42 jenny 01:02:03 python train.py\n",
      latencyMs: 9,
    }),
  });
  try {
    const created = await (await fetch(`${relay.base}/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "box", host: "h", user: "u" }),
    })).json();
    const result = await (await fetch(`${relay.base}/servers/${created.server.id}/processes`, { headers })).json();
    assert.equal(result.ok, true);
    assert.equal(result.processes.gpus[0].processes[0].pid, 42);
    assert.equal(result.processes.gpus[0].processes[0].memoryUsed, 8000);
    assert.equal(result.processes.gpus[0].processes[0].command, "python train.py");
    assert.equal(result.processes.gpus[0].processes[0].user, "jenny");
  } finally {
    await relay.close();
  }
});

test("connection tests pass the server result through", async () => {
  const relay = await startRelay({ sshTest: async () => ({ ok: false, code: "auth", message: "Permission denied", latencyMs: 42 }) });
  try {
    const created = await (await fetch(`${relay.base}/servers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "box", host: "h", user: "u" }),
    })).json();
    const result = await (await fetch(`${relay.base}/servers/${created.server.id}/test`, { method: "POST", headers })).json();
    assert.deepEqual(result, { ok: false, code: "auth", message: "Permission denied", latencyMs: 42 });
  } finally {
    await relay.close();
  }
});

test("ssh aliases are listed and failures are reported without crashing", async () => {
  const relay = await startRelay({ readSshConfig: async () => ["gpu-01", "gpu-02"] });
  try {
    const ok = await (await fetch(`${relay.base}/ssh-hosts`, { headers })).json();
    assert.deepEqual(ok.hosts, ["gpu-01", "gpu-02"]);
  } finally {
    await relay.close();
  }
  const broken = await startRelay({ readSshConfig: async () => { throw new Error("no ssh config"); } });
  try {
    const failed = await fetch(`${broken.base}/ssh-hosts`, { headers });
    assert.equal(failed.status, 200);
    assert.equal((await failed.json()).hosts.length, 0);
  } finally {
    await broken.close();
  }
});

function fakeChild() {
  const { EventEmitter } = require("node:events");
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => child.emit("close", null);
  return child;
}

test("ssh failures are classified into readable codes", async () => {
  const ssh = await load("../relay/lib/ssh.mjs");
  assert.equal(ssh.classifySshFailure("Permission denied (publickey).").code, "auth");
  assert.equal(ssh.classifySshFailure("ssh: connect to host h port 22: Connection refused").code, "refused");
  assert.equal(ssh.classifySshFailure("ssh: Could not resolve hostname h").code, "dns");
  assert.equal(ssh.classifySshFailure("Connection timed out").code, "timeout");
});

test("ssh test returns ok, timeout and ssh_missing instead of hanging", async () => {
  const ssh = await load("../relay/lib/ssh.mjs");

  const success = await ssh.runSshTest({ host: "h", port: 22, user: "u" }, 1000, () => {
    const child = fakeChild();
    setImmediate(() => child.emit("close", 0));
    return child;
  });
  assert.equal(success.code, "ok");
  assert.equal(success.ok, true);

  const startedAt = Date.now();
  const timeout = await ssh.runSshTest({ host: "h", port: 22, user: "u" }, 200, () => fakeChild());
  assert.equal(timeout.code, "timeout");
  assert.ok(Date.now() - startedAt < 2000);

  const missing = await ssh.runSshTest({ host: "h", port: 22, user: "u" }, 1000, () => {
    throw Object.assign(new Error("spawn ssh ENOENT"), { code: "ENOENT" });
  });
  assert.equal(missing.code, "ssh_missing");
});

test("relay config is generated once and reused", async () => {
  const config = await load("../relay/lib/config.mjs");
  const file = path.join(mkdtempSync(path.join(tmpdir(), "quest-relay-config-")), "relay.config.json");
  const first = config.loadOrCreateConfig(file);
  assert.match(first.token, /^[0-9a-f]{64}$/);
  const second = config.loadOrCreateConfig(file);
  assert.equal(second.token, first.token);
  assert.equal(second.port, 8787);
});
