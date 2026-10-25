import { usePreferences } from "@/components/preferences-context";
import { Icon } from "@/components/icon";
import { Camera, Image as ImageIcon, File, Shapes, Blocks, Plus, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAttachmentDraft, type AttachmentSource } from "./attachment-draft";

const ACTIONS = [
  { source: "camera", title: "摄像头", icon: Camera },
  { source: "library", title: "图库", icon: ImageIcon },
  { source: "file", title: "文件", icon: File },
] as const;

export function AttachmentMenu() {
  const { t } = usePreferences();
  const unsupported = process.env.EXPO_OS === "web";
  const { select, isPicking } = useAttachmentDraft();
  const anchor = useRef<View>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => () => clearTimeout(pending.current), []);
  function open() {
    Keyboard.dismiss();
    clearTimeout(pending.current);
    // Measure after the native keyboard has finished moving the composer.
    pending.current = setTimeout(() => anchor.current?.measureInWindow((x, y) => setPosition({ x, y })), 320);
  }
  function choose(source: AttachmentSource) {
    setPosition(null);
    void select(source);
  }
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable onPress={open} disabled={isPicking || unsupported} accessibilityRole="button" accessibilityLabel={t(unsupported ? "附件仅在 Android 原生版本可用" : "添加附件")} accessibilityState={{ disabled: isPicking || unsupported, expanded: position !== null }} className="h-9 w-9 items-center justify-center rounded-full bg-secondary active:opacity-70">
          <Icon icon={position ? X : Plus} className="h-4 w-4 text-foreground" />
        </Pressable>
      </View>
      {unsupported && <Text className="text-[10px] text-muted-foreground">{t("附件仅原生版")}</Text>}
      <Modal visible={position !== null} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setPosition(null)}>
        <Pressable className="absolute inset-0" accessibilityLabel={t("关闭添加菜单")} onPress={() => setPosition(null)} />
        {position && (
          <View className="absolute w-56 rounded-[26px] border border-border bg-card p-3" style={{ left: Math.max(12, Math.min(position.x, width - 236)), top: Math.max(insets.top + 8, Math.min(position.y - 304, height - insets.bottom - 312)), boxShadow: "0 6px 28px rgba(0,0,0,0.14)" }}>
            {ACTIONS.map((action) => (
              <Pressable key={action.source} onPress={() => choose(action.source)} accessibilityRole="button" className="h-[52px] flex-row items-center gap-4 rounded-xl px-3 active:bg-secondary">
                <Icon icon={action.icon} className="h-6 w-6 text-foreground" /><Text className="text-[17px] text-foreground">{t(action.title)}</Text>
              </Pressable>
            ))}
            <View className="mx-3 my-2 h-px bg-border" />
            {[{ title: "技能", icon: Shapes }, { title: "连接器", icon: Blocks }].map((action) => (
              <View key={t(action.title)} accessibilityLabel={`${t(action.title)}，暂未接入`} accessibilityState={{ disabled: true }} className="h-[52px] flex-row items-center gap-4 px-3 opacity-45">
                <Icon icon={action.icon} className="h-6 w-6 text-foreground" /><Text className="text-[17px] text-foreground">{t(action.title)}</Text><Text className="ml-auto text-[10px] text-muted-foreground">{t("暂未接入")}</Text>
              </View>
            ))}
          </View>
        )}
      </Modal>
    </>
  );
}
