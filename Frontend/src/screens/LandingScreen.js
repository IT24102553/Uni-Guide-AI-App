import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { colors, layout, type } from "../theme";

const roleCards = [
  {
    key: "student",
    icon: "school",
    eyebrow: "Students",
    title: "Get answers before a ticket becomes necessary",
    body:
      "Ask UniGuide AI, browse approved knowledge-base answers, and follow support requests from one calm student workspace.",
  },
  {
    key: "staff",
    icon: "support-agent",
    eyebrow: "Staff",
    title: "Work the queue with real context",
    body:
      "Assigned requests, updates, and reference answers stay connected so staff can respond faster without bouncing between screens.",
  },
  {
    key: "admin",
    icon: "admin-panel-settings",
    eyebrow: "Admin",
    title: "Keep operations structured and visible",
    body:
      "Announcements, users, tickets, analytics, and knowledge content sit in one operational flow built for campus oversight.",
  },
];

const journeySteps = [
  {
    icon: "chat",
    title: "Start with the question",
    body: "Students can ask naturally, read updates, or search approved answers before opening a request.",
  },
  {
    icon: "alt-route",
    title: "Route work to the right team",
    body: "When support is needed, the platform carries the context into the ticket flow instead of forcing the student to start over.",
  },
  {
    icon: "task-alt",
    title: "Resolve and close the loop",
    body: "Staff update the queue, students see progress, and admin keeps the whole support system aligned.",
  },
];

const proofPanels = [
  {
    icon: "bolt",
    value: "Faster",
    label: "Student-first answers",
  },
  {
    icon: "confirmation-number",
    value: "Structured",
    label: "Ticket handoff flow",
  },
  {
    icon: "visibility",
    value: "Clearer",
    label: "Staff and admin oversight",
  },
];

export function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  function openLogin() {
    navigation.navigate("Login");
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.main}>
          <AppBrandHeader
            style={styles.topBar}
            right={
              <Pressable style={styles.headerButton} onPress={openLogin}>
                <Text style={styles.headerButtonText}>Sign In</Text>
              </Pressable>
            }
          />

          <View style={styles.heroWrap}>
            <View style={styles.heroCard}>
              <View style={styles.heroOrbPrimary} />
              <View style={styles.heroOrbSecondary} />

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Campus Support Platform</Text>
              </View>

              <Text style={styles.heroTitle}>One smooth support flow for students, staff, and admin.</Text>
              <Text style={styles.heroBody}>
                UniGuide AI brings questions, ticket handling, announcements, and operational oversight into one
                connected experience built for university teams.
              </Text>

              <View style={styles.heroActions}>
                <Pressable style={styles.primaryButton} onPress={openLogin}>
                  <Text style={styles.primaryButtonText}>Open UniGuide AI</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={openLogin}>
                  <Text style={styles.secondaryButtonText}>Go to Portal</Text>
                </Pressable>
              </View>

              <View style={styles.heroStats}>
                {proofPanels.map((panel) => (
                  <View key={panel.label} style={styles.proofPanel}>
                    <View style={styles.proofIconWrap}>
                      <MaterialIcons name={panel.icon} size={18} color={colors.primary} />
                    </View>
                    <Text style={styles.proofValue}>{panel.value}</Text>
                    <Text style={styles.proofLabel}>{panel.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle
              eyebrow="Role-Based Workspaces"
              title="Each team gets the right view of the same support system"
              body="The product is organized by role, but the work stays connected from the first student question to the final resolution."
            />

            <View style={styles.stack}>
              {roleCards.map((card) => (
                <RoleCard
                  key={card.key}
                  icon={card.icon}
                  eyebrow={card.eyebrow}
                  title={card.title}
                  body={card.body}
                  onPress={openLogin}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle
              eyebrow="Support Journey"
              title="The flow stays simple even when the work is complex"
              body="Students do not need to guess where to go next, and support teams do not need to rebuild context at every handoff."
            />

            <View style={styles.stack}>
              {journeySteps.map((step, index) => (
                <JourneyCard
                  key={step.title}
                  index={index + 1}
                  icon={step.icon}
                  title={step.title}
                  body={step.body}
                />
              ))}
            </View>
          </View>

          <View style={styles.signalBand}>
            <Text style={styles.signalEyebrow}>What Changes</Text>
            <Text style={styles.signalTitle}>Less confusion for students. Better structure for teams.</Text>
            <Text style={styles.signalBody}>
              Instead of disconnected pages and demo-like paths, UniGuide AI is shaped around the real movement of
              campus support work.
            </Text>

            <View style={styles.signalGrid}>
              <SignalTile icon="forum" title="Ask and understand" note="Students start with answers, not friction." />
              <SignalTile icon="campaign" title="Stay updated" note="Announcements remain visible and relevant." />
              <SignalTile icon="manage-search" title="Track requests" note="Ticket progress is easier to follow." />
              <SignalTile icon="dashboard" title="Operate clearly" note="Staff and admin work from focused dashboards." />
            </View>
          </View>

          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Enter the platform with a cleaner starting point.</Text>
            <Text style={styles.ctaBody}>
              Sign in to continue into the role-based workspace for student support, staff response, or admin operations.
            </Text>
            <Pressable style={styles.primaryButton} onPress={openLogin}>
              <Text style={styles.primaryButtonText}>Continue to Login</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
          <Text style={styles.footerBrand}>UniGuide AI</Text>
          <Text style={styles.footerCopy}>© 2026 UniGuide AI. Structured campus support in one connected flow.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ eyebrow, title, body }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function RoleCard({ icon, eyebrow, title, body, onPress }) {
  return (
    <Pressable style={styles.roleCard} onPress={onPress}>
      <View style={styles.roleIconWrap}>
        <MaterialIcons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.roleEyebrow}>{eyebrow}</Text>
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleBody}>{body}</Text>
      <View style={styles.roleFooter}>
        <Text style={styles.roleAction}>Open workspace</Text>
        <MaterialIcons name="arrow-forward" size={16} color={colors.secondary} />
      </View>
    </Pressable>
  );
}

function JourneyCard({ index, icon, title, body }) {
  return (
    <View style={styles.journeyCard}>
      <View style={styles.journeyTopRow}>
        <View style={styles.journeyIndex}>
          <Text style={styles.journeyIndexText}>{index}</Text>
        </View>
        <View style={styles.journeyIconWrap}>
          <MaterialIcons name={icon} size={20} color={colors.primary} />
        </View>
      </View>
      <Text style={styles.journeyTitle}>{title}</Text>
      <Text style={styles.journeyBody}>{body}</Text>
    </View>
  );
}

function SignalTile({ icon, title, note }) {
  return (
    <View style={styles.signalTile}>
      <View style={styles.signalTileIcon}>
        <MaterialIcons name={icon} size={18} color={colors.secondary} />
      </View>
      <Text style={styles.signalTileTitle}>{title}</Text>
      <Text style={styles.signalTileNote}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "space-between" },
  main: {
    paddingBottom: 24,
    gap: 18,
  },
  topBar: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: 8,
  },
  headerButton: {
    minHeight: 40,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.secondary,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonText: {
    color: "white",
    fontWeight: "700",
  },
  heroWrap: {
    paddingHorizontal: layout.screenPadding,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: colors.primary,
    padding: layout.cardPadding,
    gap: 14,
    overflow: "hidden",
  },
  heroOrbPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -40,
    right: -30,
  },
  heroOrbSecondary: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(107,56,212,0.35)",
    bottom: -18,
    left: -12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: layout.pillRadius,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "white",
    fontSize: type.hero,
    fontWeight: "800",
    lineHeight: type.heroLine,
  },
  heroBody: {
    color: "#d9ddff",
    fontSize: type.body,
    lineHeight: 22,
    maxWidth: 620,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    minHeight: layout.touchTarget,
    backgroundColor: colors.secondary,
    borderRadius: layout.pillRadius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: {
    minHeight: layout.touchTarget,
    borderColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    borderRadius: layout.pillRadius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonText: { color: "white", fontWeight: "700" },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  proofPanel: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 12,
    gap: 6,
  },
  proofIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  proofValue: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  proofLabel: {
    color: "#d9ddff",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  section: {
    gap: 10,
  },
  sectionTitleWrap: {
    paddingHorizontal: layout.screenPadding,
    gap: 6,
  },
  sectionEyebrow: {
    fontSize: type.small,
    color: colors.secondary,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: type.h2,
    color: colors.primary,
    fontWeight: "800",
  },
  sectionBody: {
    fontSize: type.body,
    color: colors.textMuted,
    lineHeight: 21,
  },
  stack: {
    paddingHorizontal: layout.screenPadding,
    gap: 10,
  },
  roleCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: layout.compactPadding,
    gap: 8,
  },
  roleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  roleEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  roleTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  roleBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  roleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  roleAction: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  journeyCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: layout.compactPadding,
    gap: 8,
  },
  journeyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journeyIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyIndexText: {
    color: "white",
    fontWeight: "800",
  },
  journeyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  journeyTitle: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },
  journeyBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  signalBand: {
    marginTop: 4,
    backgroundColor: "#f0ecff",
    paddingHorizontal: layout.screenPadding,
    paddingVertical: 20,
    gap: 10,
  },
  signalEyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  signalTitle: {
    color: colors.primary,
    fontSize: type.h2,
    fontWeight: "800",
  },
  signalBody: {
    color: colors.textMuted,
    fontSize: type.body,
    lineHeight: 21,
  },
  signalGrid: {
    gap: 10,
    marginTop: 4,
  },
  signalTile: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e4def8",
  },
  signalTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f5f0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  signalTileTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  signalTileNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  ctaCard: {
    marginHorizontal: layout.screenPadding,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: "center",
    gap: 10,
  },
  ctaTitle: {
    color: colors.primary,
    fontSize: type.h2,
    fontWeight: "800",
    textAlign: "center",
  },
  ctaBody: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  footer: {
    marginTop: 12,
    backgroundColor: colors.footer,
    paddingTop: 18,
    paddingHorizontal: layout.screenPadding,
    gap: 6,
  },
  footerBrand: { color: "white", fontSize: 18, fontWeight: "700" },
  footerCopy: { color: "#cfd2ff", fontSize: 12, lineHeight: 18 },
});
