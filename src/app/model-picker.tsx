import { usePreferences } from "@/components/preferences-context";
import { AndroidGrabber } from "@/components/grabber";
import { Icon } from "@/components/icon";
import { useModel } from "@/components/model-context";
import { MODEL_IDS } from "@/utils/model-config";
import { useRouter } from "expo-router";
import { Check, Sparkles } from "lucide-react-native";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

export default function ModelPickerSheet() {
  const { models, selectedModel, setSelectedModel, extendedThinking, setExtendedThinking } = useModel();
  const router = useRouter();
  const { t } = usePreferences();
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="android:pb-safe">
      <AndroidGrabber />
      {models.filter((model) => Object.hasOwn(MODEL_IDS, model.id)).map((model) => (
        <Pressable key={model.id} onPress={() => { setSelectedModel(model.id); router.back(); }} accessibilityRole="radio" accessibilityState={{ selected: selectedModel === model.id }} className="flex-row items-center gap-3 px-5 py-4 active:bg-secondary">
          <View className="flex-1"><Text className="text-[17px] text-foreground">{model.label}</Text>{model.subtitle ? <Text className="mt-1 text-sm text-muted-foreground">{model.subtitle}</Text> : null}</View>
          {selectedModel === model.id && <Icon icon={Check} className="h-5 w-5 text-foreground" />}
        </Pressable>
      ))}
      <View className="mx-5 my-2 h-px bg-border" />
      <View className="flex-row items-center gap-3.5 px-5 py-3">
        <Icon icon={Sparkles} className="h-5 w-5 text-foreground" />
        <View className="flex-1"><Text className="text-[17px] text-foreground">{t("Extended thinking")}</Text><Text className="text-sm text-muted-foreground">{t("真实模型模式下请求更长思考")}</Text></View>
        <Switch value={extendedThinking} onValueChange={setExtendedThinking} />
      </View>
      {process.env.EXPO_PUBLIC_MOCK_AI === "1" && <Text className="px-5 pb-5 text-sm text-muted-foreground">{t("当前为模拟回复，模型与思考选项将在接入真实 API 后生效。")}</Text>}
    </ScrollView>
  );
}
