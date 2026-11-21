import {
  DrawerContent,
  DrawerProvider,
  useDrawer,
} from "@/components/drawer-content";
import { DrawerLayout } from "@/components/drawer-layout";
import "@/global.css";
import { useSystemBackgroundColor } from "@/utils/use-system-background-color";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, usePathname, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ModelProvider } from "@/components/model-context";
import { AttachmentDraftProvider } from "@/components/chat/attachment-draft";
import { PreferencesProvider, usePreferences } from "@/components/preferences-context";
import { ProjectProvider } from "@/components/projects/project-context";
import { ResearchProvider } from "@/components/research/research-context";
import { captureBackDestination } from "@/components/navigation/predictive-back";
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
    id: "deepseek-flash",
    label: "DeepSeek V4.1 Flash",
    subtitle: "Latest general model, image input",
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    subtitle: "Stronger knowledge, text only",
  },
] as const;

const ALL_MODELS = [...MODELS];

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
          <ProjectProvider><AttachmentDraftProvider><ResearchProvider><DrawerProvider><RootDrawer /></DrawerProvider></ResearchProvider></AttachmentDraftProvider></ProjectProvider>
        </ModelProvider>
        {process.env.EXPO_OS !== "ios" && <StatusBar style="auto" />}
      </KeyboardProvider>
    </ThemeProvider></PreferencesProvider>
  );
}

function RootDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, openDrawer, closeDrawer, instantOpen } = useDrawer();
  // Only the chat screen owns the drawer gesture. Other screens sit above it.
  const isChat = pathname === "/";

  useSystemBackgroundColor();

  return (
    <DrawerLayout
      open={isOpen}
      instantOpen={instantOpen}
      swipeEnabled={isChat}
      onOpen={openDrawer}
      onClose={closeDrawer}
      drawerContent={
        <DrawerContent
          onNewChat={() => {
            closeDrawer();
            router.replace({ pathname: "/", params: { newChat: `${Date.now()}` } }, { withAnchor: true });
          }}
          onOpenChat={(id) => {
            closeDrawer();
            router.replace({ pathname: "/", params: { chat: id } }, { withAnchor: true });
          }}
          onOpenSettings={async () => {
            await captureBackDestination("drawer");
            closeDrawer();
            router.navigate("/(settings)/settings");
          }}
          onOpenCapabilities={async () => {
            await captureBackDestination("drawer");
            closeDrawer();
            router.navigate({ pathname: "/(settings)/capabilities", params: { returnTo: "drawer" } });
          }}
          onOpenProjects={async () => {
            await captureBackDestination("drawer");
            closeDrawer();
            router.navigate("/projects" as Href);
          }}
          onOpenResearch={() => {
            closeDrawer();
            router.navigate("/research" as Href);
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

      <Stack.Screen
        name="projects"
        options={{ headerShown: false, animation: IS_ANDROID ? "none" : undefined }}
      />

      <Stack.Screen
        name="research"
        options={{ headerShown: false, animation: IS_ANDROID ? "none" : undefined }}
      />

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
          animation: IS_ANDROID ? "none" : undefined,
          presentation: IS_ANDROID ? undefined : "modal",
          headerShown: false,
        }}
      />
    </Stack>
  );
}
