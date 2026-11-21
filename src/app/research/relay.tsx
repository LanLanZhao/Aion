import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { SafeAreaView } from "@/components/tw";
import { useRouter } from "expo-router";
import { Cable, Info, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";

export default function RelaySettingsScreen() {
  const { t } = usePreferences();
  const { relay, saveRelay, disconnectRelay } = useResearch();
  const router = useRouter();
  const goBack = () => {
    Keyboard.dismiss();
    router.back();
  };

  const [baseUrl, setBaseUrl] = useState(relay?.baseUrl ?? "");
  const [token, setToken] = useState(relay?.token ?? "");
  const [busy, setBusy] = useState(false);

  const canSave = Boolean(baseUrl.trim() && token.trim()) && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await saveRelay(baseUrl, token);
      Keyboard.dismiss();
      Alert.alert(t("Relay connected"));
      router.back();
    } catch (cause) {
      Alert.alert(t("Unable to connect relay"), t(cause instanceof Error ? cause.message : "请稍后重试。"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDisconnect = () => {
    Alert.alert(t("Disconnect"), t("The app will forget the relay address and token."), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Disconnect"),
        style: "destructive",
        onPress: () => {
          void disconnectRelay().then(() => router.back());
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-4">
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t("Cancel")} className="h-11 w-11 items-center justify-center active:opacity-60">
          <Icon icon={X} className="h-6 w-6 text-foreground" />
        </Pressable>
        <Text className="flex-1 px-2 text-[19px] font-semibold text-foreground">{t("Relay")}</Text>
        <View className="w-11" />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-12 pt-3">
        <View className="mb-5 flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-card">
            <Icon icon={Cable} className="h-6 w-6 text-foreground" />
          </View>
          <Text className="flex-1 text-[14px] leading-5 text-muted-foreground">
            {t("The relay runs on your computer and reaches the servers over SSH.")}
          </Text>
        </View>

        <Text className="mb-2 px-1 text-[14px] text-muted-foreground">{t("Connection")}</Text>
        <View className="overflow-hidden rounded-[22px] bg-card">
          <View className="px-5 py-3">
            <Text className="text-[13px] text-muted-foreground">{t("Relay address")}</Text>
            <TextInput
              value={baseUrl}
              onChangeText={setBaseUrl}
              placeholder="http://192.168.1.5:8787"
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="mt-1 min-h-9 py-1 text-[16px] text-foreground"
            />
          </View>
          <View className="border-t border-border px-5 py-3">
            <Text className="text-[13px] text-muted-foreground">Token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              placeholder="relay 启动时打印的 token"
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              className="mt-1 min-h-9 py-1 text-[16px] text-foreground"
            />
          </View>
        </View>

        <Pressable
          onPress={() => { void save(); }}
          disabled={!canSave}
          accessibilityRole="button"
          className={`mt-5 flex-row items-center justify-center gap-2 rounded-full px-5 py-3.5 ${canSave ? "bg-foreground active:opacity-80" : "bg-secondary"}`}
        >
          <Text className={`text-[16px] font-medium ${canSave ? "text-background" : "text-muted-foreground"}`}>
            {t(busy ? "Testing…" : "Test and save")}
          </Text>
        </Pressable>

        <View className="mt-8 flex-row gap-3 rounded-[22px] bg-card px-5 py-4">
          <Icon icon={Info} className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <View className="flex-1">
            <Text className="text-[14px] font-medium text-foreground">{t("Run bun run relay on your computer")}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-muted-foreground">
              {t("Enter the address it prints; the phone must be on the same Wi-Fi or Tailscale network.")}
            </Text>
          </View>
        </View>

        {relay ? (
          <Pressable onPress={confirmDisconnect} accessibilityRole="button" className="mt-8 items-center py-3 active:opacity-60">
            <Text className="text-[14px] text-red-500">{t("Disconnect")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
