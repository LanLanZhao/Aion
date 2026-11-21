import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useResearch } from "@/components/research/research-context";
import type { ServerDraft } from "@/components/research/research-model";
import { SafeAreaView } from "@/components/tw";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp, KeyRound, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  divider?: boolean;
  keyboardType?: "default" | "number-pad";
  maxLength?: number;
  autoFocus?: boolean;
  autoCapitalize?: "none" | "sentences";
};

function Field({ label, divider = true, ...input }: FieldProps) {
  const { t } = usePreferences();
  return (
    <View className={`px-5 py-3 ${divider ? "border-t border-border" : ""}`}>
      <Text className="text-[13px] text-muted-foreground">{t(label)}</Text>
      <TextInput
        {...input}
        placeholderTextColor="#8E8E93"
        autoCorrect={false}
        className="mt-1 min-h-9 py-1 text-[16px] text-foreground"
      />
    </View>
  );
}

export function ServerForm({
  title,
  initial,
  keyPathHint,
  saveErrorTitle = "Unable to save server",
  onSave,
}: {
  title: string;
  initial?: Partial<ServerDraft>;
  keyPathHint?: string;
  saveErrorTitle?: string;
  onSave: (draft: ServerDraft) => Promise<void>;
}) {
  const { t } = usePreferences();
  const { loadSshHosts } = useResearch();
  const router = useRouter();
  const goBack = () => {
    Keyboard.dismiss();
    router.back();
  };

  const [name, setName] = useState(initial?.name ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [port, setPort] = useState(String(initial?.port ?? 22));
  const [user, setUser] = useState(initial?.user ?? "");
  const [keyPath, setKeyPath] = useState(initial?.keyPath ?? "");
  const [condaEnv, setCondaEnv] = useState(initial?.condaEnv ?? "");
  const [rootDir, setRootDir] = useState(initial?.rootDir ?? "");
  const [hosts, setHosts] = useState<string[]>([]);
  const [showHosts, setShowHosts] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSshHosts()
      .then((list) => { if (active) setHosts(list); })
      .catch(() => {});
    return () => { active = false; };
  }, [loadSshHosts]);

  const canSave = Boolean(name.trim() && host.trim() && user.trim()) && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({
        name,
        host,
        port: port.trim() ? Number(port) : 22,
        user,
        keyPath,
        condaEnv,
        rootDir,
      });
      Keyboard.dismiss();
      router.back();
    } catch (cause) {
      Alert.alert(t(saveErrorTitle), t(cause instanceof Error ? cause.message : "请稍后重试。"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-muted" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-4">
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t("Cancel")} className="h-11 w-11 items-center justify-center active:opacity-60">
          <Icon icon={X} className="h-6 w-6 text-foreground" />
        </Pressable>
        <Text className="flex-1 px-2 text-[19px] font-semibold text-foreground">{title}</Text>
        <Pressable
          onPress={() => { void save(); }}
          disabled={!canSave}
          accessibilityRole="button"
          className={`rounded-full px-5 py-2.5 ${canSave ? "bg-card active:bg-secondary" : "bg-secondary"}`}
        >
          <Text className={`text-[15px] font-medium ${canSave ? "text-foreground" : "text-muted-foreground"}`}>
            {t(busy ? "Saving…" : "Save")}
          </Text>
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-12 pt-3">
        <Text className="mb-2 px-1 text-[14px] text-muted-foreground">{t("Connection")}</Text>
        <View className="overflow-hidden rounded-[22px] bg-card">
          <Field label="Server name" value={name} onChangeText={setName} placeholder={t("4090 training box")} maxLength={60} autoFocus divider={false} />
          <Field label="Host" value={host} onChangeText={setHost} placeholder="10.0.0.5" autoCapitalize="none" maxLength={255} />
          {hosts.length ? (
            <>
              <Pressable
                onPress={() => setShowHosts((open) => !open)}
                accessibilityRole="button"
                className="flex-row items-center gap-2 border-t border-border px-5 py-3 active:bg-secondary"
              >
                <Icon icon={KeyRound} className="h-4 w-4 text-muted-foreground" />
                <Text className="flex-1 text-[14px] text-muted-foreground">{t("Pick from ssh config")}</Text>
                <Icon icon={showHosts ? ChevronUp : ChevronDown} className="h-4 w-4 text-muted-foreground" />
              </Pressable>
              {showHosts
                ? hosts.map((alias) => (
                    <Pressable
                      key={alias}
                      onPress={() => { setHost(alias); setShowHosts(false); }}
                      accessibilityRole="button"
                      className="border-t border-border px-5 py-3 active:bg-secondary"
                    >
                      <Text className="text-[15px] text-foreground">{alias}</Text>
                    </Pressable>
                  ))
                : null}
            </>
          ) : null}
          <Field label="Port" value={port} onChangeText={setPort} keyboardType="number-pad" maxLength={5} />
          <Field label="Username" value={user} onChangeText={setUser} autoCapitalize="none" maxLength={200} />
          <Field label="Private key path (optional)" value={keyPath} onChangeText={setKeyPath} placeholder="~/.ssh/id_ed25519" autoCapitalize="none" maxLength={500} />
        </View>
        <Text className="mt-2 px-1 text-[12px] leading-5 text-muted-foreground">
          {t("SSH key paths refer to the computer running the relay.")}{keyPathHint ? ` ${keyPathHint}` : ""}
        </Text>

        <Text className="mb-2 mt-7 px-1 text-[14px] text-muted-foreground">{t("Experiment (optional)")}</Text>
        <View className="overflow-hidden rounded-[22px] bg-card">
          <Field label="Conda environment (optional)" value={condaEnv} onChangeText={setCondaEnv} placeholder="research" autoCapitalize="none" maxLength={100} divider={false} />
          <Field label="Experiment root (optional)" value={rootDir} onChangeText={setRootDir} placeholder="~/runs" autoCapitalize="none" maxLength={500} />
        </View>
        <Text className="mt-2 px-1 text-[12px] leading-5 text-muted-foreground">
          {t("Saved for now; metrics and curves arrive in the next version.")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
