import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { fetchAnnouncements } from "../api/announcements";
import { fetchChatConversations } from "../api/chat";
import { fetchKnowledgeBaseFaqs } from "../api/knowledgeBase";
import { fetchTickets } from "../api/tickets";
import {
  formatAnnouncementDate,
  getAnnouncementTypeMeta,
} from "../announcements/utils";
import { useSession } from "../context/SessionContext";
import { subscribeRealtimeEvent } from "../realtime/socket";
import { colors, layout, type } from "../theme";
import { ticketId } from "./tickets/ticketUtils";

function count(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function stamp(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function formatTime(value) {
  if (!value) return "Recently updated";

  try {
    return new Intl.DateTimeFormat("en-LK", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return String(value);
  }
}

function getStudentRegistration(user) {
  return (
    user?.studentProfile?.registrationNumber ||
    user?.studentProfile?.studentId ||
    ""
  );
}

function getStudentFocus(user) {
  return (
    user?.studentProfile?.specialization ||
    user?.studentProfile?.program ||
    user?.studentProfile?.department ||
    user?.studentProfile?.faculty ||
    ""
  );
}

function getStudentYear(user) {
  return user?.studentProfile?.academicYear || user?.studentProfile?.year || "";
}

function getTicketPriorityWeight(ticket) {
  const priority = String(ticket?.priority || "").toLowerCase();
  const status = String(ticket?.status || "");

  if (status === "Escalated" || priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (status === "In Progress") return 2;
  if (status === "New") return 1;
  return 0;
}

function NoticeBanner({ notice }) {
  if (!notice?.text) return null;

  const warn = notice.tone === "warn";
  const error = notice.tone === "error";

  return (
    <View style={[styles.banner, warn && styles.bannerWarn, error && styles.bannerError]}>
      <MaterialIcons
        name={error ? "error-outline" : warn ? "warning-amber" : "info-outline"}
        size={16}
        color={error ? "#b42318" : warn ? "#8b5e00" : colors.primary}
      />
      <Text style={[styles.bannerText, warn && styles.bannerTextWarn, error && styles.bannerTextError]}>
        {notice.text}
      </Text>
    </View>
  );
}

function EmptyCard({ title, body, actionLabel, onPress }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onPress ? (
        <Pressable style={styles.emptyActionButton} onPress={onPress}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatCard({ icon, value, label, note, accent = false }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <View style={[styles.statIconWrap, accent && styles.statIconWrapAccent]}>
        <MaterialIcons name={icon} size={18} color={accent ? colors.secondary : colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

function InfoPill({ icon, label }) {
  if (!label) return null;

  return (
    <View style={styles.infoPill}>
      <MaterialIcons name={icon} size={14} color={colors.primary} />
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

function SupportTicketCard({ ticket, onPress }) {
  const status = String(ticket.status || "");
  const active = !["Resolved", "Closed"].includes(status);
  const priorityWeight = getTicketPriorityWeight(ticket);

  return (
    <Pressable
      style={[styles.ticketCard, active && priorityWeight >= 2 && styles.ticketCardPriority]}
      onPress={onPress}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.ticketCode}>{ticket.ticketCode}</Text>
        <Text style={styles.ticketTime}>{formatTime(ticket.updatedAt || ticket.createdAt)}</Text>
      </View>
      <View style={styles.badgeRow}>
        <StatusBadge
          label={ticket.priority}
          background={priorityWeight >= 3 ? "#fff1f2" : "#eef2ff"}
          color={priorityWeight >= 3 ? "#be123c" : colors.primary}
        />
        <StatusBadge
          label={ticket.status}
          background={
            status === "Resolved"
              ? "#ecfdf3"
              : status === "Closed"
                ? "#f3f4f6"
                : status === "In Progress"
                  ? "#ede9fe"
                  : "#eef2ff"
          }
          color={
            status === "Resolved"
              ? "#166534"
              : status === "Closed"
                ? "#667085"
                : status === "In Progress"
                  ? colors.secondary
                  : colors.primary
          }
        />
      </View>
      <Text style={styles.ticketTitle}>{ticket.subject}</Text>
      <Text style={styles.ticketMeta}>
        {ticket.requestType || "Support request"} | {ticket.department || "General student support"}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ label, background, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function WorkflowCard({ icon, title, note, metric, detail, action, onPress }) {
  return (
    <Pressable style={styles.workflowCard} onPress={onPress}>
      <View style={styles.workflowIconWrap}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.workflowTitle}>{title}</Text>
      <Text style={styles.workflowNote}>{note}</Text>
      <Text style={styles.workflowMetric}>{metric}</Text>
      <Text style={styles.workflowDetail}>{detail}</Text>
      <View style={styles.workflowFooter}>
        <Text style={styles.workflowAction}>{action}</Text>
        <MaterialIcons name="arrow-forward" size={16} color={colors.secondary} />
      </View>
    </Pressable>
  );
}

function UpdateCard({ announcement, onPress }) {
  const typeMeta = getAnnouncementTypeMeta(announcement.type);
  const attachmentCount = Array.isArray(announcement.attachments)
    ? announcement.attachments.length
    : 0;

  return (
    <Pressable style={styles.updateCard} onPress={onPress}>
      <View style={[styles.updateAccent, { backgroundColor: typeMeta.color }]} />
      <View style={styles.updateBody}>
        <View style={styles.rowBetween}>
          <View style={[styles.updateTypeBadge, { backgroundColor: typeMeta.softColor }]}>
            <Text style={[styles.updateTypeText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
          </View>
          {announcement.pinnedToTop ? (
            <Text style={styles.updatePinned}>Pinned</Text>
          ) : null}
        </View>
        <Text style={styles.updateTitle}>{announcement.title}</Text>
        <Text style={styles.updateText} numberOfLines={3}>
          {announcement.content}
        </Text>
        <Text style={styles.updateMeta}>
          Expires {formatAnnouncementDate(announcement.expiryDate)}
          {attachmentCount ? ` | ${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function StudentDashboardScreen({ navigation }) {
  const { currentUser } = useSession();
  const [dashboard, setDashboard] = useState({
    tickets: [],
    announcements: [],
    faqs: [],
    conversations: [],
    loadedAt: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const hasLoadedRef = useRef(false);

  const currentUserId = currentUser?._id;
  const currentUserRole = currentUser?.role;

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [currentUserId, currentUserRole]);

  const loadDashboard = useCallback(
    async ({ pullToRefresh = false, silent = false } = {}) => {
      if (!currentUserId || currentUserRole !== "student") {
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = false;
        return;
      }

      if (pullToRefresh) setRefreshing(true);
      else if (!silent && !hasLoadedRef.current) setLoading(true);

      const requests = [
        {
          key: "tickets",
          label: "tickets",
          run: () => fetchTickets({ viewerId: currentUserId, viewerRole: currentUserRole }),
        },
        {
          key: "announcements",
          label: "announcements",
          run: () => fetchAnnouncements({ viewerRole: "student" }),
        },
        {
          key: "faqs",
          label: "knowledge base FAQs",
          run: () => fetchKnowledgeBaseFaqs(),
        },
        {
          key: "conversations",
          label: "AI conversations",
          run: () => fetchChatConversations({ userId: currentUserId }),
        },
      ];

      const results = await Promise.allSettled(requests.map((item) => item.run()));
      const next = {};
      const failed = [];

      results.forEach((result, index) => {
        const request = requests[index];

        if (result.status !== "fulfilled") {
          failed.push(request.label);
          return;
        }

        if (request.key === "tickets") {
          next.tickets = Array.isArray(result.value?.tickets) ? result.value.tickets : [];
        }

        if (request.key === "announcements") {
          next.announcements = Array.isArray(result.value?.announcements)
            ? result.value.announcements
            : [];
        }

        if (request.key === "faqs") {
          next.faqs = Array.isArray(result.value?.faqs) ? result.value.faqs : [];
        }

        if (request.key === "conversations") {
          next.conversations = Array.isArray(result.value?.conversations)
            ? result.value.conversations
            : [];
        }
      });

      setDashboard((current) => ({
        tickets: next.tickets ?? current.tickets,
        announcements: next.announcements ?? current.announcements,
        faqs: next.faqs ?? current.faqs,
        conversations: next.conversations ?? current.conversations,
        loadedAt: new Date().toISOString(),
      }));

      if (failed.length === requests.length) {
        setNotice({ tone: "error", text: "Unable to load the student dashboard right now." });
      } else if (failed.length) {
        setNotice({ tone: "warn", text: `Some sections could not refresh: ${failed.join(", ")}.` });
      } else {
        setNotice(null);
      }

      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    },
    [currentUserId, currentUserRole]
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  useEffect(() => {
    if (!currentUserId || currentUserRole !== "student") {
      return undefined;
    }

    const handleRealtimeRefresh = () => {
      void loadDashboard({ silent: true });
    };

    const unsubscribeTicketChanged = subscribeRealtimeEvent(
      "ticket:changed",
      handleRealtimeRefresh
    );
    const unsubscribeAnnouncementChanged = subscribeRealtimeEvent(
      "announcement:changed",
      handleRealtimeRefresh
    );
    const unsubscribeConversationChanged = subscribeRealtimeEvent(
      "chat:conversationChanged",
      handleRealtimeRefresh
    );
    const unsubscribeConversationDeleted = subscribeRealtimeEvent(
      "chat:conversationDeleted",
      handleRealtimeRefresh
    );

    return () => {
      unsubscribeTicketChanged();
      unsubscribeAnnouncementChanged();
      unsubscribeConversationChanged();
      unsubscribeConversationDeleted();
    };
  }, [currentUserId, currentUserRole, loadDashboard]);

  function openAnnouncementsPage() {
    navigation.navigate("StudentAnnouncements");
  }

  function openTab(routeName, params) {
    const parentNavigation = navigation.getParent?.();

    if (parentNavigation?.navigate) {
      parentNavigation.navigate(routeName, params);
      return;
    }

    navigation.navigate(routeName, params);
  }

  function openSupportWorkspace(params) {
    openTab("My Tickets", params);
  }

  function openMessagesWorkspace() {
    openTab("Messages");
  }

  function openKnowledgeWorkspace() {
    openTab("Knowledge Base");
  }

  function openProfileWorkspace() {
    openTab("Profile");
  }

  if (!currentUser || currentUser.role !== "student") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <AppBrandHeader />
          </View>
          <EmptyCard
            title="Sign in as a student"
            body="The student dashboard becomes available after logging in with a student account."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const studentProfile = currentUser.studentProfile || {};
  const firstName = String(currentUser.name || "Student").trim().split(" ")[0] || "Student";
  const registration = getStudentRegistration(currentUser);
  const focus = getStudentFocus(currentUser);
  const academicYear = getStudentYear(currentUser);
  const semester = studentProfile.semester || "";
  const campus = studentProfile.campus || "";
  const profileAttentionNeeded = !String(currentUser.phone || "").trim() || !registration || !campus;

  const tickets = dashboard.tickets;
  const announcements = dashboard.announcements;
  const faqs = dashboard.faqs;
  const conversations = dashboard.conversations;

  const openTickets = tickets.filter((item) => !["Resolved", "Closed"].includes(String(item.status || ""))).length;
  const newTickets = tickets.filter((item) => String(item.status || "") === "New").length;
  const inProgressTickets = tickets.filter((item) => String(item.status || "") === "In Progress").length;
  const resolvedTickets = tickets.filter((item) => ["Resolved", "Closed"].includes(String(item.status || ""))).length;
  const pinnedAnnouncements = announcements.filter((item) => item.pinnedToTop).length;
  const faqCategories = Array.from(
    new Set(faqs.map((item) => String(item.category || "").trim()).filter(Boolean))
  );

  const sortedConversations = conversations
    .slice()
    .sort(
      (left, right) =>
        stamp(right.updatedAt || right.lastMessageAt || right.createdAt) -
        stamp(left.updatedAt || left.lastMessageAt || left.createdAt)
    );
  const latestConversation = sortedConversations[0] || null;

  const highlightedTickets = tickets
    .slice()
    .sort((left, right) => {
      const weightDiff = getTicketPriorityWeight(right) - getTicketPriorityWeight(left);

      if (weightDiff !== 0) {
        return weightDiff;
      }

      return stamp(right.updatedAt || right.createdAt) - stamp(left.updatedAt || left.createdAt);
    })
    .slice(0, 3);

  const latestAnnouncements = announcements
    .slice()
    .sort((left, right) => stamp(right.createdAt || right.updatedAt) - stamp(left.createdAt || left.updatedAt))
    .slice(0, 2);

  const initialLoading = loading && !dashboard.loadedAt;
  const studyMeta = [focus, academicYear, semester].filter(Boolean).join(" | ");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard({ pullToRefresh: true })}
            tintColor={colors.secondary}
          />
        }
      >
        <View style={styles.header}>
          <AppBrandHeader />
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Student Workspace</Text>
          </View>
          <Text style={styles.heroTitle}>Welcome back, {firstName}.</Text>
          <Text style={styles.heroBody}>
            Your dashboard now keeps the student flow in one place: support requests, AI help,
            campus updates, and approved answers from the knowledge base.
          </Text>
          <Text style={styles.heroMeta}>
            {dashboard.loadedAt ? `Updated ${formatTime(dashboard.loadedAt)}` : "Syncing student data"}
          </Text>

          <View style={styles.heroPillRow}>
            <InfoPill icon="badge" label={registration || "Registration pending"} />
            <InfoPill icon="school" label={studyMeta || "Program details pending"} />
            <InfoPill icon="place" label={campus || "Campus not added"} />
          </View>

          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={openMessagesWorkspace}>
              <MaterialIcons name="auto-awesome" size={18} color="white" />
              <Text style={styles.primaryButtonText}>Ask UniGuide AI</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => openSupportWorkspace({ mode: "create" })}
            >
              <MaterialIcons name="confirmation-number" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>New Support Request</Text>
            </Pressable>
          </View>
        </View>

        {profileAttentionNeeded ? (
          <Pressable style={styles.profilePrompt} onPress={openProfileWorkspace}>
            <View style={styles.profilePromptIcon}>
              <MaterialIcons name="person-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.profilePromptBody}>
              <Text style={styles.profilePromptTitle}>Complete your student profile</Text>
              <Text style={styles.profilePromptText}>
                Adding your contact number, registration, and campus helps staff respond faster.
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.primary} />
          </Pressable>
        ) : null}

        <NoticeBanner notice={notice} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today's Snapshot</Text>
          <Text style={styles.sectionBody}>
            Live numbers from your requests, student updates, AI chats, and the support library.
          </Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : (
            <View style={styles.stack}>
              <StatCard
                icon="confirmation-number"
                value={count(openTickets)}
                label="Open Requests"
                note={`${count(newTickets)} new and ${count(inProgressTickets)} in progress`}
                accent={openTickets > 0}
              />
              <StatCard
                icon="task-alt"
                value={count(resolvedTickets)}
                label="Resolved Tickets"
                note="Completed requests ready for review or feedback"
              />
              <StatCard
                icon="forum"
                value={count(conversations.length)}
                label="AI Conversations"
                note={
                  latestConversation
                    ? `Last active ${formatTime(latestConversation.updatedAt || latestConversation.lastMessageAt || latestConversation.createdAt)}`
                    : "Start your first AI chat whenever you need help"
                }
              />
              <StatCard
                icon="campaign"
                value={count(announcements.length)}
                label="Campus Updates"
                note={`${count(pinnedAnnouncements)} pinned announcements visible to students`}
              />
              <StatCard
                icon="library-books"
                value={count(faqs.length)}
                label="Knowledge Base FAQs"
                note={`${count(faqCategories.length)} categories ready to browse`}
              />
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>My Requests</Text>
          <Text style={styles.sectionBody}>
            Jump straight into the tickets that matter most instead of opening a long list first.
          </Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : highlightedTickets.length ? (
            <View style={styles.stack}>
              {highlightedTickets.map((ticket) => (
                <SupportTicketCard
                  key={ticket._id || ticket.id}
                  ticket={ticket}
                  onPress={() => openSupportWorkspace({ ticketId: ticketId(ticket) })}
                />
              ))}
            </View>
          ) : (
            <EmptyCard
              title="No student requests yet"
              body="When you create a support request, it will appear here with its latest progress."
              actionLabel="Create your first request"
              onPress={() => openSupportWorkspace({ mode: "create" })}
            />
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Student Flow</Text>
          <Text style={styles.sectionBody}>
            Move through the main student actions without bouncing through demo content.
          </Text>
          <View style={styles.stack}>
            <WorkflowCard
              icon="auto-awesome"
              title="AI Assistant"
              note="Ask study, campus, or policy questions in your saved UniGuide chat."
              metric={`${count(conversations.length)} saved chats`}
              detail={
                latestConversation
                  ? `${latestConversation.title || "Recent conversation"} | ${formatTime(latestConversation.updatedAt || latestConversation.lastMessageAt || latestConversation.createdAt)}`
                  : "Start a new conversation and it will be kept here for later."
              }
              action="Open chat"
              onPress={openMessagesWorkspace}
            />
            <WorkflowCard
              icon="confirmation-number"
              title="Support Center"
              note="Create requests, read staff replies, and close resolved issues."
              metric={`${count(openTickets)} open tickets`}
              detail={`${count(newTickets)} new | ${count(inProgressTickets)} in progress | ${count(resolvedTickets)} resolved`}
              action="Manage tickets"
              onPress={() => openSupportWorkspace()}
            />
            <WorkflowCard
              icon="campaign"
              title="Announcements"
              note="Review official student notices, deadlines, and attached documents."
              metric={`${count(announcements.length)} active updates`}
              detail={`${count(pinnedAnnouncements)} pinned notices currently visible to students`}
              action="Read updates"
              onPress={openAnnouncementsPage}
            />
            <WorkflowCard
              icon="library-books"
              title="Knowledge Base"
              note="Find approved answers before raising a new request."
              metric={`${count(faqs.length)} FAQs available`}
              detail={
                faqCategories.length
                  ? faqCategories.slice(0, 3).join(", ")
                  : "FAQ categories will appear here once entries are available."
              }
              action="Browse FAQs"
              onPress={openKnowledgeWorkspace}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Latest Updates</Text>
          <Text style={styles.sectionBody}>
            The newest student-facing announcements are collected here for a faster daily check-in.
          </Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : latestAnnouncements.length ? (
            <View style={styles.stack}>
              {latestAnnouncements.map((announcement) => (
                <UpdateCard
                  key={announcement._id || announcement.id}
                  announcement={announcement}
                  onPress={openAnnouncementsPage}
                />
              ))}
            </View>
          ) : (
            <EmptyCard
              title="No active announcements"
              body="Student notices will show here as soon as the admin team publishes them."
            />
          )}
        </View>

        <View style={styles.footerGap} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: layout.topBarHeight,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e3e5",
  },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 12 },
  heroCard: {
    marginTop: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.cardPadding,
    gap: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: layout.pillRadius,
    backgroundColor: "#ece7ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.primary,
    fontSize: type.h1,
    fontWeight: "800",
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  heroMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  heroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: layout.pillRadius,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: layout.pillRadius,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  profilePrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profilePromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  profilePromptBody: {
    flex: 1,
    gap: 2,
  },
  profilePromptTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  profilePromptText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  bannerWarn: { borderColor: "#f3d58b", backgroundColor: "#fff7d6" },
  bannerError: { borderColor: "#ffcac3", backgroundColor: "#ffebe9" },
  bannerText: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: "600" },
  bannerTextWarn: { color: "#8b5e00" },
  bannerTextError: { color: "#b42318" },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.cardPadding,
    gap: 12,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: type.h3,
    fontWeight: "800",
  },
  sectionBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    gap: 10,
  },
  statCard: {
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#eef0f3",
    padding: 14,
    gap: 8,
  },
  statCardAccent: {
    backgroundColor: "#faf5ff",
    borderColor: "#e9d5ff",
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconWrapAccent: {
    backgroundColor: "#f3e8ff",
  },
  statValue: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  statNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  ticketCard: {
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 8,
  },
  ticketCardPriority: {
    borderColor: "#d8b4fe",
    backgroundColor: "#fcfaff",
  },
  ticketCode: {
    color: colors.secondary,
    fontWeight: "800",
  },
  ticketTime: {
    color: "#98a2b3",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  ticketTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  ticketMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  workflowCard: {
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 8,
  },
  workflowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  workflowTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  workflowNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  workflowMetric: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  workflowDetail: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  workflowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workflowAction: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  updateCard: {
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  updateAccent: {
    height: 5,
  },
  updateBody: {
    padding: 14,
    gap: 8,
  },
  updateTypeBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  updateTypeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  updatePinned: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  updateTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  updateText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  updateMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyActionButton: {
    alignSelf: "flex-start",
    borderRadius: layout.pillRadius,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  footerGap: {
    height: 8,
  },
});
