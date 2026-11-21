import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { ArrowLeft } from "lucide-react-native";
import { Pressable } from "react-native";

export function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = usePreferences();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t("Go back")} className="mr-3 h-10 w-10 items-center justify-center active:opacity-60">
    <Icon icon={ArrowLeft} className="h-6 w-6 text-foreground" />
  </Pressable>;
}
