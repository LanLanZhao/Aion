import { File, Paths } from "expo-file-system";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { translate } from "@/utils/i18n";
import { DEFAULT_PREFERENCES, parsePreferences, type AppPreferences, type Language, type UserProfile } from "@/utils/preferences";

type Preferences = AppPreferences & {
  setLanguage: (language: Language) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  t: (text: string) => string;
};
const Context = createContext<Preferences | null>(null);
const STORAGE_KEY = "aion-preferences-v1";

async function readSavedPreferences(): Promise<AppPreferences> {
  if (process.env.EXPO_OS === "web") {
    if (typeof window === "undefined") return parsePreferences(null);
    return parsePreferences(window.localStorage.getItem(STORAGE_KEY));
  }
  const file = new File(Paths.document, STORAGE_KEY + ".json");
  return parsePreferences(file.exists ? await file.text() : null);
}
async function writeSavedPreferences(value: AppPreferences) {
  const serialized = JSON.stringify(value);
  if (process.env.EXPO_OS === "web") {
    if (typeof window === "undefined") throw new Error("Storage is unavailable");
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return;
  }
  const file = new File(Paths.document, STORAGE_KEY + ".json");
  file.write(serialized);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const current = useRef(DEFAULT_PREFERENCES);
  const loading = useRef<Promise<void> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  const ensureLoaded = useCallback(() => {
    loading.current ??= readSavedPreferences().then((saved) => {
      current.current = saved;
      if (mounted.current) setPreferences(saved);
    }).catch(() => {
      Alert.alert(translate(current.current.language, "Unable to load preferences"), translate(current.current.language, "Default settings are in use. Please try saving again."));
    });
    return loading.current;
  }, []);
  useEffect(() => {
    mounted.current = true;
    void ensureLoaded();
    return () => { mounted.current = false; };
  }, [ensureLoaded]);

  const update = useCallback((change: (previous: AppPreferences) => AppPreferences) => {
    const operation = queue.current.then(async () => {
      // Read before merging: a tap during startup must not overwrite saved profile fields.
      await ensureLoaded();
      const next = change(current.current);
      try { await writeSavedPreferences(next); }
      catch (error) {
        Alert.alert(translate(current.current.language, "Unable to save"), translate(current.current.language, "Your changes were not saved. Please try again."));
        throw error;
      }
      current.current = next;
      if (mounted.current) setPreferences(next);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ensureLoaded]);
  const setLanguage = useCallback((language: Language) => update((previous) => ({ ...previous, language })), [update]);
  const updateProfile = useCallback((patch: Partial<UserProfile>) => update((previous) => ({ ...previous, profile: { ...previous.profile, ...patch } })), [update]);
  const value = useMemo(() => ({ ...preferences, setLanguage, updateProfile, t: (text: string) => translate(preferences.language, text) }), [preferences, setLanguage, updateProfile]);
  return <Context value={value}>{children}</Context>;
}
export function usePreferences() {
  const value = use(Context);
  if (!value) throw new Error("usePreferences must be used within PreferencesProvider");
  return value;
}
