import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../../components/AdminShell";
import { useSession } from "../../context/SessionContext";
import { fetchTicketFeedbackDashboard } from "../../api/tickets";
import { subscribeRealtimeEvent } from "../../realtime/socket";
import { colors, layout, type } from "../../theme";
import { AttachmentList } from "./TicketAttachmentSection";
import { formatDateTime } from "./ticketUtils";
import { getRatingLabel } from "./feedbackUtils";

function FeedbackBanner({ feedback }) {
  if (!feedback?.message) return null;

  const error = feedback.type === "error";

  return (
    <View style={[styles.banner, error ? styles.bannerError : styles.bannerSuccess]}>
      <MaterialIcons
        name={error ? "error-outline" : "check-circle-outline"}
        size={16}
        color={error ? "#b42318" : "#166534"}
      />
      <Text style={[styles.bannerText, error ? styles.bannerErrorText : styles.bannerSuccessText]}>
        {feedback.message}
      </Text>
    </View>
  );
}

function EmptyState({ title, body }) {
  return (
    <View style={styles.card}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function SummaryCard({ label, value, helper }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      {helper ? <Text style={styles.summaryHelper}>{helper}</Text> : null}
    </View>
  );
}

function RatingStars({ rating, size = 16 }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <MaterialIcons
          key={value}
          name={value <= Number(rating || 0) ? "star" : "star-border"}
          size={size}
          color="#f4b400"
        />
      ))}
    </View>
  );
}

function RatingBreakdown({ breakdown }) {
  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.breakdownTitle}>Rating Breakdown</Text>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = Number(breakdown?.[rating] || 0);
        const max = Math.max(...[1, 2, 3, 4, 5].map((value) => Number(breakdown?.[value] || 0)), 1);
        const width = `${Math.max((count / max) * 100, count ? 8 : 0)}%`;

        return (
          <View key={rating} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{`${rating} star`}</Text>
            <View style={styles.breakdownTrack}>
              <View style={[styles.breakdownFill, { width }]} />
            </View>
            <Text style={styles.breakdownCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

function FeedbackCard({ item, onOpenTicket }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.studentWrap}>
          <Text style={styles.studentName}>{item.student?.name || "Student"}</Text>
          <Text style={styles.studentMeta}>{item.student?.email || "No email available"}</Text>
          {item.student?.registrationNumber ? (
            <Text style={styles.studentMeta}>{item.student.registrationNumber}</Text>
          ) : null}
        </View>
        <View style={styles.ratingBadge}>
          <MaterialIcons name="star" size={18} color="#f4b400" />
          <Text style={styles.ratingBadgeText}>{`${item.feedback?.rating || 0}/5`}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{item.status}</Text>
        </View>
        <Pressable style={styles.ticketChip} onPress={onOpenTicket}>
          <MaterialIcons name="open-in-new" size={14} color={colors.secondary} />
          <Text style={styles.ticketChipText}>{item.ticketCode}</Text>
        </Pressable>
      </View>

      <RatingStars rating={item.feedback?.rating} size={18} />
      <Text style={styles.ratingLabel}>{getRatingLabel(item.feedback?.rating)}</Text>
      <Text style={styles.ticketSubject}>{item.subject}</Text>
      <Text style={styles.ticketNote}>
        {item.requestSubType ? `${item.requestType} | ${item.requestSubType}` : item.requestType}
      </Text>
      <Text style={styles.ticketNote}>{`Updated ${formatDateTime(item.feedback?.updatedAt)}`}</Text>
      {item.assignedTo?.name ? (
        <Text style={styles.ticketNote}>{`Handled by ${item.assignedTo.name}`}</Text>
      ) : null}
      <Text style={styles.commentBox}>
        {item.feedback?.comment || "The student submitted a star rating without a written comment."}
      </Text>
      <AttachmentList
        title="Feedback Attachments"
        attachments={item.feedback?.attachments || []}
        hideWhenEmpty
      />
    </View>
  );
}

export function AdminFeedbackScreen({ navigation }) {
  const { currentUser } = useSession();
  const currentUserId = currentUser?._id || "";
  const currentUserRole = currentUser?.role || "";
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    averageRating: 0,
    totalSubmissions: 0,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [items, setItems] = useState([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    hasLoadedRef.current = false;
  }, [currentUserId, currentUserRole]);

  const loadFeedback = useCallback(async () => {
    if (!currentUserId || currentUserRole !== "admin") {
      setItems([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      const data = await fetchTicketFeedbackDashboard({
        viewerId: currentUserId,
        viewerRole: currentUserRole,
      });
      setSummary({
        averageRating: Number(data.summary?.averageRating || 0),
        totalSubmissions: Number(data.summary?.totalSubmissions || 0),
        breakdown: data.summary?.breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
      setItems(Array.isArray(data.feedbacks) ? data.feedbacks : []);
      setFeedback({ type: "", message: "" });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to load ticket feedback right now." });
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [currentUserId, currentUserRole]);

  useFocusEffect(
    useCallback(() => {
      void loadFeedback();
    }, [loadFeedback])
  );

  useEffect(() => {
    if (!currentUserId || currentUserRole !== "admin") {
      return undefined;
    }

    return subscribeRealtimeEvent("ticket:feedbackChanged", () => {
      void loadFeedback();
    });
  }, [currentUserId, currentUserRole, loadFeedback]);

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <AdminShell navigation={navigation} currentRoute="Feedback">
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <EmptyState
            title="Sign in as an admin"
            body="Ticket feedback analytics are only available to admin accounts."
          />
        </ScrollView>
      </AdminShell>
    );
  }

  return (
    <AdminShell navigation={navigation} currentRoute="Feedback">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Student Feedback</Text>
        <Text style={styles.subtitle}>
          Ratings and comments submitted by students on resolved support tickets.
        </Text>
        <FeedbackBanner feedback={feedback} />

        <View style={styles.summaryRow}>
          <SummaryCard
            label="Average Rating"
            value={summary.totalSubmissions ? summary.averageRating.toFixed(1) : "0.0"}
            helper={summary.totalSubmissions ? getRatingLabel(Math.round(summary.averageRating)) : "No ratings yet"}
          />
          <SummaryCard label="Total Submissions" value={summary.totalSubmissions} />
        </View>

        <RatingBreakdown breakdown={summary.breakdown} />

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={() => void loadFeedback()}>
            <Text style={styles.secondaryButtonText}>Refresh Feedback</Text>
          </Pressable>
        </View>

        {loading ? (
          <EmptyState title="Loading feedback..." body="Fetching resolved-ticket ratings and comments." />
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((item) => (
              <FeedbackCard
                key={`${item.ticketId}-${item.feedback?._id || "feedback"}`}
                item={item}
                onOpenTicket={() => navigation.navigate("AllTickets", { ticketId: item.ticketId })}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No feedback yet"
            body="Once students rate a resolved ticket, their feedback will appear here with a direct ticket link."
          />
        )}
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 28, gap: 12 },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, lineHeight: 20 },
  banner: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerSuccess: { backgroundColor: "#ecfdf3", borderColor: "#b7ebc6" },
  bannerError: { backgroundColor: "#fff1f3", borderColor: "#fecdd3" },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700" },
  bannerSuccessText: { color: "#166534" },
  bannerErrorText: { color: "#b42318" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryCard: { minWidth: 120, flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 4 },
  summaryValue: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  summaryHelper: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
  breakdownCard: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 10 },
  breakdownTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownLabel: { width: 54, color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  breakdownTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "#edf2f7", overflow: "hidden" },
  breakdownFill: { height: "100%", borderRadius: 999, backgroundColor: "#f4b400" },
  breakdownCount: { width: 24, color: colors.textMuted, fontWeight: "700", textAlign: "right" },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  secondaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "white" },
  secondaryButtonText: { color: colors.primary, fontWeight: "800" },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  studentWrap: { flex: 1, gap: 2 },
  studentName: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  studentMeta: { color: colors.textMuted, fontSize: 12 },
  ratingBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff7d6" },
  ratingBadgeText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  statusPill: { borderRadius: 999, backgroundColor: "#ecfdf3", paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { color: "#166534", fontSize: 11, fontWeight: "800" },
  ticketChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 5 },
  ticketChipText: { color: colors.secondary, fontSize: 12, fontWeight: "800" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingLabel: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  ticketSubject: { color: colors.text, fontSize: 15, fontWeight: "800" },
  ticketNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  commentBox: { borderRadius: 12, backgroundColor: "#f8fafc", padding: 14, color: colors.text, lineHeight: 22 },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, lineHeight: 20 },
});
