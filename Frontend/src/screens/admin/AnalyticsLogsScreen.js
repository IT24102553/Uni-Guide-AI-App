import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../../components/AdminShell";
import { useSession } from "../../context/SessionContext";
import {
  createAnalyticsLog,
  deleteAnalyticsLog,
  fetchAnalyticsLogs,
  fetchAnalyticsSummary,
  updateAnalyticsLog,
} from "../../api/analyticsLogs";
import { colors, layout, type } from "../../theme";
import {
  appendAttachmentsToFormData,
  attachmentKey,
  pickAttachments,
  removePendingAttachment,
} from "../tickets/attachmentUtils";
import { AttachmentList, AttachmentPickerField } from "../tickets/TicketAttachmentSection";

const LOG_CATEGORIES = [
  { value: "usage", label: "Service Usage" },
  { value: "incident", label: "System Issue" },
  { value: "security", label: "Security Issue" },
  { value: "maintenance", label: "Maintenance" },
  { value: "report", label: "Admin Report" },
  { value: "other", label: "Other" },
];

const LOG_SEVERITIES = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

const LOG_STATUSES = [
  { value: "Open", label: "Open" },
  { value: "In Review", label: "In Review" },
  { value: "Resolved", label: "Resolved" },
  { value: "Archived", label: "Archived" },
];

function todayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function emptyForm() {
  return {
    title: "",
    category: "incident",
    severity: "Medium",
    status: "Open",
    source: "",
    eventDate: todayInputValue(),
    notes: "",
  };
}

function clean(value) {
  return String(value || "").trim();
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Recently updated";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatInputDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return todayInputValue();

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getCategoryLabel(value) {
  return LOG_CATEGORIES.find((item) => item.value === value)?.label || "Other";
}

function getSeverityMeta(value) {
  if (value === "Critical") return { bg: "#fee2e2", fg: "#b91c1c" };
  if (value === "High") return { bg: "#fff1f2", fg: "#be123c" };
  if (value === "Medium") return { bg: "#fef3c7", fg: "#a16207" };
  return { bg: "#dcfce7", fg: "#166534" };
}

function getStatusMeta(value) {
  if (value === "Resolved") return { bg: "#dcfce7", fg: "#166534" };
  if (value === "Archived") return { bg: "#e5e7eb", fg: "#4b5563" };
  if (value === "In Review") return { bg: "#ede9fe", fg: colors.secondary };
  return { bg: "#dbeafe", fg: colors.primary };
}

function matchesFilters(record, query, statusFilter, severityFilter, categoryFilter) {
  const search = clean(query).toLowerCase();
  const matchesSearch =
    !search ||
    [
      record.title,
      record.category,
      record.severity,
      record.status,
      record.source,
      record.notes,
      record.reportedByName,
    ].some((value) => String(value || "").toLowerCase().includes(search));

  return (
    matchesSearch &&
    (statusFilter === "all" || record.status === statusFilter) &&
    (severityFilter === "all" || record.severity === severityFilter) &&
    (categoryFilter === "all" || record.category === categoryFilter)
  );
}

function percentage(count, total) {
  if (!total) return 0;
  return Math.max(6, Math.round((count / total) * 100));
}

export function AnalyticsLogsScreen({ navigation }) {
  const { currentUser } = useSession();
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [removedExistingAttachmentIds, setRemovedExistingAttachmentIds] = useState([]);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData(options = {}) {
    if (options.pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [summaryData, recordsData] = await Promise.all([
        fetchAnalyticsSummary(),
        fetchAnalyticsLogs(),
      ]);

      setSummary(summaryData);
      setRecords(Array.isArray(recordsData.records) ? recordsData.records : []);

      if (!options.keepFeedback) {
        setFeedback(null);
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to load the help desk analytics right now.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm(emptyForm());
    setExistingAttachments([]);
    setPendingAttachments([]);
    setRemovedExistingAttachmentIds([]);
  }

  function validateForm() {
    if (!clean(form.title)) return "Title is required.";
    if (!clean(form.eventDate)) return "Event date is required.";
    if (!clean(form.notes)) return "Notes are required.";
    return "";
  }

  async function handlePickAttachments() {
    const result = await pickAttachments(pendingAttachments);
    setPendingAttachments(result.attachments);

    if (result.error) {
      setFeedback({ type: "error", message: result.error });
      return;
    }

    setFeedback(null);
  }

  function handleRemoveExistingAttachment(key) {
    const match = existingAttachments.find((attachment) => attachmentKey(attachment) === key);
    if (!match) return;

    setExistingAttachments((current) =>
      current.filter((attachment) => attachmentKey(attachment) !== key)
    );
    setRemovedExistingAttachmentIds((current) =>
      current.includes(match.fileId) ? current : [...current, match.fileId]
    );
  }

  async function handleSubmit() {
    const errorMessage = validateForm();
    if (errorMessage) {
      setFeedback({ type: "error", message: errorMessage });
      return;
    }

    try {
      setSaving(true);
      const payload = new FormData();
      payload.append("title", clean(form.title));
      payload.append("category", form.category);
      payload.append("severity", form.severity);
      payload.append("status", form.status);
      payload.append("source", clean(form.source));
      payload.append("eventDate", clean(form.eventDate));
      payload.append("notes", clean(form.notes));
      payload.append("reportedByName", currentUser?.name || "Admin");

      if (removedExistingAttachmentIds.length) {
        payload.append("removedAttachmentIds", JSON.stringify(removedExistingAttachmentIds));
      }

      appendAttachmentsToFormData(payload, pendingAttachments);

      if (editingId) {
        await updateAnalyticsLog(editingId, payload);
        setFeedback({ type: "success", message: "Incident report updated successfully." });
      } else {
        await createAnalyticsLog(payload);
        setFeedback({ type: "success", message: "Incident report created successfully." });
      }

      resetForm();
      await loadData({ keepFeedback: true });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to save the incident report right now.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(record) {
    setEditingId(record._id);
    setForm({
      title: record.title || "",
      category: record.category || "incident",
      severity: record.severity || "Medium",
      status: record.status || "Open",
      source: record.source || "",
      eventDate: formatInputDate(record.eventDate),
      notes: record.notes || "",
    });
    setExistingAttachments(record.attachments || []);
    setPendingAttachments([]);
    setRemovedExistingAttachmentIds([]);
    setFeedback({
      type: "info",
      message: "Editing incident report. Update the fields and save your changes.",
    });
  }

  async function removeRecord(record) {
    try {
      setDeletingId(record._id);
      await deleteAnalyticsLog(record._id);
      if (editingId === record._id) resetForm();
      setFeedback({ type: "success", message: "Incident report deleted successfully." });
      await loadData({ keepFeedback: true });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to delete the incident report right now.",
      });
    } finally {
      setDeletingId("");
    }
  }

  function confirmDelete(record) {
    const message = `Delete "${record.title}"?`;

    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(message)) void removeRecord(record);
      return;
    }

    Alert.alert("Delete incident report", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void removeRecord(record) },
    ]);
  }

  const filteredRecords = records.filter((record) =>
    matchesFilters(record, query, statusFilter, severityFilter, categoryFilter)
  );
  const logsBySeverity = Array.isArray(summary?.breakdowns?.logsBySeverity)
    ? summary.breakdowns.logsBySeverity
    : [];
  const recentLogs = Array.isArray(summary?.recentLogs) ? summary.recentLogs : [];
  const severityTotal = logsBySeverity.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const reportStatusBreakdown = LOG_STATUSES.map((item) => ({
    key: item.value,
    label: item.label,
    count: records.filter((record) => record.status === item.value).length,
  })).filter((item) => item.count > 0);
  const reportStatusTotal = reportStatusBreakdown.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );
  const metrics = [
    {
      icon: "confirmation-number",
      label: "Total Tickets",
      value: summary?.summary?.support?.totalTickets ?? 0,
      note: "All student help requests",
      tint: "#eef2ff",
    },
    {
      icon: "confirmation-number",
      label: "Open Tickets",
      value: summary?.summary?.support?.openTickets ?? 0,
      note: `${summary?.summary?.support?.pendingAssignmentTickets ?? 0} still waiting for your action`,
      tint: "#fff7d6",
    },
    {
      icon: "priority-high",
      label: "Urgent Tickets",
      value: summary?.summary?.support?.urgentTickets ?? 0,
      note: "High-priority help requests",
      tint: "#fee2e2",
    },
    {
      icon: "task-alt",
      label: "Resolved Tickets",
      value: summary?.summary?.support?.resolvedTickets ?? 0,
      note: "Completed support requests",
      tint: "#ecfdf3",
    },
    {
      icon: "fact-check",
      label: "Incident Reports",
      value: summary?.summary?.logs?.totalLogs ?? 0,
      note: "Private issue records for your help desk",
      tint: "#fce7f3",
    },
    {
      icon: "warning",
      label: "Critical Reports",
      value: summary?.summary?.logs?.criticalLogs ?? 0,
      note: `${summary?.summary?.logs?.openLogs ?? 0} still open`,
      tint: "#fff7d6",
    },
  ];

  return (
    <AdminShell navigation={navigation} currentRoute="AnalyticsLogs">
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData({ pullToRefresh: true, keepFeedback: true })}
              tintColor={colors.secondary}
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="insights" size={24} color={colors.secondary} />
            </View>
            <Text style={styles.title}>Help Desk Analytics</Text>
            <Text style={styles.subtitle}>
              See your current ticket workload, then save private incident reports with attached proof files.
            </Text>
            <View style={styles.heroPills}>
              <InfoPill
                icon="confirmation-number"
                label={`${summary?.summary?.support?.openTickets ?? 0} open tickets`}
              />
              <InfoPill
                icon="fact-check"
                label={`${summary?.summary?.logs?.totalLogs ?? records.length} incident reports`}
              />
            </View>
          </View>

          {feedback ? <Banner feedback={feedback} /> : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What This Page Does</Text>
            <Text style={styles.sectionNote}>
              This is your single-admin help desk workspace.
            </Text>
            <View style={styles.stack}>
              <ExplainCard
                icon="bar-chart"
                title="Ticket Analytics"
                body="Shows how many student help requests are open, urgent, and already resolved."
              />
              <ExplainCard
                icon="description"
                title="Incident Reports"
                body="Lets you save private problem reports like system errors, outages, or important observations with file evidence."
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ticket Analytics</Text>
                <Text style={styles.sectionNote}>
                  Simple numbers for the help desk queue and today&apos;s support workload.
                </Text>
              </View>
            </View>

            {loading && !summary ? (
              <LoadingState label="Loading ticket analytics..." />
            ) : (
              <View style={styles.metricGrid}>
                {metrics.map((item) => (
                  <MetricCard key={item.label} item={item} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Incident Report Breakdown</Text>
            <Text style={styles.sectionNote}>
              These reports are your private admin records, not student tickets.
            </Text>

            <Text style={styles.subheading}>By Status</Text>
            {reportStatusBreakdown.length ? (
              <View style={styles.stack}>
                {reportStatusBreakdown.map((item) => (
                  <BreakdownRow
                    key={item.key}
                    label={item.label}
                    count={item.count}
                    width={`${percentage(item.count, reportStatusTotal)}%`}
                    color="#6b38d4"
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No incident reports yet"
                body="Create the first incident report to start this breakdown."
              />
            )}

            <Text style={styles.subheading}>By Severity</Text>
            {logsBySeverity.length ? (
              <View style={styles.stack}>
                {logsBySeverity.map((item) => (
                  <BreakdownRow
                    key={item.key}
                    label={item.key}
                    count={item.count}
                    width={`${percentage(item.count, severityTotal)}%`}
                    color={getSeverityMeta(item.key).fg}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Recent Incident Reports</Text>
            <Text style={styles.sectionNote}>
              Latest issues and reports saved in your admin workspace.
            </Text>
            {loading && !recentLogs.length ? (
              <LoadingState label="Loading recent activity..." />
            ) : recentLogs.length ? (
              <View style={styles.stack}>
                {recentLogs.map((record) => (
                  <View key={record._id} style={styles.timelineCard}>
                    <View style={styles.timelineTop}>
                      <Text style={styles.timelineTitle}>{record.title}</Text>
                      <StatusBadge label={record.status} meta={getStatusMeta(record.status)} />
                    </View>
                    <View style={styles.badgeRow}>
                      <Text
                        style={[
                          styles.inlineBadge,
                          {
                            backgroundColor: getSeverityMeta(record.severity).bg,
                            color: getSeverityMeta(record.severity).fg,
                          },
                        ]}
                      >
                        {record.severity}
                      </Text>
                      <Text style={styles.inlineBadgeNeutral}>
                        {getCategoryLabel(record.category)}
                      </Text>
                    </View>
                    <Text style={styles.metaText}>
                      {record.source ? `${record.source} | ` : ""}
                      {formatDateTime(record.eventDate)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                title="No recent incident reports yet"
                body="Saved reports will appear here after you create them."
              />
            )}
          </View>

          <View style={styles.formPanel}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {editingId ? "Edit Incident Report" : "Create Incident Report"}
              </Text>
              {editingId ? (
                <View style={styles.editingBadge}>
                  <Text style={styles.editingBadgeText}>Editing</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.sectionNote}>
              This is the CRUD part of the assignment: create, update, delete, and attach files to each incident report.
            </Text>

            <FieldLabel label="Title *" />
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(value) => updateField("title", value)}
              placeholder="e.g. Admission portal latency spike"
              placeholderTextColor="#8b8f99"
            />

            <FieldLabel label="Reported From" />
            <TextInput
              style={styles.input}
              value={form.source}
              onChangeText={(value) => updateField("source", value)}
              placeholder="e.g. Student Portal, Staff Observation, Ticket Review"
              placeholderTextColor="#8b8f99"
            />

            <FieldLabel label="Incident Date *" />
            <TextInput
              style={styles.input}
              value={form.eventDate}
              onChangeText={(value) => updateField("eventDate", value)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#8b8f99"
              autoCapitalize="none"
            />

            <FieldLabel label="Incident Type" />
            <View style={styles.chipRow}>
              {LOG_CATEGORIES.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={item.label}
                  active={form.category === item.value}
                  onPress={() => updateField("category", item.value)}
                />
              ))}
            </View>

            <FieldLabel label="Severity" />
            <View style={styles.chipRow}>
              {LOG_SEVERITIES.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={item.label}
                  active={form.severity === item.value}
                  onPress={() => updateField("severity", item.value)}
                />
              ))}
            </View>

            <FieldLabel label="Status" />
            <View style={styles.chipRow}>
              {LOG_STATUSES.map((item) => (
                <ChoiceChip
                  key={item.value}
                  label={item.label}
                  active={form.status === item.value}
                  onPress={() => updateField("status", item.value)}
                />
              ))}
            </View>

            <FieldLabel label="Notes *" />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.notes}
              onChangeText={(value) => updateField("notes", value)}
              placeholder="Describe the issue, who was affected, and what action the help desk took."
              placeholderTextColor="#8b8f99"
              multiline
              textAlignVertical="top"
            />

            {existingAttachments.length ? (
              <AttachmentList
                title="Current Attachments"
                attachments={existingAttachments}
                removable
                onRemove={handleRemoveExistingAttachment}
              />
            ) : null}

            <AttachmentPickerField
              title="Attach Files"
              attachments={pendingAttachments}
              onPick={() => void handlePickAttachments()}
              onRemove={(key) =>
                setPendingAttachments((current) => removePendingAttachment(current, key))
              }
            />

            <View style={styles.formActions}>
              <Pressable style={styles.secondaryButton} onPress={resetForm} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, saving && styles.dimmed]}
                onPress={() => void handleSubmit()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {editingId ? "Save Changes" : "Create Report"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Incident Report Library</Text>
            <Text style={styles.sectionNote}>Search and filter the saved incident reports below.</Text>

            <SearchBox
              value={query}
              onChangeText={setQuery}
              placeholder="Search incident title, source, status, notes, or saved by"
            />

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={styles.chipRow}>
                <FilterChip label="All" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
                {LOG_STATUSES.map((item) => (
                  <FilterChip
                    key={item.value}
                    label={item.label}
                    active={statusFilter === item.value}
                    onPress={() => setStatusFilter(item.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Severity</Text>
              <View style={styles.chipRow}>
                <FilterChip label="All" active={severityFilter === "all"} onPress={() => setSeverityFilter("all")} />
                {LOG_SEVERITIES.map((item) => (
                  <FilterChip
                    key={item.value}
                    label={item.label}
                    active={severityFilter === item.value}
                    onPress={() => setSeverityFilter(item.value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.chipRow}>
                <FilterChip label="All" active={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
                {LOG_CATEGORIES.map((item) => (
                  <FilterChip
                    key={item.value}
                    label={item.label}
                    active={categoryFilter === item.value}
                    onPress={() => setCategoryFilter(item.value)}
                  />
                ))}
              </View>
            </View>

            {loading ? (
              <LoadingState label="Loading incident reports..." />
            ) : filteredRecords.length ? (
              <View style={styles.stack}>
                {filteredRecords.map((record) => (
                  <LogRecordCard
                    key={record._id}
                    record={record}
                    editing={editingId === record._id}
                    deleting={deletingId === record._id}
                    onEdit={() => handleEdit(record)}
                    onDelete={() => confirmDelete(record)}
                  />
                ))}
              </View>
            ) : (
              <EmptyState
                title="No matching incident reports"
                body="Try a different search or create your first incident report."
              />
            )}
          </View>
        </ScrollView>
      </View>
    </AdminShell>
  );
}

function Banner({ feedback }) {
  const type = feedback.type || "info";
  const bg = type === "error" ? "#fff1f3" : type === "success" ? "#ecfdf3" : "#eef2ff";
  const border = type === "error" ? "#fecdd3" : type === "success" ? "#b7ebc6" : "#c7d2fe";
  const color = type === "error" ? "#b91c1c" : type === "success" ? "#166534" : colors.primary;
  const icon = type === "error" ? "error-outline" : type === "success" ? "check-circle-outline" : "info-outline";

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
      <MaterialIcons name={icon} size={18} color={color} />
      <Text style={[styles.bannerText, { color }]}>{feedback.message}</Text>
    </View>
  );
}

function InfoPill({ icon, label }) {
  return (
    <View style={styles.infoPill}>
      <MaterialIcons name={icon} size={15} color={colors.primary} />
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

function ExplainCard({ icon, title, body }) {
  return (
    <View style={styles.explainCard}>
      <View style={styles.explainIcon}>
        <MaterialIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.explainText}>
        <Text style={styles.explainTitle}>{title}</Text>
        <Text style={styles.explainBody}>{body}</Text>
      </View>
    </View>
  );
}

function MetricCard({ item }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: item.tint }]}>
        <MaterialIcons name={item.icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.metricValue}>{item.value}</Text>
      <Text style={styles.metricLabel}>{item.label}</Text>
      <Text style={styles.metricNote}>{item.note}</Text>
    </View>
  );
}

function BreakdownRow({ label, count, width, color }) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownHead}>
        <Text style={styles.breakdownLabel}>{label}</Text>
        <Text style={styles.breakdownCount}>{count}</Text>
      </View>
      <View style={styles.breakdownTrack}>
        <View style={[styles.breakdownFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function LoadingState({ label }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={colors.secondary} />
      <Text style={styles.centerText}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, body }) {
  return (
    <View style={styles.centerState}>
      <MaterialIcons name="inbox" size={22} color="#8b8f99" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function FieldLabel({ label }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function SearchBox({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.searchBox}>
      <MaterialIcons name="search" size={18} color="#7c7f8d" />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7c7f8d"
      />
    </View>
  );
}

function ChoiceChip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.choiceChip, active && styles.choiceChipActive]} onPress={onPress}>
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ label, meta }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.statusBadgeText, { color: meta.fg }]}>{label}</Text>
    </View>
  );
}

function LogRecordCard({ record, editing, deleting, onEdit, onDelete }) {
  const severityMeta = getSeverityMeta(record.severity);
  const statusMeta = getStatusMeta(record.status);

  return (
    <View style={[styles.recordCard, editing && styles.recordCardEditing]}>
      <View style={styles.recordTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordTitle}>{record.title}</Text>
          <Text style={styles.metaText}>
            {record.source ? `${record.source} | ` : ""}
            Saved by {record.reportedByName || "Admin"}
          </Text>
          <Text style={styles.metaText}>
            Incident date {formatDateTime(record.eventDate)} | Updated {formatDateTime(record.updatedAt)}
          </Text>
        </View>
        <StatusBadge label={record.status} meta={statusMeta} />
      </View>

      <View style={styles.badgeRow}>
        <Text
          style={[
            styles.inlineBadge,
            { backgroundColor: severityMeta.bg, color: severityMeta.fg },
          ]}
        >
          {record.severity}
        </Text>
        <Text style={styles.inlineBadgeNeutral}>{getCategoryLabel(record.category)}</Text>
      </View>

      <Text style={styles.recordNotes}>{record.notes}</Text>

      <AttachmentList
        title="Attachments"
        attachments={record.attachments || []}
        emptyText="No files attached."
        hideWhenEmpty
      />

      <View style={styles.cardActions}>
        <Pressable style={styles.actionButton} onPress={onEdit}>
          <MaterialIcons name="edit" size={16} color={colors.primary} />
          <Text style={styles.actionButtonText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#b91c1c" />
          ) : (
            <>
              <MaterialIcons name="delete-outline" size={16} color="#b91c1c" />
              <Text style={styles.actionButtonDangerText}>Delete</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 28, gap: 12 },
  hero: {
    backgroundColor: "#f4efe6",
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e8ddcb",
    padding: layout.cardPadding,
    gap: 10,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(107,56,212,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, lineHeight: 20 },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e8ddcb",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  infoPillText: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  explainCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
  },
  explainIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  explainText: { flex: 1, gap: 4 },
  explainTitle: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  explainBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    gap: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    gap: 10,
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: { color: colors.primary, fontSize: 20, fontWeight: "800", flex: 1 },
  sectionNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  subheading: { color: colors.primary, fontSize: 14, fontWeight: "800", marginTop: 4 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    minWidth: 145,
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { color: colors.primary, fontSize: 24, fontWeight: "800", marginTop: 12 },
  metricLabel: { color: colors.text, fontWeight: "700", marginTop: 2 },
  metricNote: { color: colors.textMuted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  stack: { gap: 10 },
  breakdownRow: { gap: 6 },
  breakdownHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  breakdownLabel: { color: colors.text, fontWeight: "700" },
  breakdownCount: { color: colors.primary, fontWeight: "800" },
  breakdownTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#edf0f5",
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 999,
  },
  timelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 8,
  },
  timelineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  timelineTitle: { color: colors.text, fontWeight: "800", flex: 1 },
  editingBadge: {
    borderRadius: 999,
    backgroundColor: "#ede9fe",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editingBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7dae0",
    backgroundColor: "#f7f8fb",
    paddingHorizontal: 14,
    color: colors.text,
  },
  textArea: { minHeight: 130, paddingVertical: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: {
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceChipActive: {
    borderColor: colors.secondary,
    backgroundColor: "#ede9fe",
  },
  choiceChipText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  choiceChipTextActive: { color: colors.primary },
  formActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  primaryButton: {
    flex: 1,
    minHeight: layout.touchTarget,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: {
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
  secondaryButtonText: { color: colors.textMuted, fontWeight: "800" },
  dimmed: { opacity: 0.75 },
  searchBox: {
    backgroundColor: colors.surface,
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    paddingHorizontal: 14,
    minHeight: layout.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text },
  filterGroup: { gap: 8 },
  filterLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  filterChip: {
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: "#e9ddff", borderColor: colors.secondary },
  filterChipText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: colors.primary },
  centerState: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 },
  centerText: { color: colors.textMuted, fontSize: 12 },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  inlineBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  inlineBadgeNeutral: {
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    color: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
  },
  metaText: { color: "#6b7280", fontSize: 12, fontWeight: "600", lineHeight: 18 },
  recordCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  recordCardEditing: {
    borderColor: colors.secondary,
    backgroundColor: "#faf5ff",
  },
  recordTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  recordTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  recordNotes: { color: colors.textMuted, lineHeight: 20 },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  actionButton: {
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
  actionButtonDanger: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  actionButtonText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  actionButtonDangerText: { color: "#b91c1c", fontWeight: "800", fontSize: 12 },
});
