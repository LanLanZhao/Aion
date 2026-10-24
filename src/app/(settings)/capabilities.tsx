import { Icon } from "@/components/icon";
import { useDrawer } from "@/components/drawer-content";
import {
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings-ui";
import {
  Box,
  Brain,
  Check,
  ChevronRight,
  FileCog,
  Globe,
  Search,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TOOL_ACCESS = [
  { label: "Auto", description: "Agent chooses for you" },
  {
    label: "On demand",
    description: "Load when needed. More messages, lower accuracy",
  },
  { label: "Always available", description: undefined },
];

export default function CapabilitiesScreen() {
  const insets = useSafeAreaInsets();
  const [artifacts, setArtifacts] = useState(true);
  const [codeExecution, setCodeExecution] = useState(true);
  const [webSearch, setWebSearch] = useState(true);
  const [searchChats, setSearchChats] = useState(true);
  const [generateMemory, setGenerateMemory] = useState(true);
  const [toolAccess, setToolAccess] = useState("Auto");
  const { requestDrawerRestore } = useDrawer();

  // Reopen the drawer when this screen is popped back to the chat.
  useEffect(() => () => requestDrawerRestore(), [requestDrawerRestore]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <SettingsSection title="Tools">
        <SettingsToggleRow
          icon={Box}
          label="Artifacts"
          description="Required by code execution"
          value={artifacts}
          onValueChange={setArtifacts}
        />
        <SettingsToggleRow
          icon={FileCog}
          label="Code execution"
          description="Run code and create docs, spreadsheets, presentations, PDFs, and data reports."
          value={codeExecution}
          onValueChange={setCodeExecution}
        />
        <SettingsToggleRow
          icon={Globe}
          label="Web search"
          description="Search the web automatically when current information is needed."
          value={webSearch}
          onValueChange={setWebSearch}
        />
      </SettingsSection>

      <SettingsSection title="Memory">
        <SettingsToggleRow
          icon={Search}
          label="Search and reference chats"
          description="Allow Agent to look for relevant details in past chats."
          value={searchChats}
          onValueChange={setSearchChats}
        />
        <SettingsToggleRow
          icon={Brain}
          label="Generate memory"
          description="Remember relevant context from your chats, for both chats and projects."
          value={generateMemory}
          onValueChange={setGenerateMemory}
        />
        <Pressable className="flex-row items-center gap-4 px-4 py-3.5 active:bg-muted">
          <View className="flex-1">
            <Text className="text-[16px] text-foreground">
              View your memory
            </Text>
            <Text className="mt-0.5 text-[13px] text-muted-foreground">
              Updated 4d ago from your chats
            </Text>
          </View>
          <Icon
            icon={ChevronRight}
            className="h-4 w-4 text-muted-foreground"
          />
        </Pressable>
      </SettingsSection>

      <SettingsSection title="Tool access">
        {TOOL_ACCESS.map((option) => {
          const selected = option.label === toolAccess;
          return (
            <Pressable
              key={option.label}
              onPress={() => setToolAccess(option.label)}
              className="flex-row items-center gap-4 px-4 py-3.5 active:bg-muted"
            >
              <View className="flex-1">
                <Text className="text-[16px] text-foreground">
                  {option.label}
                </Text>
                {option.description ? (
                  <Text className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    {option.description}
                  </Text>
                ) : null}
              </View>
              {selected && <Icon icon={Check} className="h-5 w-5 text-foreground" />}
            </Pressable>
          );
        })}
      </SettingsSection>
    </ScrollView>
  );
}
