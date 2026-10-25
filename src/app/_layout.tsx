import {
  DrawerContent,
  DrawerProvider,
  useDrawer,
} from "@/components/drawer-content";
import { DrawerLayout } from "@/components/drawer-layout";
import "@/global.css";
import { useSystemBackgroundColor } from "@/utils/use-system-background-color";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ModelProvider } from "@/components/model-context";
import { AttachmentDraftProvider } from "@/components/chat/attachment-draft";
import { PreferencesProvider, usePreferences } from "@/components/preferences-context";
import { ProjectProvider } from "@/components/projects/project-context";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as RNTheme,
} from "expo-router/react-navigation";
import { useColorScheme } from "react-native";
import { SafeAreaListener } from "react-native-safe-area-context";
import { Uniwind, useCSSVariable } from "uniwind";

const GLASS = isLiquidGlassAvailable();
const IS_ANDROID = process.env.EXPO_OS === "android";
const MODELS = [
  {
    id: "opus-4.6",
    label: "Opus 4.6",
    subtitle: "Most capable for ambitious work",
  },
  {
    id: "sonnet-4.6",
    label: "Sonnet 4.6",
    subtitle: "Most efficient for everyday tasks",
  },
  {
    id: "haiku-4.5",
    label: "Haiku 4.5",
    subtitle: "Fastest for quick answers",
  },
] as const;

const MORE_MODELS = [
  { id: "opus-4.5", label: "Opus 4.5" },
  { id: "opus-3", label: "Opus 3" },
  { id: "sonnet-4.5", label: "Sonnet 4.5" },
] as const;

const ALL_MODELS = [...MODELS, ...MORE_MODELS];

function ThemeProvider(props: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  return (
    <RNTheme value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
        {props.children}
      </SafeAreaListener>
    </RNTheme>
  );
}

export const unstable_settings = {
  anchor: "index",
};

export default function RootLayout() {
  return (
    <PreferencesProvider><ThemeProvider>
      <KeyboardProvider>
        <ModelProvider models={ALL_MODELS}>
          <ProjectProvider><AttachmentDraftProvider><DrawerProvider><RootDrawer /></DrawerProvider></AttachmentDraftProvider></ProjectProvider>
        </ModelProvider>
        {process.env.EXPO_OS !== "ios" && <StatusBar style="auto" />}
      </KeyboardProvider>
    </ThemeProvider></PreferencesProvider>
  );
}

function RootDrawer() {
  const router = useRouter();
  const { isOpen, openDrawer, closeDrawer } = useDrawer();

  useSystemBackgroundColor();

  return (
    <DrawerLayout
      open={isOpen}
      onOpen={openDrawer}
      onClose={closeDrawer}
      drawerContent={
        <DrawerContent
          onNewChat={() => {
            closeDrawer();
            router.replace({ pathname: "/", params: { newChat: `${Date.now()}` } }, { withAnchor: true });
          }}
          onOpenSettings={() => {
            // The drawer is a custom overlay, not a navigator: route changes
            // do not dismiss it. Close it first or Settings stays hidden
            // underneath the still-open panel.
            closeDrawer();
            router.navigate("/(settings)/settings");
          }}
          onOpenCapabilities={() => {
            closeDrawer();
            router.navigate("/(settings)/capabilities");
          }}
          onOpenProjects={() => {
            closeDrawer();
            router.navigate("/projects" as Href);
          }}
          onClose={closeDrawer}
        />
      }
    >
      <StackLayout />
    </DrawerLayout>
  );
}

function StackLayout() {
  const { t } = usePreferences();
  const appForeground = useCSSVariable("--app-foreground") as string;
  const appBackground = useCSSVariable("--app-background") as string;

  return (
    <Stack
      screenOptions={{
        headerTransparent: GLASS,
        headerBackButtonDisplayMode: GLASS ? "minimal" : "default",
        headerTintColor: appForeground,
        headerShadowVisible: IS_ANDROID ? false : undefined,
        headerStyle: IS_ANDROID
          ? {
              backgroundColor: appBackground,
            }
          : undefined,
      }}
    >
      <Stack.Screen
        name="index"
        dangerouslySingular
        options={{
          title: t("Chat"),
          animation: "none",
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="chats"
        options={{
          title: t("Chats"),
          animation: "none",
          headerLargeTitleShadowVisible: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen name="projects" options={{ headerShown: false }} />

      <Stack.Screen
        name="attachments"
        options={{
          title: t("Add to chat"),
          presentation: "formSheet",
          sheetAllowedDetents: [0.55],
          // following https://m3.material.io/components/bottom-sheets/specs
          sheetCornerRadius: IS_ANDROID ? 28 : undefined,
          sheetGrabberVisible: true,
          headerTransparent: GLASS,
          headerLargeTitleShadowVisible: false,
        }}
      />

      <Stack.Screen
        name="model-picker"
        options={{
          title: t("Model"),
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
          sheetCornerRadius: IS_ANDROID ? 28 : undefined,
          sheetGrabberVisible: true,
          headerTransparent: GLASS,
          headerLargeTitleShadowVisible: false,
        }}
      />

      <Stack.Screen
        name="(settings)"
        options={{
          presentation: IS_ANDROID ? undefined : "modal",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
