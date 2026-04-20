import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../../components/AdminShell";
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  updateAnnouncement,
} from "../../api/announcements";
import {
  ANNOUNCEMENT_ATTACHMENT_HELPER_TEXT,
  pickAnnouncementAttachments,
} from "../../announcements/attachmentUtils";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_TYPES,
  formatAnnouncementDate,
  formatAnnouncementInputDate,
  getAnnouncementAudienceMeta,
  getAnnouncementFormDefaults,
  getAnnouncementTypeMeta,
  toAnnouncementPayload,
  validateAnnouncementDraft,
} from "../../announcements/utils";
import { AttachmentList, AttachmentPickerField } from "../tickets/TicketAttachmentSection";
import {
  appendAttachmentsToFormData,
  attachmentKey,
  removePendingAttachment,
} from "../tickets/attachmentUtils";
import { subscribeRealtimeEvent } from "../../realtime/socket";
import { colors, layout, type } from "../../theme";

export function AnnouncementsScreen({ navigation }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [notice, setNotice] = useState(null);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(getAnnouncementFormDefaults());
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [removedExistingAttachmentIds, setRemovedExistingAttachmentIds] = useState([]);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements({ pullToRefresh = false, silent = false } = {}) {
    if (pullToRefresh) {
      setRefreshing(true);
    } else if (!silent && !hasLoaded) {
      setLoading(true);
    }

    try {
      const data = await fetchAnnouncements({
        viewerRole: "admin",
        includeExpired: true,
      });

      setAnnouncements(data.announcements || []);
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Unable to load announcements." });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasLoaded(true);
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeRealtimeEvent("announcement:changed", () => {
      void loadAnnouncements({ silent: true });
    });

    return unsubscribe;
  }, [hasLoaded]);

  function updateFormField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function resetForm() {
    setForm(getAnnouncementFormDefaults());
    setEditingId("");
    setErrors({});
    setTypePickerVisible(false);
    setExistingAttachments([]);
    setPendingAttachments([]);
    setRemovedExistingAttachmentIds([]);
  }

  function handleClear() {
    resetForm();
    setNotice(null);
  }

  function handleEdit(announcement) {
    setEditingId(announcement._id);
    setForm({
      title: announcement.title || "",
      type: announcement.type || "",
      expiryDate: formatAnnouncementInputDate(announcement.expiryDate),
      targetAudience: announcement.targetAudience || "all",
      pinnedToTop: Boolean(announcement.pinnedToTop),
      content: announcement.content || "",
    });
    setExistingAttachments(announcement.attachments || []);
    setPendingAttachments([]);
    setRemovedExistingAttachmentIds([]);
    setErrors({});
    setNotice({ tone: "info", text: "Editing announcement. Update the fields and save your changes." });
  }

  async function handlePickAttachments() {
    const result = await pickAnnouncementAttachments(pendingAttachments);
    setPendingAttachments(result.attachments);

    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }

    setNotice(null);
  }

  function handleRemovePendingAttachment(key) {
    setPendingAttachments((current) => removePendingAttachment(current, key));
  }

  function handleRemoveExistingAttachment(key) {
    const match = existingAttachments.find((attachment) => attachmentKey(attachment) === key);

    if (!match) {
      return;
    }

    setExistingAttachments((current) =>
      current.filter((attachment) => attachmentKey(attachment) !== key)
    );
    setRemovedExistingAttachmentIds((current) =>
      current.includes(match.fileId) ? current : [...current, match.fileId]
    );
  }

  async function handleSubmit() {
    const nextErrors = validateAnnouncementDraft(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setNotice({ tone: "error", text: "Please fix the highlighted announcement fields." });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const wasEditing = Boolean(editingId);
      const payload = new FormData();
      const serializedForm = toAnnouncementPayload(form);

      Object.entries(serializedForm).forEach(([key, value]) => {
        payload.append(key, String(value));
      });

      if (removedExistingAttachmentIds.length) {
        payload.append(
          "removedAttachmentIds",
          JSON.stringify(removedExistingAttachmentIds)
        );
      }

      appendAttachmentsToFormData(payload, pendingAttachments);

      if (wasEditing) {
        await updateAnnouncement(editingId, payload);
      } else {
        await createAnnouncement(payload);
      }

      resetForm();
      setNotice({
        tone: "success",
        text: wasEditing
          ? "Announcement updated successfully."
          : "Announcement published successfully.",
      });
      await loadAnnouncements();
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Unable to save the announcement." });
    } finally {
      setSaving(false);
    }
  }

  async function performDelete(announcement) {
    setDeletingId(announcement._id);
    setNotice(null);

    try {
      await deleteAnnouncement(announcement._id);

      if (editingId === announcement._id) {
        resetForm();
      }

      setNotice({ tone: "success", text: "Announcement deleted successfully." });
      await loadAnnouncements();
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Unable to delete the announcement." });
    } finally {
      setDeletingId("");
    }
  }

  function handleDelete(announcement) {
    Alert.alert(
      "Delete announcement",
      `Delete "${announcement.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            performDelete(announcement);
          },
        },
      ]
    );
  }

  function handleExpiryBlur() {
    const formatted = formatAnnouncementInputDate(form.expiryDate);

    if (formatted) {
      updateFormField("expiryDate", formatted);
    }
  }

  const selectedType = ANNOUNCEMENT_TYPES.find((item) => item.value === form.type);

  return (
    <AdminShell navigation={navigation} currentRoute="Announcements">
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAnnouncements({ pullToRefresh: true })}
              tintColor={colors.secondary}
            />
          }
        >
          <View style={styles.heroCard}>
            <Text style={styles.title}>Announcements</Text>
            <Text style={styles.subtitle}>
              Publish, edit, and manage announcements visible to students.
            </Text>
          </View>

          {notice ? (
            <View
              style={[
                styles.noticeCard,
                notice.tone === "error" && styles.noticeError,
                notice.tone === "success" && styles.noticeSuccess,
              ]}
            >
              <MaterialIcons
                name={
                  notice.tone === "error"
                    ? "error-outline"
                    : notice.tone === "success"
                      ? "check-circle-outline"
                      : "edit-note"
                }
                size={18}
                color={
                  notice.tone === "error"
                    ? "#b91c1c"
                    : notice.tone === "success"
                      ? "#047857"
                      : colors.primary
                }
              />
              <Text
                style={[
                  styles.noticeText,
                  notice.tone === "error" && styles.noticeTextError,
                  notice.tone === "success" && styles.noticeTextSuccess,
                ]}
              >
                {notice.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.formPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {editingId ? "Edit Announcement" : "Create Announcement"}
              </Text>
              {editingId ? (
                <View style={styles.editingBadge}>
                  <Text style={styles.editingBadgeText}>Editing</Text>
                </View>
              ) : null}
            </View>

            <FieldLabel label="Title *" />
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={form.title}
              onChangeText={(value) => updateFormField("title", value)}
              placeholder="e.g. Library will be closed on Friday"
              placeholderTextColor="#8b8f99"
            />
            <FieldError message={errors.title} />

            <FieldLabel label="Type *" />
            <Pressable
              style={[styles.selectField, errors.type && styles.inputError]}
              onPress={() => setTypePickerVisible(true)}
            >
              {selectedType ? (
                <View style={styles.selectValueRow}>
                  <View style={[styles.typeDot, { backgroundColor: selectedType.color }]} />
                  <Text style={styles.selectValueText}>{selectedType.label}</Text>
                </View>
              ) : (
                <Text style={styles.selectPlaceholder}>Select type</Text>
              )}
              <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.primary} />
            </Pressable>
            <FieldError message={errors.type} />

            <FieldLabel label="Expiry Date *" />
            <TextInput
              style={[styles.input, errors.expiryDate && styles.inputError]}
              value={form.expiryDate}
              onChangeText={(value) => updateFormField("expiryDate", value)}
              onBlur={handleExpiryBlur}
              placeholder="mm/dd/yyyy"
              placeholderTextColor="#8b8f99"
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.helperText}>Only future dates are allowed.</Text>
            <FieldError message={errors.expiryDate} />

            <FieldLabel label="Target Audience" />
            <View style={styles.audienceRow}>
              {ANNOUNCEMENT_AUDIENCES.map((item) => {
                const active = form.targetAudience === item.value;

                return (
                  <Pressable
                    key={item.value}
                    style={[styles.audienceChip, active && styles.audienceChipActive]}
                    onPress={() => updateFormField("targetAudience", item.value)}
                  >
                    <MaterialIcons
                      name={item.icon}
                      size={16}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.audienceChipText,
                        active && styles.audienceChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <FieldError message={errors.targetAudience} />

            <View style={styles.pinRow}>
              <View style={styles.pinTextWrap}>
                <Text style={styles.pinTitle}>Pin to top of student feed</Text>
                <Text style={styles.pinSubtitle}>
                  Pinned announcements stay above the regular student feed.
                </Text>
              </View>
              <Switch
                value={form.pinnedToTop}
                onValueChange={(value) => updateFormField("pinnedToTop", value)}
                trackColor={{ false: "#d1d5db", true: "#c4b5fd" }}
                thumbColor={form.pinnedToTop ? colors.secondary : "#ffffff"}
              />
            </View>

            <FieldLabel label="Content *" />
            <TextInput
              style={[styles.textArea, errors.content && styles.inputError]}
              value={form.content}
              onChangeText={(value) => updateFormField("content", value)}
              placeholder="Write the announcement details..."
              placeholderTextColor="#8b8f99"
              multiline
              textAlignVertical="top"
            />
            <FieldError message={errors.content} />

            {existingAttachments.length ? (
              <AttachmentList
                title="Current PDFs"
                attachments={existingAttachments}
                removable
                onRemove={handleRemoveExistingAttachment}
              />
            ) : null}

            <AttachmentPickerField
              title="Attach PDF Files"
              attachments={pendingAttachments}
              onPick={handlePickAttachments}
              onRemove={handleRemovePendingAttachment}
              helperText={ANNOUNCEMENT_ATTACHMENT_HELPER_TEXT}
            />

            <View style={styles.formActions}>
              <Pressable style={styles.clearButton} onPress={handleClear}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.submitButton, saving && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <MaterialIcons
                      name={editingId ? "save" : "campaign"}
                      size={18}
                      color="white"
                    />
                    <Text style={styles.submitButtonText}>
                      {editingId ? "Update Announcement" : "Publish Announcement"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.listPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Published Announcements ({announcements.length})
              </Text>
              <Pressable
                style={styles.refreshButton}
                onPress={() => loadAnnouncements()}
              >
                <MaterialIcons name="refresh" size={18} color={colors.primary} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.secondary} size="large" />
                <Text style={styles.loadingText}>Loading announcements...</Text>
              </View>
            ) : announcements.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="campaign" size={22} color="#8b8f99" />
                <Text style={styles.emptyTitle}>No announcements yet</Text>
                <Text style={styles.emptyText}>
                  Publish the first update to make it visible in the student feed.
                </Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {announcements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement._id}
                    announcement={announcement}
                    editing={editingId === announcement._id}
                    deleting={deletingId === announcement._id}
                    onEdit={() => handleEdit(announcement)}
                    onDelete={() => handleDelete(announcement)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <Modal
          visible={typePickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTypePickerVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setTypePickerVisible(false)}
          >
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Select type</Text>
              <View style={styles.modalList}>
                {ANNOUNCEMENT_TYPES.map((item) => (
                  <Pressable
                    key={item.value}
                    style={styles.modalOption}
                    onPress={() => {
                      updateFormField("type", item.value);
                      setTypePickerVisible(false);
                    }}
                  >
                    <View style={[styles.typeDot, { backgroundColor: item.color }]} />
                    <Text style={styles.modalOptionText}>{item.label}</Text>
                    {form.type === item.value ? (
                      <MaterialIcons
                        name="check-circle"
                        size={18}
                        color={colors.secondary}
                      />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </AdminShell>
  );
}

function FieldLabel({ label }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function FieldError({ message }) {
  if (!message) {
    return null;
  }

  return <Text style={styles.errorText}>{message}</Text>;
}

function AnnouncementCard({ announcement, editing, deleting, onEdit, onDelete }) {
  const typeMeta = getAnnouncementTypeMeta(announcement.type);
  const audienceMeta = getAnnouncementAudienceMeta(announcement.targetAudience);

  return (
    <View style={[styles.announcementCard, editing && styles.announcementCardEditing]}>
      <View style={styles.badgeRow}>
        {announcement.pinnedToTop ? (
          <View style={styles.pinnedBadge}>
            <MaterialIcons name="push-pin" size={14} color={colors.primary} />
            <Text style={styles.pinnedBadgeText}>Pinned</Text>
          </View>
        ) : null}

        <View style={[styles.typeBadge, { backgroundColor: typeMeta.softColor }]}>
          <View style={[styles.typeDot, { backgroundColor: typeMeta.color }]} />
          <Text style={[styles.typeBadgeText, { color: typeMeta.color }]}>
            {typeMeta.label}
          </Text>
        </View>

        <View style={styles.audienceBadge}>
          <MaterialIcons name={audienceMeta.icon} size={14} color={colors.primary} />
          <Text style={styles.audienceBadgeText}>{audienceMeta.label}</Text>
        </View>

        {announcement.isExpired ? (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>Expired</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardTitle}>{announcement.title}</Text>
      <Text style={styles.cardContent}>{announcement.content}</Text>

      <Text style={styles.cardMeta}>By {announcement.authorName || "Admin"}</Text>
      <Text style={styles.cardMeta}>
        Expires: {formatAnnouncementDate(announcement.expiryDate)}
      </Text>
      <AttachmentList
        title="Attached PDFs"
        attachments={announcement.attachments || []}
        emptyText="No PDF attachments."
        hideWhenEmpty
      />

      <View style={styles.cardActions}>
        <Pressable style={styles.cardActionButton} onPress={onEdit}>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
          <Text style={styles.cardActionText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.cardActionButton, styles.cardDeleteButton]}
          onPress={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#b91c1c" size="small" />
          ) : (
            <>
              <MaterialIcons name="delete-outline" size={16} color="#b91c1c" />
              <Text style={styles.cardDeleteText}>Delete</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.cardPadding,
  },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9dce1",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeError: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  noticeSuccess: {
    backgroundColor: "#ecfdf5",
    borderColor: "#bbf7d0",
  },
  noticeText: { flex: 1, color: colors.primary, fontWeight: "600", lineHeight: 18 },
  noticeTextError: { color: "#b91c1c" },
  noticeTextSuccess: { color: "#047857" },
  formPanel: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    gap: 8,
  },
  listPanel: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: { flex: 1, color: colors.primary, fontSize: 20, fontWeight: "800" },
  editingBadge: {
    borderRadius: 999,
    backgroundColor: "#ede9fe",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editingBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: "#f7f8fb",
    paddingHorizontal: 14,
    color: colors.text,
  },
  selectField: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: "#f7f8fb",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectValueText: { color: colors.text, fontSize: 16 },
  selectPlaceholder: { color: "#8b8f99", fontSize: 16 },
  helperText: { color: "#6b7280", fontSize: 12 },
  errorText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  inputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  audienceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  audienceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  audienceChipActive: {
    borderColor: colors.secondary,
    backgroundColor: "#ede9fe",
  },
  audienceChipText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
  audienceChipTextActive: { color: colors.primary },
  pinRow: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fafafc",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pinTextWrap: { flex: 1 },
  pinTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  pinSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 18 },
  textArea: {
    minHeight: 124,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: "#f7f8fb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
  },
  formActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  clearButton: {
    minWidth: 104,
    minHeight: layout.touchTarget,
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "white",
  },
  clearButtonText: { color: colors.textMuted, fontWeight: "800" },
  submitButton: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  submitButtonText: { color: "white", fontWeight: "800" },
  buttonDisabled: { opacity: 0.75 },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7dae0",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#f8fafc",
  },
  refreshButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 10,
  },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  emptyText: { color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  listWrap: { gap: 10 },
  announcementCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  announcementCardEditing: {
    borderColor: colors.secondary,
    backgroundColor: "#faf5ff",
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#ede9fe",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pinnedBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "800" },
  audienceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  audienceBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  expiredBadge: {
    borderRadius: 999,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  expiredBadgeText: { color: "#b91c1c", fontSize: 11, fontWeight: "800" },
  typeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  cardContent: { color: colors.textMuted, lineHeight: 20 },
  cardMeta: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  cardActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7dae0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  cardDeleteButton: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  cardActionText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  cardDeleteText: { color: "#b91c1c", fontWeight: "800", fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.28)",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 20,
    backgroundColor: "white",
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  modalTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  modalList: { gap: 8 },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalOptionText: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 15 },
});
