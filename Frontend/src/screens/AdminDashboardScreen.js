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
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../components/AdminShell";
import { fetchAnalyticsSummary } from "../api/analyticsLogs";
import { fetchAnnouncements } from "../api/announcements";
import { fetchKnowledgeBaseDocuments, fetchKnowledgeBaseFaqs } from "../api/knowledgeBase";
import { fetchTicketFeedbackDashboard, fetchTickets } from "../api/tickets";
import { fetchUsers } from "../api/users";
import { useSession } from "../context/SessionContext";
import { adminModuleGroups, getAdminModulesByGroup, openAdminRoute } from "../navigation/adminModules";
import { subscribeRealtimeEvent } from "../realtime/socket";
import { colors, layout, type } from "../theme";

function n(value) {
  return Number(value || 0);
}

function count(value) {
  return new Intl.NumberFormat("en-US").format(n(value));
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

function isOpen(ticket) {
  return !["Resolved", "Closed"].includes(String(ticket?.status || ""));
}

function isUrgent(ticket) {
  return isOpen(ticket) && ["High", "Urgent"].includes(String(ticket?.priority || ""));
}

function isActiveNotice(item) {
  if (!item?.expiryDate) return true;
  return stamp(item.expiryDate) >= Date.now();
}

function NoticeBanner({ notice }) {
  if (!notice?.text) return null;

  const warn = notice.tone === "warn";
  const error = notice.tone === "error";

  return (
    <View style={[styles.banner, error && styles.bannerError, warn && styles.bannerWarn]}>
      <MaterialIcons
        name={error ? "error-outline" : warn ? "warning-amber" : "info-outline"}
        size={16}
        color={error ? "#b42318" : warn ? "#8b5e00" : colors.primary}
      />
      <Text style={[styles.bannerText, error && styles.bannerTextError, warn && styles.bannerTextWarn]}>
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

function ModuleCard({ item, insight, onPress }) {
  return (
    <Pressable style={styles.moduleCard} onPress={onPress}>
      <View style={styles.moduleTop}>
        <View style={styles.moduleIcon}>
          <MaterialIcons name={item.icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.liveTag}>Live</Text>
      </View>
      <Text style={styles.moduleTitle}>{item.label}</Text>
      <Text style={styles.moduleNote}>{item.note}</Text>
      <Text style={styles.moduleMetric}>{insight.metric}</Text>
      <Text style={styles.moduleDetail}>{insight.detail}</Text>
      <View style={styles.moduleFooter}>
        <Text style={styles.moduleAction}>{insight.action}</Text>
        <MaterialIcons name="arrow-forward" size={16} color={colors.secondary} />
      </View>
    </Pressable>
  );
}

function ActivityRow({ item, onPress }) {
  return (
    <Pressable style={styles.activityRow} onPress={onPress}>
      <View style={styles.activityIcon}>
        <MaterialIcons name={item.icon} size={16} color={colors.secondary} />
      </View>
      <View style={styles.activityText}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityBody}>{item.body}</Text>
        <Text style={styles.activityTime}>{formatTime(item.time)}</Text>
      </View>
      <MaterialIcons name="open-in-new" size={16} color="#98a2b3" />
    </Pressable>
  );
}

export function AdminDashboardScreen({ navigation }) {
  const { currentUser } = useSession();
  const [dashboard, setDashboard] = useState({
    summary: null,
    users: [],
    tickets: [],
    feedback: null,
    announcements: [],
    faqs: [],
    documents: [],
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
      if (!currentUser?._id || currentUser.role !== "admin") {
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = false;
        return;
      }

      if (pullToRefresh) setRefreshing(true);
      else if (!silent && !hasLoadedRef.current) setLoading(true);

      const requests = [
        { key: "summary", label: "analytics summary", run: () => fetchAnalyticsSummary() },
        { key: "users", label: "users", run: () => fetchUsers() },
        { key: "tickets", label: "tickets", run: () => fetchTickets({ viewerId: currentUser._id, viewerRole: currentUser.role }) },
        { key: "feedback", label: "feedback", run: () => fetchTicketFeedbackDashboard({ viewerId: currentUser._id, viewerRole: currentUser.role }) },
        { key: "announcements", label: "announcements", run: () => fetchAnnouncements({ viewerRole: "admin", includeExpired: true }) },
        { key: "faqs", label: "knowledge base FAQs", run: () => fetchKnowledgeBaseFaqs() },
        { key: "documents", label: "knowledge base PDFs", run: () => fetchKnowledgeBaseDocuments() },
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

        if (request.key === "summary") next.summary = result.value;
        if (request.key === "users") next.users = Array.isArray(result.value?.users) ? result.value.users : [];
        if (request.key === "tickets") next.tickets = Array.isArray(result.value?.tickets) ? result.value.tickets : [];
        if (request.key === "feedback") next.feedback = result.value?.summary || null;
        if (request.key === "announcements") next.announcements = Array.isArray(result.value?.announcements) ? result.value.announcements : [];
        if (request.key === "faqs") next.faqs = Array.isArray(result.value?.faqs) ? result.value.faqs : [];
        if (request.key === "documents") next.documents = Array.isArray(result.value?.documents) ? result.value.documents : [];
      });

      setDashboard((current) => ({
        summary: next.summary ?? current.summary,
        users: next.users ?? current.users,
        tickets: next.tickets ?? current.tickets,
        feedback: next.feedback ?? current.feedback,
        announcements: next.announcements ?? current.announcements,
        faqs: next.faqs ?? current.faqs,
        documents: next.documents ?? current.documents,
        loadedAt: new Date().toISOString(),
      }));

      if (failed.length === requests.length) {
        setNotice({ tone: "error", text: "Unable to load the admin dashboard right now." });
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
    if (!currentUser?._id || currentUser.role !== "admin") {
      return undefined;
    }

    const handleRealtimeRefresh = () => {
      void loadDashboard({ silent: true });
    };

    const unsubscribeTicketChanged = subscribeRealtimeEvent(
      "ticket:changed",
      handleRealtimeRefresh
    );
    const unsubscribeFeedbackChanged = subscribeRealtimeEvent(
      "ticket:feedbackChanged",
      handleRealtimeRefresh
    );
    const unsubscribeAnnouncementChanged = subscribeRealtimeEvent(
      "announcement:changed",
      handleRealtimeRefresh
    );

    return () => {
      unsubscribeTicketChanged();
      unsubscribeFeedbackChanged();
      unsubscribeAnnouncementChanged();
    };
  }, [currentUser?._id, currentUser?.role, loadDashboard]);

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <AdminShell navigation={navigation} currentRoute="AdminHome" showBack={false}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sign in as an admin</Text>
            <Text style={styles.emptyBody}>The admin dashboard is only available to admin accounts.</Text>
          </View>
        </ScrollView>
      </AdminShell>
    );
  }

  const users = dashboard.users;
  const tickets = dashboard.tickets;
  const announcements = dashboard.announcements;
  const faqs = dashboard.faqs;
  const documents = dashboard.documents;
  const summary = dashboard.summary?.summary || {};
  const logs = summary.logs || {};

  const students = users.filter((item) => item.role === "student").length;
  const staff = users.filter((item) => item.role === "staff").length;
  const admins = users.filter((item) => item.role === "admin").length;
  const openTickets = n(summary.support?.openTickets ?? tickets.filter(isOpen).length);
  const urgentTickets = tickets.filter(isUrgent).length;
  const unassignedTickets = tickets.filter((item) => isOpen(item) && !item?.assignedTo?._id && !item?.assignedTo?.id).length;
  const activeAnnouncements = n(summary.content?.activeAnnouncements ?? announcements.filter(isActiveNotice).length);
  const pinnedAnnouncements = announcements.filter((item) => isActiveNotice(item) && item.pinnedToTop).length;
  const pendingRag = documents.filter((item) => String(item?.ragStatus || "").toLowerCase() !== "indexed").length;
  const averageRating = n(dashboard.feedback?.averageRating);
  const totalRatings = n(dashboard.feedback?.totalSubmissions);
  const criticalLogs = n(logs.criticalLogs);
  const totalLogs = n(logs.totalLogs);
  const resolvedLogs = n(logs.resolvedLogs);

  const alerts = [];
  if (urgentTickets) alerts.push({ key: "urgent", icon: "priority-high", tone: "danger", title: `${count(urgentTickets)} urgent tickets need attention`, body: `${count(unassignedTickets)} open tickets are still waiting for your action.`, route: "AllTickets" });
  if (criticalLogs) alerts.push({ key: "logs", icon: "warning", tone: "warn", title: `${count(criticalLogs)} critical incident reports remain open`, body: "Review the help desk analytics page and close or escalate these high-risk issues.", route: "AnalyticsLogs" });
  if (pendingRag) alerts.push({ key: "rag", icon: "picture-as-pdf", tone: "warn", title: `${count(pendingRag)} documents are pending RAG indexing`, body: "Check the knowledge base and confirm the latest PDFs were processed.", route: "KnowledgeBase" });

  const insights = {
    AllTickets: { metric: `${count(openTickets)} open`, detail: `${count(urgentTickets)} urgent • ${count(unassignedTickets)} unassigned`, action: "Open queue" },
    Feedback: { metric: totalRatings ? `${averageRating.toFixed(1)}/5 average` : "No ratings yet", detail: totalRatings ? `${count(totalRatings)} student submissions` : "Student service ratings will appear here as they arrive.", action: "View feedback" },
    UserManagement: { metric: `${count(users.length)} accounts`, detail: `${count(students)} students • ${count(staff)} staff • ${count(admins)} admin account${admins === 1 ? "" : "s"}`, action: "Manage users" },
    Announcements: { metric: `${count(activeAnnouncements)} active`, detail: `${count(pinnedAnnouncements)} pinned for visibility`, action: "Publish update" },
    KnowledgeBase: { metric: `${count(faqs.length)} FAQs`, detail: `${count(documents.length)} PDFs • ${count(pendingRag)} pending RAG`, action: "Open knowledge base" },
    AnalyticsLogs: { metric: `${count(totalLogs)} reports`, detail: `${count(criticalLogs)} critical • ${count(resolvedLogs)} resolved`, action: "Open analytics" },
  };

  const activity = [
    ...tickets
      .slice()
      .sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt))
      .slice(0, 2)
      .map((item) => ({ key: `ticket-${item._id || item.id}`, icon: "confirmation-number", title: item.subject || item.ticketCode || "Ticket updated", body: `${item.ticketCode || "Ticket"} • ${item.status || "Open"} • ${item.priority || "Normal"}`, time: item.updatedAt || item.createdAt, route: "AllTickets", params: item?._id ? { ticketId: item._id } : undefined })),
    ...announcements
      .slice()
      .sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt))
      .slice(0, 2)
      .map((item) => ({ key: `notice-${item._id || item.id}`, icon: "campaign", title: item.title || "Announcement updated", body: `${item.type || "Notice"} • ${item.targetAudience || "All"} audience`, time: item.updatedAt || item.createdAt, route: "Announcements" })),
    ...(Array.isArray(dashboard.summary?.recentLogs) ? dashboard.summary.recentLogs : [])
      .slice(0, 2)
      .map((item) => ({ key: `log-${item._id || item.id || item.title}`, icon: item.severity === "Critical" ? "warning" : "fact-check", title: item.title || "Incident report updated", body: [item.category, item.status, item.severity].filter(Boolean).join(" • ") || "Internal incident activity", time: item.updatedAt || item.eventDate || item.createdAt, route: "AnalyticsLogs" })),
  ]
    .sort((a, b) => stamp(b.time) - stamp(a.time))
    .slice(0, 6);

  const initialLoading = loading && !dashboard.loadedAt;
  const groups = adminModuleGroups.filter((item) => ["support", "content", "oversight"].includes(item.key));

  return (
    <AdminShell navigation={navigation} currentRoute="AdminHome" showBack={false}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard({ pullToRefresh: true })} tintColor={colors.secondary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Live Admin Overview</Text>
          </View>
          <Text style={styles.heroTitle}>Admin Command Center</Text>
          <Text style={styles.heroBody}>
            The dashboard now follows the real admin flow: support first, content second, oversight always visible.
          </Text>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaText}>{dashboard.loadedAt ? `Updated ${formatTime(dashboard.loadedAt)}` : "Syncing data"}</Text>
            <Text style={styles.heroMetaText}>{`${count(users.length)} total accounts`}</Text>
            <Text style={styles.heroMetaText}>{`${count(activeAnnouncements)} active notices`}</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable style={styles.primaryButton} onPress={() => openAdminRoute(navigation, "AllTickets")}>
              <MaterialIcons name="confirmation-number" size={18} color="white" />
              <Text style={styles.primaryButtonText}>Open Ticket Desk</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => openAdminRoute(navigation, "Announcements")}>
              <MaterialIcons name="campaign" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Publish Notice</Text>
            </Pressable>
          </View>
        </View>

        <NoticeBanner notice={notice} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today’s Snapshot</Text>
          <Text style={styles.sectionBody}>Real counts pulled from the admin-facing modules already in the app.</Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : (
            <View style={styles.stack}>
              <StatCard icon="confirmation-number" value={count(openTickets)} label="Open Tickets" note={`${count(unassignedTickets)} waiting for assignment`} />
              <StatCard icon="priority-high" value={count(urgentTickets)} label="Urgent Tickets" note="High-priority support requests" danger={urgentTickets > 0} />
              <StatCard icon="reviews" value={totalRatings ? `${averageRating.toFixed(1)}/5` : "0.0/5"} label="Feedback Rating" note={totalRatings ? `${count(totalRatings)} student submissions` : "No ratings yet"} />
              <StatCard icon="picture-as-pdf" value={count(pendingRag)} label="Pending RAG" note={`${count(documents.length)} PDFs in the knowledge base`} />
              <StatCard icon="campaign" value={count(activeAnnouncements)} label="Active Notices" note={`${count(pinnedAnnouncements)} pinned right now`} />
              <StatCard icon="warning" value={count(criticalLogs)} label="Critical Reports" note={`${count(totalLogs)} total incident reports`} danger={criticalLogs > 0} />
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Priority Queue</Text>
          <Text style={styles.sectionBody}>Surface the work that should be handled before the rest of the day’s admin tasks.</Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : alerts.length ? (
            <View style={styles.stack}>
              {alerts.map((item) => (
                <Pressable key={item.key} style={[styles.alertCard, item.tone === "danger" && styles.alertCardDanger, item.tone === "warn" && styles.alertCardWarn]} onPress={() => openAdminRoute(navigation, item.route)}>
                  <View style={styles.alertIcon}>
                    <MaterialIcons name={item.icon} size={18} color={item.tone === "danger" ? "#b42318" : colors.primary} />
                  </View>
                  <View style={styles.alertText}>
                    <Text style={styles.alertTitle}>{item.title}</Text>
                    <Text style={styles.alertBody}>{item.body}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={colors.secondary} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No urgent blockers right now</Text>
              <Text style={styles.emptyBody}>Support, content, and oversight all look stable from the latest refresh.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Workflows</Text>
          <Text style={styles.sectionBody}>Modules are grouped by how you move through the platform as the admin.</Text>
          <View style={styles.groupStack}>
            {groups.map((group) => (
              <View key={group.key} style={styles.groupCard}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupNote}>{group.description}</Text>
                <View style={styles.stack}>
                  {getAdminModulesByGroup(group.key, { includePlanned: false }).map((item) => (
                    <ModuleCard key={item.route} item={item} insight={insights[item.route]} onPress={() => openAdminRoute(navigation, item.route)} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.sectionBody}>Latest movement across tickets, notices, and incident reports.</Text>
          {initialLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.secondary} />
            </View>
          ) : activity.length ? (
            <View style={styles.stack}>
              {activity.map((item) => (
                <ActivityRow key={item.key} item={item} onPress={() => (item.params ? navigation.navigate(item.route, item.params) : openAdminRoute(navigation, item.route))} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No recent activity to show</Text>
              <Text style={styles.emptyBody}>New ticket, notice, and incident updates will appear here as you work through the system.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 24, gap: 14 },
  hero: { borderRadius: 24, backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1, borderColor: "#e0e3e5", padding: layout.cardPadding, gap: 12 },
  heroBadge: { alignSelf: "flex-start", borderRadius: layout.pillRadius, backgroundColor: "#ece7ff", paddingHorizontal: 10, paddingVertical: 5 },
  heroBadgeText: { color: colors.secondary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  heroTitle: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  heroBody: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  heroMeta: { gap: 4 },
  heroMetaText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, borderRadius: layout.pillRadius, paddingHorizontal: 14, paddingVertical: 11 },
  primaryButtonText: { color: "white", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  secondaryButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "white", borderRadius: layout.pillRadius, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.outline },
  secondaryButtonText: { color: colors.primary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#c7d2fe", backgroundColor: "#eef2ff" },
  bannerWarn: { borderColor: "#f3d58b", backgroundColor: "#fff7d6" },
  bannerError: { borderColor: "#ffcac3", backgroundColor: "#ffebe9" },
  bannerText: { flex: 1, color: colors.primary, fontSize: 12, fontWeight: "600" },
  bannerTextWarn: { color: "#8b5e00" },
  bannerTextError: { color: "#b42318" },
  sectionCard: { borderRadius: 22, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "#e0e3e5", padding: layout.cardPadding, gap: 12 },
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
  alertCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 14 },
  alertCardDanger: { backgroundColor: "#fff4f4", borderColor: "#fecaca" },
  alertCardWarn: { backgroundColor: "#fffaf0", borderColor: "#f3d58b" },
  alertIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center" },
  alertText: { flex: 1, gap: 4 },
  alertTitle: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  alertBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  groupStack: { gap: 16 },
  groupCard: { gap: 8 },
  groupTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  groupNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  moduleCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 14, gap: 8 },
  moduleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  moduleIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#eef2ff", alignItems: "center", justifyContent: "center" },
  liveTag: { color: "#0f8a43", fontSize: 10, fontWeight: "800", textTransform: "uppercase", backgroundColor: "#eafaf0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: layout.pillRadius },
  moduleTitle: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  moduleNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  moduleMetric: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  moduleDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  moduleFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  moduleAction: { color: colors.secondary, fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 14 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#ece7ff", alignItems: "center", justifyContent: "center" },
  activityText: { flex: 1, gap: 4 },
  activityTitle: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  activityBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  activityTime: { color: "#98a2b3", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  emptyCard: { borderRadius: 18, backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", padding: 16, gap: 6 },
  emptyTitle: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
