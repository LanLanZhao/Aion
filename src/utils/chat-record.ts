export type ChatRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  starred: boolean;
};

const MAX_TITLE_LENGTH = 48;

/** Build a conversation title from the first user message. */
export function chatTitleFromInput(text: string, fallback: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > MAX_TITLE_LENGTH
    ? `${normalized.slice(0, MAX_TITLE_LENGTH)}…`
    : normalized;
}

export function daysAgo(updatedAt: number, now = Date.now()): number {
  return Math.max(0, Math.floor((now - updatedAt) / 86_400_000));
}
