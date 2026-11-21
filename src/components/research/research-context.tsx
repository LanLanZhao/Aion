import { File, Paths } from "expo-file-system";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  describeTestCode,
  parseRelayConfig,
  parseProcessesResponse,
  parseServersResponse,
  parseStatusResponse,
  parseTestResult,
  validateRelayConfig,
  validateServerDraft,
  type RelayConfig,
  type ProcessesSnapshot,
  type ServerDraft,
  type ServerStatus,
  type ServerSummary,
  type TestResult,
} from "./research-model";

const STORAGE_FILE = "quest-research.json";
const WEB_KEY = "quest-research-v1";
const REQUEST_TIMEOUT_MS = 15000;

type ResearchContextValue = {
  relay: RelayConfig | null;
  servers: ServerSummary[];
  ready: boolean;
  loading: boolean;
  error: string | null;
  statuses: Record<string, TestResult>;
  saveRelay: (baseUrl: string, token: string) => Promise<void>;
  disconnectRelay: () => Promise<void>;
  refresh: () => Promise<void>;
  addServer: (draft: ServerDraft) => Promise<ServerSummary>;
  updateServer: (id: string, draft: ServerDraft) => Promise<ServerSummary>;
  deleteServer: (id: string) => Promise<void>;
  testServer: (id: string) => Promise<TestResult>;
  getStatus: (id: string) => Promise<ServerStatus>;
  getProcesses: (id: string) => Promise<ProcessesSnapshot>;
  loadSshHosts: () => Promise<string[]>;
};

const Context = createContext<ResearchContextValue | null>(null);

async function readRelay(): Promise<RelayConfig | null> {
  if (process.env.EXPO_OS === "web") {
    if (typeof window === "undefined") return null;
    return parseRelayConfig(window.localStorage.getItem(WEB_KEY));
  }
  const file = new File(Paths.document, STORAGE_FILE);
  return parseRelayConfig(file.exists ? await file.text() : null);
}

async function writeRelay(relay: RelayConfig | null) {
  const serialized = relay ? JSON.stringify(relay) : "";
  if (process.env.EXPO_OS === "web") {
    if (typeof window === "undefined") return;
    if (relay) window.localStorage.setItem(WEB_KEY, serialized);
    else window.localStorage.removeItem(WEB_KEY);
    return;
  }
  const file = new File(Paths.document, STORAGE_FILE);
  if (!relay) {
    if (file.exists) file.delete();
    return;
  }
  file.write(serialized);
}

function requestError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (error.name === "AbortError" || message.includes("canceled") || message.includes("aborted")) {
      return new Error("中转响应超时，请确认电脑和手机在同一网络。");
    }
    if (error instanceof TypeError || message.includes("network request failed")) {
      return new Error("无法连接中转，请确认地址和电脑上的 relay 正在运行。");
    }
    return error;
  }
  return new Error("无法连接中转。");
}

async function relayRequest<T>(relay: RelayConfig, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${relay.baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${relay.token}`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    if (response.status === 401) throw new Error("Token 不正确。");
    if (!response.ok) {
      let message = `中转返回 ${response.status}。`;
      try {
        const body: unknown = await response.json();
        const detail = (body as { message?: unknown } | null)?.message;
        if (typeof detail === "string" && detail) message = detail;
      } catch {
        // Keep the status message when the body is not JSON.
      }
      throw new Error(message);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    throw requestError(error);
  } finally {
    clearTimeout(timer);
  }
}

export function ResearchProvider({ children }: { children: ReactNode }) {
  const [relay, setRelay] = useState<RelayConfig | null>(null);
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TestResult>>({});
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const relayRef = useRef<RelayConfig | null>(null);
  const mounted = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const refreshWith = useCallback(async (config: RelayConfig) => {
    setLoading(true);
    setError(null);
    try {
      const data = await relayRequest<unknown>(config, "/servers");
      const list = parseServersResponse(data);
      if (mounted.current) setServers(list);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "无法连接中转。");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const saved = await readRelay();
        if (!mounted.current) return;
        relayRef.current = saved;
        setRelay(saved);
        setReady(true);
        if (saved) await refreshWith(saved);
      } catch {
        if (mounted.current) {
          setReady(true);
          setError("无法读取中转设置。");
        }
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [refreshWith]);

  const refresh = useCallback(async () => {
    const config = relayRef.current;
    if (!config) return;
    await refreshWith(config);
  }, [refreshWith]);

  const saveRelay = useCallback(async (baseUrl: string, token: string) => {
    const config = validateRelayConfig(baseUrl, token);
    await relayRequest<{ ok: boolean }>(config, "/health");
    const operation = queue.current.then(async () => {
      await writeRelay(config);
      relayRef.current = config;
      if (mounted.current) {
        setRelay(config);
        setError(null);
      }
      await refreshWith(config);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [refreshWith]);

  const disconnectRelay = useCallback(async () => {
    const operation = queue.current.then(async () => {
      await writeRelay(null);
      relayRef.current = null;
      if (mounted.current) {
        setRelay(null);
        setServers([]);
        setStatuses({});
        setError(null);
      }
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, []);

  const addServer = useCallback(async (draft: ServerDraft) => {
    const config = relayRef.current;
    if (!config) throw new Error("请先配置中转。");
    const payload = validateServerDraft(draft);
    const data = await relayRequest<{ server: unknown }>(config, "/servers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const [server] = parseServersResponse({ servers: [data.server] });
    if (!server) throw new Error("中转返回的服务器数据不完整。");
    if (mounted.current) {
      setError(null);
      setServers((previous) => [server, ...previous.filter((item) => item.id !== server.id)]);
    }
    return server;
  }, []);

  const updateServer = useCallback(async (id: string, draft: ServerDraft) => {
    const config = relayRef.current;
    if (!config) throw new Error("请先配置中转。");
    const payload = validateServerDraft(draft);
    const data = await relayRequest<{ server: unknown }>(config, `/servers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const [server] = parseServersResponse({ servers: [data.server] });
    if (!server) throw new Error("中转返回的服务器数据不完整。");
    if (mounted.current) {
      setError(null);
      setServers((previous) => previous.map((item) => (item.id === id ? server : item)));
      setStatuses((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    }
    return server;
  }, []);

  const deleteServer = useCallback(async (id: string) => {
    const config = relayRef.current;
    if (!config) throw new Error("请先配置中转。");
    await relayRequest<void>(config, `/servers/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (mounted.current) {
      setError(null);
      setServers((previous) => previous.filter((item) => item.id !== id));
      setStatuses((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    }
  }, []);

  const testServer = useCallback(async (id: string) => {
    const config = relayRef.current;
    if (!config) throw new Error("请先配置中转。");
    const result = parseTestResult(await relayRequest<unknown>(config, `/servers/${encodeURIComponent(id)}/test`, { method: "POST" }));
    if (mounted.current) {
      setError(null);
      setStatuses((previous) => ({ ...previous, [id]: result }));
    }
    return result;
  }, []);

  const getStatus = useCallback(async (id: string) => {
    const config = relayRef.current;
    if (!config) throw new Error("请先配置中转。");
    const result = parseStatusResponse(await relayRequest<unknown>(config, `/servers/${encodeURIComponent(id)}/status`));
    if (!result.ok) throw new Error(result.message || describeTestCode(result.code));
    if (mounted.current) setError(null);
    return result.status;
  }, []);

  const getProcesses = useCallback(async (id: string) => {
    const config = relayRef.current;
    if (!config) throw new Error("请先配置中转。");
    const result = parseProcessesResponse(await relayRequest<unknown>(config, `/servers/${encodeURIComponent(id)}/processes`));
    if (!result.ok) throw new Error(result.message || describeTestCode(result.code));
    if (mounted.current) setError(null);
    return result.processes;
  }, []);

  const loadSshHosts = useCallback(async () => {
    const config = relayRef.current;
    if (!config) return [];
    const data = await relayRequest<{ hosts?: unknown }>(config, "/ssh-hosts");
    return Array.isArray(data?.hosts) ? data.hosts.filter((host): host is string => typeof host === "string") : [];
  }, []);

  const value: ResearchContextValue = {
    relay,
    servers,
    ready,
    loading,
    error,
    statuses,
    saveRelay,
    disconnectRelay,
    refresh,
    addServer,
    updateServer,
    deleteServer,
    testServer,
    getStatus,
    getProcesses,
    loadSshHosts,
  };

  return <Context value={value}>{children}</Context>;
}

export function useResearch() {
  const context = use(Context);
  if (!context) throw new Error("useResearch must be used within ResearchProvider");
  return context;
}
