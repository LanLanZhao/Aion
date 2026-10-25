import { usePreferences } from "@/components/preferences-context";
import { useDrawer } from "@/components/drawer-content";
import { useRestoreDrawerOnClose } from "@/components/use-restore-drawer";
import {
  ChatActionsSheet,
  type ChatActionTarget,
} from "@/components/chat-actions-sheet";
import { Icon } from "@/components/icon";
import { type MockChat } from "@/utils/mock-chats";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Color, Stack, useRouter } from "expo-router";
import { Menu, Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

const IS_IOS = process.env.EXPO_OS === "ios";

type Filter = "all" | "starred";

function formatTimeAgo(daysAgo: number): string {
  if (daysAgo < 7) return `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
  const weeks = Math.round(daysAgo / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

type Chat = MockChat;

function ChatRow({
  item,
  onLongPress,
}: {
  item: Chat;
  onLongPress?: () => void;
}) {
  const router = useRouter();
  const { language } = usePreferences();

  return (
    <Pressable
      onPress={() => router.push("/")}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="mx-4 mb-2 gap-0.5 rounded-[22px] border border-border bg-card px-4 py-3 active:bg-secondary"
    >
      <Text
        numberOfLines={1}
        className="text-[16px] text-foreground"
        selectable
      >
        {item.title}
      </Text>
      <Text className="text-[13px] text-muted-foreground">
        {language === "zh" ? `${item.daysAgo < 7 ? item.daysAgo : Math.round(item.daysAgo / 7)} ${item.daysAgo < 7 ? "天前" : "周前"}` : formatTimeAgo(item.daysAgo)}
      </Text>
    </Pressable>
  );
}

function EmptySearch({ query }: { query: string }) {
  const { t } = usePreferences();
  return (
    <View className="flex-1 items-center justify-center pt-32 gap-2">
      <Icon icon={Search} className="w-10 h-10 text-muted-foreground" />
      <Text className="text-[17px] text-muted-foreground text-center px-10">
        {t("No results found for")} “{query}�?
      </Text>
    </View>
  );
}

export default function ChatsScreen() {
  const { t } = usePreferences();
  const [search, setSearch] = useState("");
  const { chats, setChats } = useDrawer();
  const [filter, setFilter] = useState<Filter>("all");
  const [actionTarget, setActionTarget] = useState<ChatActionTarget>(null);

  // Popping this screen returns to the chat, so put the drawer back.
  useRestoreDrawerOnClose();

  const filtered = useMemo(() => {
    let results = chats;
    if (filter === "starred") {
      results = results.filter((c) => c.starred);
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter((c) => c.title.toLowerCase().includes(q));
    }
    return results;
  }, [search, chats, filter]);

  const handleSheetDelete = useCallback((id: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
  }, [setChats]);

  const handleSheetRename = useCallback((id: string, title: string) => {
    setChats((prev) =>
      prev.map((chat) => (chat.id === id ? { ...chat, title } : chat)),
    );
  }, [setChats]);

  const handleSheetPin = useCallback((id: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id ? { ...chat, starred: !chat.starred } : chat,
      ),
    );
  }, [setChats]);

  return (
    <>
      <View className="flex-1 bg-background">
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets
          automaticallyAdjustsScrollIndicatorInsets
          automaticallyAdjustKeyboardInsets
          contentContainerClassName="android:pb-safe pb-0"
          ListHeaderComponent={
            IS_IOS ? (
              <Text className="px-5 pb-2 pt-3 text-[13px] font-medium text-muted-foreground">
                {t(filter === "starred" ? "Starred" : "All chats")}
              </Text>
            ) : (
              <View className="flex-row gap-2 px-4 pb-2 pt-3">
                <FilterChip
                  label={t("All")}
                  active={filter === "all"}
                  onPress={() => setFilter("all")}
                />
                <FilterChip
                  label={t("Pinned")}
                  active={filter === "starred"}
                  onPress={() => setFilter("starred")}
                />
              </View>
            )
          }
          renderItem={({ item }) => (
            <ChatRow
              item={item}
              onLongPress={() =>
                setActionTarget({
                  id: item.id,
                  title: item.title,
                  pinned: item.starred,
                })
              }
            />
          )}
          ListEmptyComponent={search ? <EmptySearch query={search} /> : null}
        />
      </View>

      <Stack.SearchBar
        placeholder={t("Search")}
        hideWhenScrolling={false}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch("")}
      />

      <LeftToolbar />
      {IS_IOS && <RightToolbar filter={filter} setFilter={setFilter} />}
      {IS_IOS && <BottomToolbar />}

      <ChatActionsSheet
        key={actionTarget?.id ?? "closed"}
        target={actionTarget}
        onClose={() => setActionTarget(null)}
        onDelete={handleSheetDelete}
        onRename={handleSheetRename}
        onTogglePin={handleSheetPin}
      />
    </>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={
        active
          ? "rounded-full bg-foreground px-4 py-1.5 active:opacity-80"
          : "rounded-full bg-secondary px-4 py-1.5 active:opacity-70"
      }
    >
      <Text
        className={
          active
            ? "text-[14px] font-medium text-background"
            : "text-[14px] text-foreground"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LeftToolbar() {
  const { t } = usePreferences();
  const { openDrawer } = useDrawer();

  if (process.env.EXPO_OS === "android") {
    return (
      <Stack.Toolbar placement="left" asChild>
        <Pressable
          onPress={openDrawer}
          accessibilityLabel={t("Open drawer")}
          accessibilityRole="button"
          className="p-2 -ml-1 active:opacity-60"
        >
          <Icon icon={Menu} className="w-6 h-6 text-foreground" />
        </Pressable>
      </Stack.Toolbar>
    );
  }
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button icon="list.bullet" onPress={openDrawer} />
    </Stack.Toolbar>
  );
}

function RightToolbar({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: (filter: Filter) => void;
}) {
  const { t } = usePreferences();
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="line.horizontal.3.decrease">
        <Stack.Toolbar.Menu inline>
          <Stack.Toolbar.MenuAction
            icon="bubble.left.and.bubble.right"
            isOn={filter === "all"}
            onPress={() => setFilter("all")}
          >{t("All chats")}</Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="star"
            isOn={filter === "starred"}
            onPress={() => setFilter("starred")}
          >{t("Starred")}</Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

function BottomToolbar() {
  const router = useRouter();

  return (
    <Stack.Toolbar placement="bottom">
      {isLiquidGlassAvailable() && (
        <Stack.Toolbar.SearchBarSlot separateBackground />
      )}
      <Stack.Toolbar.Button
        tintColor={Color.ios.label}
        icon="square.and.pencil"
        onPress={() => router.navigate("/")}
        separateBackground
      />
    </Stack.Toolbar>
  );
}
