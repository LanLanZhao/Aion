import "@/global.css";

import { Icon } from "@/components/icon";
import { AvatarMonogram } from "@/components/settings-ui";
import {
  ChatActionsSheet,
  type ChatActionTarget,
} from "@/components/chat-actions-sheet";
import { SafeAreaView } from "@/components/tw";
import { MOCK_CHATS } from "@/utils/mock-chats";
import { cn } from "@/utils/tailwind";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsRight,
  MessageSquare,
  Pin,
  Search,
  Settings,
  SlidersHorizontal,
  SquarePen,
  Zap,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import React, { createContext, use, useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const ACCOUNT = { name: "Evan Bacon", initials: "EB" };

const BANNER_BLUE = "#1F3BE0";
const BANNER_PILL = "rgba(255, 255, 255, 0.18)";
const BANNER_SUBTLE = "#D6DDFF";

type DrawerContextValue = {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Ask the chat screen to reopen the drawer when it is focused again. */
  requestDrawerRestore: () => void;
  /** Returns true once if a restore was requested, then clears it. */
  takeDrawerRestore: () => boolean;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const restoreRef = React.useRef(false);

  const openDrawer = useCallback(() => setIsOpen(true), []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);
  const requestDrawerRestore = useCallback(() => {
    restoreRef.current = true;
  }, []);
  const takeDrawerRestore = useCallback(() => {
    const pending = restoreRef.current;
    restoreRef.current = false;
    return pending;
  }, []);

  return (
    <DrawerContext
      value={{
        isOpen,
        openDrawer,
        closeDrawer,
        requestDrawerRestore,
        takeDrawerRestore,
      }}
    >
      {children}
    </DrawerContext>
  );
}

export function useDrawer() {
  const context = use(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}

function DrawerAction({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-4 px-4 py-4 active:bg-secondary"
    >
      <Icon icon={icon} className="h-5 w-5 text-foreground" />
      <Text numberOfLines={1} className="flex-1 text-[16px] text-foreground">
        {label}
      </Text>
    </Pressable>
  );
}

function RowDivider() {
  return (
    <View
      className="bg-border"
      style={{ height: StyleSheet.hairlineWidth, marginLeft: 52 }}
    />
  );
}

function relativeTime(daysAgo: number) {
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo}d ago`;
  return `${Math.round(daysAgo / 7)}w ago`;
}

export function DrawerContent({
  onOpenChats,
  onNewChat,
  onOpenCapabilities,
  onOpenSettings,
  onClose,
}: {
  onOpenChats: () => void;
  onNewChat: () => void;
  onOpenCapabilities: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const [chatsOpen, setChatsOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState(MOCK_CHATS);
  const [pinned, setPinned] = useState<string[]>([]);
  const [actionTarget, setActionTarget] = useState<ChatActionTarget>(null);

  const needle = query.trim().toLowerCase();
  const visibleChats = (needle
    ? chats.filter((chat) => chat.title.toLowerCase().includes(needle))
    : chats
  )
    .slice()
    .sort(
      (a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)),
    );

  const deleteChat = useCallback((id: string) => {
    setChats((previous) => previous.filter((chat) => chat.id !== id));
  }, []);

  const renameChat = useCallback((id: string, title: string) => {
    setChats((previous) =>
      previous.map((chat) => (chat.id === id ? { ...chat, title } : chat)),
    );
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinned((previous) =>
      previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id],
    );
  }, []);

  return (
    <SafeAreaView
      // NOTE: Some issue with uniwind that prevents updates for this component.
      className="flex-1 bg-muted"
      edges={["top", "bottom", "left"]}
    >
      {/* Account */}
      <View className="flex-row items-center gap-3 px-4 pb-4 pt-2">
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Account settings"
          className="active:opacity-80"
        >
          <AvatarMonogram initials={ACCOUNT.initials} size={44} />
        </Pressable>
        <Text
          numberOfLines={1}
          className="flex-1 text-[20px] font-semibold text-foreground"
        >
          {ACCOUNT.name}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close drawer"
          className="h-11 w-11 items-center justify-center rounded-full bg-card active:bg-secondary"
        >
          <Icon icon={ChevronsRight} className="h-5 w-5 text-foreground" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}
      >
        <View className="overflow-hidden rounded-[26px] bg-card">
          <DrawerAction
            icon={MessageSquare}
            label="Chats"
            onPress={onOpenChats}
          />
          <RowDivider />
          <DrawerAction
            icon={SlidersHorizontal}
            label="Capabilities"
            onPress={onOpenCapabilities}
          />
          <RowDivider />
          <DrawerAction
            icon={Settings}
            label="Settings"
            onPress={onOpenSettings}
          />
        </View>

        {/* Mock mode stands in for Grok's subscription banner. */}
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          className="mt-3 flex-row items-center gap-3 rounded-[26px] px-4 py-3.5 active:opacity-90"
          style={{ backgroundColor: BANNER_BLUE }}
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: BANNER_PILL }}
          >
            <Icon icon={Zap} className="h-5 w-5 text-white" />
          </View>
          <View className="flex-1">
            <Text
              numberOfLines={1}
              className="text-[15px] font-semibold text-white"
            >
              Mock mode is on
            </Text>
            <Text
              numberOfLines={1}
              className="mt-0.5 text-[12px]"
              style={{ color: BANNER_SUBTLE }}
            >
              Replies are simulated
            </Text>
          </View>
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: BANNER_PILL }}
          >
            <Icon icon={ChevronRight} className="h-4 w-4 text-white" />
          </View>
        </Pressable>

        {/* Conversations */}
        <View className="mt-6 flex-row items-center justify-between px-2 pb-2">
          <Text className="text-[13px] font-medium text-muted-foreground">
            Conversations
          </Text>
          <Pressable
            onPress={() => setChatsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={
              chatsOpen ? "Collapse conversations" : "Expand conversations"
            }
            hitSlop={10}
            className="active:opacity-60"
          >
            <Icon
              icon={chatsOpen ? ChevronUp : ChevronDown}
              className="h-4 w-4 text-muted-foreground"
            />
          </Pressable>
        </View>

        {chatsOpen &&
          visibleChats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={onNewChat}
              onLongPress={() =>
                setActionTarget({
                  id: chat.id,
                  title: chat.title,
                  pinned: pinned.includes(chat.id),
                })
              }
              delayLongPress={350}
              className="mb-2 rounded-[22px] bg-card px-4 py-3 active:bg-secondary"
            >
              <View className="flex-row items-center gap-1.5">
                {pinned.includes(chat.id) && (
                  <Icon
                    icon={Pin}
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                )}
                <Text
                  numberOfLines={1}
                  className={cn(
                    "flex-1 text-[16px] text-foreground",
                    chat.id === "1" && "font-semibold",
                  )}
                >
                  {chat.title}
                </Text>
              </View>
              <Text className="mt-0.5 text-[13px] text-muted-foreground">
                {relativeTime(chat.daysAgo)}
              </Text>
            </Pressable>
          ))}

        {chatsOpen && visibleChats.length === 0 && (
          <Text className="px-3 py-6 text-center text-[14px] text-muted-foreground">
            No chats match “{query.trim()}�?
          </Text>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View className="flex-row items-center gap-2 px-4 pb-1 pt-2">
        <View className="h-12 flex-1 flex-row items-center gap-2.5 rounded-full bg-card px-4">
          <Icon icon={Search} className="h-4 w-4 text-muted-foreground" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor="#8E8E93"
            returnKeyType="search"
            className="flex-1 text-[15px] text-foreground"
          />
        </View>
        <Pressable
          onPress={onNewChat}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          className="h-12 w-12 items-center justify-center rounded-full bg-card active:bg-secondary"
        >
          <Icon icon={SquarePen} className="h-5 w-5 text-foreground" />
        </Pressable>
      </View>

      <ChatActionsSheet
        key={actionTarget?.id ?? "closed"}
        target={actionTarget}
        onClose={() => setActionTarget(null)}
        onDelete={deleteChat}
        onRename={renameChat}
        onTogglePin={togglePin}
      />
    </SafeAreaView>
  );
}
