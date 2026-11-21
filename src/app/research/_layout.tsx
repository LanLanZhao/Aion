import { usePreferences } from "@/components/preferences-context";
import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

export default function ResearchLayout() {
  const { t } = usePreferences();
  const background = useCSSVariable("--app-muted") as string;

  return (
    <Stack
      screenOptions={{
        animation: process.env.EXPO_OS === "android" ? "none" : undefined,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: background },
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen name="index" options={{ title: t("Research") }} />
      <Stack.Screen name="new" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="[id]/index" options={{ title: t("Server") }} />
      <Stack.Screen name="[id]/status" options={{ title: t("GPU & system status") }} />
      <Stack.Screen name="[id]/edit" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="relay" options={{ headerShown: false, presentation: "modal" }} />
    </Stack>
  );
}
