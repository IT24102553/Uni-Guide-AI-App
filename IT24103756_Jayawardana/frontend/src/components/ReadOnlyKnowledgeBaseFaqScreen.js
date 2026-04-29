import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "./AppBrandHeader";
import { fetchKnowledgeBaseFaqs } from "../api/knowledgeBase";
import { colors, layout, type } from "../theme";

function clean(value) {
  return String(value || "").trim();
}

function includesQuery(values, query) {
  const search = clean(query).toLowerCase();

  if (!search) {
    return true;
  }

  return values.some((value) => String(value || "").toLowerCase().includes(search));
}

export function ReadOnlyKnowledgeBaseFaqScreen({
  title = "Knowledge Base",
  subtitle = "Browse approved FAQ answers.",
}) {
  const [faqs, setFaqs] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadFaqs();
  }, []);

  async function loadFaqs(options = {}) {
    if (options.pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchKnowledgeBaseFaqs();
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "Unable to load FAQ entries right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredFaqs = faqs.filter((faq) =>
    includesQuery(
      [faq.category, faq.question, faq.answer, (faq.tags || []).join(" "), faq.authorName],
      query
    )
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadFaqs({ pullToRefresh: true })}
            tintColor={colors.secondary}
          />
        }
      >
        <AppBrandHeader style={styles.brandHeader} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color="#777683" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search FAQs, categories, or tags"
            placeholderTextColor="#777683"
          />
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={18} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={colors.secondary} />
            <Text style={styles.helperText}>Loading FAQs...</Text>
          </View>
        ) : filteredFaqs.length ? (
          <View style={styles.list}>
            {filteredFaqs.map((faq) => (
              <View key={faq._id} style={styles.faqCard}>
                <View style={styles.badgeRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{faq.category}</Text>
                  </View>
                  {(faq.tags || []).map((tag) => (
                    <View key={`${faq._id}-${tag}`} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.questionText}>{faq.question}</Text>
                <Text style={styles.answerText}>{faq.answer}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.centerState}>
            <MaterialIcons name="inbox" size={22} color="#8b8f99" />
            <Text style={styles.emptyTitle}>No FAQs found</Text>
            <Text style={styles.helperText}>
              Try a different search or add FAQ entries from the admin knowledge base.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  brandHeader: { marginBottom: 4 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 24,
    gap: 10,
  },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginBottom: 8, lineHeight: 20 },
  searchBox: {
    backgroundColor: "white",
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    paddingHorizontal: 12,
    minHeight: layout.touchTarget,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  searchInput: { flex: 1, color: colors.text },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { flex: 1, color: "#b91c1c", fontWeight: "700", lineHeight: 18 },
  centerState: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  helperText: { color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  list: { gap: 10 },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    gap: 10,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryBadge: {
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoryBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  tagBadge: {
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  questionText: { color: colors.text, fontSize: 16, fontWeight: "800" },
  answerText: { color: colors.textMuted, lineHeight: 22 },
});
