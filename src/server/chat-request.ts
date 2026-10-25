import type { UIMessage } from "ai";
import { z } from "zod";
import { ATTACHMENT_MEDIA_TYPES, MAX_ATTACHMENT_BYTES, TEXT_MEDIA_TYPES } from "@/components/chat/attachments";
import { MODEL_IDS } from "@/utils/model-config";

export class ChatRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const partSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("step-start") }),
  z.object({ type: z.literal("reasoning"), text: z.string().max(150_000) }),
  z.object({ type: z.literal("text"), text: z.string().max(150_000) }),
  z.object({ type: z.literal("file"), mediaType: z.string().max(80), filename: z.string().max(180).optional(), url: z.string() }),
]);
const schema = z.object({
  model: z.string().default("sonnet-4.6"),
  extendedThinking: z.boolean().default(false),
  language: z.enum(["zh", "en"]).default("zh"),
  projectInstructions: z.string().max(4000).default(""),
  messages: z.array(z.object({ id: z.string().min(1).max(128), role: z.enum(["user", "assistant"]), parts: z.array(partSchema).min(1).max(12) })).min(1).max(100),
});

async function readBody(request: Request) {
  const limit = 12 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new ChatRequestError("消息与附件总量过大，请开启新对话或减少附件。", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ChatRequestError("消息不能为空。");
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new ChatRequestError("消息与附件总量过大，请开启新对话或减少附件。", 413); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function parseChatRequest(request: Request): Promise<{ messages: UIMessage[]; model: string; extendedThinking: boolean; language: "zh" | "en"; projectInstructions: string }> {
  let json: unknown;
  try { json = JSON.parse(await readBody(request)); } catch (error) {
    if (error instanceof ChatRequestError) throw error;
    throw new ChatRequestError("请求不是有效的 JSON。");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new ChatRequestError("消息格式不正确，或超出了会话长度限制。");
  const { messages, model, extendedThinking, language, projectInstructions } = parsed.data;
  if (!Object.hasOwn(MODEL_IDS, model)) throw new ChatRequestError("不支持此模型。");
  // SDK responses contain step-start and optional reasoning parts. They are
  // legitimate history, but only visible text/files are forwarded as context.
  const safeMessages: UIMessage[] = messages.map((message) => ({ ...message, parts: message.parts.filter((part) => part.type !== "step-start" && part.type !== "reasoning").map((part) => {
    if (part.type === "text") return part;
    if (message.role !== "user" || !ATTACHMENT_MEDIA_TYPES.includes(part.mediaType) || !part.url.startsWith(`data:${part.mediaType};base64,`)) {
      throw new ChatRequestError("附件类型或数据无效；不接受外部附件 URL。");
    }
    const encoded = part.url.slice(part.url.indexOf(",") + 1);
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new ChatRequestError("附件编码无效。");
    const byteLength = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
    if (byteLength > MAX_ATTACHMENT_BYTES || byteLength <= 0) throw new ChatRequestError("单个附件必须在 1 字节至 4 MB 之间。");
    if (TEXT_MEDIA_TYPES.includes(part.mediaType)) {
      if (byteLength > 128 * 1024) throw new ChatRequestError("文本文件不能超过 128 KB。");
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))); }
      catch { throw new ChatRequestError("文本附件编码无效，请使用 UTF-8 文本。"); }
      return { type: "text" as const, text: `附件 ${JSON.stringify(part.filename ?? "text-file")} 的内容：\n\n${text}` };
    }
    return part;
  }) })).filter((message) => message.parts.length > 0);
  return { messages: safeMessages, model: MODEL_IDS[model], extendedThinking, language, projectInstructions };
}
