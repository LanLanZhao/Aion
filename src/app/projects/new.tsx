import { ATTACHMENT_MEDIA_TYPES } from "@/components/chat/attachments";
import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useProjects } from "@/components/projects/project-context";
import { validateProject, type ProjectFile } from "@/components/projects/project-model";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { Folder, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "@/components/tw";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
};

export default function NewProjectScreen() {
  const { t } = usePreferences();
  const { createProject } = useProjects();
  const router = useRouter();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [busy, setBusy] = useState(false);

  const chooseFiles = async () => {
    if (busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ATTACHMENT_MEDIA_TYPES, multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const incoming: ProjectFile[] = result.assets.map(asset => {
        const file = new File(asset.uri);
        const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          uri: asset.uri,
          name: asset.name.slice(0, 180),
          mediaType: asset.mimeType && asset.mimeType !== "application/octet-stream" ? asset.mimeType : MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
          size: file.size,
        };
      });
      const next = [...files, ...incoming];
      validateProject(name || "_", instructions, next);
      setFiles(next);
    } catch (error) {
      Alert.alert(t("Unable to add project file"), t(error instanceof Error ? error.message : "请稍后重试。"));
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const project = await createProject(name, instructions, files);
      router.replace({ pathname: "/projects/[id]", params: { id: project.id } });
    } catch (error) {
      Alert.alert(t("Unable to create project"), t(error instanceof Error ? error.message : "请稍后重试。"));
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-4">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("Cancel")} className="h-11 w-11 items-center justify-center active:opacity-60"><Icon icon={X} className="h-6 w-6 text-foreground" /></Pressable>
        <Text className="flex-1 px-2 text-[19px] font-semibold text-foreground">{t("New project")}</Text>
        <Pressable onPress={() => { void save(); }} disabled={busy || !name.trim()} accessibilityRole="button" className={`rounded-full px-5 py-2.5 ${name.trim() && !busy ? "bg-card active:bg-secondary" : "bg-secondary"}`}>
          <Text className={`text-[15px] font-medium ${name.trim() && !busy ? "text-foreground" : "text-muted-foreground"}`}>{t(busy ? "Creating…" : "Create")}</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-12 pt-10">
        <View className="mb-8 flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-card"><Icon icon={Folder} className="h-7 w-7 text-foreground" /></View>
          <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={t("Project name")} placeholderTextColor="#8E8E93" autoFocus className="h-16 flex-1 rounded-2xl border border-border bg-card px-4 text-[19px] text-foreground" />
        </View>
        <Text className="mb-2 text-[14px] text-muted-foreground">{t("Project instructions (optional)")}</Text>
        <TextInput value={instructions} onChangeText={setInstructions} maxLength={4000} placeholder={t("Add instructions for the tone, style and context of this project.")} placeholderTextColor="#8E8E93" multiline textAlignVertical="top" className="min-h-36 rounded-[20px] border border-border bg-card px-4 py-4 text-[16px] leading-6 text-foreground" />
        <Text className="mb-2 mt-8 text-[14px] text-muted-foreground">{t("Project files")}</Text>
        <View className="overflow-hidden rounded-[20px] bg-card">
          <Pressable onPress={() => { void chooseFiles(); }} accessibilityRole="button" className="flex-row items-center gap-4 px-5 py-4 active:bg-secondary">
            <Icon icon={Plus} className="h-5 w-5 text-foreground" /><Text className="text-[16px] text-foreground">{t("Upload file")}</Text>
          </Pressable>
          {files.map(file => (
            <View key={file.id} className="flex-row items-center gap-3 border-t border-border px-5 py-3">
              <Text numberOfLines={1} className="flex-1 text-[14px] text-foreground">{file.name}</Text>
              <Pressable onPress={() => setFiles(current => current.filter(item => item.id !== file.id))} accessibilityRole="button" accessibilityLabel={`${t("Remove")} ${file.name}`} className="h-9 w-9 items-center justify-center active:opacity-60"><Icon icon={X} className="h-4 w-4 text-muted-foreground" /></Pressable>
            </View>
          ))}
          <View className="border-t border-border px-5 py-4"><Text className="text-[14px] text-muted-foreground">Google Drive · {t("Not connected")}</Text></View>
          <View className="border-t border-border px-5 py-4"><Text className="text-[14px] text-muted-foreground">Box · {t("Not connected")}</Text></View>
        </View>
        <Text className="mt-3 text-[12px] leading-5 text-muted-foreground">{t("Up to 4 files, 8 MB total; each file up to 4 MB. Supported: images, PDF and text.")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
