import { SettingsCard, SettingsSection } from "@/components/settings-ui";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("Evan Bacon");
  const [nickname, setNickname] = useState("Evan");
  const [preferences, setPreferences] = useState(
    "I'm a creator and software developer.",
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <SettingsSection title="Name">
        <View className="px-4 py-3">
          <Text className="text-[13px] text-muted-foreground">Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            className="mt-0.5 py-1 text-[16px] text-foreground"
            placeholderTextColor="#8E8E93"
          />
        </View>
        <View className="px-4 py-3">
          <Text className="text-[13px] text-muted-foreground">Nickname</Text>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            className="mt-0.5 py-1 text-[16px] text-foreground"
            placeholderTextColor="#8E8E93"
          />
        </View>
      </SettingsSection>

      <Pressable className="mt-3 items-center rounded-[18px] border-continuous bg-foreground py-3.5 active:opacity-80">
        <Text className="text-[16px] font-semibold text-background">
          Update profile
        </Text>
      </Pressable>

      <SettingsSection title="Personal preferences">
        <View className="px-4 py-3">
          <TextInput
            value={preferences}
            onChangeText={setPreferences}
            multiline
            className="min-h-[120px] text-[16px] leading-relaxed text-foreground"
            style={{ textAlignVertical: "top" }}
            placeholderTextColor="#8E8E93"
          />
        </View>
      </SettingsSection>
      <Text className="mt-2 px-1 text-[13px] leading-relaxed text-muted-foreground">
        Your preferences will apply to all conversations, within Agent&apos;s
        guidelines.
      </Text>

      <Pressable className="mt-3 items-center rounded-[18px] border-continuous bg-secondary py-3.5 active:opacity-70">
        <Text className="text-[16px] font-semibold text-foreground">
          Save preferences
        </Text>
      </Pressable>

      <View className="mt-8">
        <SettingsCard>
          <Pressable className="items-center py-3.5 active:bg-muted">
            <Text className="text-[16px] text-red-500">Delete account</Text>
          </Pressable>
        </SettingsCard>
      </View>
    </ScrollView>
  );
}
