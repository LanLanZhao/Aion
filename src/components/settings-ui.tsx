import { usePreferences } from "@/components/preferences-context";
import { Icon } from "@/components/icon";
import { cn } from "@/utils/tailwind";
import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

const HAIRLINE = StyleSheet.hairlineWidth;

/** Left inset of the row divider: row padding + icon column + gap. */
const DIVIDER_INSET = 52;

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <View className="mt-7">
      <Text className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">
        {t(title)}
      </Text>
      <SettingsCard>{children}</SettingsCard>
    </View>
  );
}

export function SettingsCard({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);

  return (
    <View className="overflow-hidden rounded-[22px] border border-border bg-card">
      {rows.map((row, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <View
              className="bg-border"
              style={{ height: HAIRLINE, marginLeft: DIVIDER_INSET }}
            />
          )}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

type SettingsRowProps = {
  icon: LucideIcon;
  label: string;
  detail?: string;
  href?: Href;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
};

export function SettingsRow({
  icon,
  label,
  detail,
  href,
  onPress,
  danger = false,
  showChevron = true,
}: SettingsRowProps) {
  const { t } = usePreferences();
  const rowClassName = cn(
    "flex-row items-center gap-4 px-4 py-3.5",
    (onPress || href) && "active:bg-muted",
  );

  const content = (
    <>
      <Icon
        icon={icon}
        className={cn("h-5 w-5", danger ? "text-red-500" : "text-foreground")}
      />
      <Text
        numberOfLines={1}
        className={cn(
          "flex-1 text-[16px]",
          danger ? "text-red-500" : "text-foreground",
        )}
      >
        {t(label)}
      </Text>
      {detail ? (
        <Text numberOfLines={1} className="text-[16px] text-muted-foreground">
          {t(detail)}
        </Text>
      ) : null}
      {showChevron && (
        <Icon icon={ChevronRight} className="h-4 w-4 text-muted-foreground" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        <Pressable className={rowClassName}>{content}</Pressable>
      </Link>
    );
  }

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={rowClassName}>
        {content}
      </Pressable>
    );
  }

  return <View className={rowClassName}>{content}</View>;
}

export function SettingsToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { t } = usePreferences();
  return (
    <View className="flex-row items-center gap-4 px-4 py-3">
      <Icon icon={icon} className="h-5 w-5 text-foreground" />
      <View className="flex-1">
        <Text className="text-[16px] text-foreground">{t(label)}</Text>
        {description ? (
          <Text className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {t(description)}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: "#34C759" }}
      />
    </View>
  );
}

/** Default account image supplied by the user. */
export function AvatarMonogram({
  size = 76,
  onPress,
  accessibilityLabel,
}: {
  initials: string;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        "items-center justify-center rounded-full border-continuous",
        onPress && "active:opacity-80",
      )}
      style={{ width: size, height: size, backgroundColor: "#E3B341" }}
    >
      <Image source={require("../../assets/images/default-avatar.jpg")} contentFit="cover" style={{ width: size, height: size, borderRadius: size / 2 }} />
    </Pressable>
  );
}
