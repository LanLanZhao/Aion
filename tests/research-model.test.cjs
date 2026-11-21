/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadFile(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const sandbox = { exports: {}, require: (name) => require(name) };
  vm.runInNewContext(outputText, sandbox, { filename });
  return sandbox.exports;
}

const model = loadFile("../src/components/research/research-model.ts");

test("relay config normalizes and validates", () => {
  assert.deepEqual({ ...model.validateRelayConfig(" 192.168.1.5:8787/ ", " abc ") }, {
    baseUrl: "http://192.168.1.5:8787",
    token: "abc",
  });
  assert.equal(model.normalizeBaseUrl("https://lab.example.com/"), "https://lab.example.com");
  assert.equal(model.normalizeBaseUrl(""), "");
  assert.throws(() => model.validateRelayConfig("", "x"), /中转地址/);
  assert.throws(() => model.validateRelayConfig("http://h:8787", ""), /Token/);
  assert.throws(() => model.validateRelayConfig("ftp://h", "t"), /http/);
});

test("saved relay config tolerates malformed data", () => {
  assert.equal(model.parseRelayConfig('{"baseUrl":"http://h","token":"t"}').token, "t");
  assert.equal(model.parseRelayConfig("nope"), null);
  assert.equal(model.parseRelayConfig('{"baseUrl":4,"token":"t"}'), null);
  assert.equal(model.parseRelayConfig(null), null);
});

test("server drafts reject option-like hosts", () => {
  assert.deepEqual({ ...model.validateServerDraft({ name: " A ", host: "h", user: "u" }) }, {
    name: "A",
    host: "h",
    port: 22,
    user: "u",
    keyPath: "",
    condaEnv: "",
    rootDir: "",
  });
  assert.throws(() => model.validateServerDraft({ name: "A", host: "-oProxyCommand=calc", user: "u" }), /Host/);
  assert.throws(() => model.validateServerDraft({ name: "A", host: "h", user: "-u" }), /用户名/);
  assert.throws(() => model.validateServerDraft({ name: "A", host: "h", user: "u", port: 0 }), /端口/);
});

test("server responses tolerate unknown and missing fields", () => {
  const list = model.parseServersResponse({
    servers: [
      { id: "s1", name: "A", host: "h", port: 2222, user: "u", extra: 1 },
      { bad: true },
      null,
    ],
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].port, 2222);
  assert.equal(list[0].condaEnv, "");
  assert.equal(list[0].hasKeyPath, false);
  assert.equal(model.parseServersResponse("nope").length, 0);
});

test("test results are always renderable", () => {
  assert.deepEqual({ ...model.parseTestResult({ ok: true, code: "ok", latencyMs: 42 }) }, {
    ok: true,
    code: "ok",
    message: "连接测试失败。",
    latencyMs: 42,
  });
  const fallback = model.parseTestResult({ code: "made-up" });
  assert.equal(fallback.code, "unknown");
  assert.equal(fallback.ok, false);
});

test("process responses tolerate missing fields", () => {
  const parsed = model.parseProcessesResponse({
    ok: true,
    processes: {
      gpus: [
        {
          index: 0,
          name: "RTX 4090",
          memoryUsed: 100,
          memoryTotal: 1000,
          processes: [
            { pid: 7, name: "python", command: "/usr/bin/python train.py", user: "jenny", elapsed: "01:02:03", memoryUsed: 50, memoryPercent: 5 },
            { bad: true },
          ],
        },
        { bad: true },
      ],
    },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.processes.gpus.length, 1);
  assert.equal(parsed.processes.gpus[0].processes.length, 1);
  assert.equal(parsed.processes.gpus[0].processes[0].pid, 7);
  assert.equal(parsed.processes.gpus[0].processes[0].command, "/usr/bin/python train.py");
  assert.equal(parsed.processes.gpus[0].processes[0].user, "jenny");
  assert.equal(model.shortCommand("/opt/conda/envs/torch/bin/python main.py --config x", "python"), "python main.py --config x");
  assert.equal(model.shortCommand("", "python"), "python");
  const failed = model.parseProcessesResponse({ ok: false, code: "timeout", message: "x" });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, "timeout");
});
