import { Icon } from "@/components/icon";
import { useModel } from "@/components/model-context";
import { Link } from "expo-router";
import { ChevronDown, Zap } from "lucide-react-native";
import { Pressable, Text } from "react-native";

/**
 * Grok-style model chip. Lives in the composer instead of the navigation title
 * so the header can carry the mode tab and the private-chat toggle.
 */
export function ModelChip() {
  const { models, selectedModel } = useModel();
  const selected = models.find((model) => model.id === selectedModel);

  return (
    <Link href="/model-picker" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose model"
        className="h-9 flex-row items-center gap-1.5 rounded-full bg-secondary pl-3 pr-2.5 active:opacity-70"
      >
        <Icon icon={Zap} className="h-3.5 w-3.5 text-foreground" />
        <Text className="text-[14px] text-foreground">
          {selected?.label ?? "Model"}
        </Text>
        <Icon icon={ChevronDown} className="h-3 w-3 text-muted-foreground" />
      </Pressable>
    </Link>
  );
}
