import { useDrawer } from "@/components/drawer-content";
import {
  ChatActionsSheet,
  type ChatActionTarget,
} from "@/components/chat-actions-sheet";
import { Icon } from "@/components/icon";
import { MOCK_CHATS, type MockChat } from "@/utils/mock-chats";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Color, Stack, useRouter } from "expo-router";
import { Menu, Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
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
        {formatTimeAgo(item.daysAgo)}
      </Text>
    </Pressable>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <View className="flex-1 items-center justify-center pt-32 gap-2">
      <Icon icon={Search} className="w-10 h-10 text-muted-foreground" />
      <Text className="text-[17px] text-muted-foreground text-center px-10">
        No results found for &ldquo;{query}&rdquo;
      </Text>
    </View>
  );
}

export default function ChatsScreen() {
  const [search, setSearch] = useState("");
  const [chats, setChats] = useState(MOCK_CHATS);
  const [filter, setFilter] = useState<Filter>("all");
  const [actionTarget, setActionTarget] = useState<ChatActionTarget>(null);
  const { requestDrawerRestore } = useDrawer();

  // Popping this screen returns to the chat, so reopen the drawer it was
  // opened from. Navigating deeper keeps this screen mounted, so a chat tap
  // does not trigger it.
  useEffect(() => () => requestDrawerRestore(), [requestDrawerRestore]);

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
  }, []);

  const handleSheetRename = useCallback((id: string, title: string) => {
    setChats((prev) =>
      prev.map((chat) => (chat.id === id ? { ...chat, title } : chat)),
    );
  }, []);

  const handleSheetPin = useCallback((id: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id ? { ...chat, starred: !chat.starred } : chat,
      ),
    );
  }, []);

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
                {filter === "starred" ? "Starred" : "All chats"}
              </Text>
            ) : (
              <View className="flex-row gap-2 px-4 pb-2 pt-3">
                <FilterChip
                  label="All"
                  active={filter === "all"}
                  onPress={() => setFilter("all")}
                />
                <FilterChip
                  label="Pinned"
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
        placeholder="Search"
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
  const { openDrawer } = useDrawer();

  if (process.env.EXPO_OS === "android") {
    return (
      <Stack.Toolbar placement="left" asChild>
        <Pressable
          onPress={openDrawer}
          accessibilityLabel="Open drawer"
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
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="line.horizontal.3.decrease">
        <Stack.Toolbar.Menu inline>
          <Stack.Toolbar.MenuAction
            icon="bubble.left.and.bubble.right"
            isOn={filter === "all"}
            onPress={() => setFilter("all")}
          >
            All chats
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="star"
            isOn={filter === "starred"}
            onPress={() => setFilter("starred")}
          >
            Starred
          </Stack.Toolbar.MenuAction>
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
