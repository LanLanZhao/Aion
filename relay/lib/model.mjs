const NAME_MAX = 60;
const HOST_MAX = 255;
const HOST_PATTERN = /^[A-Za-z0-9._:@-]+$/;
const USER_PATTERN = /^[A-Za-z0-9._-]+$/;

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`请填写${label}。`);
  }
  return value.trim();
}

function optionalText(value, limit, label) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${label}格式不正确。`);
  const trimmed = value.trim();
  if (trimmed.length > limit) throw new Error(`${label}不能超过 ${limit} 个字符。`);
  return trimmed;
}

function parsePort(value) {
  if (value == null || value === "") return 22;
  const port = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("端口必须是 1 到 65535 之间的整数。");
  }
  return port;
}

export function validateServerInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const name = requiredText(source.name, "服务器名称");
  if (name.length > NAME_MAX) throw new Error(`服务器名称不能超过 ${NAME_MAX} 个字符。`);

  const host = requiredText(source.host, "Host");
  if (host.length > HOST_MAX) throw new Error(`Host 不能超过 ${HOST_MAX} 个字符。`);
  if (host.startsWith("-") || !HOST_PATTERN.test(host)) {
    throw new Error("Host 只能包含字母、数字、点、横线、下划线和冒号，且不能以 - 开头。");
  }

  const user = requiredText(source.user, "用户名");
  if (user.startsWith("-") || !USER_PATTERN.test(user)) {
    throw new Error("用户名只能包含字母、数字、点、横线和下划线，且不能以 - 开头。");
  }

  return {
    name,
    host,
    port: parsePort(source.port),
    user,
    keyPath: optionalText(source.keyPath, 500, "私钥路径"),
    condaEnv: optionalText(source.condaEnv, 100, "conda 环境名"),
    rootDir: optionalText(source.rootDir, 500, "实验根目录"),
  };
}

export function parseServersFile(raw) {
  if (!raw) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter((item) => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.host === "string" &&
        typeof item.user === "string" &&
        typeof item.port === "number"
      );
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      host: item.host,
      port: item.port,
      user: item.user,
      keyPath: typeof item.keyPath === "string" ? item.keyPath : "",
      condaEnv: typeof item.condaEnv === "string" ? item.condaEnv : "",
      rootDir: typeof item.rootDir === "string" ? item.rootDir : "",
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
    }));
}

export function redactServer(server) {
  return {
    id: server.id,
    name: server.name,
    host: server.host,
    port: server.port,
    user: server.user,
    condaEnv: server.condaEnv ?? "",
    rootDir: server.rootDir ?? "",
    hasKeyPath: Boolean(server.keyPath),
    createdAt: server.createdAt ?? 0,
  };
}

export function parseSshConfig(raw) {
  if (typeof raw !== "string") return [];
  const hosts = [];
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^Host\s+(.+)$/i) ?? trimmed.match(/^Host=(.+)$/i);
    if (!match) continue;
    for (const token of match[1].trim().split(/\s+/)) {
      if (!token || seen.has(token)) continue;
      if (token.includes("*") || token.includes("?") || token.startsWith("!")) continue;
      seen.add(token);
      hosts.push(token);
    }
  }
  return hosts;
}
