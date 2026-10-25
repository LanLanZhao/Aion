import { cn } from "@/utils/tailwind";
import { ArrowUp } from "lucide-react-native";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { usePreferences } from "@/components/preferences-context";
import { useChatContext } from "./chat-context";
import { useConversationContext } from "./conversation";

/**
 * Root container for the message composer. Positions itself at the bottom of
 * the `<Conversation />` using the shared conversation context.
 */
export function PromptInput({ children }: { children: ReactNode }) {
  const { promptInputStyle, onPromptInputLayout } = useConversationContext();
  const { error } = useChatContext();

  return (
    <Animated.View
      onLayout={onPromptInputLayout}
      style={[{ position: "absolute", left: 0, right: 0, paddingBottom: process.env.EXPO_OS === "android" ? 12 : 0 }, promptInputStyle]}
    >
      {error && <PromptInputError message={error.message} />}
      <View className="mx-3 rounded-[26px] border border-border bg-card px-3 pb-2 pt-3">
        {children}
      </View>
    </Animated.View>
  );
}

function PromptInputError({ message }: { message?: string }) {
  const { t } = usePreferences();
  return (
    <Animated.View entering={FadeIn.duration(200)} className="px-3 pb-2">
      <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 border-continuous">
        <View
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: "#EF4444" }}
        />
        <Text
          className="flex-1 text-xs text-muted-foreground"
          numberOfLines={2}
        >
          {message || t("Something went wrong")}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Circular control used in the composer's bottom row. */
export function PromptInputAction({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-9 w-9 items-center justify-center rounded-full bg-secondary active:opacity-70"
    >
      {children}
    </Pressable>
  );
}

/** Column wrapper: the textarea sits above the control row. */
export function PromptInputBody({ children }: { children: ReactNode }) {
  return <View>{children}</View>;
}

/**
 * Auto-growing text input for composing messages. Reads/writes the current
 * input value from `ChatContext`.
 */
export function PromptInputTextarea({
  placeholder = "Chat with Agent...",
  maxLength = 1000,
}: {
  placeholder?: string;
  maxLength?: number;
}) {
  const { input, setInput } = useChatContext();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (input === "") {
      inputRef.current?.clear();
    }
  }, [input]);

  return (
    <TextInput
      ref={inputRef}
      nativeID="composer"
      cursorColorClassName="accent-foreground"
      selectionColorClassName="accent-foreground"
      style={{ fontSize: 16 }}
      className="min-h-[44px] px-1 py-1 text-foreground max-h-25"
      value={input}
      onChangeText={setInput}
      placeholder={placeholder}
      placeholderTextColor="#8E8E93"
      multiline
      maxLength={maxLength}
    />
  );
}

/**
 * Submit button that sends the current input. Shows a spinner while the model
 * is generating. Reads state from `ChatContext`.
 */
export function PromptInputSubmit() {
  const { t } = usePreferences();
  const { input, isGenerating, onSend, hasAttachments, isPickingAttachment } = useChatContext();
  const disabled = (!input.trim() && !hasAttachments) || isGenerating || isPickingAttachment;

  return (
    <Pressable
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderCurve: "continuous",
        justifyContent: "center",
        alignItems: "center",
      }}
      className={cn(
        "active:opacity-70",
        disabled ? "bg-secondary" : "bg-foreground",
      )}
      onPress={onSend}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t("Send message")}
    >
      {isGenerating ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <ActivityIndicator
            size="small"
            colorClassName="accent-muted-foreground"
          />
        </Animated.View>
      ) : (
        <Icon
          icon={ArrowUp}
          className={cn(
            "h-4 w-4",
            disabled ? "text-muted-foreground" : "text-background",
          )}
        />
      )}
    </Pressable>
  );
}
