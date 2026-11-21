import { useResearch } from "@/components/research/research-context";
import type { ServerStatus } from "@/components/research/research-model";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";

const POLL_MS = 5000;

export function useServerStatus(serverId: string | undefined, options: { poll?: boolean } = {}) {
  const poll = options.poll ?? true;
  const { getStatus } = useResearch();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<{ cpu: number[]; gpu: Record<string, number[]> }>({ cpu: [], gpu: {} });
  const busy = useRef(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async (manual: boolean) => {
    if (!serverId || busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await getStatus(serverId);
      loadedOnce.current = true;
      setStatus(next);
      setError(null);
      setHistory((previous) => {
        const cpu = next.cpu.usagePercent == null ? previous.cpu : [...previous.cpu, next.cpu.usagePercent].slice(-30);
        const gpu = { ...previous.gpu };
        for (const item of next.gpus) {
          if (item.utilization == null) continue;
          const key = String(item.index ?? item.name);
          gpu[key] = [...(gpu[key] ?? []), item.utilization].slice(-30);
        }
        return { cpu, gpu };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取服务器状态。");
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId, getStatus]);

  useFocusEffect(
    useCallback(() => {
      if (!serverId) return;
      // Without polling, keep the last snapshot and refresh only on demand.
      if (!poll && loadedOnce.current) return;
      let active = true;
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (timer === null && active) void load(false);
        if (!poll || timer !== null) return;
        timer = setInterval(() => {
          if (active) void load(false);
        }, POLL_MS);
      };
      const stop = () => {
        if (timer === null) return;
        clearInterval(timer);
        timer = null;
      };
      if (AppState.currentState === "active") start();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") start();
        else stop();
      });
      return () => {
        active = false;
        stop();
        subscription.remove();
      };
    }, [serverId, load, poll]),
  );

  return {
    status,
    error,
    loading,
    refreshing,
    history,
    refresh: () => { void load(true); },
  };
}
