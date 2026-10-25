export type Language = "zh" | "en";
export type UserProfile = { name: string; nickname: string; preferences: string };
export type AppPreferences = { language: Language; profile: UserProfile };
export const DEFAULT_PREFERENCES: AppPreferences = {
  language: "zh",
  profile: { name: "Chiullian", nickname: "Chiullian", preferences: "" },
};

export function parsePreferences(raw: string | null): AppPreferences {
  let value: unknown;
  try { value = raw ? JSON.parse(raw) : null; } catch { value = null; }
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const profile = saved.profile && typeof saved.profile === "object" && !Array.isArray(saved.profile)
    ? saved.profile as Record<string, unknown> : {};
  return {
    language: saved.language === "en" ? "en" : "zh",
    profile: {
      name: typeof profile.name === "string" && profile.name.trim() ? profile.name : DEFAULT_PREFERENCES.profile.name,
      nickname: typeof profile.nickname === "string" ? profile.nickname : DEFAULT_PREFERENCES.profile.nickname,
      preferences: typeof profile.preferences === "string" ? profile.preferences : "",
    },
  };
}
