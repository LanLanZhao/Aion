import { usePreferences } from "@/components/preferences-context";
import { AndroidGrabber } from "@/components/grabber";
import { AttachmentList } from "@/components/chat/attachment-list";
import { useAttachmentDraft } from "@/components/chat/attachment-draft";
import { Icon } from "@/components/icon";
import { Camera, Image, File } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function AttachmentsScreen() {
  const draft = useAttachmentDraft();
  const { t } = usePreferences();
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <AndroidGrabber />
      <View className="flex-row gap-3 py-4">
        {([{ source: "camera", label: "摄像头", icon: Camera }, { source: "library", label: "图库", icon: Image }, { source: "file", label: "文件", icon: File }] as const).map((action) => (
          <Pressable key={action.source} disabled={draft.isPicking || process.env.EXPO_OS === "web"} onPress={() => { void draft.select(action.source); }} accessibilityRole="button" className="flex-1 items-center gap-2 rounded-2xl bg-secondary py-4 active:opacity-70">
            <Icon icon={action.icon} className="h-6 w-6 text-foreground" /><Text className="text-foreground">{t(action.label)}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="pb-3 text-sm text-muted-foreground">{t("支持常见图片、PDF、TXT、Markdown、CSV、JSON。单个最大 4 MB，每条最多 4 个、共 8 MB；文本最大 128 KB。")}</Text>
      <AttachmentList attachments={draft.attachments} onRemove={draft.remove} />
      <Text className="pt-6 text-sm text-muted-foreground">{t("返回聊天后可预览、移除和发送附件。技能与连接器暂未接入；Web 附件暂不可用。")}</Text>
    </ScrollView>
  );
}
