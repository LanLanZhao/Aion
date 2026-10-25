import { usePreferences } from "@/components/preferences-context";
import { Icon } from "@/components/icon";
import { Image } from "expo-image";
import { FileText, X } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ChatAttachment } from "./attachments";

export function AttachmentList({ attachments, onRemove }: { attachments: ChatAttachment[]; onRemove?: (id: string) => void }) {
  const { t } = usePreferences();
  if (!attachments.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingVertical: 6, paddingRight: 8 }}>
      {attachments.map((file) => (
        <View key={file.id} className="w-28 rounded-2xl border border-border bg-secondary p-2">
          {file.mediaType.startsWith("image/") ? (
            <Image source={{ uri: file.uri }} contentFit="cover" style={{ width: "100%", height: 64, borderRadius: 8 }} accessibilityLabel={file.name} />
          ) : (
            <View className="h-16 items-center justify-center"><Icon icon={FileText} className="h-7 w-7 text-foreground" /></View>
          )}
          <Text numberOfLines={1} className="mt-1 text-xs text-foreground">{file.name}</Text>
          {onRemove && (
            <Pressable onPress={() => onRemove(file.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("移除")} ${file.name}`} className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-foreground active:opacity-70">
              <Icon icon={X} className="h-3.5 w-3.5 text-background" />
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
