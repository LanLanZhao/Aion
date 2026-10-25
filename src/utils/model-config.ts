// Keep UI labels separate from provider IDs; callers cannot choose arbitrary paid models.
export const MODEL_IDS: Record<string, string> = {
  "sonnet-4.6": "claude-sonnet-4-6",
  "opus-4.6": "claude-opus-4-6",
  "haiku-4.5": "claude-haiku-4-5-20251001",
};
export const DEFAULT_MODELS = [
  { id: "sonnet-4.6", label: "Sonnet 4.6" },
  { id: "opus-4.6", label: "Opus 4.6" },
  { id: "haiku-4.5", label: "Haiku 4.5" },
] as const;
