import type { FileUIPart } from "ai";

export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DRAFT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;
export const TEXT_MEDIA_TYPES = ["text/plain", "text/markdown", "text/csv", "application/json"];
export const ATTACHMENT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", ...TEXT_MEDIA_TYPES];

export type ChatAttachment = {
  id: string;
  uri: string;
  name: string;
  mediaType: string;
  size: number;
  dataUrl: string;
};

export function validateAttachment(file: Pick<ChatAttachment, "name" | "mediaType" | "size">) {
  if (!ATTACHMENT_MEDIA_TYPES.includes(file.mediaType)) {
    throw new Error("不支持此文件格式。请选择 JPG、PNG、WebP、GIF、PDF 或文本文件。");
  }
  if (!Number.isFinite(file.size) || file.size < 0) throw new Error("无法确认文件大小，请重新选择。");
  if (file.size === 0) throw new Error("无法添加空文件。");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("单个附件不能超过 4 MB。");
  if (TEXT_MEDIA_TYPES.includes(file.mediaType) && file.size > 128 * 1024) {
    throw new Error("文本文件不能超过 128 KB。");
  }
}

export function mergeAttachments(current: ChatAttachment[], incoming: ChatAttachment[]) {
  const result = [...current];
  for (const file of incoming) {
    validateAttachment(file);
    if (!result.some((existing) => existing.uri === file.uri)) result.push(file);
  }
  if (result.length > MAX_ATTACHMENTS) throw new Error("每条消息最多添加 4 个附件。");
  if (result.reduce((sum, file) => sum + file.size, 0) > MAX_DRAFT_BYTES) {
    throw new Error("一条消息的附件总大小不能超过 8 MB。");
  }
  return result;
}

export function toFileParts(attachments: ChatAttachment[]): FileUIPart[] {
  return attachments.map((file) => {
    if (!file.dataUrl?.startsWith(`data:${file.mediaType};base64,`)) {
      throw new Error("附件数据无效，请移除后重新选择。");
    }
    return { type: "file", filename: file.name, mediaType: file.mediaType, url: file.dataUrl };
  });
}
