import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../../components/AdminShell";
import { useSession } from "../../context/SessionContext";
import { fetchUsers } from "../../api/users";
import { fetchTicketById, sendTicketReply, updateSupportTicket } from "../../api/tickets";
import { colors, layout, type } from "../../theme";
import { AttachmentList, AttachmentPickerField } from "./TicketAttachmentSection";
import { pickAttachments, removePendingAttachment } from "./attachmentUtils";
import {
  emptyFeedback,
  formatDateTime,
  groupStaffByDepartment,
  normalizeString,
  replaceTicket,
  ticketId,
  useTickets,
} from "./ticketUtils";
import { getRatingLabel } from "./feedbackUtils";

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];
const STATUS_OPTIONS = ["New", "In Progress", "Escalated", "Resolved", "Closed"];
const FILTER_OPTIONS = ["All", "Unassigned", "Assigned", "Open", "Resolved"];

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

function FilterRow({ active, onChange }) {
  return (
    <View style={styles.filterRow}>
      {FILTER_OPTIONS.map((option) => (
        <Pressable
          key={option}
          style={[styles.filterChip, active === option && styles.filterChipActive]}
          onPress={() => onChange(option)}
        >
          <Text style={[styles.filterChipText, active === option && styles.filterChipTextActive]}>
            {option}
          </Text>
        </Pressable>
      ))}
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
        <TicketBadge label={ticket.requestType} />
      </View>
      <Text style={styles.ticketTitle}>{ticket.subject}</Text>
      <Text style={styles.ticketMeta}>{ticket.student?.name} | {ticket.department}</Text>
      <Text style={styles.assignmentMeta}>
        {ticket.assignedTo?.name ? `Assigned to ${ticket.assignedTo.name}` : "Awaiting assignment"}
      </Text>
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

function ReplyCard({ reply }) {
  return (
    <View style={[styles.replyCard, reply.isInternal && styles.replyCardInternal]}>
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

function DetailLine({ label, value }) {
  if (!value) return null;

  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function FeedbackRating({ rating }) {
  return (
    <View style={styles.feedbackStarsRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <MaterialIcons
          key={value}
          name={value <= Number(rating || 0) ? "star" : "star-border"}
          size={18}
          color="#f4b400"
        />
      ))}
    </View>
  );
}

export function AdminTicketAssignmentScreen({ navigation, route }) {
  const { currentUser } = useSession();
  const { tickets, setTickets, loading, feedback, setFeedback, loadTickets } = useTickets(currentUser);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [internalNote, setInternalNote] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadStaffMembers() {
        if (!currentUser || currentUser.role !== "admin") {
          setStaffMembers([]);
          setStaffLoading(false);
          return;
        }

        try {
          setStaffLoading(true);
          const data = await fetchUsers({ role: "staff" });
          setStaffMembers(Array.isArray(data.users) ? data.users : []);
        } catch (error) {
          setFeedback({ type: "error", message: error.message || "Unable to load staff accounts." });
        } finally {
          setStaffLoading(false);
        }
      }

      void loadStaffMembers();
    }, [currentUser, setFeedback])
  );

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <AdminShell navigation={navigation} currentRoute="AllTickets">
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <EmptyState
            title="Sign in as an admin"
            body="Admin ticket assignment is only available to admin accounts."
          />
        </ScrollView>
      </AdminShell>
    );
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (filter === "Unassigned") return !ticket.assignedTo?._id;
    if (filter === "Assigned") return Boolean(ticket.assignedTo?._id);
    if (filter === "Open") return !["Resolved", "Closed"].includes(ticket.status);
    if (filter === "Resolved") return ["Resolved", "Closed"].includes(ticket.status);
    return true;
  });

  const selectedTicket = tickets.find((ticket) => ticketId(ticket) === selectedTicketId) || null;
  const groupedStaff = groupStaffByDepartment(staffMembers, selectedTicket?.department);

  async function openTicket(ticketKey, { clearRouteParam = false } = {}) {
    try {
      setBusy(true);
      const data = await fetchTicketById(ticketKey, {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setReplyAttachments([]);
      setAssignOpen(false);
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

  useEffect(() => {
    const routeTicketId = route?.params?.ticketId;

    if (!routeTicketId || !currentUser?._id || currentUser.role !== "admin") {
      return;
    }

    void openTicket(routeTicketId, { clearRouteParam: true });
  }, [route?.params?.ticketId, currentUser?._id]);

  async function updateTicket(patch, successMessage) {
    if (!selectedTicket) return;

    try {
      setBusy(true);
      const data = await updateSupportTicket(ticketId(selectedTicket), {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
        ...patch,
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setFeedback({ type: "success", message: successMessage });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to update the ticket right now." });
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(message, isInternal) {
    if (!selectedTicket || !normalizeString(message)) {
      setFeedback({
        type: "error",
        message: isInternal ? "Type the internal note before saving." : "Type your reply before sending.",
      });
      return;
    }

    try {
      setBusy(true);
      const data = await sendTicketReply(
        ticketId(selectedTicket),
        {
          viewerId: currentUser._id,
          viewerRole: currentUser.role,
          message: normalizeString(message),
          isInternal,
        },
        isInternal ? [] : replyAttachments
      );
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      if (isInternal) {
        setInternalNote("");
      } else {
        setReplyText("");
        setReplyAttachments([]);
      }
      setFeedback({ type: "success", message: isInternal ? "Internal note added." : "Reply sent successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to send the message right now." });
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

  return (
    <AdminShell navigation={navigation} currentRoute="AllTickets">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ticket Assignment</Text>
        <Text style={styles.subtitle}>View, assign, escalate, prioritize, and manage support tickets.</Text>
        <FeedbackBanner feedback={feedback} />
        <View style={styles.summaryRow}>
          <SummaryCard label="All" value={tickets.length} />
          <SummaryCard label="Unassigned" value={tickets.filter((ticket) => !ticket.assignedTo?._id).length} />
          <SummaryCard label="Open" value={tickets.filter((ticket) => !["Resolved", "Closed"].includes(ticket.status)).length} />
        </View>
        <FilterRow active={filter} onChange={setFilter} />
        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={() => void loadTickets({ keepFeedback: true })}>
            <Text style={styles.secondaryButtonText}>Refresh Tickets</Text>
          </Pressable>
        </View>

        {loading ? (
          <EmptyState title="Loading tickets..." body="Fetching the latest student support queue." />
        ) : filteredTickets.length ? (
          <View style={styles.list}>
            {filteredTickets.map((ticket) => (
              <TicketCard key={ticketId(ticket)} ticket={ticket} onPress={() => void openTicket(ticketId(ticket))} />
            ))}
          </View>
        ) : (
          <EmptyState title="No tickets in this filter" body="Try another filter or refresh the queue." />
        )}

        {selectedTicket ? (
          <>
            <View style={styles.rowBetween}>
              <Pressable style={styles.backButton} onPress={() => setSelectedTicketId("")}>
                <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.backButtonText}>Back to Queue</Text>
              </Pressable>
            </View>
            <Text style={styles.detailHeading}>{selectedTicket.ticketCode}</Text>
            <View style={styles.badgeRow}>
              <TicketBadge label={selectedTicket.priority} tone={`priority-${selectedTicket.priority.toLowerCase()}`} />
              <TicketBadge
                label={selectedTicket.status}
                tone={`status-${selectedTicket.status.toLowerCase().replace(/\s+/g, "-")}`}
              />
              <TicketBadge label={selectedTicket.requestType} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Original Request</Text>
              <DetailLine
                label="Student"
                value={`${selectedTicket.student?.name || ""} (${selectedTicket.student?.registrationNumber || ""})`}
              />
              <DetailLine label="Faculty / School" value={selectedTicket.student?.faculty} />
              <DetailLine label="Campus / Center" value={selectedTicket.student?.campus} />
              <DetailLine label="Contact" value={selectedTicket.student?.contactNumber} />
              <DetailLine label="Department" value={selectedTicket.department} />
              <DetailLine label="Sub-category" value={selectedTicket.requestSubType} />
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
                <View style={styles.rowBetween}>
                  <FeedbackRating rating={selectedTicket.feedback.rating} />
                  <Text style={styles.ticketMeta}>{formatDateTime(selectedTicket.feedback.updatedAt)}</Text>
                </View>
                <Text style={styles.feedbackTitle}>{getRatingLabel(selectedTicket.feedback.rating)}</Text>
                <Text style={styles.feedbackComment}>
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
                placeholder="Provide an update or ask a question to the student..."
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
                <Pressable style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void sendReply(replyText, false)} disabled={busy}>
                  <Text style={styles.primaryButtonText}>{busy ? "Sending..." : "Send Reply"}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Internal Admin Note</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={internalNote}
                onChangeText={setInternalNote}
                placeholder="Add a private note for staff (not visible to the student)..."
                placeholderTextColor="#777683"
                multiline
                textAlignVertical="top"
              />
              <View style={styles.actionsRow}>
                <Pressable style={[styles.secondaryButton, busy && styles.disabled]} onPress={() => void sendReply(internalNote, true)} disabled={busy}>
                  <Text style={styles.secondaryButtonText}>Save Note</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Update Status</Text>
              <View style={styles.choiceGrid}>
                {STATUS_OPTIONS.map((status) => (
                  <ChoiceButton
                    key={status}
                    label={status}
                    active={selectedTicket.status === status}
                    onPress={() => void updateTicket({ status }, `Ticket status updated to ${status}.`)}
                    disabled={busy}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>Update Priority</Text>
              <View style={styles.choiceGrid}>
                {PRIORITY_OPTIONS.map((priority) => (
                  <ChoiceButton
                    key={priority}
                    label={priority}
                    active={selectedTicket.priority === priority}
                    onPress={() => void updateTicket({ priority }, `Ticket priority updated to ${priority}.`)}
                    disabled={busy}
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>Assign to Staff Member</Text>
              <Pressable style={styles.selectTrigger} onPress={() => setAssignOpen((current) => !current)}>
                <Text style={styles.selectValue}>
                  {selectedTicket.assignedTo?.name
                    ? `${selectedTicket.assignedTo.name} (${selectedTicket.assignedTo.department || "STAFF"})`
                    : "-- Unassigned --"}
                </Text>
                <MaterialIcons
                  name={assignOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
              {assignOpen ? (
                <View style={styles.selectMenu}>
                  <Pressable
                    style={styles.selectOption}
                    onPress={() => {
                      setAssignOpen(false);
                      void updateTicket({ assignedToId: "" }, "Ticket unassigned successfully.");
                    }}
                  >
                    <Text style={styles.selectOptionText}>-- Unassigned --</Text>
                  </Pressable>
                  {groupedStaff.map((group) => (
                    <View key={group.department}>
                      <Text style={styles.groupHeading}>{group.department}</Text>
                      {group.staff.map((staff) => (
                        <Pressable
                          key={staff._id}
                          style={styles.selectOption}
                          onPress={() => {
                            setAssignOpen(false);
                            void updateTicket(
                              { assignedToId: staff._id, status: "In Progress" },
                              "Ticket assigned successfully."
                            );
                          }}
                        >
                          <Text style={styles.selectOptionText}>{staff.name}</Text>
                          <Text style={styles.selectOptionNote}>{staff.department}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </AdminShell>
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
  "status-closed": { backgroundColor: "#f2f4f7" },
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
  "status-closed": { color: "#667085" },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 28, gap: 12 },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 12 },
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
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 8 },
  filterChipActive: { backgroundColor: "#e9ddff", borderColor: colors.secondary },
  filterChipText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: colors.primary },
  list: { gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  ticketCode: { color: colors.secondary, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  ticketTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  ticketMeta: { color: colors.textMuted, fontSize: 12 },
  assignmentMeta: { color: colors.secondary, fontSize: 12, fontWeight: "700" },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, lineHeight: 20 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  primaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "white" },
  secondaryButtonText: { color: colors.primary, fontWeight: "800" },
  detailHeading: { color: colors.primary, fontSize: type.h2, fontWeight: "800" },
  sectionLabel: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  detailLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", flex: 1 },
  detailValue: { color: colors.text, fontSize: 12, fontWeight: "700", flex: 1, textAlign: "right" },
  originalMessage: { borderRadius: 12, backgroundColor: "#f8fafc", padding: 12, color: colors.text, lineHeight: 20 },
  replyCard: { borderRadius: 14, padding: 12, gap: 8, backgroundColor: "#f8fafc" },
  replyCardInternal: { backgroundColor: "#fff7d6" },
  replyAuthor: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  replyTime: { color: "#98a2b3", fontSize: 11 },
  replyRole: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  replyMessage: { color: colors.text, lineHeight: 19 },
  feedbackStarsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  feedbackTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  feedbackComment: { borderRadius: 12, backgroundColor: "#f8fafc", padding: 12, color: colors.text, lineHeight: 20 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", color: colors.text, paddingHorizontal: 12, paddingVertical: 12 },
  multilineInput: { minHeight: 110 },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceButton: { borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 9 },
  choiceButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceButtonText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
  choiceButtonTextActive: { color: "white" },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backButtonText: { color: colors.primary, fontWeight: "800" },
  selectTrigger: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectValue: { color: colors.text, flex: 1 },
  selectMenu: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "white", overflow: "hidden" },
  selectOption: { paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#eef2f7" },
  selectOptionText: { color: colors.text, fontWeight: "700" },
  selectOptionNote: { color: colors.textMuted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  groupHeading: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, color: colors.secondary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  disabled: { opacity: 0.6 },
});
