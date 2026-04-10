import { useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  createKnowledgeBaseFaq,
  deleteKnowledgeBaseDocument,
  deleteKnowledgeBaseFaq,
  fetchKnowledgeBaseDocuments,
  fetchKnowledgeBaseFaqs,
  resolveKnowledgeBaseDocumentUrl,
  updateKnowledgeBaseFaq,
  uploadKnowledgeBaseDocument,
} from "../../api/knowledgeBase";
import { colors, layout, type } from "../../theme";

const EMPTY_FAQ = { category: "", tags: "", question: "", answer: "" };
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const RAG_STATUS_POLL_MS = 5000;

function clean(value) {
  return String(value || "").trim();
}

function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatDate(value) {
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

function includesQuery(values, query) {
  const search = clean(query).toLowerCase();
  if (!search) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(search));
}

function statusMeta(status) {
  if (status === "indexed") return { label: "Indexed", bg: "#dcfce7", fg: "#166534" };
  if (status === "error") return { label: "Index Error", bg: "#fee2e2", fg: "#b91c1c" };
  return { label: "Pending RAG", bg: "#ede9fe", fg: colors.secondary };
}

export function KnowledgeBaseScreen({ navigation }) {
  const { currentUser } = useSession();
  const [activeTab, setActiveTab] = useState("faqs");
  const [faqs, setFaqs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [faqForm, setFaqForm] = useState({ ...EMPTY_FAQ });
  const [editingFaqId, setEditingFaqId] = useState("");
  const [faqQuery, setFaqQuery] = useState("");
  const [documentQuery, setDocumentQuery] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingFaqId, setDeletingFaqId] = useState("");
  const [deletingDocumentId, setDeletingDocumentId] = useState("");
  const pendingDocumentCount = documents.filter(
    (document) => String(document?.ragStatus || "").toLowerCase() === "pending"
  ).length;

  useEffect(() => {
    void loadKnowledgeBase();
  }, []);

  useEffect(() => {
    if (!pendingDocumentCount) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void loadKnowledgeBase({ keepFeedback: true, background: true });
    }, RAG_STATUS_POLL_MS);

    return () => clearTimeout(timer);
  }, [pendingDocumentCount, documents.length]);

  async function loadKnowledgeBase(options = {}) {
    if (options.background) {
      // Keep the current view stable while polling RAG status updates.
    } else if (options.pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [faqData, documentData] = await Promise.all([
        fetchKnowledgeBaseFaqs(),
        fetchKnowledgeBaseDocuments(),
      ]);

      setFaqs(Array.isArray(faqData.faqs) ? faqData.faqs : []);
      setDocuments(Array.isArray(documentData.documents) ? documentData.documents : []);

      if (!options.keepFeedback) {
        setFeedback(null);
      }
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to load the knowledge base right now." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function updateFaqField(key, value) {
    setFaqForm((current) => ({ ...current, [key]: value }));
  }

  function resetFaqForm() {
    setEditingFaqId("");
    setFaqForm({ ...EMPTY_FAQ });
  }

  async function submitFaq() {
    if (!clean(faqForm.category)) {
      setFeedback({ type: "error", message: "Category is required." });
      return;
    }

    if (!clean(faqForm.question)) {
      setFeedback({ type: "error", message: "Question is required." });
      return;
    }

    if (!clean(faqForm.answer)) {
      setFeedback({ type: "error", message: "Answer is required." });
      return;
    }

    try {
      setFaqSaving(true);
      const payload = {
        category: clean(faqForm.category),
        tags: faqForm.tags,
        question: clean(faqForm.question),
        answer: clean(faqForm.answer),
        authorName: currentUser?.name || "Admin",
      };

      if (editingFaqId) {
        await updateKnowledgeBaseFaq(editingFaqId, payload);
        setFeedback({ type: "success", message: "FAQ updated successfully." });
      } else {
        await createKnowledgeBaseFaq(payload);
        setFeedback({ type: "success", message: "FAQ added successfully." });
      }

      resetFaqForm();
      await loadKnowledgeBase({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to save the FAQ right now." });
    } finally {
      setFaqSaving(false);
    }
  }

  function startEditFaq(faq) {
    setActiveTab("faqs");
    setEditingFaqId(faq._id);
    setFaqForm({
      category: faq.category || "",
      tags: Array.isArray(faq.tags) ? faq.tags.join(", ") : "",
      question: faq.question || "",
      answer: faq.answer || "",
    });
    setFeedback({ type: "info", message: "Editing FAQ. Update the fields and save your changes." });
  }

  async function removeFaq(faq) {
    try {
      setDeletingFaqId(faq._id);
      await deleteKnowledgeBaseFaq(faq._id);
      if (editingFaqId === faq._id) resetFaqForm();
      setFeedback({ type: "success", message: "FAQ deleted successfully." });
      await loadKnowledgeBase({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to delete the FAQ right now." });
    } finally {
      setDeletingFaqId("");
    }
  }

  function confirmDeleteFaq(faq) {
    const message = `Delete "${faq.question}"?`;

    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(message)) void removeFaq(faq);
      return;
    }

    Alert.alert("Delete FAQ", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void removeFaq(faq) },
    ]);
  }

  async function uploadPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: "application/pdf",
        base64: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      if (Number(file.size || 0) > MAX_PDF_BYTES) {
        setFeedback({ type: "error", message: "The PDF must be 15MB or smaller." });
        return;
      }

      setUploadingDocument(true);
      await uploadKnowledgeBaseDocument({ uploadedByName: currentUser?.name || "Admin" }, file);
      setActiveTab("documents");
      setFeedback({
        type: "success",
        message: "PDF uploaded successfully. RAG indexing has started and the status will update after processing.",
      });
      await loadKnowledgeBase({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to upload the PDF right now." });
    } finally {
      setUploadingDocument(false);
    }
  }

  async function openDocument(document) {
    const url = resolveKnowledgeBaseDocumentUrl(document.downloadUrl);

    if (!url) {
      setFeedback({ type: "error", message: "Document URL is missing." });
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      setFeedback({ type: "error", message: "Unable to open the PDF document on this device." });
    }
  }

  async function removeDocument(document) {
    try {
      setDeletingDocumentId(document._id);
      await deleteKnowledgeBaseDocument(document._id);
      setFeedback({ type: "success", message: "PDF document deleted successfully." });
      await loadKnowledgeBase({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to delete the PDF right now." });
    } finally {
      setDeletingDocumentId("");
    }
  }

  function confirmDeleteDocument(document) {
    const message = `Delete "${document.originalName || document.title}"?`;

    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(message)) void removeDocument(document);
      return;
    }

    Alert.alert("Delete PDF", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void removeDocument(document) },
    ]);
  }

  const filteredFaqs = faqs.filter((faq) =>
    includesQuery([faq.category, faq.question, faq.answer, faq.authorName, (faq.tags || []).join(" ")], faqQuery)
  );
  const filteredDocuments = documents.filter((document) =>
    includesQuery([document.title, document.originalName, document.uploadedByName, document.ragStatus], documentQuery)
  );
  return (
    <AdminShell navigation={navigation} currentRoute="KnowledgeBase">
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadKnowledgeBase({ pullToRefresh: true, keepFeedback: true })}
              tintColor={colors.secondary}
            />
          }
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <MaterialIcons name="menu-book" size={24} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  Knowledge Base Management
                </Text>
                <Text style={styles.subtitle}>
                  Manage standard FAQs and PDF documents that feed the RAG system in chat.
                </Text>
              </View>
            </View>

            <View style={styles.stats}>
              <StatCard label="FAQs" value={faqs.length} />
              <StatCard label="PDFs" value={documents.length} />
            </View>
          </View>

          <View style={styles.tabs}>
            <TabChip label="Standard FAQs" icon="import-contacts" active={activeTab === "faqs"} onPress={() => setActiveTab("faqs")} />
            <TabChip label="PDF Documents (RAG)" icon="picture-as-pdf" active={activeTab === "documents"} onPress={() => setActiveTab("documents")} />
          </View>

          {feedback ? <Banner feedback={feedback} /> : null}

          {activeTab === "faqs" ? (
            <>
              <SearchBox value={faqQuery} onChangeText={setFaqQuery} placeholder="Search FAQs, categories, or tags" />

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{editingFaqId ? "Edit FAQ" : "Add FAQ"}</Text>
                <Text style={styles.cardNote}>No CSV import here. Add and manage knowledge directly in the app.</Text>

                <Label text="Category*" />
                <TextInput style={styles.input} value={faqForm.category} onChangeText={(value) => updateFaqField("category", value)} placeholder="e.g. Registration" placeholderTextColor="#8b8f99" />

                <Label text="Tags" />
                <TextInput style={styles.input} value={faqForm.tags} onChangeText={(value) => updateFaqField("tags", value)} placeholder="e.g. internship, forms, contacts" placeholderTextColor="#8b8f99" />

                <Label text="Question*" />
                <TextInput style={styles.input} value={faqForm.question} onChangeText={(value) => updateFaqField("question", value)} placeholder="Type the question students might ask" placeholderTextColor="#8b8f99" />

                <Label text="Answer*" />
                <TextInput style={[styles.input, styles.textArea]} value={faqForm.answer} onChangeText={(value) => updateFaqField("answer", value)} placeholder="Write the answer that belongs in the knowledge base" placeholderTextColor="#8b8f99" multiline textAlignVertical="top" />

                <View style={styles.row}>
                  <Pressable style={styles.secondaryButton} onPress={resetFaqForm} disabled={faqSaving}>
                    <Text style={styles.secondaryButtonText}>Clear</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryButton, faqSaving && styles.dimmed]} onPress={submitFaq} disabled={faqSaving}>
                    {faqSaving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.primaryButtonText}>{editingFaqId ? "Save FAQ" : "Add FAQ"}</Text>}
                  </Pressable>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>FAQ Library ({filteredFaqs.length})</Text>
                {loading ? (
                  <Loading label="Loading FAQs..." />
                ) : filteredFaqs.length ? (
                  <View style={styles.stack}>
                    {filteredFaqs.map((faq) => (
                      <View key={faq._id} style={[styles.itemCard, editingFaqId === faq._id && styles.itemCardActive]}>
                        <View style={styles.badgeRow}>
                          <Badge text={faq.category} tone="primary" />
                          {(faq.tags || []).map((tag) => <Badge key={`${faq._id}-${tag}`} text={tag} />)}
                        </View>
                        <Text style={styles.itemTitle}>{faq.question}</Text>
                        <Text style={styles.itemBody}>{faq.answer}</Text>
                        <Text style={styles.meta}>Updated {formatDate(faq.updatedAt)}</Text>
                        <View style={styles.row}>
                          <ActionButton icon="edit" label="Edit" onPress={() => startEditFaq(faq)} />
                          <ActionButton icon="delete-outline" label={deletingFaqId === faq._id ? "Deleting..." : "Delete"} danger onPress={() => confirmDeleteFaq(faq)} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Empty title="No FAQs found" body="Add your first FAQ or change the search text to see more results." />
                )}
              </View>
            </>
          ) : (
            <>
              <View style={[styles.card, styles.uploadCard]}>
                <Text style={styles.cardTitle}>RAG Document Storage</Text>
                <Text style={styles.uploadText}>
                  PDF files are stored in MongoDB GridFS instead of local disk, which fits Railway deployment much better and lets the app index them for RAG after upload.
                </Text>
                <Text style={styles.meta}>Accepted format: PDF up to 15MB.</Text>
                <Pressable style={[styles.primaryButton, uploadingDocument && styles.dimmed]} onPress={uploadPdf} disabled={uploadingDocument}>
                  {uploadingDocument ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.primaryButtonText}>Upload PDF</Text>}
                </Pressable>
              </View>

              <SearchBox value={documentQuery} onChangeText={setDocumentQuery} placeholder="Search PDF documents" />

              <View style={styles.card}>
                <Text style={styles.cardTitle}>PDF Documents ({filteredDocuments.length})</Text>
                {loading ? (
                  <Loading label="Loading documents..." />
                ) : filteredDocuments.length ? (
                  <View style={styles.stack}>
                    {filteredDocuments.map((document) => {
                      const meta = statusMeta(document.ragStatus);
                      return (
                        <View key={document._id} style={styles.itemCard}>
                          <View style={styles.documentHead}>
                            <View style={styles.pdfIcon}>
                              <MaterialIcons name="picture-as-pdf" size={22} color="#dc2626" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemTitle}>{document.originalName || document.title}</Text>
                              <Text style={styles.meta}>{formatSize(document.size)} | Updated {formatDate(document.updatedAt)}</Text>
                              {document.chunkCount ? <Text style={styles.meta}>Indexed chunks: {document.chunkCount}</Text> : null}
                              {document.lastIndexedAt ? <Text style={styles.meta}>Last indexed {formatDate(document.lastIndexedAt)}</Text> : null}
                              {document.indexError ? <Text style={styles.errorMeta}>{document.indexError}</Text> : null}
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                              <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
                            </View>
                          </View>
                          <View style={styles.row}>
                            <ActionButton icon="open-in-new" label="Open" onPress={() => openDocument(document)} />
                            <ActionButton icon="delete-outline" label={deletingDocumentId === document._id ? "Deleting..." : "Delete"} danger onPress={() => confirmDeleteDocument(document)} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Empty title="No PDF documents yet" body="Upload the first PDF that should later be indexed into your RAG knowledge base." />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </AdminShell>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabChip({ label, icon, active, onPress }) {
  return (
    <Pressable style={[styles.tabChip, active && styles.tabChipActive]} onPress={onPress}>
      <MaterialIcons name={icon} size={18} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
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

function SearchBox({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.searchBox}>
      <MaterialIcons name="search" size={18} color="#7c7f8d" />
      <TextInput style={styles.searchInput} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#7c7f8d" />
    </View>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Loading({ label }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={colors.secondary} />
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

function Empty({ title, body }) {
  return (
    <View style={styles.centerState}>
      <MaterialIcons name="inbox" size={22} color="#8b8f99" />
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={[styles.meta, { textAlign: "center" }]}>{body}</Text>
    </View>
  );
}

function Badge({ text, tone }) {
  return (
    <View style={[styles.badge, tone === "primary" && styles.badgePrimary]}>
      <Text style={[styles.badgeText, tone === "primary" && styles.badgeTextPrimary]}>{text}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress, danger = false }) {
  return (
    <Pressable style={[styles.actionButton, danger && styles.actionDanger]} onPress={onPress}>
      <MaterialIcons name={icon} size={16} color={danger ? "#b91c1c" : colors.primary} />
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 28, gap: 12 },
  hero: { backgroundColor: "#f4efe6", borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e8ddcb", padding: layout.cardPadding, gap: 14 },
  heroTop: { flexDirection: "column", gap: 10, alignItems: "flex-start" },
  heroIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(107,56,212,0.1)", alignItems: "center", justifyContent: "center" },
  title: { color: colors.primary, fontSize: 20, lineHeight: 26, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 20, maxWidth: 280 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { minWidth: 110, flexGrow: 1, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, borderWidth: 1, borderColor: "#eadfcd", padding: 12 },
  statValue: { color: colors.primary, fontSize: 24, fontWeight: "800" },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  tabs: { flexDirection: "row", gap: 8 },
  tabChip: { flex: 1, minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "white", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  tabChipActive: { backgroundColor: "#f2ebff", borderColor: colors.secondary },
  tabText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 },
  tabTextActive: { color: colors.primary },
  banner: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  searchBox: { backgroundColor: colors.surface, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: "#e0e3e5", paddingHorizontal: 14, minHeight: layout.touchTarget, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 10 },
  uploadCard: { backgroundColor: "#eef2ff", borderColor: "#d8defc" },
  cardTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  cardNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  uploadText: { color: colors.secondary, lineHeight: 22 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#d7dae0", backgroundColor: "#f7f8fb", paddingHorizontal: 14, color: colors.text },
  textArea: { minHeight: 130, paddingVertical: 12 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  primaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, flexGrow: 1 },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { minWidth: 104, minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "white" },
  secondaryButtonText: { color: colors.textMuted, fontWeight: "800" },
  dimmed: { opacity: 0.7 },
  stack: { gap: 10 },
  itemCard: { borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#ffffff", padding: 14, gap: 10 },
  itemCardActive: { borderColor: colors.secondary, backgroundColor: "#faf5ff" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 999, backgroundColor: "#f3f4f6", paddingHorizontal: 10, paddingVertical: 5 },
  badgePrimary: { backgroundColor: "#eef2ff" },
  badgeText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  badgeTextPrimary: { color: colors.primary, fontWeight: "800" },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  itemBody: { color: colors.textMuted, lineHeight: 20 },
  meta: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  errorMeta: { color: "#b91c1c", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: "#d7dae0", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f8fafc" },
  actionDanger: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  actionText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  actionTextDanger: { color: "#b91c1c" },
  centerState: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 8 },
  documentHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  pdfIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 11, fontWeight: "800" },
});
