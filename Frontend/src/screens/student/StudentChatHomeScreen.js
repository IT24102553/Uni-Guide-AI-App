import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { fetchChatConversations } from "../../api/chat";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { useSession } from "../../context/SessionContext";
import { subscribeRealtimeEvent } from "../../realtime/socket";
import { colors, layout, type } from "../../theme";

function formatWhen(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StudentChatHomeScreen({ navigation }) {
  const { currentUser } = useSession();
  const isFocused = useIsFocused();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFocused) return;

    if (!currentUser?._id || currentUser.role !== "student") {
      setLoading(false);
      setHasLoaded(false);
      setConversations([]);
      return;
    }

    void loadConversations({ silent: hasLoaded });
  }, [currentUser?._id, currentUser?.role, isFocused]);

  async function loadConversations(options = {}) {
    if (!currentUser?._id) return;

    const { silent = false } = options;

    try {
      if (!silent && !hasLoaded) {
        setLoading(true);
      }
      setError("");
      const data = await fetchChatConversations({ userId: currentUser._id });
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load conversations right now.");
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    if (!currentUser?._id || currentUser.role !== "student") {
      return undefined;
    }

    const handleRealtimeUpdate = () => {
      void loadConversations({ silent: true });
    };

    const unsubscribeConversationChanged = subscribeRealtimeEvent(
      "chat:conversationChanged",
      handleRealtimeUpdate
    );
    const unsubscribeConversationDeleted = subscribeRealtimeEvent(
      "chat:conversationDeleted",
      handleRealtimeUpdate
    );

    return () => {
      unsubscribeConversationChanged();
      unsubscribeConversationDeleted();
    };
  }, [currentUser?._id, currentUser?.role, hasLoaded]);

  function openDraftConversation() {
    navigation.navigate("StudentChatConversation");
  }

  function openConversation(conversationId) {
    navigation.navigate("StudentChatConversation", { conversationId });
  }

  if (!currentUser || currentUser.role !== "student") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.page}>
          <AppBrandHeader />
          <View style={styles.blockedCard}>
            <MaterialIcons name="lock-outline" size={30} color={colors.secondary} />
            <Text style={styles.blockedTitle}>Student AI chat only</Text>
            <Text style={styles.blockedText}>
              Staff and admin accounts do not have access to this workspace.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.page}>
        <AppBrandHeader />

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <MaterialIcons name="auto-awesome" size={14} color={colors.secondary} />
            <Text style={styles.heroBadgeText}>Student AI Desk</Text>
          </View>
          <Text style={styles.heroTitle}>Saved conversations</Text>
          <Text style={styles.heroBody}>
            Start a fresh chat or jump back into an earlier one. New Chat now opens a dedicated conversation page.
          </Text>
          <View style={styles.heroFooter}>
            <Pressable style={styles.heroButton} onPress={openDraftConversation}>
              <MaterialIcons name="add" size={18} color="white" />
              <Text style={styles.heroButtonText}>New Chat</Text>
            </Pressable>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{conversations.length}</Text>
              <Text style={styles.heroStatLabel}>saved chats</Text>
            </View>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>History</Text>
              <Text style={styles.sectionTitle}>Recent conversations</Text>
            </View>
            <Pressable style={styles.ghostButton} onPress={() => void loadConversations()}>
              <MaterialIcons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.ghostButtonText}>Refresh</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : conversations.length ? (
            <ScrollView
              style={styles.historyList}
              contentContainerStyle={styles.historyListContent}
              showsVerticalScrollIndicator={false}
            >
              {conversations.map((conversation) => (
                <Pressable
                  key={conversation._id}
                  style={styles.historyItem}
                  onPress={() => openConversation(conversation._id)}
                >
                  <View style={styles.historyIcon}>
                    <MaterialIcons
                      name="chat-bubble-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.historyBody}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {conversation.title}
                    </Text>
                    <Text style={styles.historyPreview} numberOfLines={2}>
                      {conversation.lastMessagePreview || "No messages yet"}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {conversation.messageCount} messages
                      {conversation.lastMessageAt
                        ? ` - ${formatWhen(conversation.lastMessageAt)}`
                        : ""}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color="#98a2b3" />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="forum" size={24} color={colors.secondary} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Your chat history will appear here after you send your first message.
              </Text>
              <Pressable style={styles.emptyButton} onPress={openDraftConversation}>
                <Text style={styles.emptyButtonText}>Open first chat</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 14,
    gap: 12,
  },
  heroCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe3ea",
    gap: 10,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f3edff",
  },
  heroBadgeText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.primary,
    fontSize: type.h2,
    fontWeight: "800",
  },
  heroBody: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  heroButton: {
    minHeight: layout.touchTarget,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  heroButtonText: {
    color: "white",
    fontWeight: "800",
  },
  heroStat: {
    minWidth: 94,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8f8fc",
    borderWidth: 1,
    borderColor: "#eceef4",
  },
  heroStatValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  errorText: {
    color: "#b42318",
    fontWeight: "700",
  },
  sectionCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dfe3ea",
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 3,
  },
  ghostButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f4f5fb",
  },
  ghostButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  loadingBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    gap: 9,
    paddingBottom: 12,
  },
  historyItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e7eaf0",
    backgroundColor: "#fafbff",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  historyBody: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  historyPreview: {
    color: colors.textMuted,
    lineHeight: 18,
    fontSize: 12,
  },
  historyMeta: {
    color: "#667085",
    fontSize: 11,
  },
  emptyCard: {
    flex: 1,
    minHeight: 220,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eceef4",
    backgroundColor: "#fafbff",
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ece5ff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    minHeight: layout.touchTarget,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    color: "white",
    fontWeight: "800",
  },
  blockedCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#dfe3ea",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 28,
  },
  blockedTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  blockedText: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
