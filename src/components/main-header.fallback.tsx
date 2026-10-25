import { usePreferences } from "@/components/preferences-context";
import { Icon } from "@/components/icon";
import { cn } from "@/utils/tailwind";
import { Stack } from "expo-router";
import { HatGlasses, Menu } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useDrawer } from "./drawer-content";

export type MainHeaderProps = {
  privateMode?: boolean;
  onTogglePrivate?: () => void;
};

export function MainHeader({
  privateMode = false,
  onTogglePrivate,
}: MainHeaderProps) {
  const { openDrawer } = useDrawer();
  const { t } = usePreferences();

  return (
    <>
      <Stack.Toolbar placement="left" asChild>
        <Pressable
          onPress={openDrawer}
          accessibilityLabel={t("Open drawer")}
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary active:opacity-70"
        >
          <Icon icon={Menu} className="h-5 w-5 text-foreground" />
        </Pressable>
      </Stack.Toolbar>

      <Stack.Screen.Title asChild>
        <View className="items-center">
          <Text className="text-[17px] font-semibold text-foreground">{t("Chat")}</Text>
          <View className="mt-0.5 h-[2px] w-6 rounded-full bg-foreground" />
        </View>
      </Stack.Screen.Title>

      <Stack.Toolbar placement="right" asChild>
        <Pressable
          onPress={onTogglePrivate}
          accessibilityRole="button"
          accessibilityLabel={
            t(privateMode ? "Leave private chat" : "Start a private chat")
          }
          className={cn(
            "h-10 w-10 items-center justify-center rounded-full active:opacity-70",
            privateMode ? "bg-foreground" : "bg-secondary",
          )}
        >
          <Icon
            icon={HatGlasses}
            className={cn(
              "h-5 w-5",
              privateMode ? "text-background" : "text-foreground",
            )}
          />
        </Pressable>
      </Stack.Toolbar>
    </>
  );
}
