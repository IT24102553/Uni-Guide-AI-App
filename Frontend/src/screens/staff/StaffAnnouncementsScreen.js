import { useEffect, useState } from "react";
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
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { subscribeRealtimeEvent } from "../../realtime/socket";
import { fetchAnnouncements } from "../../api/announcements";
import {
  formatAnnouncementDate,
  getAnnouncementAudienceMeta,
  getAnnouncementTypeMeta,
} from "../../announcements/utils";
import { AttachmentList } from "../tickets/TicketAttachmentSection";
import { colors, layout, type } from "../../theme";

export function StaffAnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  async function loadAnnouncements({ pullToRefresh = false, silent = false } = {}) {
    if (pullToRefresh) {
      setRefreshing(true);
    } else if (!silent && !hasLoaded) {
      setLoading(true);
    }

    try {
      const data = await fetchAnnouncements({ viewerRole: "staff" });
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load staff updates.");
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAnnouncements({ pullToRefresh: true })}
            tintColor={colors.secondary}
          />
        }
      >
        <AppBrandHeader
          style={styles.brandHeader}
          right={
            <Pressable style={styles.refreshButton} onPress={() => void loadAnnouncements()}>
              <MaterialIcons name="refresh" size={18} color={colors.primary} />
            </Pressable>
          }
        />

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Staff Updates</Text>
          </View>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.subtitle}>
            Review notices that apply to staff operations, service changes, and campus-wide updates.
          </Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.secondary} size="large" />
            <Text style={styles.helperText}>Loading staff updates...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialIcons name="error-outline" size={22} color="#b91c1c" />
            <Text style={styles.stateTitle}>Could not load announcements</Text>
            <Text style={styles.helperText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadAnnouncements()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialIcons name="campaign" size={22} color="#8b8f99" />
            <Text style={styles.stateTitle}>No active staff updates</Text>
            <Text style={styles.helperText}>
              New staff-facing notices will appear here as soon as the admin team publishes them.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {announcements.map((announcement) => (
              <AnnouncementCard key={announcement._id} announcement={announcement} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AnnouncementCard({ announcement }) {
  const typeMeta = getAnnouncementTypeMeta(announcement.type);
  const audienceMeta = getAnnouncementAudienceMeta(announcement.targetAudience);

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: typeMeta.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          {announcement.pinnedToTop ? (
            <View style={styles.pinnedBadge}>
              <MaterialIcons name="push-pin" size={14} color={colors.primary} />
              <Text style={styles.pinnedBadgeText}>Pinned</Text>
            </View>
          ) : null}

          <View style={[styles.typeBadge, { backgroundColor: typeMeta.softColor }]}>
            <View style={[styles.typeDot, { backgroundColor: typeMeta.color }]} />
            <Text style={[styles.typeBadgeText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
          </View>

          <View style={styles.audienceBadge}>
            <MaterialIcons name={audienceMeta.icon} size={14} color={colors.primary} />
            <Text style={styles.audienceBadgeText}>{audienceMeta.label}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{announcement.title}</Text>
        <Text style={styles.cardContent}>{announcement.content}</Text>
        <Text style={styles.cardMeta}>By {announcement.authorName || "Admin"}</Text>
        <Text style={styles.cardMeta}>Expires: {formatAnnouncementDate(announcement.expiryDate)}</Text>
        <AttachmentList
          title="Attachments"
          attachments={announcement.attachments || []}
          emptyText="No attachments."
          hideWhenEmpty
        />
      </View>
    </View>
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
    gap: 12,
  },
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
  heroCard: {
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: layout.cardPadding,
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ede9fe",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  heroBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  stateCard: {
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    backgroundColor: colors.surface,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: { color: colors.primary, fontSize: 16, fontWeight: "800", textAlign: "center" },
  helperText: { color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  retryButton: {
    marginTop: 2,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: { color: "white", fontWeight: "800", fontSize: 12 },
  listWrap: { gap: 10 },
  card: {
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardAccent: { height: 5 },
  cardBody: { padding: 14, gap: 10 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pinnedBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeDot: { width: 8, height: 8, borderRadius: 99 },
  typeBadgeText: { fontSize: 11, fontWeight: "800" },
  audienceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  audienceBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: "700" },
  cardTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  cardContent: { color: colors.textMuted, lineHeight: 20 },
  cardMeta: { color: colors.textMuted, fontSize: 12 },
});
