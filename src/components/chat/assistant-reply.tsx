import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { Check, ChevronDown, ChevronRight, Copy, Lightbulb, RefreshCw, Share2, ThumbsDown, ThumbsUp, Volume2, Square } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import { MessageResponse } from "./message";
import { replyDuration } from "./reply-timing";
import { StreamingMessage } from "./streaming-message";
import type { StreamingStore } from "./streaming-store";
import type { ChatMessage } from "./types";

let speechOwner: string | undefined;
let speechGeneration = 0;

export function AssistantReply({ message, streaming, store, onRegenerate, busy }: {
  message: ChatMessage; streaming: boolean; store: StreamingStore; onRegenerate?: () => void; busy: boolean;
}) {
  const { language, t } = usePreferences();
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speechRequest = useRef(0);
  const timing = message.timing;

  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [streaming]);

  useEffect(() => () => {
    clearTimeout(copiedTimer.current);
    speechRequest.current++;
    // Speech belongs to this response and must not continue into a new/private chat.
    if (speechOwner === message.id) { speechOwner = undefined; speechGeneration++; void Speech.stop(); }
  }, [message.id]);

  const fail = (error: unknown) => Alert.alert(t("操作失败"), error instanceof Error ? error.message : t("请稍后重试。"));
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch (error) { fail(error); }
  };
  const read = async () => {
    const wasSpeaking = speaking && speechOwner === message.id;
    const request = ++speechRequest.current;
    const generation = ++speechGeneration;
    speechOwner = message.id;
    const isCurrent = () => request === speechRequest.current && generation === speechGeneration && speechOwner === message.id;
    try {
      await Speech.stop();
      if (!isCurrent()) return;
      if (wasSpeaking) { speechOwner = undefined; setSpeaking(false); return; }
      const plain = message.content.replace(/```[^\n]*\n/g, "").replace(/```/g, "").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*#_>`]/g, "");
      const chunks = plain.match(/[\s\S]{1,3000}/g) ?? [];
      setSpeaking(true);
      chunks.forEach((chunk, index) => Speech.speak(chunk, {
        language: /[\u4e00-\u9fff]/.test(plain) ? "zh-CN" : "en-US",
        onDone: () => {
          if (request === speechRequest.current && index === chunks.length - 1) setSpeaking(false);
          if (isCurrent() && index === chunks.length - 1) speechOwner = undefined;
        },
        onStopped: () => { if (request === speechRequest.current) setSpeaking(false); },
        onError: () => {
          if (request === speechRequest.current) setSpeaking(false);
          if (!isCurrent()) return;
          speechRequest.current++;
          speechGeneration++;
          speechOwner = undefined;
          void Speech.stop();
          Alert.alert(t("朗读不可用"), t("请检查系统文字转语音引擎及对应语言的语音包。"));
        },
      }));
    } catch (error) { if (isCurrent()) { speechOwner = undefined; setSpeaking(false); fail(error); } }
  };

  const seconds = timing ? replyDuration(timing, now).toFixed(1) : "0.0";
  const phase = timing?.kind === "simulated" ? t("模拟耗时") : timing?.kind === "thinking" ? t("思考用时") : t("生成用时");
  const durationLabel = `${phase} ${seconds} ${language === "zh" ? "秒" : "s"}`;

  return (
    <View className="gap-3">
      {timing && (
        <View>
          <Pressable onPress={() => setExpanded(value => !value)} accessibilityRole="button" accessibilityLabel={durationLabel} accessibilityState={{ expanded }} className="min-h-9 flex-row items-center gap-2 self-start rounded-lg py-1 active:opacity-60">
            <Icon icon={Lightbulb} className="h-4 w-4 text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">{durationLabel}{streaming ? "…" : ""}</Text>
            <Icon icon={expanded ? ChevronDown : ChevronRight} className="h-4 w-4 text-muted-foreground" />
          </Pressable>
          {expanded && <Text className="mt-1 rounded-xl bg-secondary px-3 py-2 text-sm leading-5 text-muted-foreground">{t(timing.kind === "simulated" ? "当前为本地模拟，耗时是生成示例文本的实际用时，未调用模型，也没有真实思考过程。" : timing.kind === "thinking" ? "从发送到首段正文的客户端计时，包含网络与模型等待；不展示或编造模型内部思考内容。" : "从发送到完成的客户端生成用时，包含网络等待；当前回复没有可展示的思考过程。")}</Text>}
        </View>
      )}
      {streaming ? <StreamingMessage store={store} /> : <MessageResponse>{message.content}</MessageResponse>}
      {!streaming && !!message.content && (
        <View>
          <View className="flex-row flex-wrap items-center gap-2">
            <ReplyAction title={copied ? t("已复制") : t("复制")} icon={copied ? Check : Copy} active={copied} onPress={() => { void copy(); }} />
            <ReplyAction title={t("分享")} icon={Share2} onPress={() => { void Share.share({ message: message.content, title: "Quest" }).catch(fail); }} />
            <ReplyAction title={t("点赞")} icon={ThumbsUp} active={vote === "up"} onPress={() => setVote(value => value === "up" ? null : "up")} />
            <ReplyAction title={t("点踩")} icon={ThumbsDown} active={vote === "down"} onPress={() => setVote(value => value === "down" ? null : "down")} />
            <ReplyAction title={speaking ? t("停止朗读") : t("朗读")} icon={speaking ? Square : Volume2} active={speaking} onPress={() => { void read(); }} />
            {onRegenerate && <ReplyAction title={t("重新生成")} icon={RefreshCw} disabled={busy} onPress={onRegenerate} />}
          </View>
          {copied && <Text accessibilityLiveRegion="polite" className="mt-1 text-xs text-muted-foreground">{t("已复制")}</Text>}
          {vote && <Text accessibilityLiveRegion="polite" className="mt-1 text-xs text-muted-foreground">{t("反馈仅保留在本次会话，尚未上传。")}</Text>}
        </View>
      )}
    </View>
  );
}

function ReplyAction({ title, icon, active = false, disabled = false, onPress }: { title: string; icon: LucideIcon; active?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: active, disabled }} className={`h-10 w-10 items-center justify-center rounded-full active:bg-secondary ${active ? "bg-secondary" : ""} ${disabled ? "opacity-40" : ""}`}>
      <Icon icon={icon} className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`} />
    </Pressable>
  );
}
