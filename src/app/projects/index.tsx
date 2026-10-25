import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useProjects } from "@/components/projects/project-context";
import { useRestoreDrawerOnClose } from "@/components/use-restore-drawer";
import { Stack, useRouter } from "expo-router";
import { Folder, Plus } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function ProjectsScreen() {
  const { t } = usePreferences();
  const { projects, ready } = useProjects();
  const router = useRouter();
  const openNew = () => router.push("/projects/new");

  // Popping this screen lands on the chat, so put the drawer back.
  useRestoreDrawerOnClose();

  return (
    <>
      <Stack.Screen options={{ title: t("Projects"), headerRight: () => (
        <Pressable onPress={openNew} accessibilityRole="button" accessibilityLabel={t("New project")} className="h-11 w-11 items-center justify-center active:opacity-60">
          <Icon icon={Plus} className="h-6 w-6 text-foreground" />
        </Pressable>
      ) }} />
      {ready && projects.length === 0 ? (
        <View className="flex-1 items-center justify-center px-7 pb-20">
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-card">
            <Icon icon={Folder} className="h-8 w-8 text-foreground" />
          </View>
          <Text className="text-center text-[19px] font-semibold text-foreground">{t("Start with a new project")}</Text>
          <Text className="mt-2 text-center text-[15px] leading-6 text-muted-foreground">{t("Projects keep shared instructions and files together for conversations.")}</Text>
          <Pressable onPress={openNew} accessibilityRole="button" className="mt-6 flex-row items-center gap-2 rounded-full bg-card px-5 py-3 active:bg-secondary">
            <Icon icon={Plus} className="h-5 w-5 text-foreground" />
            <Text className="text-[16px] font-medium text-foreground">{t("New project")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-4 py-5 pb-safe" keyboardShouldPersistTaps="handled">
          {projects.map(project => (
            <Pressable key={project.id} onPress={() => router.push({ pathname: "/projects/[id]", params: { id: project.id } })} accessibilityRole="button" className="mb-3 flex-row items-center gap-3 rounded-[22px] bg-card px-5 py-4 active:bg-secondary">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-muted"><Icon icon={Folder} className="h-5 w-5 text-foreground" /></View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[17px] font-medium text-foreground">{project.name}</Text>
                <Text numberOfLines={1} className="mt-1 text-[13px] text-muted-foreground">{project.files.length ? `${project.files.length} ${t("files")}` : t("No files")}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </>
  );
}
