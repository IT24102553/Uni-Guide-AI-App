import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { requestPasswordReset, verifyPasswordResetOtp } from "../api/auth";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { colors, layout, type } from "../theme";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 120;

function formatCountdown(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function VerifyOtpScreen({ navigation, route }) {
  const [otp, setOtp] = useState(Array.from({ length: OTP_LENGTH }, () => ""));
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    route?.params?.deliveryMessage || "Enter the verification code sent to your email address."
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);
  const email = route?.params?.email || "";
  const code = useMemo(() => otp.join(""), [otp]);

  useEffect(() => {
    if (secondsLeft === 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  function updateDigit(value, index) {
    const sanitized = value.replace(/[^0-9]/g, "").slice(-1);

    setOtp((current) => {
      const next = [...current];
      next[index] = sanitized;
      return next;
    });

    if (sanitized && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(event, index) {
    if (event.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    if (!email) {
      setError("Start over from Forgot Password so a new code can be issued.");
      return;
    }

    try {
      setError("");
      setLoading(true);
      await verifyPasswordResetOtp(email, code);
      navigation.navigate("ResetPassword", { email, otp: code });
    } catch (requestError) {
      setError(requestError.message || "Unable to verify this code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email || secondsLeft > 0) {
      return;
    }

    try {
      setError("");
      setResending(true);

      const data = await requestPasswordReset(email);

      setOtp(Array.from({ length: OTP_LENGTH }, () => ""));
      setSecondsLeft(RESEND_SECONDS);
      setNotice(data.message || "A new verification code was sent to your email address.");
      inputRefs.current[0]?.focus();
    } catch (requestError) {
      setError(requestError.message || "Unable to resend the verification code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppBrandHeader style={styles.topBar} onBack={() => navigation.goBack()} />

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="mark-email-read" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>Enter the 6-digit reset code for</Text>
          <Text style={styles.email}>{email || "your university email"}</Text>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={`otp-${index}`}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(value) => updateDigit(value, index)}
                onKeyPress={(event) => handleKeyPress(event, index)}
                keyboardType="number-pad"
                maxLength={1}
                style={styles.otpInput}
                textAlign="center"
              />
            ))}
          </View>

          {notice ? (
            <View style={styles.noticeCard}>
              <MaterialIcons name="info-outline" size={16} color={colors.secondary} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <MaterialIcons name="error-outline" size={16} color="#ba1a1a" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, (code.length < OTP_LENGTH || loading) && styles.primaryBtnDisabled]}
            disabled={code.length < OTP_LENGTH || loading}
            onPress={handleVerify}
          >
            <Text style={styles.primaryBtnText}>{loading ? "Verifying..." : "Verify Code"}</Text>
          </Pressable>

          <View style={styles.timerRow}>
            <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
            <Text style={styles.timerText}>
              {secondsLeft > 0 ? `Resend code in ${formatCountdown(secondsLeft)}` : "You can request a new code now"}
            </Text>
          </View>

          <Pressable onPress={handleResend} disabled={secondsLeft > 0 || resending}>
            <Text style={[styles.resendLink, (secondsLeft > 0 || resending) && styles.resendDisabled]}>
              {resending ? "Sending..." : "Resend Code"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingBottom: 28, gap: layout.pageGap },
  topBar: { paddingTop: layout.notchClearance, paddingBottom: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding,
    alignItems: "center",
    gap: 8,
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
  title: { color: colors.primary, fontSize: type.h2, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  email: { color: colors.primary, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  otpRow: { flexDirection: "row", gap: 6, marginBottom: 10, width: "100%", justifyContent: "center" },
  otpInput: {
    width: 42,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#e0e3e5",
    color: colors.primary,
    fontSize: 20,
    fontWeight: "700",
  },
  noticeCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(107,56,212,0.08)",
    borderWidth: 1,
    borderColor: "rgba(107,56,212,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorCard: {
    width: "100%",
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
  errorText: {
    flex: 1,
    color: "#ba1a1a",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryBtn: {
    width: "100%",
    borderRadius: layout.pillRadius,
    paddingVertical: 14,
    backgroundColor: colors.secondary,
    alignItems: "center",
    marginTop: 2,
    minHeight: layout.touchTarget,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "white", fontWeight: "700" },
  timerRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 4 },
  timerText: { color: colors.textMuted, fontSize: 12 },
  resendLink: {
    color: colors.secondary,
    marginTop: 4,
    fontWeight: "700",
  },
  resendDisabled: {
    color: "#9a99a6",
  },
});
