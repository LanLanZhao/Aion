import { usePreferences } from "@/components/preferences-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Linking } from "react-native";
import { ATTACHMENT_MEDIA_TYPES, mergeAttachments, validateAttachment, type ChatAttachment } from "./attachments";

export type AttachmentSource = "camera" | "library" | "file";
type SelectedFile = { uri: string; name?: string | null; mimeType?: string | null };
type DraftContext = {
  attachments: ChatAttachment[];
  isPicking: boolean;
  select: (source: AttachmentSource) => Promise<void>;
  remove: (id: string) => void;
  clear: () => void;
};

const Context = createContext<DraftContext | null>(null);
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
};

async function readFile(asset: SelectedFile): Promise<ChatAttachment> {
  // Picker results are app-readable cached files. Do not fetch arbitrary URLs.
  if (!/^(file|content):\/\//.test(asset.uri)) throw new Error("无法读取此附件，请使用系统选择器重新选择。");
  const file = new File(asset.uri);
  if (!file.exists) throw new Error("附件已不可用，请重新选择。");
  const name = (asset.name || file.name || "attachment").slice(0, 180);
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = asset.mimeType && asset.mimeType !== "application/octet-stream"
    ? asset.mimeType : MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
  const size = file.size;
  validateAttachment({ name, mediaType, size });
  const base64 = await file.base64();
  if (!base64 || Math.floor(base64.length * 3 / 4) > 4 * 1024 * 1024 + 2) {
    throw new Error("附件读取失败或文件已变大，请重新选择（最大 4 MB）。");
  }
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, uri: asset.uri, name, mediaType, size, dataUrl: `data:${mediaType};base64,${base64}` };
}

export function AttachmentDraftProvider({ children }: { children: ReactNode }) {
  const { t } = usePreferences();
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const draft = useRef<ChatAttachment[]>([]);
  const operation = useRef(0);
  const picking = useRef(false);

  const clear = useCallback(() => {
    operation.current++;
    picking.current = false;
    draft.current = [];
    setAttachments([]);
    setIsPicking(false);
  }, []);

  useEffect(() => () => { operation.current++; }, []);

  const select = useCallback(async (source: AttachmentSource) => {
    if (process.env.EXPO_OS === "web") { Alert.alert(t("暂不支持"), t("本轮附件流程仅在 Android 原生版本验收，Web 暂不可用。")); return; }
    if (picking.current) return;
    const token = ++operation.current;
    picking.current = true;
    setIsPicking(true);
    try {
      let selected: SelectedFile[];
      if (source === "file") {
        const result = await DocumentPicker.getDocumentAsync({ type: ATTACHMENT_MEDIA_TYPES, copyToCacheDirectory: true, multiple: true });
        if (result.canceled) return;
        selected = result.assets;
      } else {
        if (source === "camera") {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (token !== operation.current) return;
          if (!permission.granted) {
            Alert.alert(t("需要摄像头权限"), t("允许摄像头权限后才能拍摄附件。"), [
              { text: t("取消"), style: "cancel" },
              ...(!permission.canAskAgain ? [{ text: t("打开设置"), onPress: () => { void Linking.openSettings(); } }] : []),
            ]);
            return;
          }
        }
        const result = source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 4, quality: 0.8 });
        if (result.canceled) return;
        selected = result.assets.map((asset) => ({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType }));
      }
      if (token !== operation.current) return;
      if (selected.length + draft.current.length > 4) throw new Error("每条消息最多添加 4 个附件。");
      const incoming: ChatAttachment[] = [];
      // Read serially so selection of several photos does not spike native memory.
      for (const asset of selected) {
        incoming.push(await readFile(asset));
        if (token !== operation.current) return;
        mergeAttachments(draft.current, incoming);
      }
      draft.current = mergeAttachments(draft.current, incoming);
      setAttachments(draft.current);
    } catch (error) {
      if (token === operation.current) Alert.alert(t("无法添加附件"), t(error instanceof Error ? error.message : "请稍后重试。"));
    } finally {
      if (token === operation.current) {
        picking.current = false;
        setIsPicking(false);
      }
    }
  }, [t]);

  const remove = useCallback((id: string) => {
    draft.current = draft.current.filter((file) => file.id !== id);
    setAttachments(draft.current);
  }, []);

  return <Context value={{ attachments, isPicking, select, remove, clear }}>{children}</Context>;
}

export function useAttachmentDraft() {
  const value = use(Context);
  if (!value) throw new Error("useAttachmentDraft must be used within AttachmentDraftProvider");
  return value;
}
