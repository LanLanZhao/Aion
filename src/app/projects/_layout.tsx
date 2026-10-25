import { usePreferences } from "@/components/preferences-context";
import { Stack } from "expo-router";

export default function ProjectsLayout() {
  const { t } = usePreferences();
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: "#F2F2F2" }, contentStyle: { backgroundColor: "#F2F2F2" } }}>
      <Stack.Screen name="index" options={{ title: t("Projects") }} />
      <Stack.Screen name="new" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: t("Project") }} />
    </Stack>
  );
}
