import { usePreferences } from "@/components/preferences-context";
import type { UserProfile } from "@/utils/preferences";
import { SettingsCard, SettingsSection } from "@/components/settings-ui";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, profile, updateProfile } = usePreferences();
  const [fullName, setFullName] = useState(profile.name);
  const [nickname, setNickname] = useState(profile.nickname);
  const [preferences, setPreferences] = useState(profile.preferences);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const dirty = useRef(new Set<string>());
  useEffect(() => {
    if (!dirty.current.has("name")) setFullName(profile.name);
    if (!dirty.current.has("nickname")) setNickname(profile.nickname);
    if (!dirty.current.has("preferences")) setPreferences(profile.preferences);
  }, [profile]);
  async function save(personalPreferences = false) {
    if (!personalPreferences && !fullName.trim()) { setStatus("Please enter your name"); return; }
    setSaving(true);
    setStatus("");
    try {
      const patch: Partial<UserProfile> = {};
      if (personalPreferences) {
        if (dirty.current.has("preferences")) patch.preferences = preferences;
      } else {
        if (dirty.current.has("name")) patch.name = fullName.trim();
        if (dirty.current.has("nickname")) patch.nickname = nickname.trim();
      }
      await updateProfile(patch);
      for (const key of personalPreferences ? ["preferences"] : ["name", "nickname"]) dirty.current.delete(key);
      setStatus(personalPreferences ? "Preferences saved" : "Profile updated");
    } catch { setStatus("Your changes were not saved. Please try again."); }
    finally { setSaving(false); }
  }
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic" keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}>
      <SettingsSection title="Name">
        <View className="px-4 py-3">
          <Text className="text-[13px] text-muted-foreground">{t("Full name")}</Text>
          <TextInput editable={!saving} value={fullName} onChangeText={(value) => { dirty.current.add("name"); setFullName(value); }} accessibilityLabel={t("Full name")} className="mt-0.5 py-1 text-[16px] text-foreground" placeholderTextColor="#8E8E93" />
        </View>
        <View className="px-4 py-3">
          <Text className="text-[13px] text-muted-foreground">{t("Nickname")}</Text>
          <TextInput editable={!saving} value={nickname} onChangeText={(value) => { dirty.current.add("nickname"); setNickname(value); }} accessibilityLabel={t("Nickname")} className="mt-0.5 py-1 text-[16px] text-foreground" placeholderTextColor="#8E8E93" />
        </View>
      </SettingsSection>
      <Pressable onPress={() => { void save(); }} disabled={saving} accessibilityRole="button" className="mt-3 items-center rounded-[18px] border-continuous bg-foreground py-3.5 active:opacity-80">
        <Text className="text-[16px] font-semibold text-background">{t(saving ? "Saving…" : "Update profile")}</Text>
      </Pressable>
      {status ? <Text accessibilityRole="alert" className="mt-3 text-sm text-foreground">{t(status)}</Text> : null}
      <SettingsSection title="Personal preferences">
        <View className="px-4 py-3">
          <TextInput editable={!saving} value={preferences} onChangeText={(value) => { dirty.current.add("preferences"); setPreferences(value); }} accessibilityLabel={t("Personal preferences")} multiline className="min-h-[120px] text-[16px] leading-relaxed text-foreground" style={{ textAlignVertical: "top" }} placeholderTextColor="#8E8E93" />
        </View>
      </SettingsSection>
      <Text className="mt-2 px-1 text-[13px] leading-relaxed text-muted-foreground">{t("Your preferences will apply to all conversations, within Agent's guidelines.")}</Text>
      <Pressable onPress={() => { void save(true); }} disabled={saving} accessibilityRole="button" className="mt-3 items-center rounded-[18px] border-continuous bg-secondary py-3.5 active:opacity-70">
        <Text className="text-[16px] font-semibold text-foreground">{t("Save preferences")}</Text>
      </Pressable>
      <View className="mt-8">
        <SettingsCard><Pressable className="items-center py-3.5 active:bg-muted"><Text className="text-[16px] text-red-500">{t("Delete account")}</Text></Pressable></SettingsCard>
      </View>
    </ScrollView>
  );
}
