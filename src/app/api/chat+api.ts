import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";
import { ChatRequestError, parseChatRequest } from "@/server/chat-request";

export async function POST(req: Request) {
  // No authentication service is connected yet. Never expose a paid anonymous
  // production endpoint merely because a provider key exists on the server.
  if (!__DEV__) return Response.json({ error: "真实模型接口尚未接入身份验证，生产环境暂不可用。" }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "服务端未配置模型 API Key。" }, { status: 503 });
  try {
  const { messages, model, extendedThinking, language, projectInstructions } = await parseChatRequest(req);

  const result = streamText({
    model: anthropic(model),
    system: `${language === "zh" ? "请默认用简体中文回答，除非用户明确要求其他语言。" : "Reply in English by default, unless the user explicitly asks for another language."}${projectInstructions ? `\n\n项目通用指令：\n${projectInstructions}` : ""}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
    providerOptions: extendedThinking ? { anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } } } : undefined,
  });

  return result.toUIMessageStreamResponse({
    onError: __DEV__ ? errorHandler : undefined,
    headers: {
      // Issue with iOS NSURLSession that requires Content-Type set in order to enable streaming.
      // https://github.com/expo/expo/issues/32950#issuecomment-2508297646
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "none",
    },
  });
  } catch (error) {
    if (error instanceof ChatRequestError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "模型请求失败，请稍后重试。" }, { status: 502 });
  }
}

function errorHandler(error: unknown) {
  if (error == null) return "unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}
