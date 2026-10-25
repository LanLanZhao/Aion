import { usePreferences } from "@/components/preferences-context";
import { Icon } from "@/components/icon";
import { useRestoreDrawerOnClose } from "@/components/use-restore-drawer";
import {
  AvatarMonogram,
  SettingsCard,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings-ui";
import { cn } from "@/utils/tailwind";
import * as Application from "expo-application";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";import {
  ArrowLeft,
  Bell,
  CircleUser,
  Globe,
  LayoutGrid,
  Link2,
  LogOut,
  Pencil,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SunMoon,
  TrendingUp,
  Users,
  Vibrate,
  Wallet,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


type SettingsItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  href?: Href;
  toggle?: boolean;
};

type SettingsGroup = {
  title: string;
  items: SettingsItem[];
};

const GROUPS: SettingsGroup[] = [
  {
    title: "My Agent",
    items: [
      {
        key: "capabilities",
        icon: SlidersHorizontal,
        label: "Capabilities",
        href: "/(settings)/capabilities",
      },
      { key: "connectors", icon: LayoutGrid, label: "Connectors" },
      { key: "permissions", icon: Users, label: "Permissions" },
    ],
  },
  {
    title: "Account",
    items: [
      {
        key: "profile",
        icon: CircleUser,
        label: "Profile",
        href: "/(settings)/profile",
      },
      { key: "billing", icon: Wallet, label: "Billing", detail: "Max plan" },
      { key: "usage", icon: TrendingUp, label: "Usage" },
    ],
  },
  {
    title: "Preferences",
    items: [
      {
        key: "appearance",
        icon: SunMoon,
        label: "Appearance",
        detail: "System",
      },
      {
        key: "language",
        icon: Globe,
        label: "Language",
        href: "/(settings)/language",
      },
      { key: "notifications", icon: Bell, label: "Notifications" },
      { key: "privacy", icon: ShieldCheck, label: "Privacy" },
      { key: "shared-links", icon: Link2, label: "Shared links" },
      {
        key: "haptics",
        icon: Vibrate,
        label: "Haptic feedback",
        toggle: true,
      },
    ],
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t, profile, language } = usePreferences();
  const insets = useSafeAreaInsets();
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [query, setQuery] = useState("");

  // Popping this screen returns to the chat, so put the drawer back.
  useRestoreDrawerOnClose();

  const needle = query.trim().toLowerCase();
  const groups = GROUPS.map((group) => ({
    ...group,
    items: needle
      ? group.items.filter((item) =>
          t(item.label).toLowerCase().includes(needle) || item.label.toLowerCase().includes(needle),
        )
      : group.items,
  })).filter((group) => group.items.length > 0);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 108,
          paddingHorizontal: 16,
        }}
      >
        <View className="relative items-center pb-1 pt-1">
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={t("Go back")}
            className="h-10 w-10 items-center justify-center rounded-full border border-border bg-card active:bg-muted"
            style={{ position: "absolute", left: 0, top: 0 }}
          >
            <Icon icon={ArrowLeft} className="h-5 w-5 text-foreground" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/(settings)/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("Edit profile")}
            className="active:opacity-80"
          >
            <AvatarMonogram initials={profile.name.slice(0, 2)} />
            <View
              className="items-center justify-center rounded-full border-[3px] border-background bg-card"
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 28,
                height: 28,
              }}
            >
              <Icon icon={Pencil} className="h-3 w-3 text-foreground" />
            </View>
          </Pressable>

          <Text className="mt-3 text-[20px] font-semibold text-foreground">
            {profile.name}
          </Text>
          <Text className="mt-0.5 text-[13px] text-muted-foreground">
            {profile.nickname}
          </Text>
        </View>

        {groups.map((group) => (
          <SettingsSection key={group.title} title={group.title}>
            {group.items.map((item) =>
              item.toggle ? (
                <SettingsToggleRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  value={hapticFeedback}
                  onValueChange={setHapticFeedback}
                />
              ) : (
                <SettingsRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  detail={item.key === "language" ? (language === "zh" ? "中文" : "English") : item.detail}
                  href={item.href}
                />
              ),
            )}
          </SettingsSection>
        ))}

        {groups.length === 0 && (
          <View className="mt-16 items-center">
            <Text className="text-[15px] text-muted-foreground">
              {t("No settings match")} “{query.trim()}�?
            </Text>
          </View>
        )}

        {needle === "" && (
          <>
            <View className="mt-7">
              <SettingsCard>
                <SettingsRow
                  icon={LogOut}
                  label={t("Log out")}
                  danger
                  showChevron={false}
                />
              </SettingsCard>
            </View>
            <Text className="mt-6 text-center text-[12px] text-muted-foreground">
              {Application.applicationName}{" "}
              {Application.nativeApplicationVersion} (
              {Application.nativeBuildVersion})
            </Text>
          </>
        )}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 8) + 8,
        }}
      >
        <View className="h-12 flex-row items-center gap-2.5 rounded-full border border-border bg-card px-4 shadow-float">
          <Icon icon={Search} className="h-4 w-4 text-muted-foreground" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("Search settings")}
            placeholderTextColor="#8E8E93"
            returnKeyType="search"
            className={cn("flex-1 text-[15px] text-foreground")}
          />
        </View>
      </View>
    </View>
  );
}
