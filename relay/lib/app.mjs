/* global Buffer */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseServersFile, redactServer, validateServerInput } from "./model.mjs";
import { STATUS_COMMAND, parseStatus } from "./status.mjs";
import { PROCESSES_COMMAND, parseProcesses } from "./processes.mjs";

const MAX_BODY_BYTES = 64 * 1024;
const JSON_TYPE = "application/json; charset=utf-8";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": JSON_TYPE, ...CORS_HEADERS });
  res.end(JSON.stringify(payload));
}

function sendEmpty(res, status) {
  res.writeHead(status, CORS_HEADERS);
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("请求体过大。"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("请求体不是有效的 JSON。"), { status: 400 });
  }
}

export function createRelayHandler({ token, dataFile, sshTest, runCommand, readSshConfig } = {}) {
  if (!token) throw new Error("relay token is required");

  let servers = [];
  try {
    servers = parseServersFile(existsSync(dataFile) ? readFileSync(dataFile, "utf8") : null);
  } catch {
    servers = [];
  }

  function save() {
    mkdirSync(dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.tmp`;
    writeFileSync(temporary, JSON.stringify(servers, null, 2));
    renameSync(temporary, dataFile);
  }

  async function handle(req, res) {
    const method = req.method ?? "GET";
    if (method === "OPTIONS") {
      sendEmpty(res, 204);
      return;
    }

    if (req.headers.authorization !== `Bearer ${token}`) {
      sendJson(res, 401, { error: "unauthorized", message: "Token 不正确。" });
      return;
    }

    const path = new URL(req.url ?? "/", "http://relay").pathname;
    const parts = path.split("/").filter(Boolean);

    if (method === "GET" && path === "/health") {
      sendJson(res, 200, { ok: true, version: 1 });
      return;
    }

    if (method === "GET" && path === "/servers") {
      sendJson(res, 200, { servers: servers.map(redactServer) });
      return;
    }

    if (method === "POST" && path === "/servers") {
      const body = await readJson(req);
      let input;
      try {
        input = validateServerInput(body);
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { status: 400 });
      }
      const server = { id: `s_${randomUUID()}`, ...input, createdAt: Date.now() };
      servers = [server, ...servers];
      save();
      sendJson(res, 201, { server: redactServer(server) });
      return;
    }

    if (method === "GET" && path === "/ssh-hosts") {
      let hosts = [];
      let message;
      try {
        hosts = (await readSshConfig?.()) ?? [];
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      sendJson(res, 200, message ? { hosts, message } : { hosts });
      return;
    }

    if (parts[0] === "servers" && parts[1] && parts.length === 2 && method === "PATCH") {
      const index = servers.findIndex((server) => server.id === parts[1]);
      if (index < 0) {
        sendJson(res, 404, { error: "not_found", message: "服务器不存在。" });
        return;
      }
      const body = await readJson(req);
      let input;
      try {
        input = validateServerInput(body);
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { status: 400 });
      }
      const existing = servers[index];
      // An empty key path means "keep the current one": the App never receives it.
      const updated = { ...existing, ...input, keyPath: input.keyPath || existing.keyPath };
      servers = servers.map((server) => (server.id === parts[1] ? updated : server));
      save();
      sendJson(res, 200, { server: redactServer(updated) });
      return;
    }

    if (parts[0] === "servers" && parts[1] && parts.length === 2 && method === "DELETE") {
      const index = servers.findIndex((server) => server.id === parts[1]);
      if (index < 0) {
        sendJson(res, 404, { error: "not_found", message: "服务器不存在。" });
        return;
      }
      servers = servers.filter((server) => server.id !== parts[1]);
      save();
      sendEmpty(res, 204);
      return;
    }

    if (parts[0] === "servers" && parts[1] && parts[2] === "status" && method === "GET") {
      const server = servers.find((item) => item.id === parts[1]);
      if (!server) {
        sendJson(res, 404, { error: "not_found", message: "服务器不存在。" });
        return;
      }
      if (typeof runCommand !== "function") {
        sendJson(res, 500, { error: "unavailable", message: "中转未配置状态查询。" });
        return;
      }
      const startedAt = Date.now();
      const result = await runCommand(server, STATUS_COMMAND, 12000);
      const latencyMs = Number.isFinite(result?.latencyMs) ? result.latencyMs : Date.now() - startedAt;
      if (!result?.ok) {
        sendJson(res, 200, {
          ok: false,
          code: result?.code ?? "unknown",
          message: result?.message ?? "",
          latencyMs,
        });
        return;
      }
      sendJson(res, 200, { ok: true, status: parseStatus(result.stdout), latencyMs });
      return;
    }

    if (parts[0] === "servers" && parts[1] && parts[2] === "processes" && method === "GET") {
      const server = servers.find((item) => item.id === parts[1]);
      if (!server) {
        sendJson(res, 404, { error: "not_found", message: "服务器不存在。" });
        return;
      }
      if (typeof runCommand !== "function") {
        sendJson(res, 500, { error: "unavailable", message: "中转未配置进程查询。" });
        return;
      }
      const startedAt = Date.now();
      const result = await runCommand(server, PROCESSES_COMMAND, 12000);
      const latencyMs = Number.isFinite(result?.latencyMs) ? result.latencyMs : Date.now() - startedAt;
      if (!result?.ok) {
        sendJson(res, 200, {
          ok: false,
          code: result?.code ?? "unknown",
          message: result?.message ?? "",
          latencyMs,
        });
        return;
      }
      sendJson(res, 200, { ok: true, processes: parseProcesses(result.stdout), latencyMs });
      return;
    }

    if (parts[0] === "servers" && parts[1] && parts[2] === "test" && method === "POST") {
      const server = servers.find((item) => item.id === parts[1]);
      if (!server) {
        sendJson(res, 404, { error: "not_found", message: "服务器不存在。" });
        return;
      }
      if (typeof sshTest !== "function") {
        sendJson(res, 500, { error: "unavailable", message: "中转未配置 SSH 测试。" });
        return;
      }
      const startedAt = Date.now();
      const result = await sshTest(server, 8000);
      const latencyMs = Number.isFinite(result?.latencyMs) ? result.latencyMs : Date.now() - startedAt;
      sendJson(res, 200, {
        ok: Boolean(result?.ok),
        code: result?.code ?? (result?.ok ? "ok" : "unknown"),
        message: result?.message ?? "",
        latencyMs,
      });
      return;
    }

    sendJson(res, 404, { error: "not_found", message: "接口不存在。" });
  }

  return (req, res) => {
    handle(req, res).catch((error) => {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      sendJson(res, status, {
        error: status === 500 ? "internal" : "invalid",
        message: error instanceof Error ? error.message : String(error),
      });
    });
  };
}
