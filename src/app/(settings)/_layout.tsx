import { usePreferences } from "@/components/preferences-context";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

const GLASS = isLiquidGlassAvailable();

export default function SettingsLayout() {
  const { t } = usePreferences();
  const appForeground = useCSSVariable("--app-foreground") as string;
  const appBackground = useCSSVariable("--app-background") as string;

  return (
    <Stack
      screenOptions={{
        headerTransparent: GLASS,
        headerLargeTitleShadowVisible: false,
        headerBackButtonDisplayMode: GLASS ? "minimal" : "default",
        headerTintColor: appForeground,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: appBackground,
        },
      }}
    >
      <Stack.Screen
        name="settings"
        options={{
          title: t("Settings"),
          // The screen renders its own account header and back control. A native
          // bar would duplicate the title and push the avatar block down.
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: t("Profile"),
        }}
      />
      <Stack.Screen
        name="capabilities"
        options={{
          title: t("Capabilities"),
        }}
      />
      <Stack.Screen name="language" options={{ title: t("Language") }} />
    </Stack>
  );
}
