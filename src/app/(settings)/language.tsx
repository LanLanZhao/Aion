import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { SettingsCard } from "@/components/settings-ui";
import type { Language } from "@/utils/preferences";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";

export default function LanguageScreen() {
  const { language, setLanguage, t } = usePreferences();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  async function choose(next: Language) {
    setSaving(true); setFailed(false);
    try { await setLanguage(next); } catch { setFailed(true); }
    finally { setSaving(false); }
  }
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
      <SettingsCard>
        {([{ value: "zh", label: "中文" }, { value: "en", label: "English" }] as const).map((option) => (
          <Pressable key={option.value} onPress={() => { void choose(option.value); }} disabled={saving} accessibilityRole="radio" accessibilityState={{ selected: language === option.value, disabled: saving }} className="flex-row items-center justify-between px-4 py-4 active:bg-muted">
            <Text className="text-base text-foreground">{option.label}</Text>
            {language === option.value && <Icon icon={Check} className="h-5 w-5 text-foreground" />}
          </Pressable>
        ))}
      </SettingsCard>
      {saving && <Text className="mt-3 text-sm text-muted-foreground">{t("Saving…")}</Text>}
      {failed && <Text accessibilityRole="alert" className="mt-3 text-sm text-red-500">{t("Your changes were not saved. Please try again.")}</Text>}
    </ScrollView>
  );
}
