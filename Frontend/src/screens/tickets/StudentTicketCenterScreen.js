import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { useSession } from "../../context/SessionContext";
import {
  createSupportTicket,
  deleteTicketFeedback,
  fetchTicketById,
  saveTicketFeedback,
  sendTicketReply,
  updateSupportTicket,
} from "../../api/tickets";
import { colors, layout, type } from "../../theme";
import {
  CAMPUS_OPTIONS,
  DEPARTMENT_OPTIONS,
  FACULTY_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  findRequestTypeOption,
} from "../../tickets/config";
import { AttachmentList, AttachmentPickerField } from "./TicketAttachmentSection";
import { attachmentKey, pickAttachments, removePendingAttachment } from "./attachmentUtils";
import {
  createStudentTicketForm,
  emptyFeedback,
  formatDateTime,
  normalizeString,
  replaceTicket,
  ticketId,
  useTickets,
  validateStudentTicketForm,
} from "./ticketUtils";
import {
  createFeedbackForm,
  FEEDBACK_MAX_COMMENT_LENGTH,
  getRatingLabel,
  isFeedbackEligibleStatus,
  validateFeedbackForm,
} from "./feedbackUtils";

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

function EmptyState({ title, body }) {
  return (
    <View style={styles.card}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
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
        <TicketBadge label={ticket.status} tone={`status-${ticket.status.toLowerCase().replace(/\s+/g, "-")}`} />
      </View>
      <Text style={styles.ticketTitle}>{ticket.subject}</Text>
      <Text style={styles.ticketMeta}>{ticket.requestType}</Text>
    </Pressable>
  );
}

function SectionHeading({ title, body }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{body}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", autoCapitalize = "words", multiline = false, helperText = "" }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#777683"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

function SelectField({ label, value, placeholder, open, onToggle, onSelect, options, helperText = "" }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.selectTrigger} onPress={onToggle}>
        <Text style={value ? styles.selectValue : styles.selectPlaceholder}>{value || placeholder}</Text>
        <MaterialIcons name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.selectMenu}>
          {options.map((option) => {
            const optionValue = typeof option === "string" ? option : option.value;
            const optionLabel = typeof option === "string" ? option : option.label;
            const optionDescription = typeof option === "string" ? "" : option.description;
            const active = optionValue === value;

            return (
              <Pressable
                key={optionValue}
                style={[styles.selectOption, active && styles.selectOptionActive]}
                onPress={() => onSelect(optionValue)}
              >
                <Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]}>
                  {optionLabel}
                </Text>
                {optionDescription ? <Text style={styles.selectOptionNote}>{optionDescription}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
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

function ReplyCard({ reply }) {
  return (
    <View
      style={[
        styles.replyCard,
        reply.authorRole === "student" ? styles.replyCardStudent : styles.replyCardStaff,
      ]}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.replyAuthor}>{reply.authorName}</Text>
        <Text style={styles.replyTime}>{formatDateTime(reply.createdAt)}</Text>
      </View>
      <Text style={styles.replyRole}>{reply.authorRole === "student" ? "Student" : "Staff / Admin"}</Text>
      <Text style={styles.replyMessage}>{reply.message}</Text>
      <AttachmentList title="Attachments" attachments={reply.attachments} hideWhenEmpty />
    </View>
  );
}

function FeedbackRatingInput({ rating, onChange, disabled = false }) {
  return (
    <View style={styles.feedbackStarsRow}>
      {[1, 2, 3, 4, 5].map((value) => {
        const active = value <= Number(rating || 0);

        return (
          <Pressable key={value} onPress={() => onChange(value)} disabled={disabled}>
            <MaterialIcons
              name={active ? "star" : "star-border"}
              size={34}
              color={active ? "#f4b400" : "#cbd5e1"}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function StudentTicketCenterScreen({ navigation, route }) {
  const { currentUser } = useSession();
  const { tickets, setTickets, loading, feedback, setFeedback } = useTickets(currentUser);
  const [mode, setMode] = useState("list");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [openSelect, setOpenSelect] = useState("");
  const [form, setForm] = useState(createStudentTicketForm(currentUser));
  const [saving, setSaving] = useState(false);
  const [createAttachments, setCreateAttachments] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [replyBusy, setReplyBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState(createFeedbackForm());
  const [feedbackExistingAttachments, setFeedbackExistingAttachments] = useState([]);
  const [feedbackPendingAttachments, setFeedbackPendingAttachments] = useState([]);
  const [removedFeedbackAttachmentIds, setRemovedFeedbackAttachmentIds] = useState([]);
  const [feedbackEditing, setFeedbackEditing] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  useEffect(() => {
    setForm(createStudentTicketForm(currentUser));
  }, [currentUser]);

  const selectedTicket = tickets.find((ticket) => ticketId(ticket) === selectedTicketId) || null;

  useEffect(() => {
    if (!selectedTicket) {
      setFeedbackForm(createFeedbackForm());
      setFeedbackExistingAttachments([]);
      setFeedbackPendingAttachments([]);
      setRemovedFeedbackAttachmentIds([]);
      setFeedbackEditing(false);
      return;
    }

    setFeedbackForm(createFeedbackForm(selectedTicket.feedback));
    setFeedbackExistingAttachments(selectedTicket.feedback?.attachments || []);
    setFeedbackPendingAttachments([]);
    setRemovedFeedbackAttachmentIds([]);
    setFeedbackEditing(!selectedTicket.feedback && isFeedbackEligibleStatus(selectedTicket.status));
  }, [selectedTicketId]);

  useEffect(() => {
    if (!selectedTicket?.feedback) {
      return;
    }

    setFeedbackForm(createFeedbackForm(selectedTicket.feedback));
    setFeedbackExistingAttachments(selectedTicket.feedback.attachments || []);
    setFeedbackPendingAttachments([]);
    setRemovedFeedbackAttachmentIds([]);
    setFeedbackEditing(false);
  }, [
    selectedTicket?.feedback?._id,
    selectedTicket?.feedback?.rating,
    selectedTicket?.feedback?.comment,
    selectedTicket?.feedback?.updatedAt,
  ]);

  useEffect(() => {
    const routeTicketId = route?.params?.ticketId;
    const routeMode = route?.params?.mode;

    if (!currentUser?._id || currentUser.role !== "student") {
      return;
    }

    if (routeTicketId) {
      void openTicketById(routeTicketId, { clearRouteParam: true });
      return;
    }

    if (routeMode === "create") {
      openCreateTicket({ clearRouteParam: true });
    }
  }, [route?.params?.ticketId, route?.params?.mode, currentUser?._id, currentUser?.role]);

  if (!currentUser || currentUser.role !== "student") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <AppBrandHeader style={styles.brandHeader} />
          <EmptyState title="Sign in as a student" body="Student ticketing becomes available after logging in with a student account." />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const requestTypeConfig = findRequestTypeOption(form.requestType);
  const activeCount = tickets.filter((ticket) => !["Resolved", "Closed"].includes(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status)).length;
  const showFeedbackSection =
    feedbackEditing ||
    Boolean(selectedTicket?.feedback) ||
    isFeedbackEligibleStatus(selectedTicket?.status);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectRequestType(value) {
    const option = findRequestTypeOption(value);

    setForm((current) => ({
      ...current,
      requestType: value,
      requestSubType: "",
      department: option?.department || current.department,
    }));
    setOpenSelect("");
  }

  function clearRouteParams() {
    if (navigation?.setParams) {
      navigation.setParams({ ticketId: undefined, mode: undefined });
    }
  }

  function openCreateTicket({ clearRouteParam = false } = {}) {
    setForm(createStudentTicketForm(currentUser));
    setCreateAttachments([]);
    setReplyText("");
    setReplyAttachments([]);
    setSelectedTicketId("");
    setOpenSelect("");
    setMode("create");
    setFeedback(emptyFeedback());

    if (clearRouteParam) {
      clearRouteParams();
    }
  }

  async function openTicketById(selectedId, { clearRouteParam = false } = {}) {
    try {
      setSaving(true);
      const data = await fetchTicketById(selectedId, {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setReplyAttachments([]);
      setMode("detail");
      setFeedback(emptyFeedback());
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to open the ticket right now." });
    } finally {
      if (clearRouteParam) {
        clearRouteParams();
      }
      setSaving(false);
    }
  }

  async function openTicket(ticket) {
    await openTicketById(ticketId(ticket));
  }

  async function submitTicket() {
    const errorMessage = validateStudentTicketForm(form);

    if (errorMessage) {
      setFeedback({ type: "error", message: errorMessage });
      return;
    }

    try {
      setSaving(true);
      const data = await createSupportTicket(
        {
          studentId: currentUser._id,
          ...form,
        },
        createAttachments
      );
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setCreateAttachments([]);
      setReplyText("");
      setReplyAttachments([]);
      setMode("detail");
      setFeedback({ type: "success", message: "Your support request was submitted successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to submit the ticket right now." });
    } finally {
      setSaving(false);
    }
  }

  async function sendReply() {
    const message = normalizeString(replyText);

    if (!message || !selectedTicket) {
      setFeedback({ type: "error", message: "Type your message before sending." });
      return;
    }

    try {
      setReplyBusy(true);
      const data = await sendTicketReply(
        ticketId(selectedTicket),
        {
          viewerId: currentUser._id,
          viewerRole: currentUser.role,
          message,
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
      setReplyBusy(false);
    }
  }

  async function closeTicket() {
    if (!selectedTicket) return;

    try {
      setCloseBusy(true);
      const data = await updateSupportTicket(ticketId(selectedTicket), {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
        status: "Closed",
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setFeedback({ type: "success", message: "Ticket closed successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to close the ticket right now." });
    } finally {
      setCloseBusy(false);
    }
  }

  async function saveFeedback() {
    if (!selectedTicket) return;

    const errorMessage = validateFeedbackForm(feedbackForm);

    if (errorMessage) {
      setFeedback({ type: "error", message: errorMessage });
      return;
    }

    try {
      setFeedbackBusy(true);
      const data = await saveTicketFeedback(ticketId(selectedTicket), {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
        rating: feedbackForm.rating,
        comment: feedbackForm.comment,
        removedAttachmentIds: removedFeedbackAttachmentIds,
      }, feedbackPendingAttachments);
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setFeedbackForm(createFeedbackForm(nextTicket.feedback));
      setFeedbackExistingAttachments(nextTicket.feedback?.attachments || []);
      setFeedbackPendingAttachments([]);
      setRemovedFeedbackAttachmentIds([]);
      setFeedbackEditing(false);
      setFeedback({ type: "success", message: "Your feedback was saved successfully." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to save your feedback right now." });
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function removeFeedback() {
    if (!selectedTicket?.feedback) return;

    try {
      setFeedbackBusy(true);
      const data = await deleteTicketFeedback(ticketId(selectedTicket), {
        viewerId: currentUser._id,
        viewerRole: currentUser.role,
      });
      const nextTicket = data.ticket;
      setTickets((current) => replaceTicket(current, nextTicket));
      setSelectedTicketId(ticketId(nextTicket));
      setFeedbackForm(createFeedbackForm());
      setFeedbackExistingAttachments([]);
      setFeedbackPendingAttachments([]);
      setRemovedFeedbackAttachmentIds([]);
      setFeedbackEditing(true);
      setFeedback({ type: "success", message: "Your feedback was deleted." });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to delete your feedback right now." });
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function handlePickCreateAttachments() {
    const result = await pickAttachments(createAttachments);
    setCreateAttachments(result.attachments);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    }
  }

  async function handlePickReplyAttachments() {
    const result = await pickAttachments(replyAttachments);
    setReplyAttachments(result.attachments);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    }
  }

  async function handlePickFeedbackAttachments() {
    const result = await pickAttachments(feedbackPendingAttachments);
    setFeedbackPendingAttachments(result.attachments);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    }
  }

  function handleRemoveExistingFeedbackAttachment(key) {
    const match = feedbackExistingAttachments.find((attachment) => attachmentKey(attachment) === key);

    if (!match) {
      return;
    }

    const removalId = match.fileId || match._id;

    setFeedbackExistingAttachments((current) =>
      current.filter((attachment) => attachmentKey(attachment) !== key)
    );
    setRemovedFeedbackAttachmentIds((current) =>
      current.includes(removalId) ? current : [...current, removalId]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppBrandHeader style={styles.brandHeader} />
        <FeedbackBanner feedback={feedback} />

        {mode === "list" ? (
          <>
            <SectionHeading
              title="My Tickets"
              body="Track your requests, read staff replies, and create a support request whenever you need help."
            />
            <View style={styles.summaryRow}>
              <SummaryCard label="Total Tickets" value={tickets.length} />
              <SummaryCard label="Active" value={activeCount} />
              <SummaryCard label="Resolved" value={resolvedCount} />
            </View>
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  openCreateTicket();
                }}
              >
                <Text style={styles.primaryButtonText}>Submit a Support Request</Text>
              </Pressable>
            </View>
            {loading ? (
              <EmptyState title="Loading tickets..." body="Fetching your latest support requests." />
            ) : tickets.length ? (
              <View style={styles.list}>
                {tickets.map((ticket) => (
                  <TicketCard key={ticketId(ticket)} ticket={ticket} onPress={() => void openTicket(ticket)} />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No tickets yet"
                body="Create your first support ticket and it will immediately appear in the admin queue for assignment."
              />
            )}
          </>
        ) : null}

        {mode === "create" ? (
          <>
            <View style={styles.rowBetween}>
              <Pressable style={styles.backButton} onPress={() => setMode("list")}>
                <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.backButtonText}>Back to My Tickets</Text>
              </Pressable>
            </View>
            <SectionHeading
              title="Submit a Support Request"
              body="Please complete this form and one of our agents will reply to you as soon as possible."
            />
            <View style={styles.card}>
              <Field label="Full Name *" value={form.fullName} onChangeText={(value) => updateForm("fullName", value)} placeholder="Enter your full name" />
              <Field label="Email *" value={form.email} onChangeText={(value) => updateForm("email", value)} placeholder="Enter your email address" keyboardType="email-address" autoCapitalize="none" />
              <Field label="Registration Number *" value={form.registrationNumber} onChangeText={(value) => updateForm("registrationNumber", value)} placeholder="e.g. IT24104153" autoCapitalize="characters" />
              <SelectField label="Faculty / School *" value={form.faculty} placeholder="Select Faculty" open={openSelect === "faculty"} onToggle={() => setOpenSelect((current) => current === "faculty" ? "" : "faculty")} onSelect={(value) => { updateForm("faculty", value); setOpenSelect(""); }} options={FACULTY_OPTIONS} helperText="Please select your faculty." />
              <Field label="Contact Number *" value={form.contactNumber} onChangeText={(value) => updateForm("contactNumber", value)} placeholder="07XXXXXXXX" keyboardType="phone-pad" autoCapitalize="none" />
              <SelectField label="Request / Inquiry Type *" value={requestTypeConfig?.label || ""} placeholder="Select Type" open={openSelect === "requestType"} onToggle={() => setOpenSelect((current) => current === "requestType" ? "" : "requestType")} onSelect={selectRequestType} options={REQUEST_TYPE_OPTIONS} helperText="Please select the most suitable option." />
              {requestTypeConfig?.subOptions?.length ? (
                <SelectField label={`${requestTypeConfig.subLabel} *`} value={form.requestSubType} placeholder="Select" open={openSelect === "requestSubType"} onToggle={() => setOpenSelect((current) => current === "requestSubType" ? "" : "requestSubType")} onSelect={(value) => { updateForm("requestSubType", value); setOpenSelect(""); }} options={requestTypeConfig.subOptions} />
              ) : null}
              <SelectField label="Department *" value={form.department} placeholder="Select Department" open={openSelect === "department"} onToggle={() => setOpenSelect((current) => current === "department" ? "" : "department")} onSelect={(value) => { updateForm("department", value); setOpenSelect(""); }} options={DEPARTMENT_OPTIONS} />
              <Field label="Subject *" value={form.subject} onChangeText={(value) => updateForm("subject", value)} placeholder="Brief one-line summary of your issue" />
              <SelectField label="Campus / Center *" value={form.campus} placeholder="Select Campus" open={openSelect === "campus"} onToggle={() => setOpenSelect((current) => current === "campus" ? "" : "campus")} onSelect={(value) => { updateForm("campus", value); setOpenSelect(""); }} options={CAMPUS_OPTIONS} helperText="Select the campus or center you are currently registered to." />
              <Field label="Message *" value={form.message} onChangeText={(value) => updateForm("message", value)} placeholder="Describe your issue in as much detail as possible..." multiline />
              <AttachmentPickerField
                title="Add Attachment"
                attachments={createAttachments}
                onPick={() => void handlePickCreateAttachments()}
                onRemove={(key) => setCreateAttachments((current) => removePendingAttachment(current, key))}
              />
            </View>
            <View style={styles.actionsRow}>
              <Pressable style={styles.secondaryButton} onPress={() => setMode("list")}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void submitTicket()} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? "Submitting..." : "Submit Ticket"}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {mode === "detail" && selectedTicket ? (
          <>
            <View style={styles.rowBetween}>
              <Pressable style={styles.backButton} onPress={() => setMode("list")}>
                <MaterialIcons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.backButtonText}>Back to My Tickets</Text>
              </Pressable>
              {selectedTicket.status === "Resolved" ? (
                <Pressable style={[styles.secondaryButton, closeBusy && styles.disabled]} onPress={() => void closeTicket()} disabled={closeBusy}>
                  <Text style={styles.secondaryButtonText}>{closeBusy ? "Closing..." : "Close Ticket"}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.detailHeading}>{selectedTicket.ticketCode}</Text>
            <View style={styles.badgeRow}>
              <TicketBadge label={`${selectedTicket.priority} Priority`} tone={`priority-${selectedTicket.priority.toLowerCase()}`} />
              <TicketBadge label={selectedTicket.status} tone={`status-${selectedTicket.status.toLowerCase().replace(/\s+/g, "-")}`} />
              <TicketBadge label={selectedTicket.requestType} />
            </View>
            <View style={styles.card}>
              <Text style={styles.ticketTitle}>{selectedTicket.subject}</Text>
              <DetailLine label="Department" value={selectedTicket.department} />
              <DetailLine label="Sub-category" value={selectedTicket.requestSubType} />
              <DetailLine label="Faculty / School" value={selectedTicket.student?.faculty} />
              <DetailLine label="Campus / Center" value={selectedTicket.student?.campus} />
              <Text style={styles.originalMessage}>{selectedTicket.message}</Text>
              <AttachmentList title="Attachments" attachments={selectedTicket.attachments} emptyText="No files were attached to this request." />
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
                <Text style={styles.emptyBody}>No replies yet. Our staff will respond to your ticket soon.</Text>
              )}
            </View>

            {showFeedbackSection ? (
              <View style={styles.card}>
                <View style={styles.resolutionHeader}>
                  <View style={styles.resolutionIconWrap}>
                    <MaterialIcons name="check" size={28} color="#0f9f6e" />
                  </View>
                  <Text style={styles.resolutionTitle}>This ticket has been resolved</Text>
                  <Text style={styles.resolutionBody}>
                    If you need further assistance, please submit a new ticket.
                  </Text>
                </View>

                {selectedTicket.feedback && !feedbackEditing ? (
                  <>
                    <View style={styles.rowBetween}>
                      <Text style={styles.sectionLabel}>Your Feedback</Text>
                      <View style={styles.inlineActionRow}>
                        <Pressable
                          style={styles.iconActionButton}
                          onPress={() => {
                            setFeedbackForm(createFeedbackForm(selectedTicket.feedback));
                            setFeedbackExistingAttachments(selectedTicket.feedback.attachments || []);
                            setFeedbackPendingAttachments([]);
                            setRemovedFeedbackAttachmentIds([]);
                            setFeedbackEditing(true);
                          }}
                          disabled={feedbackBusy}
                        >
                          <MaterialIcons name="edit" size={18} color={colors.secondary} />
                        </Pressable>
                        <Pressable style={styles.textActionButton} onPress={() => void removeFeedback()} disabled={feedbackBusy}>
                          <Text style={styles.textActionButtonLabel}>{feedbackBusy ? "Deleting..." : "Delete"}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <FeedbackRatingInput rating={selectedTicket.feedback.rating} onChange={() => undefined} disabled />
                    <Text style={styles.feedbackRatingLabel}>{getRatingLabel(selectedTicket.feedback.rating)}</Text>
                    <Text style={styles.savedFeedbackComment}>
                      {selectedTicket.feedback.comment || "You submitted a star rating without a written comment."}
                    </Text>
                    <AttachmentList
                      title="Feedback Attachments"
                      attachments={selectedTicket.feedback.attachments || []}
                      hideWhenEmpty
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.sectionLabel}>
                      {selectedTicket.feedback ? "Edit Your Feedback" : "Your Feedback"}
                    </Text>
                    <FeedbackRatingInput
                      rating={feedbackForm.rating}
                      onChange={(rating) => setFeedbackForm((current) => ({ ...current, rating }))}
                      disabled={feedbackBusy}
                    />
                    <Text style={styles.feedbackRatingLabel}>
                      {feedbackForm.rating ? getRatingLabel(feedbackForm.rating) : "Tap a star rating to continue."}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      value={feedbackForm.comment}
                      onChangeText={(comment) => setFeedbackForm((current) => ({ ...current, comment }))}
                      placeholder="Share a comment about how this ticket was handled..."
                      placeholderTextColor="#777683"
                      maxLength={FEEDBACK_MAX_COMMENT_LENGTH}
                      multiline
                      textAlignVertical="top"
                    />
                    <Text style={styles.helperText}>
                      {`${feedbackForm.comment.length}/${FEEDBACK_MAX_COMMENT_LENGTH}`}
                    </Text>
                    {feedbackExistingAttachments.length ? (
                      <AttachmentList
                        title="Current Attachments"
                        attachments={feedbackExistingAttachments}
                        removable
                        onRemove={handleRemoveExistingFeedbackAttachment}
                      />
                    ) : null}
                    <AttachmentPickerField
                      title="Attach Files"
                      attachments={feedbackPendingAttachments}
                      onPick={() => void handlePickFeedbackAttachments()}
                      onRemove={(key) =>
                        setFeedbackPendingAttachments((current) => removePendingAttachment(current, key))
                      }
                    />
                    <View style={styles.actionsRow}>
                      {selectedTicket.feedback ? (
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => {
                            setFeedbackForm(createFeedbackForm(selectedTicket.feedback));
                            setFeedbackExistingAttachments(selectedTicket.feedback.attachments || []);
                            setFeedbackPendingAttachments([]);
                            setRemovedFeedbackAttachmentIds([]);
                            setFeedbackEditing(false);
                          }}
                          disabled={feedbackBusy}
                        >
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[styles.primaryButton, feedbackBusy && styles.disabled]}
                        onPress={() => void saveFeedback()}
                        disabled={feedbackBusy}
                      >
                        <Text style={styles.primaryButtonText}>
                          {feedbackBusy ? "Saving..." : selectedTicket.feedback ? "Save Changes" : "Submit Feedback"}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Add a Reply</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Type your message here..."
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
                  <Pressable style={[styles.primaryButton, replyBusy && styles.disabled]} onPress={() => void sendReply()} disabled={replyBusy}>
                    <Text style={styles.primaryButtonText}>{replyBusy ? "Sending..." : "Send Reply"}</Text>
                  </Pressable>
                </View>
              </View>
            )}
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  brandHeader: { marginBottom: 4 },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: layout.notchClearance, paddingBottom: 24, gap: 12 },
  sectionHeading: { gap: 4 },
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
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },
  primaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "white" },
  secondaryButtonText: { color: colors.primary, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  helperText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", color: colors.text, paddingHorizontal: 12, paddingVertical: 12 },
  multilineInput: { minHeight: 110 },
  selectTrigger: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectValue: { color: colors.text, flex: 1 },
  selectPlaceholder: { color: "#777683", flex: 1 },
  selectMenu: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "white", overflow: "hidden" },
  selectOption: { paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#eef2f7" },
  selectOptionActive: { backgroundColor: "#eef2ff" },
  selectOptionText: { color: colors.text, fontWeight: "700" },
  selectOptionTextActive: { color: colors.primary },
  selectOptionNote: { color: colors.textMuted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  backButtonText: { color: colors.primary, fontWeight: "800" },
  detailHeading: { color: colors.primary, fontSize: type.h2, fontWeight: "800" },
  detailLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", flex: 1 },
  detailValue: { color: colors.text, fontSize: 12, fontWeight: "700", flex: 1, textAlign: "right" },
  originalMessage: { borderRadius: 12, backgroundColor: "#f8fafc", padding: 12, color: colors.text, lineHeight: 20 },
  sectionLabel: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  replyCard: { borderRadius: 14, padding: 12, gap: 4 },
  replyCardStudent: { backgroundColor: "#eef2ff" },
  replyCardStaff: { backgroundColor: "#f8fafc" },
  replyAuthor: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  replyTime: { color: "#98a2b3", fontSize: 11 },
  replyRole: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  replyMessage: { color: colors.text, lineHeight: 19 },
  resolutionHeader: { alignItems: "center", gap: 8, paddingVertical: 6 },
  resolutionIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#dffbea", alignItems: "center", justifyContent: "center" },
  resolutionTitle: { color: colors.primary, fontSize: 24, fontWeight: "800", textAlign: "center" },
  resolutionBody: { color: colors.textMuted, lineHeight: 20, textAlign: "center" },
  feedbackStarsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  feedbackRatingLabel: { color: colors.primary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  savedFeedbackComment: { borderRadius: 12, backgroundColor: "#f8fafc", padding: 14, color: colors.text, lineHeight: 22, fontStyle: "italic" },
  inlineActionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconActionButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#d9dde3", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" },
  textActionButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: "#f0b5bf", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, backgroundColor: "#fff1f3" },
  textActionButtonLabel: { color: "#b42318", fontWeight: "800" },
});
