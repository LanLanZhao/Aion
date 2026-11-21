import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { Sparkline } from "@/components/research/sparkline";
import { useServerStatus } from "@/components/research/use-server-status";
import { Stack, useLocalSearchParams } from "expo-router";
import { Clock, Cpu, HardDrive, MemoryStick, RefreshCw } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
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

function bytesToGb(value: number | null | undefined) {
  return value == null ? "--" : (value / 1024 ** 3).toFixed(1);
}

function mbToGb(value: number | null) {
  return value == null ? "--" : (value / 1024).toFixed(1);
}

function barWidth(percent: number | null) {
  return `${Math.max(0, Math.min(100, percent ?? 0))}%` as const;
}

function Metric({
  icon,
  label,
  value,
  detail,
  percent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  percent: number | null;
}) {
  const color = barColor(percent);
  return (
    <View className="border-b border-border py-3.5">
      <View className="flex-row items-center gap-3">
        <Icon icon={icon} className="h-5 w-5 text-muted-foreground" />
        <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
        <Text numberOfLines={1} className="text-[17px] font-semibold text-foreground">{value}</Text>
      </View>
      {percent == null ? null : (
        <>
          <View className="ml-8 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <View className="h-full rounded-full" style={{ width: barWidth(percent), backgroundColor: color }} />
          </View>
          <Text className="ml-8 mt-1 text-[12px] text-muted-foreground">{detail}</Text>
        </>
      )}
    </View>
  );
}

export default function ServerStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { servers, ready } = useResearch();
  const { t } = usePreferences();
  const server = servers.find((item) => item.id === id);
  const { status, error, loading, refreshing, history, refresh } = useServerStatus(server?.id);

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

  const cpuPercent = status?.cpu.usagePercent ?? null;
  const loadText = status?.load.length ? status.load.map((value) => value.toFixed(2)).join(" / ") : "--";

  return (
    <>
      <Stack.Screen
        options={{
          title: t("GPU & system status"),
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={MUTED} />
        }
      >

        {error ? (
          <View className="mt-3 rounded-[22px] bg-card px-5 py-4">
            <Text className="text-[14px] leading-5 text-red-500">{t(error)}</Text>
            <Pressable onPress={refresh} accessibilityRole="button" className="mt-2 flex-row items-center gap-1.5 self-start active:opacity-60">
              <Icon icon={RefreshCw} className="h-4 w-4 text-foreground" />
              <Text className="text-[14px] font-medium text-foreground">{t("Retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!status && loading ? (
          <View className="mt-3 items-center rounded-[22px] bg-card py-12">
            <ActivityIndicator color={MUTED} />
            <Text className="mt-3 text-[14px] text-muted-foreground">{t("Reading status…")}</Text>
          </View>
        ) : null}

        {status ? (
          <View className="mt-1 flex-row items-center justify-between px-1">
            <Text className="text-[12px] text-muted-foreground">
              {`${t("Updated")} ${new Date(status.collectedAt).toLocaleTimeString()}`}
            </Text>
            <Text className="text-[12px] text-muted-foreground">{`${t("Every")} 5s`}</Text>
          </View>
        ) : null}

        {status?.gpus.map((gpu) => {
          const color = barColor(gpu.utilization);
          const key = String(gpu.index ?? gpu.name);
          return (
            <View key={key} className="mt-3 rounded-[22px] bg-card p-5">
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="mr-3 flex-1 text-[15px] font-semibold text-foreground">{gpu.name}</Text>
                <Text className="text-[12px] text-muted-foreground">GPU {gpu.index ?? "-"}</Text>
              </View>
              <View className="mt-2 flex-row items-end">
                <Text className="text-[38px] font-semibold leading-[44px]" style={{ color }}>{gpu.utilization ?? "--"}</Text>
                <Text className="mb-1.5 ml-1 text-[16px] text-muted-foreground">%</Text>
                <View className="flex-1" />
                <Text className="mb-1.5 text-[12px] text-muted-foreground">
                  {t("VRAM")} {mbToGb(gpu.memoryUsed)} / {mbToGb(gpu.memoryTotal)} GB
                </Text>
              </View>
              <View className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <View className="h-full rounded-full" style={{ width: barWidth(gpu.utilization), backgroundColor: color }} />
              </View>
              <View className="mt-2">
                <Sparkline data={history.gpu[key] ?? []} color={color} />
              </View>
              <View className="mt-2 flex-row">
                <View className="flex-1 pr-2">
                  <Text className="text-[12px] text-muted-foreground">{t("Temperature")}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[15px] font-medium text-foreground">
                    {gpu.temperature == null ? "--" : `${gpu.temperature}°C`}
                  </Text>
                </View>
                <View className="flex-1 pr-2">
                  <Text className="text-[12px] text-muted-foreground">{t("Power")}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[15px] font-medium text-foreground">
                    {gpu.power == null ? "--" : `${Math.round(gpu.power)}${gpu.powerLimit ? `/${Math.round(gpu.powerLimit)}` : ""} W`}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[12px] text-muted-foreground">{t("VRAM")}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-[15px] font-medium text-foreground">
                    {gpu.memoryPercent == null ? "--" : `${Math.round(gpu.memoryPercent)}%`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {status ? (
          <>
            <Text className="mb-2 mt-6 px-1 text-[14px] text-muted-foreground">{t("System status")}</Text>
            <View className="overflow-hidden rounded-[22px] bg-card px-5">
              <Metric
                icon={Cpu}
                label={t("CPU")}
                value={cpuPercent == null ? "--" : `${Math.round(cpuPercent)}%`}
                detail={`${status.cores ?? status.cpu.cores ?? "--"} ${t("cores")} · load ${loadText}`}
                percent={cpuPercent}
              />
              <Metric
                icon={MemoryStick}
                label={t("RAM")}
                value={status.memory?.percent == null ? "--" : `${Math.round(status.memory.percent)}%`}
                detail={
                  status.memory
                    ? `${bytesToGb(status.memory.used)} / ${bytesToGb(status.memory.total)} GB`
                    : t("Unavailable")
                }
                percent={status.memory?.percent ?? null}
              />
              {status.disks.map((disk) => (
                <Metric
                  key={disk.mount}
                  icon={HardDrive}
                  label={`${t("Disk")} ${disk.mount}`}
                  value={disk.percent == null ? "--" : `${Math.round(disk.percent)}%`}
                  detail={`${bytesToGb(disk.used)} / ${bytesToGb(disk.total)} GB`}
                  percent={disk.percent}
                />
              ))}
              <View className="py-3.5">
                <View className="flex-row items-center gap-3">
                  <Icon icon={Clock} className="h-5 w-5 text-muted-foreground" />
                  <Text className="text-[15px] text-foreground">{t("Uptime")}</Text>
                  <Text numberOfLines={2} className="ml-auto max-w-[58%] text-right text-[13px] leading-5 text-muted-foreground">
                    {status.uptime || "--"}
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
