import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function createConfig() {
  return { port: 8787, host: "0.0.0.0", token: randomBytes(32).toString("hex") };
}

export function loadOrCreateConfig(configPath) {
  if (existsSync(configPath)) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      throw new Error(`${configPath} 不是有效的 JSON。`);
    }
    if (!parsed || typeof parsed.token !== "string" || !parsed.token.trim()) {
      throw new Error(`${configPath} 缺少 token。`);
    }
    const port = Number(parsed.port);
    return {
      port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 8787,
      host: typeof parsed.host === "string" && parsed.host.trim() ? parsed.host.trim() : "0.0.0.0",
      token: parsed.token.trim(),
    };
  }
  const config = createConfig();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}
