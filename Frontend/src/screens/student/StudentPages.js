import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { ReadOnlyKnowledgeBaseFaqScreen } from "../../components/ReadOnlyKnowledgeBaseFaqScreen";
import { StudentMessagesNavigator } from "../../navigation/StudentMessagesNavigator";
import { StudentTicketCenterScreen } from "../tickets/StudentTicketCenterScreen";
import { colors, layout, type } from "../../theme";

export function StudentTicketsScreen() {
  return <StudentTicketCenterScreen />;
}

export function StudentMessagesScreen() {
  return <StudentMessagesNavigator />;
}

export function StudentKnowledgeBaseScreen() {
  return (
    <ReadOnlyKnowledgeBaseFaqScreen
      title="Knowledge Base"
      subtitle="Find official answers quickly from approved FAQ entries."
    />
  );
}

export function StudentProfileScreen({ navigation }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState({
    name: "Julian Carter",
    email: "student@test.com",
    phone: "+94 77 123 4567",
    studentId: "UG-2024-0921",
    faculty: "Engineering and Technology",
    program: "BSc Computer Science",
    year: "Year 3",
    advisor: "Dr. Mira Sen",
    campus: "Colombo Campus",
  });

  const updateProfile = (key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    setEditing(false);
    setNotice("Profile updated.");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppBrandHeader style={styles.brandHeader} />
      <View style={styles.profileTopRow}>
        <View>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your academic and contact details.</Text>
        </View>
        <Pressable
          style={[styles.smallActionBtn, editing && styles.smallActionBtnActive]}
          onPress={editing ? handleSave : () => setEditing(true)}
        >
          <Text style={[styles.smallActionText, editing && styles.smallActionTextActive]}>
            {editing ? "Save" : "Edit"}
          </Text>
        </Pressable>
      </View>

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.profileHeroCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>JC</Text>
        </View>
        <View style={styles.profileHeroText}>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileMeta}>
            {profile.program} - {profile.year}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>Student</Text>
          </View>
        </View>
      </View>

      <SectionLabel title="Personal Details" />
      <EditableField label="Full Name" value={profile.name} editing={editing} onChangeText={(value) => updateProfile("name", value)} />
      <EditableField label="Email" value={profile.email} editing={editing} keyboardType="email-address" onChangeText={(value) => updateProfile("email", value)} />
      <EditableField label="Phone" value={profile.phone} editing={editing} keyboardType="phone-pad" onChangeText={(value) => updateProfile("phone", value)} />

      <SectionLabel title="Academic Details" />
      <EditableField label="Student ID" value={profile.studentId} editing={editing} onChangeText={(value) => updateProfile("studentId", value)} />
      <EditableField label="Faculty" value={profile.faculty} editing={editing} onChangeText={(value) => updateProfile("faculty", value)} />
      <EditableField label="Program" value={profile.program} editing={editing} onChangeText={(value) => updateProfile("program", value)} />
      <EditableField label="Academic Year" value={profile.year} editing={editing} onChangeText={(value) => updateProfile("year", value)} />
      <EditableField label="Advisor" value={profile.advisor} editing={editing} onChangeText={(value) => updateProfile("advisor", value)} />
      <EditableField label="Campus" value={profile.campus} editing={editing} onChangeText={(value) => updateProfile("campus", value)} />

      <SectionLabel title="Security" />
      <Pressable style={styles.securityRow} onPress={() => navigation.getParent()?.navigate("ForgotPassword", { email: profile.email })}>
        <View style={styles.securityIcon}>
          <MaterialIcons name="lock-reset" size={18} color={colors.primary} />
        </View>
        <View style={styles.securityTextWrap}>
          <Text style={styles.securityTitle}>Change Password</Text>
          <Text style={styles.securityDesc}>Verify your email before setting a new password.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color="#8b8f99" />
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}

function TicketCard({ status, title, meta }) {
  return (
    <View style={styles.ticket}>
      <View style={styles.rowBetween}>
        <Text style={styles.ticketStatus}>{status}</Text>
        <Text style={styles.ticketMeta}>{meta}</Text>
      </View>
      <Text style={styles.ticketTitle}>{title}</Text>
    </View>
  );
}

function Bubble({ from, text, mine }) {
  return (
    <View style={[styles.bubble, mine && styles.myBubble]}>
      <Text style={[styles.bubbleFrom, mine && styles.myBubbleText]}>{from}</Text>
      <Text style={[styles.bubbleText, mine && styles.myBubbleText]}>{text}</Text>
    </View>
  );
}

function ProfileRow({ icon, label, value }) {
  return (
    <View style={styles.profileRow}>
      <MaterialIcons name={icon} size={18} color={colors.primary} />
      <View style={styles.profileRowText}>
        <Text style={styles.profileLabel}>{label}</Text>
        <Text style={styles.profileValue}>{value}</Text>
      </View>
    </View>
  );
}

function SectionLabel({ title }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function EditableField({ label, value, editing, onChangeText, keyboardType = "default" }) {
  return (
    <View style={styles.editField}>
      <Text style={styles.profileLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, !editing && styles.editInputLocked]}
        value={value}
        editable={editing}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#777683"
      />
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
    gap: 10,
  },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ticket: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#e0e3e5", padding: 12 },
  ticketStatus: { color: colors.secondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  ticketMeta: { color: "#8b8f99", fontSize: 11 },
  ticketTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 6 },
  primaryBtn: { marginTop: 10, backgroundColor: colors.secondary, borderRadius: layout.pillRadius, paddingVertical: 14, alignItems: "center", minHeight: layout.touchTarget },
  primaryBtnText: { color: "white", fontWeight: "700" },
  chatWrap: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.notchClearance,
    paddingBottom: layout.screenPadding,
    gap: 8,
  },
  bubble: { backgroundColor: "white", borderRadius: 14, padding: 10, maxWidth: "86%" },
  myBubble: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  bubbleFrom: { color: colors.secondary, fontWeight: "700", fontSize: 11, marginBottom: 2 },
  bubbleText: { color: colors.textMuted, lineHeight: 18 },
  myBubbleText: { color: "white" },
  chatInputRow: { padding: 12, borderTopWidth: 1, borderTopColor: "#e0e3e5", backgroundColor: "rgba(255,255,255,0.92)", flexDirection: "row", gap: 8 },
  chatInput: { flex: 1, backgroundColor: "white", borderRadius: layout.pillRadius, paddingHorizontal: 14, color: colors.text, minHeight: layout.touchTarget },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  profileCard: { backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, marginBottom: 4 },
  profileName: { color: colors.primary, fontSize: 21, fontWeight: "800" },
  profileMeta: { color: colors.textMuted, marginTop: 4 },
  profileRow: { backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: "#e0e3e5", padding: 12, flexDirection: "row", gap: 10, alignItems: "center" },
  profileRowText: { flex: 1 },
  profileLabel: { color: colors.textMuted, fontSize: 12 },
  profileValue: { color: colors.text, fontWeight: "700", marginTop: 2 },
  profileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  smallActionBtn: {
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 38,
  },
  smallActionBtnActive: { backgroundColor: colors.secondary },
  smallActionText: { color: colors.secondary, fontWeight: "700", fontSize: 12 },
  smallActionTextActive: { color: "white" },
  noticeText: {
    color: colors.secondary,
    backgroundColor: "rgba(107,56,212,0.09)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: "700",
    fontSize: 12,
  },
  profileHeroCard: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarLarge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "800", fontSize: 18 },
  profileHeroText: { flex: 1 },
  rolePill: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#e9ddff",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  sectionLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 8,
  },
  editField: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 12,
    gap: 6,
  },
  editInput: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#e0e3e5",
    color: colors.text,
    paddingHorizontal: 12,
    fontWeight: "700",
  },
  editInputLocked: { backgroundColor: "transparent", paddingHorizontal: 0 },
  securityRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  securityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  securityTextWrap: { flex: 1 },
  securityTitle: { color: colors.text, fontWeight: "800" },
  securityDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
