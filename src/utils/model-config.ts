// Keep UI labels separate from provider IDs; callers cannot choose arbitrary paid models.
export const MODEL_IDS: Record<string, string> = {
  "deepseek-flash": "deepseek-flash",
  "deepseek-v4-pro": "deepseek-v4-pro",
};

export const DEFAULT_MODELS = [
  { id: "deepseek-flash", label: "DeepSeek V4.1 Flash", subtitle: "最新通用模型，支持图像" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", subtitle: "更强知识，纯文本" },
] as const;
