import {
  ChatProvider,
  Conversation,
  ConversationScrollButton,
  Message,
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  createStreamingStore,
  type ChatMessage,
} from "@/components/chat";
import { Icon } from "@/components/icon";
import { ModelChip } from "@/components/model-chip";
import { MainHeader } from "@/components/main-header";
import { AttachmentList } from "@/components/chat/attachment-list";
import { AttachmentMenu } from "@/components/chat/attachment-menu";
import { useAttachmentDraft } from "@/components/chat/attachment-draft";
import { mergeAttachments, toFileParts, type ChatAttachment } from "@/components/chat/attachments";
import { resolveChatApiUrl } from "@/components/chat/api-url";
import { useModel } from "@/components/model-context";
import { useDrawer } from "@/components/drawer-content";
import { usePreferences } from "@/components/preferences-context";
import { useProjects } from "@/components/projects/project-context";
import type { Project } from "@/components/projects/project-model";
import { AssistantReply } from "@/components/chat/assistant-reply";
import type { ReplyTiming } from "@/components/chat/reply-timing";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Constants from "expo-constants";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { HatGlasses, MessageSquare } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

const USE_MOCK = process.env.EXPO_PUBLIC_MOCK_AI === "1";

// Throttle interval for streaming UI updates (~30fps)
const STREAMING_THROTTLE_MS = 32;

const MOCK_RESPONSES = [
  "That's a great question! Here's what I think:\n\nThe key insight is that **simplicity** often beats complexity. When you break down the problem into smaller pieces, the solution becomes much clearer.\n\n```javascript\nconst answer = problems\n  .map(simplify)\n  .reduce(combine, []);\n```\n\nHope that helps!",
  "I'd be happy to help with that. Let me walk you through it step by step:\n\n1. **First**, identify the core requirements\n2. **Then**, design the interface\n3. **Finally**, implement and test\n\nThe most important thing is to start simple and iterate. You can always add more features later.",
  "Interesting! Here's a quick overview:\n\n> The best code is the code you don't have to write.\n\nThat said, when you *do* need to write code, keep these principles in mind:\n\n- **Readability** over cleverness\n- **Composition** over inheritance\n- **Explicit** over implicit\n\nLet me know if you want me to dive deeper into any of these!",
  "Sure thing! Here's a concise answer:\n\nThe approach I'd recommend is to use a **streaming architecture** where data flows through the system in real-time. This gives you:\n\n- Lower latency\n- Better resource utilization\n- Simpler error handling\n\n```python\nasync for chunk in stream:\n    process(chunk)\n```\n\nWant me to elaborate on any part?",
];

const MOCK_RESPONSES_ZH = [
  "你好！有什么可以帮你？\n\n这是 **Quest 的模拟回复**，用于体验流式输出、Markdown 和回复操作。当前尚未连接真实模型，因此不会真正理解或解答你发送的问题。\n\n你可以尝试：\n\n- 复制或分享这段文字\n- 点赞、点踩或使用系统朗读\n- 重新生成最后一条回复\n\n```javascript\nconst greeting = '你好，Chiullian';\nconsole.log(greeting);\n```",
  "我可以陪你梳理思路。\n\n1. 先说明你想达到的目标。\n2. 补充必要的背景与限制。\n3. 把复杂问题拆成几个小步骤。\n\n> 当前内容为本地模拟，用于验证界面和交互，并非真实模型的回答。",
  "我们可以从最简单的一步开始。\n\n**清楚地描述问题**，通常比增加复杂度更有帮助。\n\n- 你已经尝试了什么？\n- 哪一步没有得到预期结果？\n- 你希望最终看到什么？\n\n这是模拟回复，你也可以点击下方的重新生成按钮体验不同示例。",
];

async function mockStreamResponse(
  text: string,
  onToken: (token: string) => void,
  signal?: AbortSignal,
) {
  // Chinese has no word spaces. Preserve every character while streaming it
  // in small chunks rather than flashing entire paragraphs at once.
  const words = text.match(/[\u3400-\u9fff]|[^\u3400-\u9fff\s]+|\s+/g) ?? [];
  for (const word of words) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 40));
    if (signal?.aborted) return;
    onToken(word);
  }
}

/** Extract text content from a UIMessage's parts array. */
function getTextFromParts(
  parts: { type: string; text?: string }[],
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text)
    .join("");
}

function useAIChat(attachments: ChatAttachment[], onAccepted: () => void, language: "zh" | "en" = "zh", project: Project | null = null) {
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState(() => `${Date.now()}-${Math.random()}`);
  const [sendError, setSendError] = useState<Error | null>(null);
  const streamingStore = useMemo(() => createStreamingStore(), []);
  const prevStreamingTextRef = useRef("");
  const busy = useRef(false);
  const generation = useRef(0);
  const requestTiming = useRef<ReplyTiming | null>(null);
  const [timings, setTimings] = useState<Record<string, ReplyTiming>>({});
  const { selectedModel, extendedThinking } = useModel();
  const api = resolveChatApiUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri, __DEV__, process.env.EXPO_OS);
  const transport = useMemo(() => new DefaultChatTransport({ api: api ?? "/api/chat", fetch: expoFetch }), [api]);

  const {
    messages: uiMessages,
    sendMessage,
    regenerate: sdkRegenerate,
    setMessages,
    stop,
    status,
    error,
  } = useChat({ id: chatId, transport });

  const isStreaming = status === "streaming";
  const isGenerating = isStreaming || status === "submitted";
  useEffect(() => () => { void stop(); }, [stop]);

  useEffect(() => {
    const last = uiMessages.at(-1);
    const pending = requestTiming.current;
    if (!pending || last?.role !== "assistant") return;
    const hasText = last.parts.some(part => part.type === "text" && part.text.length > 0);
    if (hasText && pending.firstTokenAt == null) pending.firstTokenAt = Date.now();
    if (last.parts.some(part => part.type === "reasoning")) pending.kind = "thinking";
    if (!isGenerating && pending.completedAt == null) pending.completedAt = Date.now();
    const entry = { ...pending };
    setTimings(previous => {
      const old = previous[last.id];
      return old?.startedAt === entry.startedAt && old?.firstTokenAt === entry.firstTokenAt && old?.completedAt === entry.completedAt && old?.kind === entry.kind ? previous : { ...previous, [last.id]: entry };
    });
  }, [uiMessages, isGenerating]);

  // Map UIMessages to ChatMessages
  const messages: ChatMessage[] = useMemo(() => {
    return uiMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      timing: timings[m.id],
      content:
        isStreaming &&
        m.role === "assistant" &&
        m === uiMessages[uiMessages.length - 1]
          ? "" // Signal streaming — content comes from store
          : getTextFromParts(m.parts),
      attachments: m.parts.filter((part) => part.type === "file").map((part, index) => ({
        id: `${m.id}-${index}`, uri: part.url, name: part.filename ?? "attachment", mediaType: part.mediaType,
        dataUrl: part.url, size: 0,
      })),
    }));
  }, [uiMessages, isStreaming, timings]);

  // Sync streaming text to the store
  useEffect(() => {
    if (!isStreaming) {
      if (prevStreamingTextRef.current) {
        prevStreamingTextRef.current = "";
        streamingStore.set("");
      }
      return;
    }
    const lastMessage = uiMessages[uiMessages.length - 1];
    if (lastMessage?.role === "assistant") {
      const text = getTextFromParts(
        lastMessage.parts,
      );
      if (text !== prevStreamingTextRef.current) {
        prevStreamingTextRef.current = text;
        streamingStore.set(text);
      }
    }
  }, [uiMessages, isStreaming, streamingStore]);

  const onSend = useCallback(() => {
    if ((!input.trim() && !attachments.length) || isGenerating || busy.current) return;
    if (!api) { setSendError(new Error("尚未配置可用的模型 API 地址（EXPO_PUBLIC_API_URL）。")); return; }
    const token = ++generation.current;
    busy.current = true;
    setSendError(null);
    void (async () => {
      try {
      const projectFiles: ChatAttachment[] = [];
      // Project files enter the first user message. Later requests already
      // carry that message in history, avoiding duplicate uploads.
      if (project && uiMessages.length === 0) {
        for (const item of project.files) {
          const file = new File(item.uri);
          if (!file.exists || file.size !== item.size) throw new Error("项目文件已不可用，请重新选择。");
          projectFiles.push({ ...item, dataUrl: `data:${item.mediaType};base64,${await file.base64()}` });
        }
      }
      const files = toFileParts(mergeAttachments(projectFiles, attachments));
      requestTiming.current = { startedAt: Date.now(), kind: "response" };
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const payload = input.trim() ? { text: input.trim(), files } : { files };
      const sending = sendMessage(payload, { body: { model: selectedModel, extendedThinking, language, projectInstructions: project?.instructions ?? "" } });
      if (token === generation.current) {
        setInput(previous => previous === input ? "" : previous);
        onAccepted();
      }
      await sending;
      } catch (error) {
        if (token === generation.current) setSendError(error instanceof Error ? error : new Error("发送失败，请重试。"));
      } finally { if (token === generation.current) busy.current = false; }
    })();
  }, [input, attachments, isGenerating, api, sendMessage, selectedModel, extendedThinking, language, onAccepted, project, uiMessages.length]);

  const regenerate = useCallback(async (messageId: string) => {
    if (isGenerating || busy.current || uiMessages.at(-1)?.id !== messageId || uiMessages.at(-1)?.role !== "assistant") return;
    if (!api) { setSendError(new Error("尚未配置可用的模型 API 地址（EXPO_PUBLIC_API_URL）。")); return; }
    const token = ++generation.current;
    busy.current = true;
    setSendError(null);
    requestTiming.current = { startedAt: Date.now(), kind: "response" };
    try { await sdkRegenerate({ messageId, body: { model: selectedModel, extendedThinking, language, projectInstructions: project?.instructions ?? "" } }); }
    catch (error) { if (token === generation.current) setSendError(error instanceof Error ? error : new Error("发送失败，请重试。")); }
    finally { if (token === generation.current) busy.current = false; }
  }, [isGenerating, uiMessages, api, sdkRegenerate, selectedModel, extendedThinking, language, project]);

  const clear = useCallback(() => {
    generation.current++;
    busy.current = false;
    requestTiming.current = null;
    setTimings({});
    void stop();
    // Detach the old SDK Chat so a late response cannot mutate the next chat.
    setChatId(`${Date.now()}-${Math.random()}`);
    setMessages([]);
    setInput("");
    setSendError(null);
    prevStreamingTextRef.current = "";
    streamingStore.set("");
  }, [stop, setMessages, streamingStore]);

  return {
    messages,
    input,
    setInput,
    isGenerating,
    onSend,
    clear,
    streamingStore,
    regenerate,
    error: sendError ?? error ?? null,
  };
}

function useMockChat(attachments: ChatAttachment[] = [], onAccepted: () => void = () => {}, language: "zh" | "en" = "zh", project: Project | null = null) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const streamingStore = useMemo(() => createStreamingStore(), []);
  const streamingRef = useRef("");
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mockIndexRef = useRef(0);
  const active = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useEffect(() => () => {
    active.current?.abort();
    if (throttleRef.current) clearTimeout(throttleRef.current);
  }, []);

  const generate = useCallback(async (userMessage: ChatMessage, history: ChatMessage[], retry = false) => {
    if (isGenerating || busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    active.current = controller;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "assistant",
      content: "",
      timing: { startedAt: Date.now(), kind: "simulated" },
    };

    const newMessages = [...history, userMessage, assistantMessage];
    setMessages(newMessages);
    if (!retry) setInput("");
    setIsGenerating(true);
    if (!retry) onAccepted();

    streamingRef.current = "";
    streamingStore.set("");

    try {
      const files = userMessage.attachments ?? [];
      const responses = language === "zh" ? MOCK_RESPONSES_ZH : MOCK_RESPONSES;
      const mockText = project
        ? language === "zh" ? `【模拟模式】当前对话属于项目「${project.name}」，保存了 ${project.files.length} 个项目文件和项目说明。尚未连接真实模型，因此不会解析项目文件或执行项目指令。` : `[Simulated] This chat belongs to project “${project.name}” with ${project.files.length} saved files and project instructions. No live model is connected to analyze files or follow instructions.`
        : files.length
        ? language === "zh" ? `【模拟模式】已将 ${files.map((file) => file.name).join("、")} 加入本条消息。当前没有调用模型解析附件内容；真实解析需要接入模型 API。` : `[Simulated] Attached ${files.map((file) => file.name).join(", ")}. No model was called to analyze these files.`
        : responses[mockIndexRef.current % responses.length];
      mockIndexRef.current++;

      await mockStreamResponse(mockText, (token) => {
        if (controller.signal.aborted) return;
        streamingRef.current += token;
        if (!throttleRef.current) {
          throttleRef.current = setTimeout(() => {
            streamingStore.set(streamingRef.current);
            throttleRef.current = null;
          }, STREAMING_THROTTLE_MS);
        }
      }, controller.signal);
    } catch (err) {
      console.error("Generation error:", err);
      streamingRef.current = "Error generating response";
    } finally {
      if (controller.signal.aborted || active.current !== controller) return;
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      const finalContent = streamingRef.current;
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: finalContent,
          timing: { ...assistantMessage.timing!, completedAt: Date.now() },
        };
        return updated;
      });
      streamingRef.current = "";
      streamingStore.set("");
      setIsGenerating(false);
      busy.current = false;
      active.current = null;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isGenerating, streamingStore, onAccepted, language, project]);

  const handleSend = useCallback(() => {
    if (!input.trim() && !attachments.length) return;
    return generate({ id: `${Date.now()}-${Math.random()}`, role: "user", content: input.trim(), attachments: [...attachments] }, messages);
  }, [input, attachments, messages, generate]);

  const regenerate = useCallback((messageId: string) => {
    const last = messages.at(-1);
    const user = messages.at(-2);
    if (last?.id !== messageId || last.role !== "assistant" || user?.role !== "user") return;
    return generate(user, messages.slice(0, -2), true);
  }, [messages, generate]);

  const clearMessages = useCallback(() => {
    active.current?.abort();
    active.current = null;
    busy.current = false;
    if (throttleRef.current) { clearTimeout(throttleRef.current); throttleRef.current = null; }
    setMessages([]);
    setInput("");
    setIsGenerating(false);
    streamingRef.current = "";
    streamingStore.set("");
  }, [streamingStore]);

  return {
    messages,
    input,
    setInput,
    isGenerating,
    onSend: handleSend,
    clear: clearMessages,
    streamingStore,
    regenerate,
  };
}

// The build-time mode selects one hook for the lifetime of this bundle.
const useChatImplementation = USE_MOCK ? useMockChat : useAIChat;

export default function ChatScreen() {
  const { language, t } = usePreferences();
  const { projects } = useProjects();
  const { newChat, projectId } = useLocalSearchParams<{ newChat?: string; projectId?: string }>();
  const [privateMode, setPrivateMode] = useState(false);
  const project = privateMode ? null : projects.find(item => item.id === projectId) ?? null;
  const draft = useAttachmentDraft();
  const { clear: clearDraft } = draft;
  const implementation = useChatImplementation(draft.attachments, clearDraft, language, project);
  const { clear: clearChat } = implementation;
  const chat = { ...implementation, hasAttachments: draft.attachments.length > 0, isPickingAttachment: draft.isPicking };
  const { isGenerating, streamingStore } = chat;
  const { openDrawer, takeDrawerRestore } = useDrawer();
  const handledReset = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (newChat && newChat !== handledReset.current) {
      handledReset.current = newChat;
      clearChat();
      clearDraft();
      setPrivateMode(false);
    }
  }, [newChat, clearChat, clearDraft]);

  // Returning from a drawer destination should land back on the drawer.
  useFocusEffect(
    useCallback(() => {
      // Defer past the commit so the popped screen's cleanup has run and has
      // had a chance to record the restore request.
      const frame = requestAnimationFrame(() => {
        if (takeDrawerRestore()) openDrawer();
      });
      return () => cancelAnimationFrame(frame);
    }, [openDrawer, takeDrawerRestore]),
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.role === "user") {
        return <Message from="user"><View>{item.attachments?.length ? <AttachmentList attachments={item.attachments} /> : null}{item.content ? <Text selectable className="text-base leading-5.5 text-foreground">{item.content}</Text> : null}</View></Message>;
      }

      const isStreaming = isGenerating && item.id === chat.messages.at(-1)?.id && item.content === "";
      return (
        <Message from="assistant">
          <AssistantReply message={item} streaming={isStreaming} store={streamingStore} onRegenerate={item.id === chat.messages.at(-1)?.id ? () => { void implementation.regenerate(item.id); } : undefined} busy={isGenerating} />
        </Message>
      );
    },
    [isGenerating, streamingStore, chat.messages, implementation],
  );

  const { clear } = chat;

  const togglePrivate = useCallback(() => {
    // Nothing carries into a private chat, and leaving one discards it.
    clear();
    clearDraft();
    setPrivateMode((previous) => !previous);
  }, [clear, clearDraft]);

  return (
    <>
      <ChatProvider value={chat}>
        <Conversation
          renderMessage={renderMessage}
          emptyState={<ChatEmptyState privateMode={privateMode} />}
        >
          <ConversationScrollButton />
          <PromptInput>
            <PromptInputBody>
              {project && <Text numberOfLines={1} className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">📁 {project.name} · {project.files.length} {t("files")}</Text>}
              <AttachmentList attachments={draft.attachments} onRemove={draft.remove} />
              {draft.isPicking && <Text className="px-1 pb-1 text-xs text-muted-foreground">{t("正在读取附件…")}</Text>}
              <PromptInputTextarea
                placeholder={t(privateMode ? "Temporary chat" : "Ask anything...")}
              />
              <View className="mt-2 flex-row items-center gap-2">
                <AttachmentMenu />
                <ModelChip />
                <View className="flex-1" />
                <PromptInputSubmit />
              </View>
            </PromptInputBody>
          </PromptInput>
        </Conversation>
      </ChatProvider>
      <MainHeader privateMode={privateMode} onTogglePrivate={togglePrivate} />
    </>
  );
}

function ChatEmptyState({ privateMode }: { privateMode: boolean }) {
  const { t } = usePreferences();
  return (
    <View className="flex-1 items-center justify-center px-10">
      <View style={{ opacity: 0.16 }}>
        <Icon
          icon={privateMode ? HatGlasses : MessageSquare}
          className="h-28 w-28 text-foreground"
        />
      </View>
      <Text className="mt-8 text-[22px] font-semibold text-foreground">
        {t(privateMode ? "Private chat" : "Chat")}
      </Text>
      <Text className="mt-2 text-center text-[15px] leading-relaxed text-muted-foreground">
        {t(privateMode
          ? "本应用不保存此临时会话。接入模型服务后的数据处理以服务方政策为准。"
          : "Ask anything to get started.")}
      </Text>
    </View>
  );
}
