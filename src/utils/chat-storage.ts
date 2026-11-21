import type { UIMessage } from "ai";
import { File, Paths } from "expo-file-system";
import type { ChatRecord } from "@/utils/chat-record";

type ChatStore = {
  chats: ChatRecord[];
  messages: Record<string, UIMessage[]>;
};

const STORAGE_KEY = "aion-chats-v1";

function isChatRecord(value: unknown): value is ChatRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number" &&
    typeof record.starred === "boolean"
  );
}

export function parseChatStore(raw: string | null): ChatStore {
  if (!raw) return { chats: [], messages: {} };
  try {
    const parsed = JSON.parse(raw) as { chats?: unknown; messages?: unknown };
    const chats = Array.isArray(parsed.chats) ? parsed.chats.filter(isChatRecord) : [];
    const messages: Record<string, UIMessage[]> = {};
    if (parsed.messages && typeof parsed.messages === "object") {
      for (const [id, value] of Object.entries(parsed.messages as Record<string, unknown>)) {
        if (Array.isArray(value)) messages[id] = value as UIMessage[];
      }
    }
    return { chats, messages };
  } catch {
    return { chats: [], messages: {} };
  }
}

export async function readChatStore(): Promise<ChatStore> {
  if (process.env.EXPO_OS === "web") {
    if (typeof window === "undefined") return { chats: [], messages: {} };
    return parseChatStore(window.localStorage.getItem(STORAGE_KEY));
  }
  const file = new File(Paths.document, `${STORAGE_KEY}.json`);
  return parseChatStore(file.exists ? await file.text() : null);
}

export async function writeChatStore(store: ChatStore): Promise<void> {
  const serialized = JSON.stringify(store);
  if (process.env.EXPO_OS === "web") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return;
  }
  const file = new File(Paths.document, `${STORAGE_KEY}.json`);
  file.write(serialized);
}
