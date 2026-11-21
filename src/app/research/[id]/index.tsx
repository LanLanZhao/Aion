import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { useServerStatus } from "@/components/research/use-server-status";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Activity, Boxes, ChevronDown, ChevronUp, FolderOpen, RefreshCw, Server, SquareTerminal } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

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

type Tool = {
  icon: LucideIcon;
  label: string;
  detail: string;
  onPress: () => void;
};

export default function ServerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { servers, ready } = useResearch();
  const { t } = usePreferences();
  const router = useRouter();

  const server = servers.find((item) => item.id === id);
  const { status, error, loading, refreshing, refresh } = useServerStatus(server?.id, { poll: false });
  const [expandedGpus, setExpandedGpus] = useState(false);

  const openStatus = () => {
    if (!server) return;
    router.push({ pathname: "/research/[id]/status", params: { id: server.id } } as unknown as Href);
  };

  const openProcesses = () => {
    if (!server) return;
    router.push({ pathname: "/research/[id]/processes", params: { id: server.id } } as unknown as Href);
  };

  const comingSoon = () => {
    Alert.alert(t("Coming soon"), t("This tool will be added in a later version."));
  };

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

  const tools: Tool[] = [
    { icon: Activity, label: "GPU & system status", detail: "Watch live GPU and system usage.", onPress: openStatus },
    { icon: SquareTerminal, label: "Python environment", detail: "Choose conda environments and install packages.", onPress: comingSoon },
    { icon: Boxes, label: "GPU processes", detail: "See which process is using VRAM.", onPress: openProcesses },
    { icon: FolderOpen, label: "Files", detail: "Browse experiment folders.", onPress: comingSoon },
  ];

  return (
    <>
      <Stack.Screen options={{ title: server.name }} />
      <ScrollView
        className="flex-1 bg-muted"
        contentContainerClassName="px-4 py-5 pb-safe"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={MUTED} />
        }
      >
        <View className="rounded-[22px] bg-card px-5 py-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icon icon={Server} className="h-6 w-6 text-foreground" />
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-[20px] font-semibold text-foreground">{server.name}</Text>
              <Text numberOfLines={1} className="mt-0.5 text-[13px] text-muted-foreground">
                {server.user}@{server.host}:{server.port}
              </Text>
            </View>
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel={t("Refresh")}
              className="h-10 w-10 items-center justify-center rounded-full bg-muted active:opacity-60"
            >
              {refreshing ? <ActivityIndicator size="small" color={MUTED} /> : <Icon icon={RefreshCw} className="h-5 w-5 text-foreground" />}
            </Pressable>
          </View>

          {!status && loading ? (
            <Text className="mt-4 text-[12px] text-muted-foreground">{t("Reading status…")}</Text>
          ) : null}

          {status ? (
            status.gpus.length === 0 ? (
              <Text className="mt-4 text-[12px] leading-4 text-muted-foreground">{t("No NVIDIA GPU detected")}</Text>
            ) : (
              <>
                {(expandedGpus ? status.gpus : status.gpus.slice(0, 2)).map((gpu) => {
                  const color = barColor(gpu.utilization);
                  return (
                    <Pressable
                      key={String(gpu.index ?? gpu.name)}
                      onPress={openStatus}
                      accessibilityRole="button"
                      accessibilityLabel={`GPU ${gpu.index ?? ""} ${gpu.utilization ?? ""}%`}
                      className="mt-3.5 active:opacity-70"
                    >
                      <View className="flex-row items-center">
                        <Text className="w-14 text-[12px] text-muted-foreground">GPU {gpu.index ?? "-"}</Text>
                        <Text className="ml-1 text-[17px] font-semibold" style={{ color }}>{gpu.utilization ?? "--"}</Text>
                        <Text className="ml-0.5 text-[12px] text-muted-foreground">%</Text>
                        <View className="flex-1" />
                        <Text numberOfLines={1} className="text-[11px] text-muted-foreground">
                          {t("VRAM")} {mbToGb(gpu.memoryUsed)}/{mbToGb(gpu.memoryTotal)}G · {gpu.temperature == null ? "--" : `${gpu.temperature}°C`} · {gpu.power == null ? "--" : `${Math.round(gpu.power)}W`}
                        </Text>
                      </View>
                      <View className="ml-14 mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                        <View className="h-full rounded-full" style={{ width: barWidth(gpu.utilization), backgroundColor: color }} />
                      </View>
                    </Pressable>
                  );
                })}
                {status.gpus.length > 2 ? (
                  <Pressable
                    onPress={() => setExpandedGpus((value) => !value)}
                    accessibilityRole="button"
                    className="ml-14 mt-2 flex-row items-center gap-1 active:opacity-60"
                  >
                    <Text className="text-[12px] text-muted-foreground">
                      {expandedGpus ? t("Show less") : `${t("Show all")} ${status.gpus.length}`}
                    </Text>
                    <Icon icon={expandedGpus ? ChevronUp : ChevronDown} className="h-3.5 w-3.5 text-muted-foreground" />
                  </Pressable>
                ) : null}
              </>
            )
          ) : null}

          {status ? (
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-[12px] text-muted-foreground">
                {`${t("Updated")} ${new Date(status.collectedAt).toLocaleTimeString()}`}
              </Text>
              <Text className="text-[12px] text-muted-foreground">{status.host}</Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View className="mt-3 rounded-[22px] bg-card px-5 py-4">
            <Text className="text-[14px] leading-5 text-red-500">{t(error)}</Text>
            <Pressable onPress={refresh} accessibilityRole="button" className="mt-2 flex-row items-center gap-1.5 self-start active:opacity-60">
              <Icon icon={RefreshCw} className="h-4 w-4 text-foreground" />
              <Text className="text-[14px] font-medium text-foreground">{t("Retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        <Text className="mb-2 mt-6 px-1 text-[14px] text-muted-foreground">{t("Tools")}</Text>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {tools.map((tool) => (
            <Pressable
              key={tool.label}
              onPress={tool.onPress}
              accessibilityRole="button"
              className="w-[48.5%] rounded-[20px] bg-card p-4 active:bg-secondary"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Icon icon={tool.icon} className="h-5 w-5 text-foreground" />
              </View>
              <Text className="mt-3 text-[15px] font-medium text-foreground">{t(tool.label)}</Text>
              <Text className="mt-1 text-[12px] leading-4 text-muted-foreground">{t(tool.detail)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
