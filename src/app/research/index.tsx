import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { useDrawer } from "@/components/drawer-content";
import { describeTestCode, type ServerSummary } from "@/components/research/research-model";
import { Stack, useRouter, type Href } from "expo-router";
import { ArrowLeft, Cable, FlaskConical, Pencil, Plus, RefreshCw, Server, Trash2 } from "lucide-react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, ActivityIndicator } from "react-native";

const GREEN = "#34C759";
const RED = "#FF3B30";
const MUTED = "#8E8E93";

export default function ResearchScreen() {
  const { t } = usePreferences();
  const { relay, servers, ready, loading, error, statuses, refresh, testServer, deleteServer } = useResearch();
  const router = useRouter();
  const { openDrawerImmediately } = useDrawer();
  const [testingId, setTestingId] = useState<string | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/" as Href);
    // Restore the drawer only after the pop commits.
    requestAnimationFrame(() => requestAnimationFrame(() => openDrawerImmediately()));
  };

  const openNew = () => {
    router.push("/research/new" as Href);
  };
  const openRelay = () => {
    router.push("/research/relay" as Href);
  };
  const openEdit = (server: ServerSummary) => {
    router.push({ pathname: "/research/[id]/edit", params: { id: server.id } } as unknown as Href);
  };
  const openDetail = (server: ServerSummary) => {
    router.push({ pathname: "/research/[id]", params: { id: server.id } } as unknown as Href);
  };

  const runTest = async (id: string) => {
    if (testingId) return;
    setTestingId(id);
    try {
      await testServer(id);
    } catch (cause) {
      Alert.alert(t("Unable to test connection"), t(cause instanceof Error ? cause.message : "请稍后重试。"));
    } finally {
      setTestingId(null);
    }
  };

  const confirmDelete = (server: ServerSummary) => {
    Alert.alert(t("Delete server"), t("This server will be removed from the relay. Your SSH config is not changed."), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: () => {
          void deleteServer(server.id).catch((cause) =>
            Alert.alert(t("Unable to delete server"), t(cause instanceof Error ? cause.message : "请稍后重试。")),
          );
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t("Research"),
          headerLeft: () => (
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t("Go back")} className="mr-3 h-11 w-11 items-center justify-center active:opacity-60">
              <Icon icon={ArrowLeft} className="h-6 w-6 text-foreground" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => { void openNew(); }} accessibilityRole="button" accessibilityLabel={t("Add server")} className="h-11 w-11 items-center justify-center active:opacity-60">
              <Icon icon={Plus} className="h-6 w-6 text-foreground" />
            </Pressable>
          ),
        }}
      />

      {ready && !relay ? (
        <View className="flex-1 items-center justify-center bg-muted px-7 pb-20">
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-card">
            <Icon icon={FlaskConical} className="h-8 w-8 text-foreground" />
          </View>
          <Text className="text-center text-[19px] font-semibold text-foreground">{t("Connect a relay first")}</Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-muted-foreground">
            {t("The relay runs on your computer and reaches the servers over SSH.")}
          </Text>
          <Pressable onPress={() => { void openRelay(); }} accessibilityRole="button" className="mt-6 flex-row items-center gap-2 rounded-full bg-card px-5 py-3 active:bg-secondary">
            <Icon icon={Cable} className="h-5 w-5 text-foreground" />
            <Text className="text-[16px] font-medium text-foreground">{t("Configure relay")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1 bg-muted"
          contentContainerClassName="px-4 py-5 pb-safe"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => { void refresh(); }}
              tintColor={MUTED}
            />
          }
        >
          {error ? (
            <View className="mb-3 rounded-[22px] bg-card px-5 py-4">
              <Text className="text-[14px] leading-5 text-red-500">{t(error)}</Text>
              <Pressable onPress={() => { void refresh(); }} accessibilityRole="button" className="mt-2 flex-row items-center gap-1.5 self-start active:opacity-60">
                <Icon icon={RefreshCw} className="h-4 w-4 text-foreground" />
                <Text className="text-[14px] font-medium text-foreground">{t("Retry")}</Text>
              </Pressable>
            </View>
          ) : null}

          {ready && relay && servers.length === 0 ? (
            <View className="items-center px-6 py-16">
              <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-card">
                <Icon icon={Server} className="h-8 w-8 text-foreground" />
              </View>
              <Text className="text-center text-[19px] font-semibold text-foreground">{t("Add your first server")}</Text>
              <Text className="mt-2 text-center text-[15px] leading-6 text-muted-foreground">
                {t("Save an SSH host, then test the connection here.")}
              </Text>
              <Pressable onPress={() => { void openNew(); }} accessibilityRole="button" className="mt-6 flex-row items-center gap-2 rounded-full bg-card px-5 py-3 active:bg-secondary">
                <Icon icon={Plus} className="h-5 w-5 text-foreground" />
                <Text className="text-[16px] font-medium text-foreground">{t("Add server")}</Text>
              </Pressable>
            </View>
          ) : (
            servers.map((server) => {
              const result = statuses[server.id];
              const testing = testingId === server.id;
              const label = testing
                ? t("Testing…")
                : !result
                  ? t("Not tested")
                  : result.ok
                    ? `${t("Online")} · ${result.latencyMs}ms`
                    : t(describeTestCode(result.code));
              const color = testing ? MUTED : !result ? MUTED : result.ok ? GREEN : RED;
              return (
                <ReanimatedSwipeable
                  key={server.id}
                  friction={2}
                  rightThreshold={36}
                  overshootRight={false}
                  renderRightActions={(_progress, _translation, methods) => (
                    <View className="mb-3 flex-row items-stretch gap-2 pl-2">
                      <Pressable
                        onPress={() => { methods.close(); void openEdit(server); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("Edit")} ${server.name}`}
                        className="w-20 items-center justify-center gap-1 rounded-[22px] bg-secondary active:opacity-70"
                      >
                        <Icon icon={Pencil} className="h-5 w-5 text-foreground" />
                        <Text className="text-[13px] text-foreground">{t("Edit")}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { methods.close(); confirmDelete(server); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("Delete")} ${server.name}`}
                        className="w-20 items-center justify-center gap-1 rounded-[22px] bg-red-500 active:opacity-70"
                      >
                        <Icon icon={Trash2} className="h-5 w-5 text-white" />
                        <Text className="text-[13px] text-white">{t("Delete")}</Text>
                      </Pressable>
                    </View>
                  )}
                >
                  <Pressable
                    onPress={() => { void openDetail(server); }}
                    onLongPress={() => confirmDelete(server)}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={`${server.name} ${server.user}@${server.host}`}
                    className="mb-3 rounded-[22px] bg-card px-5 py-4 active:bg-secondary"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <Icon icon={Server} className="h-5 w-5 text-foreground" />
                      </View>
                      <Text numberOfLines={1} className="flex-1 text-[17px] font-medium text-foreground">{server.name}</Text>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          void runTest(server.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t("Test connection")} ${server.name}`}
                        className="flex-row items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1.5 active:opacity-60"
                      >
                        {testing ? (
                          <ActivityIndicator size="small" color={MUTED} />
                        ) : (
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
                        )}
                        <Text numberOfLines={1} className="text-[13px]" style={{ color }}>
                          {label}
                        </Text>
                      </Pressable>
                    </View>
                    <Text numberOfLines={1} className="mt-2 pl-14 text-[13px] text-muted-foreground">
                      {server.user}@{server.host}:{server.port}
                    </Text>
                  </Pressable>
                </ReanimatedSwipeable>
              );
            })
          )}

          {servers.length ? (
            <Text className="mt-1 px-2 text-center text-[13px] text-muted-foreground">
              {t("Tap the card to open, tap the status to test, swipe left for more.")}
            </Text>
          ) : null}

          {relay ? (
            <View className="mt-5 flex-row items-center gap-3 rounded-[22px] bg-card px-5 py-4">
              <Icon icon={Cable} className="h-5 w-5 text-muted-foreground" />
              <View className="flex-1">
                <Text className="text-[13px] text-muted-foreground">{t("Relay")}</Text>
                <Text numberOfLines={1} className="mt-0.5 text-[15px] text-foreground">{relay.baseUrl}</Text>
              </View>
              <Pressable onPress={() => { void openRelay(); }} accessibilityRole="button" className="h-9 items-center justify-center rounded-full px-3 active:bg-muted">
                <Text className="text-[14px] font-medium text-foreground">{t("Manage")}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </>
  );
}
