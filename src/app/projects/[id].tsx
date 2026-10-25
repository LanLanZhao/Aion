import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useProjects } from "@/components/projects/project-context";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { FileText, Folder, MessageSquarePlus, Trash2 } from "lucide-react-native";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = usePreferences();
  const { projects, deleteProject } = useProjects();
  const router = useRouter();
  const project = projects.find(item => item.id === id);

  const confirmDelete = () => Alert.alert(t("Delete project"), t("This project and its files will be removed from this device."), [
    { text: t("Cancel"), style: "cancel" },
    { text: t("Delete"), style: "destructive", onPress: () => { void deleteProject(id).then(() => router.replace("/projects" as Href)).catch(error => Alert.alert(t("Unable to delete project"), String(error))); } },
  ]);

  return (
    <>
      <Stack.Screen options={{ title: project?.name ?? t("Project") }} />
      {!project ? <View className="flex-1 items-center justify-center bg-muted"><Text className="text-muted-foreground">{t("Project not found")}</Text></View> : (
        <ScrollView className="flex-1 bg-muted" contentContainerClassName="px-5 pb-safe pt-8">
          <View className="h-18 w-18 items-center justify-center rounded-full bg-card"><Icon icon={Folder} className="h-8 w-8 text-foreground" /></View>
          <Text className="mt-4 text-[26px] font-semibold text-foreground">{project.name}</Text>
          <Pressable onPress={() => router.replace({ pathname: "/", params: { newChat: `${Date.now()}`, projectId: project.id } }, { withAnchor: true })} accessibilityRole="button" className="mt-6 flex-row items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 active:opacity-80">
            <Icon icon={MessageSquarePlus} className="h-5 w-5 text-background" /><Text className="text-[16px] font-medium text-background">{t("Start a chat in this project")}</Text>
          </Pressable>
          <Text className="mb-2 mt-8 text-[14px] text-muted-foreground">{t("Project instructions")}</Text>
          <View className="rounded-[20px] bg-card p-5"><Text className="text-[15px] leading-6 text-foreground">{project.instructions || t("No instructions")}</Text></View>
          <Text className="mb-2 mt-8 text-[14px] text-muted-foreground">{t("Project files")}</Text>
          <View className="overflow-hidden rounded-[20px] bg-card">
            {project.files.length ? project.files.map(file => (
              <View key={file.id} className="flex-row items-center gap-3 border-b border-border px-5 py-4"><Icon icon={FileText} className="h-5 w-5 text-foreground" /><Text numberOfLines={1} className="flex-1 text-[15px] text-foreground">{file.name}</Text></View>
            )) : <Text className="px-5 py-4 text-[15px] text-muted-foreground">{t("No files")}</Text>}
          </View>
          <Pressable onPress={confirmDelete} accessibilityRole="button" className="mt-8 flex-row items-center justify-center gap-2 py-3 active:opacity-60"><Icon icon={Trash2} className="h-4 w-4 text-red-500" /><Text className="text-[14px] text-red-500">{t("Delete project")}</Text></Pressable>
        </ScrollView>
      )}
    </>
  );
}
