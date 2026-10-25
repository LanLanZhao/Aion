import { usePreferences } from "@/components/preferences-context";
import { Icon } from "@/components/icon";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ChatActionTarget = {
  id: string;
  title: string;
  pinned: boolean;
} | null;

type Props = {
  target: ChatActionTarget;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
};

/** Long-press menu for a conversation, in the shape Grok uses. */
export function ChatActionsSheet({
  target,
  onClose,
  onDelete,
  onRename,
  onTogglePin,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  const [mode, setMode] = useState<"actions" | "rename">("actions");
  const [draft, setDraft] = useState(target?.title ?? "");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // The modal has its own window, so it does not resize with the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="flex-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
          onPress={onClose}
          accessibilityLabel={t("Close menu")}
        />

        <View
          className="rounded-t-[28px] bg-card px-5 pt-3"
          style={{
            paddingBottom: insets.bottom + 20,
            marginBottom: mode === "rename" ? keyboardHeight : 0,
          }}
        >
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />

          {mode === "actions" ? (
            <>
              <SheetAction
                icon={Trash2}
                label={t("Delete")}
                danger
                onPress={() => {
                  if (target) onDelete(target.id);
                  onClose();
                }}
              />
              <SheetAction
                icon={Pencil}
                label={t("Rename")}
                onPress={() => setMode("rename")}
              />
              <SheetAction
                icon={target?.pinned ? PinOff : Pin}
                label={t(target?.pinned ? "Unpin" : "Pin")}
                onPress={() => {
                  if (target) onTogglePin(target.id);
                  onClose();
                }}
              />
            </>
          ) : (
            <View className="pb-1">
              <Text className="px-1 pb-2 text-[13px] font-medium text-muted-foreground">{t("Rename chat")}</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (target) onRename(target.id, draft.trim() || target.title);
                  onClose();
                }}
                placeholder={t("Chat name")}
                placeholderTextColor="#8E8E93"
                className="rounded-[18px] bg-secondary px-4 py-3 text-[16px] text-foreground"
              />
              <View className="mt-3 flex-row gap-3">
                <Pressable
                  onPress={() => setMode("actions")}
                  className="flex-1 items-center rounded-[18px] bg-secondary py-3 active:opacity-70"
                >
                  <Text className="text-[16px] text-foreground">{t("Cancel")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (target) {
                      onRename(target.id, draft.trim() || target.title);
                    }
                    onClose();
                  }}
                  className="flex-1 items-center rounded-[18px] bg-foreground py-3 active:opacity-80"
                >
                  <Text className="text-[16px] font-semibold text-background">{t("Save")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-4 py-3.5 active:opacity-60"
    >
      <Icon
        icon={icon}
        className={danger ? "h-6 w-6 text-red-500" : "h-6 w-6 text-foreground"}
      />
      <Text
        className={
          danger ? "text-[19px] text-red-500" : "text-[19px] text-foreground"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
