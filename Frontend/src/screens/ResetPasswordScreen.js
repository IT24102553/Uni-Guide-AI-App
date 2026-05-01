import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { resetUserPassword } from "../api/auth";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { PasswordField } from "../components/PasswordField";
import { colors, layout, type } from "../theme";

export function ResetPasswordScreen({ navigation, route }) {
  const email = route?.params?.email || "";
  const otp = route?.params?.otp || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      number: /\d/.test(password),
      match: password.length > 0 && password === confirmPassword,
    }),
    [confirmPassword, password]
  );

  const canSubmit =
    checks.length && checks.upper && checks.special && checks.number && checks.match && !!email && !!otp;

  async function handleReset() {
    if (!email || !otp) {
      setError("The reset session expired. Start the forgot-password flow again.");
      return;
    }

    try {
      setError("");
      setLoading(true);
      await resetUserPassword(email, otp, password);
      navigation.replace("Login");
    } catch (requestError) {
      setError(requestError.message || "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppBrandHeader style={styles.topBar} onBack={() => navigation.goBack()} />

        <View style={styles.card}>
          <Text style={styles.title}>Create a new password</Text>
          <Text style={styles.subtitle}>You are updating access for {email || "your account"}.</Text>

          <View style={styles.rulesCard}>
            <Text style={styles.rulesTitle}>Security Requirements</Text>
            <Requirement ok={checks.length} text="At least 8 characters" />
            <Requirement ok={checks.upper} text="One uppercase letter" />
            <Requirement ok={checks.special} text="One special character" />
            <Requirement ok={checks.number} text="One numeric value" />
            <Requirement ok={checks.match} text="Both password fields must match" />
          </View>

          <Text style={styles.label}>New Password</Text>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your new password"
          />

          <Text style={styles.label}>Confirm New Password</Text>
          <PasswordField
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your new password"
          />

          {error ? (
            <View style={styles.errorCard}>
              <MaterialIcons name="error-outline" size={16} color="#ba1a1a" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, (!canSubmit || loading) && styles.primaryBtnDisabled]}
            disabled={!canSubmit || loading}
            onPress={handleReset}
          >
            <Text style={styles.primaryBtnText}>{loading ? "Resetting..." : "Reset Password"}</Text>
            <MaterialIcons name="lock-open" size={18} color="white" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Requirement({ ok, text }) {
  return (
    <View style={styles.ruleRow}>
      <MaterialIcons
        name={ok ? "check-circle" : "radio-button-unchecked"}
        size={14}
        color={ok ? colors.secondary : "#9a99a6"}
      />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingBottom: 28 },
  topBar: { paddingTop: layout.notchClearance, paddingBottom: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    gap: 10,
  },
  title: { color: colors.primary, fontSize: type.h2, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  rulesCard: { backgroundColor: "#f2f4f6", borderRadius: 10, padding: 12, gap: 8, marginBottom: 6 },
  rulesTitle: { color: colors.primary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { color: colors.textMuted, fontSize: 12 },
  label: { color: colors.textMuted, fontWeight: "600", fontSize: 13, marginTop: 4 },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#ffebe9",
    borderWidth: 1,
    borderColor: "#ffcac3",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { flex: 1, color: "#ba1a1a", fontSize: 12, fontWeight: "600" },
  primaryBtn: {
    marginTop: 8,
    borderRadius: layout.pillRadius,
    paddingVertical: 14,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: layout.touchTarget,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "white", fontWeight: "700" },
});
