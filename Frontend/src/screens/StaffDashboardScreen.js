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
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { fetchAnnouncements } from "../api/announcements";
import { fetchKnowledgeBaseFaqs } from "../api/knowledgeBase";
import { fetchTickets } from "../api/tickets";
import { useSession } from "../context/SessionContext";
import {
  formatAnnouncementDate,
  getAnnouncementTypeMeta,
} from "../announcements/utils";
import { colors, layout, type } from "../theme";
import { subscribeRealtimeEvent } from "../realtime/socket";

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

function StatCard({ icon, value, label, note, danger = false }) {
  return (
    <View style={[styles.statCard, danger && styles.statCardDanger]}>
      <View style={[styles.statIcon, danger && styles.statIconDanger]}>
        <MaterialIcons name={icon} size={18} color={danger ? "#b42318" : colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

function QueueCard({ ticket, onPress }) {
  const priority = String(ticket.priority || "").toLowerCase();
  const status = String(ticket.status || "");
  const urgent = priority === "high" || priority === "urgent" || status === "Escalated";

  return (
    <Pressable style={[styles.queueCard, urgent && styles.queueCardUrgent]} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.queueCode}>{ticket.ticketCode}</Text>
        <Text style={styles.queueTime}>{formatTime(ticket.updatedAt || ticket.createdAt)}</Text>
      </View>
      <View style={styles.badgeRow}>
        <Badge
          label={ticket.priority}
          background={priority === "urgent" ? "#fee2e2" : priority === "high" ? "#fff1f2" : "#eef2ff"}
          color={priority === "urgent" ? "#b91c1c" : priority === "high" ? "#be123c" : colors.primary}
        />
        <Badge
          label={ticket.status}
          background={status === "Escalated" ? "#fff7d6" : status === "In Progress" ? "#ede9fe" : "#ecfdf3"}
          color={status === "Escalated" ? "#a16207" : status === "In Progress" ? colors.secondary : "#166534"}
        />
      </View>
      <Text style={styles.queueTitle}>{ticket.subject}</Text>
      <Text style={styles.queueMeta}>
        {ticket.student?.name || "Student"} • {ticket.department || "General support"}
      </Text>
    </Pressable>
  );
}

function Badge({ label, background, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function WorkflowCard({ icon, title, note, metric, detail, action, onPress }) {
  return (
    <Pressable style={styles.workflowCard} onPress={onPress}>
      <View style={styles.workflowIcon}>
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
        <Text style={styles.updateMeta}>Expires {formatAnnouncementDate(announcement.expiryDate)}</Text>
      </View>
    </Pressable>
  );
}

function EmptyCard({ title, body }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function StaffDashboardScreen({ navigation }) {
  const { currentUser } = useSession();
  const [dashboard, setDashboard] = useState({
    tickets: [],
    announcements: [],
    faqs: [],
    loadedAt: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [currentUser?._id, currentUser?.role]);

  const loadDashboard = useCallback(
    async ({ pullToRefresh = false, silent = false } = {}) => {
      if (!currentUser?._id || currentUser.role !== "staff") {
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = false;
        return;
      }

      if (pullToRefresh) setRefreshing(true);
      else if (!silent && !hasLoadedRef.current) setLoading(true);

      const requests = [
        { key: "tickets", label: "tickets", run: () => fetchTickets({ viewerId: currentUser._id, viewerRole: currentUser.role }) },
        { key: "announcements", label: "announcements", run: () => fetchAnnouncements({ viewerRole: "staff" }) },
        { key: "faqs", label: "knowledge base FAQs", run: () => fetchKnowledgeBaseFaqs() },
      ];

      const results = await Promise.allSettled(requests.map((item) => item.run()));
      const failed = [];
      const next = {};

      results.forEach((result, index) => {
        const request = requests[index];

        if (result.status !== "fulfilled") {
          failed.push(request.label);
          return;
        }

        if (request.key === "tickets") next.tickets = Array.isArray(result.value?.tickets) ? result.value.tickets : [];
        if (request.key === "announcements") next.announcements = Array.isArray(result.value?.announcements) ? result.value.announcements : [];
        if (request.key === "faqs") next.faqs = Array.isArray(result.value?.faqs) ? result.value.faqs : [];
      });

      setDashboard((current) => ({
        tickets: next.tickets ?? current.tickets,
        announcements: next.announcements ?? current.announcements,
        faqs: next.faqs ?? current.faqs,
        loadedAt: new Date().toISOString(),
      }));

      if (failed.length === requests.length) {
        setNotice({ tone: "error", text: "Unable to load the staff dashboard right now." });
      } else if (failed.length) {
        setNotice({ tone: "warn", text: `Some sections could not refresh: ${failed.join(", ")}.` });
      } else {
        setNotice(null);
      }

      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    },
    [currentUser]
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  useEffect(() => {
    if (!currentUser?._id || currentUser.role !== "staff") {
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

    return () => {
      unsubscribeTicketChanged();
      unsubscribeAnnouncementChanged();
    };
  }, [currentUser?._id, currentUser?.role, loadDashboard]);

  if (!currentUser || currentUser.role !== "staff") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <AppBrandHeader style={styles.brandHeader} />
          <EmptyCard
            title="Sign in as staff"
            body="The staff dashboard becomes available after logging in with a staff account."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tickets = dashboard.tickets;
  const announcements = dashboard.announcements;
  const faqs = dashboard.faqs;
  const department = currentUser?.staffProfile?.department || "Student Services";
  const firstName = String(currentUser?.name || "Staff").trim().split(" ")[0] || "Staff";

  const newTickets = tickets.filter((item) => item.status === "New").length;
  const inProgressTickets = tickets.filter((item) => item.status === "In Progress").length;
  const escalatedTickets = tickets.filter((item) => item.status === "Escalated").length;
  const resolvedTickets = tickets.filter((item) => item.status === "Resolved").length;
  const urgentTickets = tickets.filter((item) => ["High", "Urgent"].includes(String(item.priority || "")) || item.status === "Escalated").length;
  const pinnedAnnouncements = announcements.filter((item) => item.pinnedToTop).length;
  const staffOnlyAnnouncements = announcements.filter((item) => item.targetAudience === "staff").length;
  const faqCategories = Array.from(
    new Set(faqs.map((item) => String(item.category || "").trim()).filter(Boolean))
  );

  const priorityTickets = tickets
    .slice()
    .sort((left, right) => {
      const leftWeight = left.status === "Escalated" ? 3 : ["High", "Urgent"].includes(left.priority) ? 2 : left.status === "New" ? 1 : 0;
      const rightWeight = right.status === "Escalated" ? 3 : ["High", "Urgent"].includes(right.priority) ? 2 : right.status === "New" ? 1 : 0;

      if (leftWeight !== rightWeight) {
        return rightWeight - leftWeight;
      }

      return stamp(right.updatedAt || right.createdAt) - stamp(left.updatedAt || left.createdAt);
    })
    .slice(0, 3);

  const latestAnnouncements = announcements
    .slice()
    .sort((left, right) => stamp(right.createdAt || right.updatedAt) - stamp(left.createdAt || left.updatedAt))
    .slice(0, 2);

  const initialLoading = loading && !dashboard.loadedAt;

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
        <AppBrandHeader
          style={styles.brandHeader}
          right={
            <View style={styles.topActions}>
              <Pressable style={styles.refreshButton} onPress={() => void loadDashboard()}>
                <MaterialIcons name="refresh" size={18} color={colors.primary} />
              </Pressable>
            </View>
          }
        />

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Staff Workspace</Text>
          </View>
          <Text style={styles.title}>Welcome back, {firstName}.</Text>
          <Text style={styles.subtitle}>
            Your dashboard is now focused on real staff work: assigned tickets, current updates,
            and the knowledge base you can use while responding to students.
          </Text>
          <Text style={styles.heroMeta}>
            {dashboard.loadedAt ? `Updated ${formatTime(dashboard.loadedAt)}` : "Syncing data"} • {department}
          </Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Tickets")}>
              <MaterialIcons name="confirmation-number" size={18} color="white" />
              <Text style={styles.primaryButtonText}>Open Queue</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Updates")}>
              <MaterialIcons name="campaign" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Read Updates</Text>
            </Pressable>
          </View>
        </View>

        <NoticeBanner notice={notice} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today’s Snapshot</Text>
          <Text style={styles.sectionBody}>Live numbers from your queue, staff updates, and support reference library.</Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : (
            <View style={styles.stack}>
              <StatCard icon="assignment-ind" value={count(tickets.length)} label="Assigned Tickets" note={`${count(newTickets)} new items waiting in your queue`} />
              <StatCard icon="hourglass-top" value={count(inProgressTickets)} label="In Progress" note="Requests currently being worked by staff" />
              <StatCard icon="priority-high" value={count(urgentTickets)} label="Urgent Attention" note={`${count(escalatedTickets)} escalated tickets in your ownership`} danger={urgentTickets > 0} />
              <StatCard icon="campaign" value={count(announcements.length)} label="Visible Updates" note={`${count(staffOnlyAnnouncements)} staff-only • ${count(pinnedAnnouncements)} pinned`} />
              <StatCard icon="task-alt" value={count(resolvedTickets)} label="Resolved" note="Tickets already completed in your assigned list" />
              <StatCard icon="library-books" value={count(faqs.length)} label="Knowledge Base FAQs" note={`${count(faqCategories.length)} categories ready for reference`} />
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Priority Queue</Text>
          <Text style={styles.sectionBody}>The tickets below are the best place to start when you open your queue.</Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : priorityTickets.length ? (
            <View style={styles.stack}>
              {priorityTickets.map((ticket) => (
                <QueueCard
                  key={ticket._id || ticket.id}
                  ticket={ticket}
                  onPress={() => navigation.navigate("Tickets", { ticketId: ticket._id || ticket.id })}
                />
              ))}
            </View>
          ) : (
            <EmptyCard
              title="No priority tickets right now"
              body="When new, urgent, or escalated requests are assigned to you, they will appear here first."
            />
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Workflow</Text>
          <Text style={styles.sectionBody}>Move through your main staff actions without bouncing around messy screens.</Text>
          <View style={styles.stack}>
            <WorkflowCard
              icon="confirmation-number"
              title="My Queue"
              note="Review assigned requests, reply to students, and update status."
              metric={`${count(tickets.length)} assigned`}
              detail={`${count(newTickets)} new • ${count(inProgressTickets)} in progress • ${count(escalatedTickets)} escalated`}
              action="Open queue"
              onPress={() => navigation.navigate("Tickets")}
            />
            <WorkflowCard
              icon="campaign"
              title="Staff Updates"
              note="Stay current on notices that affect service operations and campus guidance."
              metric={`${count(announcements.length)} active updates`}
              detail={`${count(staffOnlyAnnouncements)} staff-only • ${count(pinnedAnnouncements)} pinned to the top`}
              action="View updates"
              onPress={() => navigation.navigate("Updates")}
            />
            <WorkflowCard
              icon="library-books"
              title="Knowledge Base"
              note="Use approved answers when you need a fast and consistent response."
              metric={`${count(faqs.length)} FAQs ready`}
              detail={
                faqCategories.length
                  ? `${faqCategories.slice(0, 3).join(", ")}${faqCategories.length > 3 ? "..." : ""}`
                  : "Approved FAQ guidance will appear here."
              }
              action="Open knowledge"
              onPress={() => navigation.navigate("KB")}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Latest Updates</Text>
          <Text style={styles.sectionBody}>Recent notices you may need while handling today’s requests.</Text>
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
                  onPress={() => navigation.navigate("Updates")}
                />
              ))}
            </View>
          ) : (
            <EmptyCard
              title="No active announcements"
              body="Staff-visible updates will show here once the admin team publishes them."
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  brandHeader: { marginBottom: 4 },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: layout.notchClearance, paddingBottom: 24, gap: 12 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.94)",
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
  heroBadgeText: { color: colors.secondary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  title: { fontSize: type.h1, fontWeight: "800", color: colors.primary },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  heroMeta: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: layout.pillRadius,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: { color: "white", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
    borderRadius: layout.pillRadius,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
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
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.cardPadding,
    gap: 12,
  },
  sectionTitle: { color: colors.primary, fontSize: type.h3, fontWeight: "800" },
  sectionBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  loadingBox: { paddingVertical: 24, alignItems: "center", justifyContent: "center" },
  stack: { gap: 10 },
  statCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#eef0f3", padding: 14, gap: 8 },
  statCardDanger: { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
  statIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center" },
  statIconDanger: { backgroundColor: "#ffe4e6" },
  statValue: { color: colors.primary, fontSize: 28, fontWeight: "800" },
  statLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  statNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  queueCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 14, gap: 8 },
  queueCardUrgent: { borderColor: "#fecaca", backgroundColor: "#fff8f8" },
  queueCode: { color: colors.secondary, fontWeight: "800" },
  queueTime: { color: "#98a2b3", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  queueTitle: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  queueMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  workflowCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 14, gap: 8 },
  workflowIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center" },
  workflowTitle: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  workflowNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  workflowMetric: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  workflowDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  workflowFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workflowAction: { color: colors.secondary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  updateCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden" },
  updateAccent: { height: 5 },
  updateBody: { padding: 14, gap: 8 },
  updateTypeBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  updateTypeText: { fontSize: 11, fontWeight: "800" },
  updatePinned: { color: colors.secondary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  updateTitle: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  updateText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  updateMeta: { color: colors.textMuted, fontSize: 12 },
  emptyCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 16, gap: 6 },
  emptyTitle: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
