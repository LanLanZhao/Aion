export type RelayConfig = {
  baseUrl: string;
  token: string;
};

export type ServerSummary = {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  condaEnv: string;
  rootDir: string;
  hasKeyPath: boolean;
  createdAt: number;
};

export type ServerDraft = {
  name: string;
  host: string;
  port: number;
  user: string;
  keyPath: string;
  condaEnv: string;
  rootDir: string;
};

export type TestCode = "ok" | "timeout" | "refused" | "auth" | "dns" | "ssh_missing" | "unknown";

export type TestResult = {
  ok: boolean;
  code: TestCode;
  message: string;
  latencyMs: number;
};

export type GpuUsage = {
  index: number | null;
  name: string;
  utilization: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  memoryPercent: number | null;
  temperature: number | null;
  power: number | null;
  powerLimit: number | null;
};

export type DiskUsage = {
  mount: string;
  total: number;
  used: number;
  percent: number | null;
};

export type ServerStatus = {
  host: string;
  uptime: string;
  load: number[];
  cores: number | null;
  cpu: { usagePercent: number | null; cores: number | null };
  memory: { total: number; used: number; available: number | null; percent: number | null } | null;
  disks: DiskUsage[];
  gpus: GpuUsage[];
  collectedAt: number;
};

export type StatusResult = { ok: true; status: ServerStatus } | { ok: false; code: TestCode; message: string };

export type GpuProcess = {
  pid: number;
  name: string;
  command: string;
  user: string;
  elapsed: string;
  memoryUsed: number | null;
  memoryPercent: number | null;
};

export type GpuProcessGroup = {
  index: number | null;
  name: string;
  memoryUsed: number | null;
  memoryTotal: number | null;
  processes: GpuProcess[];
};

export type ProcessesSnapshot = {
  gpus: GpuProcessGroup[];
  collectedAt: number;
};

export type ProcessesResult = { ok: true; processes: ProcessesSnapshot } | { ok: false; code: TestCode; message: string };

const HOST_PATTERN = /^[A-Za-z0-9._:@-]+$/;
const USER_PATTERN = /^[A-Za-z0-9._-]+$/;

export function normalizeBaseUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `http://${value.replace(/\/+$/, "")}`;
}

export function validateRelayConfig(baseUrl: string, token: string): RelayConfig {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) throw new Error("请填写中转地址。");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("中转地址必须以 http:// 或 https:// 开头。");
  }
  const hostPart = normalized.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? "";
  if (!hostPart) throw new Error("中转地址格式不正确，例如 http://192.168.1.5:8787。");
  if (!/^[A-Za-z0-9._\-[\]:]+$/.test(hostPart)) {
    throw new Error("中转地址格式不正确，例如 http://192.168.1.5:8787。");
  }
  const trimmedToken = token.trim();
  if (!trimmedToken) throw new Error("请填写 Token。");
  if (trimmedToken.length > 200) throw new Error("Token 过长。");
  return { baseUrl: normalized, token: trimmedToken };
}

export function parseRelayConfig(raw: string | null): RelayConfig | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const { baseUrl, token } = data as { baseUrl?: unknown; token?: unknown };
    if (typeof baseUrl !== "string" || typeof token !== "string") return null;
    return validateRelayConfig(baseUrl, token);
  } catch {
    return null;
  }
}

export function validateServerDraft(input: Partial<ServerDraft>): ServerDraft {
  const name = text(input.name, "服务器名称", 60);
  const host = text(input.host, "Host", 255);
  if (host.startsWith("-") || !HOST_PATTERN.test(host)) {
    throw new Error("Host 只能包含字母、数字、点、横线、下划线和冒号，且不能以 - 开头。");
  }
  const user = text(input.user, "用户名", 200);
  if (user.startsWith("-") || !USER_PATTERN.test(user)) {
    throw new Error("用户名只能包含字母、数字、点、横线和下划线，且不能以 - 开头。");
  }
  const port = parsePort(input.port);
  const keyPath = optionalText(input.keyPath, 500, "私钥路径");
  const condaEnv = optionalText(input.condaEnv, 100, "conda 环境名");
  const rootDir = optionalText(input.rootDir, 500, "实验根目录");
  return { name, host, port, user, keyPath, condaEnv, rootDir };
}

function text(value: unknown, label: string, limit: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`请填写${label}。`);
  const trimmed = value.trim();
  if (trimmed.length > limit) throw new Error(`${label}不能超过 ${limit} 个字符。`);
  return trimmed;
}

function optionalText(value: unknown, limit: number, label: string): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${label}格式不正确。`);
  const trimmed = value.trim();
  if (trimmed.length > limit) throw new Error(`${label}不能超过 ${limit} 个字符。`);
  return trimmed;
}

function parsePort(value: unknown): number {
  if (value == null || value === "") return 22;
  const port = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("端口必须是 1 到 65535 之间的整数。");
  }
  return port;
}

export function parseServersResponse(data: unknown): ServerSummary[] {
  if (!data || typeof data !== "object") return [];
  const list = (data as { servers?: unknown }).servers;
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is Record<string, unknown> => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).host === "string" &&
        typeof (item as Record<string, unknown>).user === "string"
      );
    })
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      host: item.host as string,
      port: typeof item.port === "number" ? item.port : 22,
      user: item.user as string,
      condaEnv: typeof item.condaEnv === "string" ? item.condaEnv : "",
      rootDir: typeof item.rootDir === "string" ? item.rootDir : "",
      hasKeyPath: Boolean(item.hasKeyPath),
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
    }));
}

export function parseTestResult(data: unknown): TestResult {
  const fallback: TestResult = { ok: false, code: "unknown", message: "连接测试失败。", latencyMs: 0 };
  if (!data || typeof data !== "object") return fallback;
  const item = data as Record<string, unknown>;
  const codes: TestCode[] = ["ok", "timeout", "refused", "auth", "dns", "ssh_missing", "unknown"];
  const code = typeof item.code === "string" && codes.includes(item.code as TestCode) ? (item.code as TestCode) : "unknown";
  return {
    ok: Boolean(item.ok),
    code,
    message: typeof item.message === "string" ? item.message : fallback.message,
    latencyMs: typeof item.latencyMs === "number" ? item.latencyMs : 0,
  };
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseStatusResponse(data: unknown): StatusResult {
  if (!data || typeof data !== "object") {
    return { ok: false, code: "unknown", message: "中转返回的数据不完整。" };
  }
  const item = data as Record<string, unknown>;
  if (item.ok !== true) {
    const codes: TestCode[] = ["ok", "timeout", "refused", "auth", "dns", "ssh_missing", "unknown"];
    const code = typeof item.code === "string" && codes.includes(item.code as TestCode) ? (item.code as TestCode) : "unknown";
    return { ok: false, code, message: typeof item.message === "string" ? item.message : "无法读取服务器状态。" };
  }

  const raw = (item.status ?? {}) as Record<string, unknown>;
  const cpu = (raw.cpu ?? {}) as Record<string, unknown>;
  const memory = raw.memory && typeof raw.memory === "object" ? (raw.memory as Record<string, unknown>) : null;
  const memoryTotal = numeric(memory?.total);

  return {
    ok: true,
    status: {
      host: typeof raw.host === "string" ? raw.host : "",
      uptime: typeof raw.uptime === "string" ? raw.uptime : "",
      load: Array.isArray(raw.load) ? raw.load.filter((value): value is number => typeof value === "number") : [],
      cores: numeric(raw.cores),
      cpu: { usagePercent: numeric(cpu.usagePercent), cores: numeric(cpu.cores) },
      memory: memory && memoryTotal
        ? {
            total: memoryTotal,
            used: numeric(memory.used) ?? 0,
            available: numeric(memory.available),
            percent: numeric(memory.percent),
          }
        : null,
      disks: Array.isArray(raw.disks)
        ? raw.disks
            .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
            .map((entry) => ({
              mount: typeof entry.mount === "string" ? entry.mount : "",
              total: numeric(entry.total) ?? 0,
              used: numeric(entry.used) ?? 0,
              percent: numeric(entry.percent),
            }))
        : [],
      gpus: Array.isArray(raw.gpus)
        ? raw.gpus
            .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
            .map((entry) => ({
              index: numeric(entry.index),
              name: typeof entry.name === "string" ? entry.name : "GPU",
              utilization: numeric(entry.utilization),
              memoryUsed: numeric(entry.memoryUsed),
              memoryTotal: numeric(entry.memoryTotal),
              memoryPercent: numeric(entry.memoryPercent),
              temperature: numeric(entry.temperature),
              power: numeric(entry.power),
              powerLimit: numeric(entry.powerLimit),
            }))
        : [],
      collectedAt: typeof raw.collectedAt === "number" ? raw.collectedAt : Date.now(),
    },
  };
}

/** Localized label for a connection-test outcome; errors from the relay stay as detail text. */
export function shortGpuName(name: string) {
  return name.replace(/^NVIDIA\s+(GeForce\s+)?/i, "").replace(/\s+GPU$/i, "").trim() || name;
}

function executableName(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

/** Keep the executable short but preserve the script and arguments after it. */
export function shortCommand(command: string, fallback: string) {
  const trimmed = command.trim();
  if (!trimmed) return fallback;
  const space = trimmed.indexOf(" ");
  if (space === -1) return executableName(trimmed) || fallback;
  return `${executableName(trimmed.slice(0, space))} ${trimmed.slice(space + 1)}`.trim();
}

export function parseProcessesResponse(data: unknown): ProcessesResult {
  if (!data || typeof data !== "object") {
    return { ok: false, code: "unknown", message: "中转返回的数据不完整。" };
  }
  const item = data as Record<string, unknown>;
  if (item.ok !== true) {
    const codes: TestCode[] = ["ok", "timeout", "refused", "auth", "dns", "ssh_missing", "unknown"];
    const code = typeof item.code === "string" && codes.includes(item.code as TestCode) ? (item.code as TestCode) : "unknown";
    return { ok: false, code, message: typeof item.message === "string" ? item.message : "无法读取进程列表。" };
  }
  const raw = (item.processes ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    processes: {
      gpus: Array.isArray(raw.gpus)
        ? raw.gpus
            .filter(
              (entry): entry is Record<string, unknown> =>
                !!entry &&
                typeof entry === "object" &&
                (numeric((entry as Record<string, unknown>).index) != null ||
                  Array.isArray((entry as Record<string, unknown>).processes)),
            )
            .map((entry) => ({
              index: numeric(entry.index),
              name: typeof entry.name === "string" ? entry.name : "",
              memoryUsed: numeric(entry.memoryUsed),
              memoryTotal: numeric(entry.memoryTotal),
              processes: Array.isArray(entry.processes)
                ? entry.processes
                    .filter(
                      (row): row is Record<string, unknown> =>
                        !!row &&
                        typeof row === "object" &&
                        numeric((row as Record<string, unknown>).pid) != null &&
                        typeof (row as Record<string, unknown>).name === "string",
                    )
                    .map((row) => ({
                      pid: numeric(row.pid) ?? 0,
                      name: typeof row.name === "string" ? row.name : "",
                      command: typeof row.command === "string" ? row.command : "",
                      user: typeof row.user === "string" ? row.user : "",
                      elapsed: typeof row.elapsed === "string" ? row.elapsed : "",
                      memoryUsed: numeric(row.memoryUsed),
                      memoryPercent: numeric(row.memoryPercent),
                    }))
                : [],
            }))
        : [],
      collectedAt: typeof raw.collectedAt === "number" ? raw.collectedAt : Date.now(),
    },
  };
}

export function describeTestCode(code: TestCode): string {
  switch (code) {
    case "ok":
      return "在线";
    case "timeout":
      return "连接超时";
    case "refused":
      return "端口拒绝连接";
    case "auth":
      return "认证失败";
    case "dns":
      return "主机不存在";
    case "ssh_missing":
      return "电脑上找不到 ssh";
    default:
      return "连接失败";
  }
}
