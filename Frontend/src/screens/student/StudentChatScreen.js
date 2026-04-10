import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import {
  createChatConversation,
  deleteChatConversation,
  fetchChatConversationById,
  fetchChatConversations,
  rateChatMessage,
  renameChatConversation,
  sendChatMessage,
} from "../../api/chat";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { useSession } from "../../context/SessionContext";
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

function buildSourceLabel(source) {
  if (!source) return "";
  return source.sourceType === "faq" ? "FAQ" : "PDF";
}

export function StudentChatScreen() {
  const { currentUser } = useSession();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const streamRef = useRef(null);

  useEffect(
    () => () => {
      if (streamRef.current) clearTimeout(streamRef.current);
    },
    []
  );

  useEffect(() => {
    if (!currentUser?._id || currentUser.role !== "student") {
      setLoading(false);
      setConversations([]);
      setSelectedConversationId("");
      setSelectedConversation(null);
      return;
    }

    void loadConversations();
  }, [currentUser?._id, currentUser?.role]);

  async function loadConversations(nextSelectedId) {
    if (!currentUser?._id) return;

    try {
      setLoading(true);
      setError("");
      const data = await fetchChatConversations({ userId: currentUser._id });
      const list = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(list);

      const targetId = nextSelectedId || selectedConversationId || list[0]?._id || "";

      if (targetId) {
        await loadConversation(targetId);
      } else {
        setSelectedConversationId("");
        setSelectedConversation(null);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load conversations right now.");
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(conversationId) {
    if (!currentUser?._id) return;

    try {
      setError("");
      const data = await fetchChatConversationById(conversationId, {
        userId: currentUser._id,
      });
      setSelectedConversationId(conversationId);
      setSelectedConversation(data.conversation || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load this conversation right now.");
    }
  }

  function mergeSummary(conversation) {
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    const lastMessage = messages[messages.length - 1];

    setConversations((current) => {
      const summary = {
        _id: conversation._id,
        title: conversation.title,
        lastMessagePreview: lastMessage?.content || "No messages yet",
        lastMessageAt: conversation.lastMessageAt,
        messageCount: messages.length,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };

      return [summary, ...current.filter((item) => item._id !== conversation._id)];
    });
  }

  function streamAssistant(conversation) {
    if (streamRef.current) clearTimeout(streamRef.current);

    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    const assistantIndex = messages.length - 1;
    const assistant = messages[assistantIndex];

    if (!assistant || assistant.role !== "assistant") {
      setSelectedConversation(conversation);
      return;
    }

    const fullText = assistant.content;

    setSelectedConversation({
      ...conversation,
      messages: messages.map((message, index) =>
        index === assistantIndex ? { ...message, content: "" } : message
      ),
    });

    let cursor = 0;

    const tick = () => {
      cursor += Math.max(1, Math.ceil(fullText.length / 24));

      setSelectedConversation((current) => {
        if (!current) return current;

        return {
          ...current,
          messages: current.messages.map((message, index) =>
            index === assistantIndex
              ? { ...message, content: fullText.slice(0, cursor) }
              : message
          ),
        };
      });

      if (cursor < fullText.length) {
        streamRef.current = setTimeout(tick, 30);
      } else {
        setSelectedConversation(conversation);
      }
    };

    streamRef.current = setTimeout(tick, 20);
  }

  async function handleCreateConversation() {
    if (!currentUser?._id) return;

    try {
      setError("");
      const data = await createChatConversation({
        userId: currentUser._id,
        title: "New conversation",
      });
      await loadConversations(data.conversation?._id);
    } catch (requestError) {
      setError(requestError.message || "Unable to create a new conversation right now.");
    }
  }

  async function handleSend() {
    const content = draft.trim();

    if (!content || sending || !currentUser?._id) return;

    try {
      setSending(true);
      setError("");

      let conversationId = selectedConversationId;

      if (!conversationId) {
        const created = await createChatConversation({
          userId: currentUser._id,
          title: "New conversation",
        });
        conversationId = created.conversation._id;
        setSelectedConversationId(conversationId);
      }

      setDraft("");

      const data = await sendChatMessage(conversationId, {
        userId: currentUser._id,
        content,
      });

      setSelectedConversationId(data.conversation._id);
      mergeSummary(data.conversation);
      streamAssistant(data.conversation);
    } catch (requestError) {
      setError(requestError.message || "Unable to send the message right now.");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteConversation(conversationId) {
    if (!currentUser?._id) return;

    try {
      setError("");
      await deleteChatConversation(conversationId, { userId: currentUser._id });
      const remaining = conversations.filter((item) => item._id !== conversationId);
      setConversations(remaining);

      const nextId = remaining[0]?._id || "";

      if (nextId) {
        await loadConversation(nextId);
      } else {
        setSelectedConversationId("");
        setSelectedConversation(null);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to delete the conversation right now.");
    }
  }

  function promptDelete(conversationId) {
    Alert.alert("Delete conversation", "This will remove the full chat history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void handleDeleteConversation(conversationId);
        },
      },
    ]);
  }

  async function handleRenameConversation() {
    if (!selectedConversationId || !renameTitle.trim() || !currentUser?._id) return;

    try {
      setError("");
      const data = await renameChatConversation(selectedConversationId, {
        userId: currentUser._id,
        title: renameTitle.trim(),
      });
      setRenameVisible(false);
      setSelectedConversation(data.conversation);
      mergeSummary(data.conversation);
    } catch (requestError) {
      setError(requestError.message || "Unable to rename the conversation right now.");
    }
  }

  async function handleRateMessage(messageId, rating) {
    if (!selectedConversationId || !currentUser?._id) return;

    try {
      const currentMessage = selectedConversation?.messages?.find((item) => item._id === messageId);
      const nextRating = currentMessage?.rating === rating ? null : rating;

      await rateChatMessage(selectedConversationId, messageId, {
        userId: currentUser._id,
        rating: nextRating,
      });

      setSelectedConversation((current) => {
        if (!current) return current;

        return {
          ...current,
          messages: current.messages.map((message) =>
            message._id === messageId ? { ...message, rating: nextRating } : message
          ),
        };
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to save the message rating right now.");
    }
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

  const messages = selectedConversation?.messages || [];
  const selectedMessageCount = selectedConversation?.messageCount || messages.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.page}>
        <AppBrandHeader />

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <MaterialIcons name="auto-awesome" size={14} color={colors.secondary} />
            <Text style={styles.heroBadgeText}>Student AI Desk</Text>
          </View>
          <Text style={styles.heroTitle}>Ask first. Ticket later.</Text>
          <Text style={styles.heroBody}>
            Use AI chat to shape your question, gather the right details, and then escalate to a support ticket when you need staff help.
          </Text>
          <View style={styles.heroFooter}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{conversations.length}</Text>
              <Text style={styles.heroStatLabel}>saved chats</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{selectedMessageCount}</Text>
              <Text style={styles.heroStatLabel}>messages here</Text>
            </View>
            <Pressable style={styles.heroButton} onPress={handleCreateConversation}>
              <MaterialIcons name="add" size={18} color="white" />
              <Text style={styles.heroButtonText}>New Chat</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>History</Text>
              <Text style={styles.sectionTitle}>Recent conversations</Text>
            </View>
            <Text style={styles.sectionMeta}>{conversations.length} total</Text>
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
              nestedScrollEnabled
            >
              {conversations.map((conversation) => {
                const active = conversation._id === selectedConversationId;

                return (
                  <Pressable
                    key={conversation._id}
                    style={[styles.historyItem, active && styles.historyItemActive]}
                    onPress={() => {
                      void loadConversation(conversation._id);
                    }}
                  >
                    <View style={[styles.historyIcon, active && styles.historyIconActive]}>
                      <MaterialIcons
                        name={active ? "forum" : "chat-bubble-outline"}
                        size={18}
                        color={active ? colors.secondary : colors.primary}
                      />
                    </View>
                    <View style={styles.historyBody}>
                      <Text
                        style={[styles.historyTitle, active && styles.historyTitleActive]}
                        numberOfLines={1}
                      >
                        {conversation.title}
                      </Text>
                      <Text style={styles.historyPreview} numberOfLines={2}>
                        {conversation.lastMessagePreview || "No messages yet"}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {conversation.messageCount} messages
                        {conversation.lastMessageAt ? ` • ${formatWhen(conversation.lastMessageAt)}` : ""}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={active ? "radio-button-checked" : "chevron-right"}
                      size={18}
                      color={active ? colors.secondary : "#98a2b3"}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="forum" size={24} color={colors.secondary} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Start a chat and the conversation will be saved here automatically.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, styles.chatCard]}>
          <View style={styles.chatHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Live Chat</Text>
              <Text style={styles.sectionTitle}>
                {selectedConversation?.title || "Start a new conversation"}
              </Text>
              <Text style={styles.chatHint}>
                Keep it simple: what happened, when it happened, and what help you need.
              </Text>
            </View>

            {selectedConversationId ? (
              <View style={styles.chatActions}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => {
                    setRenameTitle(selectedConversation?.title || "");
                    setRenameVisible(true);
                  }}
                >
                  <MaterialIcons name="edit" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  style={styles.actionButtonDanger}
                  onPress={() => promptDelete(selectedConversationId)}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#ba1a1a" />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.threadShell}>
            <ScrollView
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {messages.length ? (
                messages.map((message) => (
                  <View
                    key={message._id}
                    style={[
                      styles.messageBubble,
                      message.role === "user" ? styles.userBubble : styles.aiBubble,
                    ]}
                  >
                    <View style={styles.messageTop}>
                      <Text
                        style={[
                          styles.messageRole,
                          message.role === "user" && styles.userBubbleText,
                        ]}
                      >
                        {message.role === "user" ? "You" : "UniGuide AI"}
                      </Text>
                      <Text
                        style={[
                          styles.messageTime,
                          message.role === "user" && styles.userBubbleMeta,
                        ]}
                      >
                        {formatWhen(message.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.messageText,
                        message.role === "user" && styles.userBubbleText,
                      ]}
                    >
                      {message.content}
                    </Text>

                    {message.role === "assistant" &&
                    Array.isArray(message.sources) &&
                    message.sources.length ? (
                      <View style={styles.sourceBlock}>
                        <Text style={styles.sourceHeading}>Sources</Text>
                        {message.sources.map((source, index) => (
                          <View
                            key={`${message._id}-source-${source.sourceType}-${source.sourceId}-${index}`}
                            style={styles.sourceCard}
                          >
                            <View style={styles.sourceTop}>
                              <View style={styles.sourceBadge}>
                                <Text style={styles.sourceBadgeText}>
                                  {buildSourceLabel(source)}
                                </Text>
                              </View>
                              <Text style={styles.sourceTitle} numberOfLines={1}>
                                {source.title}
                              </Text>
                            </View>
                            {source.subtitle ? (
                              <Text style={styles.sourceSubtitle} numberOfLines={1}>
                                {source.subtitle}
                              </Text>
                            ) : null}
                            {source.snippet ? (
                              <Text style={styles.sourceSnippet} numberOfLines={3}>
                                {source.snippet}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {message.role === "assistant" ? (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Helpful?</Text>
                        <Pressable
                          style={[
                            styles.ratingButton,
                            message.rating === "up" && styles.ratingButtonUp,
                          ]}
                          onPress={() => {
                            void handleRateMessage(message._id, "up");
                          }}
                        >
                          <MaterialIcons
                            name="thumb-up-off-alt"
                            size={16}
                            color={message.rating === "up" ? "white" : colors.primary}
                          />
                        </Pressable>
                        <Pressable
                          style={[
                            styles.ratingButton,
                            message.rating === "down" && styles.ratingButtonDown,
                          ]}
                          onPress={() => {
                            void handleRateMessage(message._id, "down");
                          }}
                        >
                          <MaterialIcons
                            name="thumb-down-off-alt"
                            size={16}
                            color={message.rating === "down" ? "white" : "#ba1a1a"}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={styles.emptyThread}>
                  <View style={styles.emptyThreadIcon}>
                    <MaterialIcons name="psychology" size={24} color={colors.secondary} />
                  </View>
                  <Text style={styles.emptyTitle}>Start with your question</Text>
                  <Text style={styles.emptyText}>
                    Ask about a problem, deadline, document, or request. The chat will stay saved under your student account.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>

          <View style={styles.composerShell}>
            <TextInput
              style={styles.composerInput}
              placeholder="Type your message..."
              placeholderTextColor="#777683"
              value={draft}
              multiline
              onChangeText={setDraft}
            />
            <Pressable
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={() => {
                void handleSend();
              }}
              disabled={sending}
            >
              <MaterialIcons
                name={sending ? "hourglass-top" : "send"}
                size={18}
                color="white"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename conversation</Text>
            <TextInput
              style={styles.modalInput}
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder="Enter a new title"
              placeholderTextColor="#777683"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhostButton} onPress={() => setRenameVisible(false)}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimaryButton}
                onPress={() => void handleRenameConversation()}
              >
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f7fb",
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfe3ea",
    gap: 10,
    shadowColor: "#1f1a6f",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  heroBody: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  },
  heroStat: {
    minWidth: 88,
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
  heroButton: {
    minHeight: layout.touchTarget,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.secondary,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  heroButtonText: {
    color: "white",
    fontWeight: "800",
  },
  errorText: {
    color: "#b42318",
    fontWeight: "700",
  },
  sectionCard: {
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
  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
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
  sectionMeta: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "700",
  },
  loadingBlock: {
    paddingVertical: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  historyList: {
    maxHeight: 208,
  },
  historyListContent: {
    gap: 9,
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
  historyItemActive: {
    borderColor: "#8f6af2",
    backgroundColor: "#f3edff",
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  historyIconActive: {
    backgroundColor: "#e6dcff",
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
  historyTitleActive: {
    color: colors.secondary,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eceef4",
    backgroundColor: "#fafbff",
    padding: 18,
    alignItems: "center",
    gap: 8,
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
  chatCard: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  chatHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  chatActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f4f5fb",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonDanger: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff3f2",
    alignItems: "center",
    justifyContent: "center",
  },
  threadShell: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "#f5f7fb",
    borderWidth: 1,
    borderColor: "#eaedf3",
    overflow: "hidden",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: "92%",
    borderRadius: 18,
    padding: 12,
    gap: 6,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e3e7ef",
  },
  messageTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  messageRole: {
    color: colors.secondary,
    fontWeight: "800",
    fontSize: 12,
  },
  messageTime: {
    color: "#667085",
    fontSize: 11,
  },
  messageText: {
    color: colors.text,
    lineHeight: 20,
    fontSize: 14,
  },
  userBubbleText: {
    color: "white",
  },
  userBubbleMeta: {
    color: "rgba(255,255,255,0.8)",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  sourceBlock: {
    gap: 8,
    marginTop: 4,
  },
  sourceHeading: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  sourceCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dfe5ef",
    backgroundColor: "#f8faff",
    padding: 10,
    gap: 4,
  },
  sourceTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceBadge: {
    borderRadius: 999,
    backgroundColor: "#ece5ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceBadgeText: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sourceTitle: {
    flex: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  sourceSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  sourceSnippet: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  ratingLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  ratingButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#d3d8e2",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  ratingButtonUp: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingButtonDown: {
    backgroundColor: "#ba1a1a",
    borderColor: "#ba1a1a",
  },
  emptyThread: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyThreadIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#ece5ff",
    alignItems: "center",
    justifyContent: "center",
  },
  composerShell: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 120,
    borderRadius: 18,
    backgroundColor: "#f5f7fb",
    borderWidth: 1,
    borderColor: "#e3e7ef",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  sendButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.65,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(25,28,30,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 18,
  },
  modalInput: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#f5f7fb",
    borderWidth: 1,
    borderColor: "#e3e7ef",
    paddingHorizontal: 14,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalGhostButton: {
    minHeight: layout.touchTarget,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    minHeight: layout.touchTarget,
    paddingHorizontal: 16,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: {
    color: "white",
    fontWeight: "800",
  },
});
