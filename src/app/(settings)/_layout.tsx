import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useCSSVariable } from "uniwind";

const GLASS = isLiquidGlassAvailable();

export default function SettingsLayout() {
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
          title: "Settings",
          // The screen renders its own account header and back control. A native
          // bar would duplicate the title and push the avatar block down.
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
      <Stack.Screen
        name="capabilities"
        options={{
          title: "Capabilities",
        }}
      />
    </Stack>
  );
}
