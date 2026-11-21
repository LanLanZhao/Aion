import { spawn as nodeSpawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSshConfig } from "./model.mjs";

const STDERR_LIMIT = 4096;
const STDOUT_LIMIT = 256 * 1024;

function buildArgs(server, remoteArgs) {
  const args = [
    "-p",
    String(server.port),
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=5",
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];
  if (server.keyPath) args.push("-i", server.keyPath);
  args.push(`${server.user}@${server.host}`, ...remoteArgs);
  return args;
}

export function buildSshTestArgs(server) {
  return buildArgs(server, ["printf", "ok"]);
}

export function buildSshCommandArgs(server, command) {
  return buildArgs(server, [command]);
}

function firstLine(text) {
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  return (line ?? "").slice(0, 200);
}

export function classifySshFailure(stderr) {
  const text = String(stderr ?? "").toLowerCase();
  const message = firstLine(String(stderr ?? ""));
  if (/permission denied|publickey|no supported authentication/.test(text)) {
    return { ok: false, code: "auth", message: message || "认证失败。" };
  }
  if (/connection refused/.test(text)) {
    return { ok: false, code: "refused", message: message || "连接被拒绝。" };
  }
  if (/could not resolve hostname|name or service not known|nodename nor servname/.test(text)) {
    return { ok: false, code: "dns", message: message || "无法解析主机名。" };
  }
  if (/timed out|connection timeout/.test(text)) {
    return { ok: false, code: "timeout", message: message || "连接超时。" };
  }
  return { ok: false, code: "unknown", message: message || "SSH 连接失败。" };
}

function runSsh(server, remoteArgs, timeoutMs, spawnImpl) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let stdout = "";
    let stderr = "";
    let timer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, ...result, latencyMs: Date.now() - startedAt });
    };

    let child;
    try {
      child = spawnImpl("ssh", buildArgs(server, remoteArgs), { windowsHide: true });
    } catch (error) {
      finish({
        ok: false,
        code: error?.code === "ENOENT" ? "ssh_missing" : "unknown",
        message: error?.code === "ENOENT" ? "电脑上找不到 ssh 命令。" : String(error?.message ?? error),
      });
      return;
    }

    timer = setTimeout(() => {
      finish({ ok: false, code: "timeout", message: "连接超时。" });
      try {
        child.kill();
      } catch {
        // The child may already be gone.
      }
    }, timeoutMs);

    child.on("error", (error) => {
      finish({
        ok: false,
        code: error?.code === "ENOENT" ? "ssh_missing" : "unknown",
        message: error?.code === "ENOENT" ? "电脑上找不到 ssh 命令。" : String(error?.message ?? error),
      });
    });
    child.stdout?.on("data", (chunk) => {
      if (stdout.length < STDOUT_LIMIT) stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      if (stderr.length < STDERR_LIMIT) stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        finish({ ok: true, code: "ok", message: "" });
        return;
      }
      finish(classifySshFailure(stderr));
    });
  });
}

export function runSshTest(server, timeoutMs = 8000, spawnImpl = nodeSpawn) {
  return runSsh(server, ["printf", "ok"], timeoutMs, spawnImpl).then((result) => ({
    ok: result.ok,
    code: result.code,
    message: result.message,
    latencyMs: result.latencyMs,
  }));
}

export function runSshCommand(server, command, timeoutMs = 12000, spawnImpl = nodeSpawn) {
  return runSsh(server, [command], timeoutMs, spawnImpl);
}

export async function readSshConfig() {
  try {
    return parseSshConfig(await readFile(join(homedir(), ".ssh", "config"), "utf8"));
  } catch {
    return [];
  }
}
