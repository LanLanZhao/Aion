export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: import("./attachments").ChatAttachment[];
  timing?: import("./reply-timing").ReplyTiming;
};
