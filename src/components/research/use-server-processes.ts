import { useResearch } from "@/components/research/research-context";
import type { ProcessesSnapshot } from "@/components/research/research-model";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";

const POLL_MS = 5000;

export function useServerProcesses(serverId: string | undefined) {
  const { getProcesses } = useResearch();
  const [snapshot, setSnapshot] = useState<ProcessesSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  const load = useCallback(async (manual: boolean) => {
    if (!serverId || busy.current) return;
    busy.current = true;
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await getProcesses(serverId);
      setSnapshot(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取进程列表。");
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId, getProcesses]);

  useFocusEffect(
    useCallback(() => {
      if (!serverId) return;
      let active = true;
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (timer) return;
        void load(false);
        timer = setInterval(() => {
          if (active) void load(false);
        }, POLL_MS);
      };
      const stop = () => {
        if (!timer) return;
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
    }, [serverId, load]),
  );

  return {
    snapshot,
    error,
    loading,
    refreshing,
    refresh: () => { void load(true); },
  };
}
