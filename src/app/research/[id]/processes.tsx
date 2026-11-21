import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { shortCommand, shortGpuName } from "@/components/research/research-model";
import { useServerProcesses } from "@/components/research/use-server-processes";
import { Stack, useLocalSearchParams } from "expo-router";
import { Boxes, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

const GREEN = "#34C759";
const ORANGE = "#FF9F0A";
const RED = "#FF3B30";
const MUTED = "#8E8E93";

function barColor(percent: number | null) {
  if (percent == null) return MUTED;
  if (percent < 60) return GREEN;
  if (percent < 85) return ORANGE;
  return RED;
}

function barWidth(percent: number | null) {
  return `${Math.max(0, Math.min(100, percent ?? 0))}%` as const;
}

function mbToGb(value: number | null) {
  return value == null ? "--" : (value / 1024).toFixed(1);
}

export default function ServerProcessesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { servers, ready } = useResearch();
  const { t } = usePreferences();
  const server = servers.find((item) => item.id === id);
  const { snapshot, error, loading, refreshing, refresh } = useServerProcesses(server?.id);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-muted">
        <ActivityIndicator color={MUTED} />
      </View>
    );
  }

  if (!server) {
    return (
      <View className="flex-1 items-center justify-center bg-muted px-8">
        <Text className="text-center text-[17px] text-muted-foreground">{t("Server not found")}</Text>
      </View>
    );
  }

  const gpus = snapshot?.gpus ?? [];
  const total = gpus.reduce((sum, gpu) => sum + gpu.processes.length, 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: t("GPU processes"),
          headerRight: () => (
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel={t("Refresh")}
              className="h-10 w-10 items-center justify-center active:opacity-60"
            >
              {refreshing ? <ActivityIndicator size="small" color={MUTED} /> : <Icon icon={RefreshCw} className="h-5 w-5 text-foreground" />}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-muted"
        contentContainerClassName="px-4 pt-1 pb-safe"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={MUTED} />}
      >
        <View className="flex-row items-center justify-between px-1 pb-2 pt-1">
          <Text className="text-[12px] text-muted-foreground">{t("Live GPU processes")}</Text>
          <Text className="text-[12px] text-muted-foreground">
            {snapshot ? `${total} ${t("processes")} · ${t("Every 5 seconds")}` : t("Reading…")}
          </Text>
        </View>

        {error ? (
          <View className="mb-3 rounded-[22px] bg-card px-5 py-4">
            <Text className="text-[14px] leading-5 text-red-500">{t(error)}</Text>
            <Pressable onPress={refresh} accessibilityRole="button" className="mt-2 flex-row items-center gap-1.5 self-start active:opacity-60">
              <Icon icon={RefreshCw} className="h-4 w-4 text-foreground" />
              <Text className="text-[14px] font-medium text-foreground">{t("Retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!snapshot && loading ? (
          <View className="mt-10 items-center">
            <ActivityIndicator color={MUTED} />
            <Text className="mt-3 text-[13px] text-muted-foreground">{t("Reading processes…")}</Text>
          </View>
        ) : null}

        {snapshot && gpus.length === 0 ? (
          <View className="mt-8 items-center rounded-[22px] bg-card px-6 py-10">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icon icon={Boxes} className="h-6 w-6 text-muted-foreground" />
            </View>
            <Text className="mt-3 text-[16px] font-medium text-foreground">{t("No GPU processes")}</Text>
            <Text className="mt-1 text-center text-[12px] leading-4 text-muted-foreground">
              {t("nvidia-smi returned no processes. Start a training job to see it here.")}
            </Text>
          </View>
        ) : null}

        {gpus.map((gpu) => {
          const memoryPercent = gpu.memoryUsed != null && gpu.memoryTotal ? (gpu.memoryUsed / gpu.memoryTotal) * 100 : null;
          const color = barColor(memoryPercent);
          return (
            <View key={`${gpu.index ?? "unknown"}-${gpu.name}`} className="mb-3 rounded-[22px] bg-card px-4 py-3.5">
              <View className="flex-row items-center gap-2">
                <View className="rounded-full bg-muted px-2 py-0.5">
                  <Text className="text-[10px] font-semibold tracking-wide text-foreground">GPU {gpu.index ?? "?"}</Text>
                </View>
                <Text numberOfLines={1} className="flex-1 text-[12px] text-muted-foreground">
                  {gpu.name ? shortGpuName(gpu.name) : t("Unknown GPU")}
                </Text>
                <Text className="text-[12px] text-muted-foreground">
                  {mbToGb(gpu.memoryUsed)} / {mbToGb(gpu.memoryTotal)} G
                </Text>
              </View>

              <View className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
                <View className="h-full rounded-full" style={{ width: barWidth(memoryPercent), backgroundColor: color }} />
              </View>

              {gpu.processes.length === 0 ? (
                <View className="mt-3 flex-row items-center gap-2">
                  <View className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  <Text className="text-[12px] text-muted-foreground">{t("Idle · no process using VRAM")}</Text>
                </View>
              ) : (
                <View className="mt-2.5 gap-2">
                  <Text className="text-[10px] font-medium tracking-wide text-muted-foreground">{t("Processes")}</Text>
                  {gpu.processes.map((process, index) => {
                    const percent = process.memoryPercent;
                    return (
                      <View
                        key={`${process.pid}-${index}`}
                        className="rounded-[14px] bg-muted px-3 py-2.5"
                      >
                        <View className="flex-row items-start gap-2">
                          <View className="flex-1">
                            <Text numberOfLines={1} className="text-[13.5px] font-medium text-foreground">
                              {shortCommand(process.command, process.name)}
                            </Text>
                            <Text numberOfLines={1} className="mt-0.5 text-[11px] text-muted-foreground">
                              PID {process.pid}
                              {process.user ? ` · ${process.user}` : ""}
                              {process.elapsed ? ` · ${process.elapsed}` : ""}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-[13px] font-semibold text-foreground">{mbToGb(process.memoryUsed)} G</Text>
                            <Text className="mt-0.5 text-[11px] text-muted-foreground">
                              {percent == null ? "--" : `${percent.toFixed(0)}%`}
                            </Text>
                          </View>
                        </View>
                        <View className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-card">
                          <View className="h-full rounded-full" style={{ width: barWidth(percent), backgroundColor: barColor(percent) }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {snapshot ? (
          <Text className="px-1 pt-1 text-center text-[11px] leading-4 text-muted-foreground">
            {t("VRAM per process comes from nvidia-smi. A process can appear once per GPU.")}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}
