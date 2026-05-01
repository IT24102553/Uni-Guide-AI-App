import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  createChatConversation,
  deleteChatConversation,
  fetchChatConversationById,
  fetchChatConversations,
  rateChatMessage,
  renameChatConversation,
  sendChatMessage,
} from "../../api/chat";
import { resolveProtectedFileUrl } from "../../api/client";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { useSession } from "../../context/SessionContext";
import { subscribeRealtimeEvent } from "../../realtime/socket";
import { colors, layout } from "../../theme";

const CHAT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

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

function resolveImageUrl(url) {
  return resolveProtectedFileUrl(url);
}

function formatImageSize(bytes) {
  const size = Number(bytes || 0);

  if (!size) return "";

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function StudentChatConversationScreen({ navigation, route }) {
  const { currentUser } = useSession();
  const isFocused = useIsFocused();
  const routeConversationId = route.params?.conversationId || "";
  const [conversationId, setConversationId] = useState(routeConversationId);
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [draft, setDraft] = useState("");
  const [draftImage, setDraftImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [error, setError] = useState("");
  const [historyVisible, setHistoryVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteConversationId, setDeleteConversationId] = useState("");
  const [deleteConversationTitle, setDeleteConversationTitle] = useState("");
  const [draftConversation, setDraftConversation] = useState(false);
  const streamRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(
    () => () => {
      if (streamRef.current) clearTimeout(streamRef.current);
    },
    []
  );

  useEffect(() => {
    if (!isFocused) return;

    if (!currentUser?._id || currentUser.role !== "student") {
      setLoading(false);
      setHistoryLoading(false);
      setConversation(null);
      setConversations([]);
      return;
    }

    const silent =
      Boolean(conversation || draftConversation) &&
      (!routeConversationId || routeConversationId === conversationId);

    void initializeChat(routeConversationId, { silent });
  }, [routeConversationId, currentUser?._id, currentUser?.role, isFocused]);

  async function initializeChat(targetConversationId = "", options = {}) {
    const { silent = false } = options;

    if (!silent) {
      setLoading(true);
    }

    const list = await loadConversationList({ silent });

    const nextId = targetConversationId || conversationId;

    if (nextId) {
      await loadConversation(nextId, {
        closeHistory: false,
        syncParams: false,
        silent,
      });
      return;
    }

    if (!draftConversation && list[0]?._id) {
      await loadConversation(list[0]._id, {
        closeHistory: false,
        silent,
      });
      return;
    }

    setConversationId("");
    setConversation(null);
    if (!silent) {
      setLoading(false);
    }
  }

  async function loadConversationList(options = {}) {
    if (!currentUser?._id) return [];

    const { silent = false } = options;

    try {
      if (!silent) setHistoryLoading(true);
      setError("");
      const data = await fetchChatConversations({ userId: currentUser._id });
      const list = Array.isArray(data.conversations) ? data.conversations : [];
      setConversations(list);
      return list;
    } catch (requestError) {
      setError(requestError.message || "Unable to load conversations right now.");
      return [];
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }

  async function loadConversation(targetConversationId, options = {}) {
    if (!currentUser?._id || !targetConversationId) return;

    const { closeHistory = true, syncParams = true, silent = false } = options;

    try {
      if (!silent) {
        setLoading(true);
      }
      setError("");
      if (closeHistory) setHistoryVisible(false);
      const data = await fetchChatConversationById(targetConversationId, {
        userId: currentUser._id,
      });
      setConversationId(targetConversationId);
      setDraftConversation(false);
      setConversation(data.conversation || null);

      if (syncParams) {
        navigation.setParams({ conversationId: targetConversationId });
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load this conversation right now.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!currentUser?._id || currentUser.role !== "student") {
      return undefined;
    }

    const handleConversationChanged = (event) => {
      const nextConversationId = String(event?.conversationId || "").trim();

      void loadConversationList({ silent: true });

      if (nextConversationId && nextConversationId === conversationId) {
        void loadConversation(nextConversationId, {
          closeHistory: false,
          syncParams: false,
          silent: true,
        });
      }
    };

    const handleConversationDeleted = async (event) => {
      const deletedConversationId = String(event?.conversationId || "").trim();

      if (deletedConversationId && deletedConversationId === conversationId) {
        setConversationId("");
        setConversation(null);
        setDraftConversation(false);
        navigation.setParams({ conversationId: undefined });

        const list = await loadConversationList({ silent: true });
        const nextConversation = list.find(
          (item) => item._id !== deletedConversationId
        );

        if (nextConversation?._id) {
          void loadConversation(nextConversation._id, {
            closeHistory: false,
            syncParams: true,
            silent: true,
          });
        } else {
          setDraftConversation(true);
        }

        return;
      }

      void loadConversationList({ silent: true });
    };

    const unsubscribeConversationChanged = subscribeRealtimeEvent(
      "chat:conversationChanged",
      handleConversationChanged
    );
    const unsubscribeConversationDeleted = subscribeRealtimeEvent(
      "chat:conversationDeleted",
      handleConversationDeleted
    );

    return () => {
      unsubscribeConversationChanged();
      unsubscribeConversationDeleted();
    };
  }, [conversationId, currentUser?._id, currentUser?.role, navigation]);

  function mergeConversationSummary(nextConversation) {
    const messages = Array.isArray(nextConversation?.messages)
      ? nextConversation.messages
      : [];
    const lastMessage = messages[messages.length - 1];

    setConversations((current) => {
      const summary = {
        _id: nextConversation._id,
        title: nextConversation.title,
        lastMessagePreview: lastMessage?.content || "No messages yet",
        lastMessageAt: nextConversation.lastMessageAt,
        messageCount: messages.length,
        createdAt: nextConversation.createdAt,
        updatedAt: nextConversation.updatedAt,
      };

      return [summary, ...current.filter((item) => item._id !== nextConversation._id)];
    });
  }

  function streamAssistant(nextConversation) {
    if (streamRef.current) clearTimeout(streamRef.current);

    const messages = Array.isArray(nextConversation?.messages)
      ? nextConversation.messages
      : [];
    const assistantIndex = messages.length - 1;
    const assistant = messages[assistantIndex];

    if (!assistant || assistant.role !== "assistant") {
      setConversation(nextConversation);
      return;
    }

    const fullText = assistant.content;

    setConversation({
      ...nextConversation,
      messages: messages.map((message, index) =>
        index === assistantIndex ? { ...message, content: "" } : message
      ),
    });

    let cursor = 0;

    const tick = () => {
      cursor += Math.max(1, Math.ceil(fullText.length / 24));

      setConversation((current) => {
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
        setConversation(nextConversation);
      }
    };

    streamRef.current = setTimeout(tick, 20);
  }

  function handleStartFresh() {
    setHistoryVisible(false);
    setConversationId("");
    setConversation(null);
    setDraft("");
    setDraftImage(null);
    setError("");
    setDraftConversation(true);
    setLoading(false);
    navigation.setParams({ conversationId: undefined });
  }

  function openRenameModal(targetConversationId, currentTitle) {
    setHistoryVisible(false);
    setRenameConversationId(targetConversationId);
    setRenameTitle(currentTitle || "");
    setRenameVisible(true);
  }

  function openDeleteModal(targetConversationId, currentTitle) {
    if (!targetConversationId) {
      handleStartFresh();
      return;
    }

    setHistoryVisible(false);
    setDeleteConversationId(targetConversationId);
    setDeleteConversationTitle(currentTitle || "this conversation");
    setDeleteVisible(true);
  }

  async function handlePickImage() {
    try {
      setPickingImage(true);
      setError("");

      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: CHAT_IMAGE_MIME_TYPES,
        base64: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset) {
        return;
      }

      const size = Number(asset.size || 0);

      if (size && size > MAX_CHAT_IMAGE_BYTES) {
        setError("Chat images must be 5MB or smaller.");
        return;
      }

      setDraftImage(asset);
    } catch (requestError) {
      setError(requestError.message || "Unable to pick an image right now.");
    } finally {
      setPickingImage(false);
    }
  }

  function removeDraftImage() {
    setDraftImage(null);
  }

  async function openMessageImage(image) {
    const url = resolveImageUrl(image?.url);

    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (requestError) {
      setError("Unable to open this image right now.");
    }
  }

  async function handleSend() {
    const content = draft.trim();

    if ((!content && !draftImage) || sending || !currentUser?._id) return;

    try {
      setSending(true);
      setError("");

      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const created = await createChatConversation({
          userId: currentUser._id,
          title: "New conversation",
        });

        activeConversationId = created.conversation._id;
        setConversationId(activeConversationId);
        setDraftConversation(false);
        navigation.setParams({ conversationId: activeConversationId });
      }
      const payload = new FormData();
      payload.append("userId", currentUser._id);
      payload.append("content", content);

      if (draftImage) {
        payload.append("image", {
          uri: draftImage.uri,
          name: draftImage.name || "chat-image.jpg",
          type: draftImage.mimeType || "image/jpeg",
        });
      }

      const data = await sendChatMessage(activeConversationId, payload);

      setConversationId(data.conversation._id);
      setConversation(data.conversation);
      setDraft("");
      setDraftImage(null);
      setDraftConversation(false);
      mergeConversationSummary(data.conversation);
      streamAssistant(data.conversation);
    } catch (requestError) {
      setError(requestError.message || "Unable to send the message right now.");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteConversation(targetConversationId) {
    if (!currentUser?._id || !targetConversationId) return;

    try {
      setError("");
      await deleteChatConversation(targetConversationId, { userId: currentUser._id });

      const remaining = conversations.filter((item) => item._id !== targetConversationId);
      setConversations(remaining);

      if (targetConversationId !== conversationId) {
        return;
      }

      if (remaining[0]?._id) {
        await loadConversation(remaining[0]._id, { closeHistory: false });
      } else {
        handleStartFresh();
      }

      setDeleteVisible(false);
      setDeleteConversationId("");
      setDeleteConversationTitle("");
    } catch (requestError) {
      setError(requestError.message || "Unable to delete the conversation right now.");
    }
  }

  function confirmDeleteConversation() {
    if (!deleteConversationId) return;
    void handleDeleteConversation(deleteConversationId);
  }

  async function handleRenameConversation() {
    if (!renameConversationId || !renameTitle.trim() || !currentUser?._id) return;

    try {
      setError("");
      const data = await renameChatConversation(renameConversationId, {
        userId: currentUser._id,
        title: renameTitle.trim(),
      });
      setRenameVisible(false);

      if (renameConversationId === conversationId) {
        setConversation(data.conversation);
      }

      mergeConversationSummary(data.conversation);
      setRenameConversationId("");
    } catch (requestError) {
      setError(requestError.message || "Unable to rename the conversation right now.");
    }
  }

  async function handleRateMessage(messageId, rating) {
    if (!conversationId || !currentUser?._id) return;

    try {
      const currentMessage = conversation?.messages?.find((item) => item._id === messageId);
      const nextRating = currentMessage?.rating === rating ? null : rating;

      await rateChatMessage(conversationId, messageId, {
        userId: currentUser._id,
        rating: nextRating,
      });

      setConversation((current) => {
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

  const messages = conversation?.messages || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.page}>
        <AppBrandHeader
          right={
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerIconButton}
                onPress={() => setHistoryVisible(true)}
              >
                <MaterialIcons name="menu" size={20} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.headerPrimaryButton} onPress={handleStartFresh}>
                <MaterialIcons name="add" size={16} color="white" />
                <Text style={styles.headerPrimaryText}>New Chat</Text>
              </Pressable>
            </View>
          }
        />

        {error ? (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color="#b42318" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.threadStage}>
          <View style={styles.threadTopRow}>
            <View style={styles.threadTitleWrap}>
              <Text style={styles.threadEyebrow}>Student AI Assistant</Text>
              <Text style={styles.threadTitle} numberOfLines={1}>
                {conversation?.title || "New conversation"}
              </Text>
            </View>

            <View style={styles.threadTopActions}>
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>{messages.length} messages</Text>
              </View>
              {conversationId ? (
                <Pressable
                  style={styles.threadIconButton}
                  onPress={() => openRenameModal(conversationId, conversation?.title || "")}
                >
                  <MaterialIcons name="edit" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
              {conversationId ? (
                <Pressable
                  style={styles.threadDangerButton}
                  onPress={() =>
                    openDeleteModal(conversationId, conversation?.title || "this conversation")
                  }
                >
                  <MaterialIcons name="delete-outline" size={18} color="#ba1a1a" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={styles.threadHint}>
            Ask naturally. If it needs staff follow-up later, you can turn it into a ticket after the chat helps you shape the request.
          </Text>

          <View style={styles.messageStage}>
            {loading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.secondary} />
              </View>
            ) : (
              <ScrollView
                ref={scrollRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {messages.length ? (
                  messages.map((message) => (
                    <View
                      key={message._id}
                      style={[
                        styles.messageRow,
                        message.role === "user"
                          ? styles.userMessageRow
                          : styles.aiMessageRow,
                      ]}
                    >
                      {message.role === "assistant" ? (
                        <View style={styles.aiAvatar}>
                          <MaterialIcons
                            name="auto-awesome"
                            size={16}
                            color={colors.secondary}
                          />
                        </View>
                      ) : null}

                      <View
                        style={[
                          styles.messageBubble,
                          message.role === "user"
                            ? styles.userBubble
                            : styles.assistantBubble,
                        ]}
                      >
                        <View style={styles.messageMetaRow}>
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
                        {message.image?.url ? (
                          <Pressable
                            style={styles.messageImageWrap}
                            onPress={() => {
                              void openMessageImage(message.image);
                            }}
                          >
                            <Image
                              source={{ uri: resolveImageUrl(message.image.url) }}
                              style={styles.messageImage}
                              resizeMode="cover"
                            />
                            <View style={styles.messageImageMeta}>
                              <Text
                                style={[
                                  styles.messageImageName,
                                  message.role === "user" && styles.userBubbleText,
                                ]}
                                numberOfLines={1}
                              >
                                {message.image.originalName}
                              </Text>
                              <Text
                                style={[
                                  styles.messageImageSize,
                                  message.role === "user" && styles.userBubbleMeta,
                                ]}
                              >
                                Tap to open
                                {message.image.size
                                  ? ` • ${formatImageSize(message.image.size)}`
                                  : ""}
                              </Text>
                            </View>
                          </Pressable>
                        ) : null}

                        {message.content ? (
                          <Text
                            style={[
                              styles.messageText,
                              message.role === "user" && styles.userBubbleText,
                            ]}
                          >
                            {message.content}
                          </Text>
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
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyThread}>
                    <View style={styles.emptyThreadOrb}>
                      <MaterialIcons name="psychology" size={24} color={colors.secondary} />
                    </View>
                    <Text style={styles.emptyTitle}>Start the conversation</Text>
                    <Text style={styles.emptyText}>
                      Type your first message below. This page stays open like a chatbot, and your history is available from the menu.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.composerShell}>
            <View style={styles.composerMain}>
              {draftImage ? (
                <View style={styles.draftImageCard}>
                  <Image
                    source={{ uri: draftImage.uri }}
                    style={styles.draftImagePreview}
                    resizeMode="cover"
                  />
                  <View style={styles.draftImageBody}>
                    <Text style={styles.draftImageName} numberOfLines={1}>
                      {draftImage.name || "Selected image"}
                    </Text>
                    <Text style={styles.draftImageMeta}>
                      {formatImageSize(draftImage.size) || "Ready to send"}
                    </Text>
                  </View>
                  <Pressable style={styles.draftImageRemove} onPress={removeDraftImage}>
                    <MaterialIcons name="close" size={16} color={colors.primary} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composerInputRow}>
                <Pressable
                  style={styles.attachButton}
                  onPress={() => {
                    void handlePickImage();
                  }}
                  disabled={pickingImage || sending}
                >
                  <MaterialIcons
                    name={pickingImage ? "hourglass-top" : "image"}
                    size={18}
                    color={colors.primary}
                  />
                </Pressable>
                <TextInput
                  style={styles.composerInput}
                  placeholder="Message UniGuide AI..."
                  placeholderTextColor="#7d8493"
                  value={draft}
                  multiline
                  onChangeText={setDraft}
                />
              </View>
            </View>
            <Pressable
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={() => {
                void handleSend();
              }}
              disabled={sending}
            >
              <MaterialIcons
                name={sending ? "hourglass-top" : "arrow-upward"}
                size={18}
                color="white"
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={historyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.drawerBackdrop}>
          <Pressable style={styles.drawerScrim} onPress={() => setHistoryVisible(false)} />
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerEyebrow}>History</Text>
                <Text style={styles.drawerTitle}>Conversations</Text>
              </View>
              <Pressable
                style={styles.drawerCloseButton}
                onPress={() => setHistoryVisible(false)}
              >
                <MaterialIcons name="close" size={18} color={colors.primary} />
              </Pressable>
            </View>

            <Pressable style={styles.drawerNewButton} onPress={handleStartFresh}>
              <MaterialIcons name="add" size={18} color="white" />
              <Text style={styles.drawerNewButtonText}>New chat</Text>
            </Pressable>

            {historyLoading ? (
              <View style={styles.drawerLoading}>
                <ActivityIndicator color={colors.secondary} />
              </View>
            ) : conversations.length ? (
              <ScrollView
                style={styles.drawerList}
                contentContainerStyle={styles.drawerListContent}
                showsVerticalScrollIndicator={false}
              >
                {conversations.map((item) => {
                  const active = item._id === conversationId;

                  return (
                    <View
                      key={item._id}
                      style={[styles.drawerItem, active && styles.drawerItemActive]}
                    >
                      <Pressable
                        style={styles.drawerItemMain}
                        onPress={() => {
                          void loadConversation(item._id);
                        }}
                      >
                        <Text
                          style={[
                            styles.drawerItemTitle,
                            active && styles.drawerItemTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.drawerItemPreview} numberOfLines={2}>
                          {item.lastMessagePreview || "No messages yet"}
                        </Text>
                        <Text style={styles.drawerItemMeta}>
                          {item.messageCount} messages
                          {item.lastMessageAt ? ` - ${formatWhen(item.lastMessageAt)}` : ""}
                        </Text>
                      </Pressable>

                      <View style={styles.drawerItemActions}>
                        <Pressable
                          style={styles.drawerItemIcon}
                          onPress={() => openRenameModal(item._id, item.title)}
                        >
                          <MaterialIcons name="edit" size={16} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          style={styles.drawerItemDanger}
                          onPress={() => openDeleteModal(item._id, item.title)}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={16}
                            color="#ba1a1a"
                          />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.drawerEmpty}>
                <MaterialIcons name="forum" size={22} color={colors.secondary} />
                <Text style={styles.drawerEmptyTitle}>No saved conversations yet</Text>
                <Text style={styles.drawerEmptyText}>
                  Send your first message and it will show up here.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

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

      <Modal
        visible={deleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete conversation</Text>
            <Text style={styles.modalBody}>
              This will permanently remove{" "}
              <Text style={styles.modalBodyStrong}>{deleteConversationTitle}</Text> and its full chat history.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhostButton} onPress={() => setDeleteVisible(false)}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalDangerButton}
                onPress={confirmDeleteConversation}
              >
                <Text style={styles.modalDangerText}>Delete</Text>
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
    backgroundColor: colors.background,
  },
  page: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 14,
    gap: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  headerPrimaryButton: {
    minHeight: 40,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerPrimaryText: {
    color: "white",
    fontWeight: "800",
    fontSize: 12,
  },
  errorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f3c7c3",
    backgroundColor: "#fff1f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    color: "#b42318",
    fontWeight: "700",
  },
  threadStage: {
    flex: 1,
    gap: 10,
  },
  threadTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  threadTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  threadEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  threadTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statChip: {
    borderRadius: 999,
    backgroundColor: "#eef1f7",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statChipText: {
    color: "#536074",
    fontSize: 11,
    fontWeight: "700",
  },
  threadIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  threadDangerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff1f0",
    alignItems: "center",
    justifyContent: "center",
  },
  messageStage: {
    flex: 1,
    backgroundColor: "#fbfcfe",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e7ebf2",
    overflow: "hidden",
  },
  headerButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f4f5fb",
  },
  headerButtonText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe3ea",
    gap: 10,
  },
  summaryEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  summaryText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  summaryMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  summaryPill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f8f8fc",
    borderWidth: 1,
    borderColor: "#eceef4",
  },
  summaryPillValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryPillLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  summaryTime: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    color: "#b42318",
    fontWeight: "700",
  },
  threadCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dfe3ea",
    padding: 14,
    gap: 12,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  threadTitle: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  threadHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  threadActions: {
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
  loadingBlock: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
    paddingBottom: 16,
    flexGrow: 1,
  },
  messageRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  aiMessageRow: {
    justifyContent: "flex-start",
  },
  userMessageRow: {
    justifyContent: "flex-end",
  },
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ece5ff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: "88%",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  userBubble: {
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e6ebf3",
    flexShrink: 1,
  },
  messageMetaRow: {
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
  messageImageWrap: {
    gap: 8,
  },
  messageImage: {
    width: 220,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#dde3ec",
  },
  messageImageMeta: {
    gap: 2,
  },
  messageImageName: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  messageImageSize: {
    color: colors.textMuted,
    fontSize: 11,
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
    flex: 1,
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyThreadOrb: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  composerShell: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingTop: 4,
  },
  composerMain: {
    flex: 1,
    gap: 8,
  },
  draftImageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe5ee",
    padding: 10,
  },
  draftImagePreview: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#dde3ec",
  },
  draftImageBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  draftImageName: {
    color: colors.primary,
    fontWeight: "700",
  },
  draftImageMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  draftImageRemove: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  composerInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  attachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  composerInput: {
    flex: 1,
    minHeight: 56,
    maxHeight: 132,
    borderRadius: 22,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe5ee",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.65,
  },
  drawerBackdrop: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(12,18,28,0.28)",
  },
  drawerScrim: {
    flex: 1,
  },
  drawerPanel: {
    width: "84%",
    maxWidth: 360,
    backgroundColor: "#f9fbff",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 22,
    gap: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  drawerEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  drawerTitle: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 3,
  },
  drawerCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerNewButton: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  drawerNewButtonText: {
    color: "white",
    fontWeight: "800",
  },
  drawerLoading: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerList: {
    flex: 1,
  },
  drawerListContent: {
    gap: 10,
    paddingBottom: 16,
  },
  drawerItem: {
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e6ebf3",
    padding: 12,
    gap: 10,
  },
  drawerItemActive: {
    borderColor: "#9f84f8",
    backgroundColor: "#f4efff",
  },
  drawerItemMain: {
    gap: 5,
  },
  drawerItemTitle: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  drawerItemTitleActive: {
    color: colors.secondary,
  },
  drawerItemPreview: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  drawerItemMeta: {
    color: "#667085",
    fontSize: 11,
  },
  drawerItemActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  drawerItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#eef1f7",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItemDanger: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff1f0",
    alignItems: "center",
    justifyContent: "center",
  },
  drawerEmpty: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  drawerEmptyTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  drawerEmptyText: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
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
  modalBody: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  modalBodyStrong: {
    color: colors.primary,
    fontWeight: "800",
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
  modalDangerButton: {
    minHeight: layout.touchTarget,
    paddingHorizontal: 16,
    borderRadius: layout.pillRadius,
    backgroundColor: "#ba1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerText: {
    color: "white",
    fontWeight: "800",
  },
});
