import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import { ServerForm } from "@/components/research/server-form";
import { SafeAreaView } from "@/components/tw";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Server } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

export default function EditServerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { servers, updateServer } = useResearch();
  const { t } = usePreferences();
  const router = useRouter();

  const server = servers.find((item) => item.id === id);

  if (!server) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-muted px-8" edges={["top", "bottom"]}>
        <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-card">
          <Icon icon={Server} className="h-8 w-8 text-foreground" />
        </View>
        <Text className="text-center text-[17px] text-muted-foreground">{t("Server not found")}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" className="mt-6 rounded-full bg-card px-5 py-3 active:bg-secondary">
          <Text className="text-[15px] font-medium text-foreground">{t("Go back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <ServerForm
      title={t("Edit server")}
      saveErrorTitle="Unable to save changes"
      initial={{
        name: server.name,
        host: server.host,
        port: server.port,
        user: server.user,
        keyPath: "",
        condaEnv: server.condaEnv,
        rootDir: server.rootDir,
      }}
      keyPathHint={server.hasKeyPath ? t("Leave blank to keep the current key.") : undefined}
      onSave={async (draft) => {
        await updateServer(server.id, draft);
      }}
    />
  );
}
