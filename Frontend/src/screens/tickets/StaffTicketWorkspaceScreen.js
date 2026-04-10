import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { useSession } from "../../context/SessionContext";
import { fetchTicketById, sendTicketReply, updateSupportTicket } from "../../api/tickets";
import { colors, layout, type } from "../../theme";
import { AttachmentList, AttachmentPickerField } from "./TicketAttachmentSection";
import { pickAttachments, removePendingAttachment } from "./attachmentUtils";
import {
  emptyFeedback,
  formatDateTime,
  normalizeString,
  replaceTicket,
  ticketId,
  useTickets,
} from "./ticketUtils";
import { getRatingLabel } from "./feedbackUtils";

const STATUS_OPTIONS = ["New", "In Progress", "Escalated", "Resolved"];

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

function SummaryCard({ label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TicketBadge({ label, tone = "neutral" }) {
  return (
    <View style={[styles.badge, badgeBackgrounds[tone] || badgeBackgrounds.neutral]}>
      <Text style={[styles.badgeText, badgeColors[tone] || badgeColors.neutral]}>{label}</Text>
    </View>
  );
}

function TicketCard({ ticket, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.ticketCode}>{ticket.ticketCode}</Text>
        <Text style={styles.ticketMeta}>{formatDateTime(ticket.updatedAt)}</Text>
      </View>
      <View style={styles.badgeRow}>
        <TicketBadge label={ticket.priority} tone={`priority-${ticket.priority.toLowerCase()}`} />
        <TicketBadge
          label={ticket.status}
          tone={`status-${ticket.status.toLowerCase().replace(/\s+/g, "-")}`}
        />
      </View>
      <Text style={styles.ticketTitle}>{ticket.subject}</Text>
      <Text style={styles.ticketMeta}>{ticket.student?.name} | {ticket.department}</Text>
    </Pressable>
  );
}

function ReplyCard({ reply }) {
  return (
    <View style={styles.replyCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.replyAuthor}>{reply.authorName}</Text>
        <Text style={styles.replyTime}>{formatDateTime(reply.createdAt)}</Text>
      </View>
      <Text style={styles.replyRole}>
        {reply.authorRole === "student" ? "Student" : reply.authorRole === "staff" ? "Staff" : "Admin"}
        {reply.isInternal ? " | Internal note" : ""}
      </Text>
      <Text style={styles.replyMessage}>{reply.message}</Text>
      <AttachmentList title="Attachments" attachments={reply.attachments} hideWhenEmpty />
    </View>
  );
}

function ChoiceButton({ label, active, onPress, disabled = false }) {
  return (
    <Pressable
      style={[styles.choiceButton, active && styles.choiceButtonActive, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.choiceButtonText, active && styles.choiceButtonTextActive]}>{label}</Text>
    </Pressable>
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

export function StaffTicketWorkspaceScreen({ navigation, route }) {
  const { currentUser } = useSession();
  const { tickets, setTickets, loading, feedback, setFeedback } = useTickets(currentUser);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [busy, setBusy] = useState(false);

  if (!currentUser || currentUser.role !== "staff") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <AppBrandHeader style={styles.brandHeader} />
          <EmptyState
            title="Sign in as staff"
            body="The staff ticket workspace becomes available after logging in with a staff account."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const selectedTicket = tickets.find((ticket) => ticketId(ticket) === selectedTicketId) || null;

  async function openTicketById(selectedId, { clearRouteParam = false } = {}) {
    try {
      setBusy(true);
      const data = await fetchTicketById(selectedId, {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setReplyAttachments([]);
      setFeedback(emptyFeedback());
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to open the ticket right now." });
    } finally {
      if (clearRouteParam && navigation?.setParams) {
        navigation.setParams({ ticketId: undefined });
      }
      setBusy(false);
    }
  }

  async function openTicket(ticket) {
    await openTicketById(ticketId(ticket));
  }

  async function updateTicket(status) {
    if (!selectedTicket) return;

    try {
      setBusy(true);
      const data = await updateSupportTicket(ticketId(selectedTicket), {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
        status,
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setFeedback({ type: "success", message: `Ticket status updated to ${status}.` });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to update the ticket right now." });
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !normalizeString(replyText)) {
      setFeedback({ type: "error", message: "Type your reply before sending." });
      return;
    }

    try {
      setBusy(true);
      const data = await sendTicketReply(
        ticketId(selectedTicket),
        {
          viewerId: currentUser._id,
          viewerRole: currentUser.role,
          message: normalizeString(replyText),
        },
        replyAttachments
      );
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setReplyText("");
      setReplyAttachments([]);
      setFeedback({ type: "success", message: "Reply sent successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to send the reply right now." });
    } finally {
      setBusy(false);
    }
  }

  async function handlePickReplyAttachments() {
    const result = await pickAttachments(replyAttachments);
    setReplyAttachments(result.attachments);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    }
  }

  useEffect(() => {
    const routeTicketId = route?.params?.ticketId;

    if (!routeTicketId || !currentUser?._id || currentUser.role !== "staff") {
      return;
    }

    void openTicketById(routeTicketId, { clearRouteParam: true });
  }, [route?.params?.ticketId, currentUser?._id, currentUser?.role]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppBrandHeader style={styles.brandHeader} />
        <Text style={styles.title}>Ticket Workspace</Text>
        <Text style={styles.subtitle}>Review your assigned support requests and reply to students.</Text>
        <FeedbackBanner feedback={feedback} />
        <View style={styles.summaryRow}>
          <SummaryCard label="Assigned" value={tickets.length} />
          <SummaryCard label="In Progress" value={tickets.filter((ticket) => ticket.status === "In Progress").length} />
          <SummaryCard label="Resolved" value={tickets.filter((ticket) => ticket.status === "Resolved").length} />
        </View>

        {loading ? (
          <EmptyState title="Loading assigned tickets..." body="Fetching your staff queue." />
        ) : tickets.length ? (
          <View style={styles.list}>
            {tickets.map((ticket) => (
              <TicketCard key={ticketId(ticket)} ticket={ticket} onPress={() => void openTicket(ticket)} />
            ))}
          </View>
        ) : (
          <EmptyState title="No assigned tickets" body="When an admin assigns a ticket to you, it will appear here." />
        )}

        {selectedTicket ? (
          <>
            <Pressable style={styles.backButton} onPress={() => setSelectedTicketId("")}>
              <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.backButtonText}>Back to Queue</Text>
            </Pressable>
            <Text style={styles.detailHeading}>{selectedTicket.ticketCode}</Text>
            <View style={styles.badgeRow}>
              <TicketBadge label={selectedTicket.priority} tone={`priority-${selectedTicket.priority.toLowerCase()}`} />
              <TicketBadge
                label={selectedTicket.status}
                tone={`status-${selectedTicket.status.toLowerCase().replace(/\s+/g, "-")}`}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Original Request</Text>
              <Text style={styles.ticketTitle}>{selectedTicket.subject}</Text>
              <Text style={styles.ticketMeta}>
                Student: {selectedTicket.student?.name} ({selectedTicket.student?.registrationNumber})
              </Text>
              <Text style={styles.ticketMeta}>Department: {selectedTicket.department}</Text>
              {selectedTicket.requestSubType ? (
                <Text style={styles.ticketMeta}>Sub-category: {selectedTicket.requestSubType}</Text>
              ) : null}
              <Text style={styles.originalMessage}>{selectedTicket.message}</Text>
              <AttachmentList
                title="Attachments"
                attachments={selectedTicket.attachments}
                emptyText="No files were attached to this request."
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Communication Thread</Text>
              {selectedTicket.replies?.length ? (
                <View style={styles.list}>
                  {selectedTicket.replies.map((reply) => (
                    <ReplyCard key={reply._id} reply={reply} />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyBody}>No replies have been made on this ticket yet.</Text>
              )}
            </View>

            {selectedTicket.feedback ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Student Feedback</Text>
                <Text style={styles.ticketMeta}>{formatDateTime(selectedTicket.feedback.updatedAt)}</Text>
                <Text style={styles.ticketTitle}>{getRatingLabel(selectedTicket.feedback.rating)}</Text>
                <Text style={styles.originalMessage}>
                  {selectedTicket.feedback.comment || "The student submitted a star rating without a comment."}
                </Text>
                <AttachmentList
                  title="Feedback Attachments"
                  attachments={selectedTicket.feedback.attachments || []}
                  hideWhenEmpty
                />
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Write a Reply</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Provide an update to the student..."
                placeholderTextColor="#777683"
                multiline
                textAlignVertical="top"
              />
              <AttachmentPickerField
                title="Attach Files"
                attachments={replyAttachments}
                onPick={() => void handlePickReplyAttachments()}
                onRemove={(key) => setReplyAttachments((current) => removePendingAttachment(current, key))}
              />
              <View style={styles.actionsRow}>
                <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void sendReply()} disabled={busy}>
                  <Text style={styles.primaryButtonText}>{busy ? "Sending..." : "Send Reply"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Update Status</Text>
              <View style={styles.choiceGrid}>
                {STATUS_OPTIONS.map((status) => (
                  <ChoiceButton key={status} label={status} active={selectedTicket.status === status} onPress={() => void updateTicket(status)} disabled={busy} />
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const badgeBackgrounds = {
  neutral: { backgroundColor: "#f8fafc" },
  "priority-low": { backgroundColor: "#ecfdf3" },
  "priority-medium": { backgroundColor: "#fff7d6" },
  "priority-high": { backgroundColor: "#fff1f2" },
  "priority-urgent": { backgroundColor: "#fee2e2" },
  "status-new": { backgroundColor: "#eef2ff" },
  "status-in-progress": { backgroundColor: "#ede9fe" },
  "status-escalated": { backgroundColor: "#fff7d6" },
  "status-resolved": { backgroundColor: "#ecfdf3" },
};

const badgeColors = {
  neutral: { color: colors.textMuted },
  "priority-low": { color: "#166534" },
  "priority-medium": { color: "#a16207" },
  "priority-high": { color: "#be123c" },
  "priority-urgent": { color: "#b91c1c" },
  "status-new": { color: colors.primary },
  "status-in-progress": { color: colors.secondary },
  "status-escalated": { color: "#a16207" },
  "status-resolved": { color: "#166534" },
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  brandHeader: { marginBottom: 4 },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: layout.notchClearance, paddingBottom: 24, gap: 12 },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, lineHeight: 20 },
  banner: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerSuccess: { backgroundColor: "#ecfdf3", borderColor: "#b7ebc6" },
  bannerError: { backgroundColor: "#fff1f3", borderColor: "#fecdd3" },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700" },
  bannerSuccessText: { color: "#166534" },
  bannerErrorText: { color: "#b42318" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryCard: { minWidth: 100, flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: "#e0e3e5", padding: 12 },
  summaryValue: { color: colors.primary, fontSize: 24, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  ticketCode: { color: colors.secondary, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  ticketTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  ticketMeta: { color: colors.textMuted, fontSize: 12 },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, lineHeight: 20 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backButtonText: { color: colors.primary, fontWeight: "800" },
  detailHeading: { color: colors.primary, fontSize: type.h2, fontWeight: "800" },
  sectionLabel: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  originalMessage: { borderRadius: 12, backgroundColor: "#f8fafc", padding: 12, color: colors.text, lineHeight: 20 },
  replyCard: { borderRadius: 14, padding: 12, gap: 8, backgroundColor: "#f8fafc" },
  replyAuthor: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  replyTime: { color: "#98a2b3", fontSize: 11 },
  replyRole: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  replyMessage: { color: colors.text, lineHeight: 19 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", color: colors.text, paddingHorizontal: 12, paddingVertical: 12 },
  multilineInput: { minHeight: 110 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  primaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "white", fontWeight: "800" },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceButton: { borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 9 },
  choiceButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceButtonText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
  choiceButtonTextActive: { color: "white" },
  disabled: { opacity: 0.6 },
});
