import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { requestPasswordReset } from "../api/auth";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { colors, layout, type } from "../theme";

export function ForgotPasswordScreen({ navigation, route }) {
  const [email, setEmail] = useState(route?.params?.email || "");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const isValidEmail = /\S+@\S+\.\S+/.test(normalizedEmail);

  async function handleContinue() {
    setTouched(true);

    if (!isValidEmail) {
      setError("Enter a valid university email address.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const data = await requestPasswordReset(normalizedEmail);

      navigation.navigate("VerifyOtp", {
        email: normalizedEmail,
        deliveryMessage: data.message || "Verification code sent to your email address.",
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to validate this account right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppBrandHeader style={styles.topBar} onBack={() => navigation.goBack()} />

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="lock-reset" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Recover your account</Text>
          <Text style={styles.subtitle}>
            We will validate your university email against the backend database before issuing a reset code.
          </Text>

          <Text style={styles.label}>University Email</Text>
          <TextInput
            style={[styles.input, touched && !isValidEmail && styles.inputError]}
            placeholder="name@university.edu"
            placeholderTextColor="#777683"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          {error ? (
            <View style={styles.alert}>
              <MaterialIcons name="error-outline" size={16} color="#ba1a1a" />
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, (!isValidEmail || loading) && styles.primaryBtnDisabled]}
            onPress={handleContinue}
            disabled={!isValidEmail || loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? "Checking Account..." : "Send Verification Code"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.infoPanel}>
          <MaterialIcons name="verified-user" size={18} color={colors.secondary} />
          <Text style={styles.infoText}>
            Reset codes expire after 10 minutes. Check your inbox and spam folder for the verification email.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingBottom: 28, gap: layout.pageGap },
  topBar: {
    paddingTop: layout.notchClearance,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    gap: 10,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#e9ddff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { color: colors.primary, fontSize: type.h2, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  label: { color: colors.textMuted, fontWeight: "600", fontSize: 13, marginTop: 4 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#e0e3e5",
    paddingHorizontal: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: { borderColor: "#ba1a1a" },
  alert: {
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
  alertText: { flex: 1, color: "#ba1a1a", fontSize: 12, fontWeight: "600" },
  primaryBtn: {
    marginTop: 8,
    borderRadius: layout.pillRadius,
    paddingVertical: 14,
    backgroundColor: colors.secondary,
    alignItems: "center",
    minHeight: layout.touchTarget,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "white", fontWeight: "700" },
  infoPanel: {
    backgroundColor: "rgba(54,51,134,0.08)",
    borderWidth: 1,
    borderColor: "rgba(54,51,134,0.2)",
    borderRadius: layout.cardRadius,
    padding: 12,
    gap: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
