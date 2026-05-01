import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../../components/AdminShell";
import { AdminDashboardScreen } from "../AdminDashboardScreen";
import {
  adminModuleGroups,
  getAdminModulesByGroup,
  liveAdminWorkspaces,
  openAdminRoute,
  plannedAdminModules,
} from "../../navigation/adminModules";
import { AdminFeedbackScreen } from "../tickets/AdminFeedbackScreen";
import { AdminTicketAssignmentScreen } from "../tickets/AdminTicketAssignmentScreen";
import { colors, layout, type } from "../../theme";

export function AdminPortalScreen({ navigation }) {
  const liveGroups = adminModuleGroups.filter((group) => group.key !== "overview");

  return (
    <AdminShell navigation={navigation} currentRoute="AdminWorkspace">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Structured Flow</Text>
          </View>
          <Text style={styles.title}>Admin Workspace</Text>
          <Text style={styles.subtitle}>
            Every live admin tool is grouped by workflow so it is easier to move from daily support
            work to content updates and platform oversight.
          </Text>
          <View style={styles.heroMetaRow}>
            <MetaChip icon="apps" label={`${liveAdminWorkspaces.length} live modules`} />
            <MetaChip icon="schedule" label={`${plannedAdminModules.length} planned`} />
          </View>
          <Pressable style={styles.primaryButton} onPress={() => openAdminRoute(navigation, "AdminHome")}>
            <MaterialIcons name="dashboard" size={18} color="white" />
            <Text style={styles.primaryButtonText}>Back To Dashboard</Text>
          </Pressable>
        </View>

        {liveGroups.map((group) => {
          const items = getAdminModulesByGroup(group.key, { includePlanned: false });

          if (!items.length) {
            return null;
          }

          return (
            <View key={group.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{group.label}</Text>
              <Text style={styles.sectionSubtitle}>{group.description}</Text>
              <View style={styles.stack}>
                {items.map((item) => (
                  <ModuleCard
                    key={item.route}
                    item={item}
                    statusLabel="Live"
                    onPress={() => openAdminRoute(navigation, item.route)}
                  />
                ))}
              </View>
            </View>
          );
        })}

        {plannedAdminModules.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planned Workspace</Text>
            <Text style={styles.sectionSubtitle}>
              These areas are intentionally kept out of the main flow until they are backed by real
              data and actions.
            </Text>
            <View style={styles.stack}>
              {plannedAdminModules.map((item) => (
                <ModuleCard
                  key={item.route}
                  item={item}
                  statusLabel="Planned"
                  planned
                  onPress={() => openAdminRoute(navigation, item.route)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}

export function AdminHomeScreen({ navigation }) {
  return <AdminDashboardScreen navigation={navigation} />;
}

export function ChatMonitorScreen({ navigation }) {
  return (
    <AdminShell navigation={navigation} currentRoute="ChatMonitor">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroBadgePlanned}>
            <Text style={styles.heroBadgePlannedText}>Planned Module</Text>
          </View>
          <Text style={styles.title}>Chat Monitor</Text>
          <Text style={styles.subtitle}>
            This workspace is reserved for real-time conversation monitoring, moderation, and live
            escalation trails. It stays outside the main admin flow until those capabilities are
            fully connected.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Use These Live Tools For Now</Text>
          <Text style={styles.sectionSubtitle}>
            The current admin workflow already covers the practical parts of support operations.
          </Text>
          <View style={styles.stack}>
            <InlineAction
              icon="confirmation-number"
              label="Open Ticket Desk"
              note="Review ownership, status, and replies across support tickets."
              onPress={() => openAdminRoute(navigation, "AllTickets")}
            />
            <InlineAction
              icon="analytics"
              label="Review Analytics & Logs"
              note="Track incidents, audits, and platform signals from one place."
              onPress={() => openAdminRoute(navigation, "AnalyticsLogs")}
            />
            <InlineAction
              icon="reviews"
              label="Check Feedback"
              note="Read student ratings and service comments after ticket resolution."
              onPress={() => openAdminRoute(navigation, "Feedback")}
            />
          </View>
        </View>
      </ScrollView>
    </AdminShell>
  );
}

export function FeedbackScreen({ navigation }) {
  return <AdminFeedbackScreen navigation={navigation} />;
}

export function AllTicketsScreen({ navigation, route }) {
  return <AdminTicketAssignmentScreen navigation={navigation} route={route} />;
}

function ModuleCard({ item, statusLabel, onPress, planned = false }) {
  return (
    <Pressable style={[styles.card, planned && styles.cardPlanned]} onPress={onPress}>
      <View style={[styles.iconWrap, planned && styles.iconWrapPlanned]}>
        <MaterialIcons
          name={item.icon}
          size={22}
          color={planned ? "#8b5e00" : colors.primary}
        />
      </View>
      <View style={styles.cardTextWrap}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{item.label}</Text>
          <View style={[styles.statusPill, planned ? styles.statusPillPlanned : styles.statusPillLive]}>
            <Text style={[styles.statusPillText, planned && styles.statusPillTextPlanned]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text style={styles.cardNote}>{item.note}</Text>
      </View>
      <MaterialIcons name="arrow-forward" size={18} color={planned ? "#b27a00" : colors.secondary} />
    </Pressable>
  );
}

function MetaChip({ icon, label }) {
  return (
    <View style={styles.metaChip}>
      <MaterialIcons name={icon} size={14} color={colors.primary} />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function InlineAction({ icon, label, note, onPress }) {
  return (
    <Pressable style={styles.inlineAction} onPress={onPress}>
      <View style={styles.inlineActionIcon}>
        <MaterialIcons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.inlineActionText}>
        <Text style={styles.inlineActionLabel}>{label}</Text>
        <Text style={styles.inlineActionNote}>{note}</Text>
      </View>
      <MaterialIcons name="open-in-new" size={18} color={colors.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  hero: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.cardPadding,
    gap: 10,
  },
  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.pillRadius,
    backgroundColor: "#ece7ff",
  },
  heroBadgeText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroBadgePlanned: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.pillRadius,
    backgroundColor: "#fff4cc",
  },
  heroBadgePlannedText: {
    color: "#8b5e00",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.primary,
    fontSize: type.h2,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 20,
    fontSize: 14,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: layout.pillRadius,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  section: {
    gap: 8,
  },
  sectionCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.cardPadding,
    gap: 10,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: type.h3,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  stack: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
  },
  cardPlanned: {
    backgroundColor: "#fffdf5",
    borderColor: "#f3d58b",
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapPlanned: {
    backgroundColor: "#fff1c2",
  },
  cardTextWrap: {
    flex: 1,
    gap: 4,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  cardNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: layout.pillRadius,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillLive: {
    backgroundColor: "#eafaf0",
  },
  statusPillPlanned: {
    backgroundColor: "#fff1c2",
  },
  statusPillText: {
    color: "#0f8a43",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statusPillTextPlanned: {
    color: "#8b5e00",
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e0e3e5",
  },
  inlineActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineActionText: {
    flex: 1,
    gap: 4,
  },
  inlineActionLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  inlineActionNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
