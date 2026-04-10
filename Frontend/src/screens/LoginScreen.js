import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { loginUser } from "../api/auth";
import { AppBrandHeader } from "../components/AppBrandHeader";
import { PasswordField } from "../components/PasswordField";
import { useSession } from "../context/SessionContext";
import { colors, layout, type } from "../theme";

export function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { setSession } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter both your email and password.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const data = await loginUser({
        email: normalizedEmail,
        password,
      });

      let nextRoute = "";
      if (data.user.role === "student") {
        nextRoute = "StudentTabs";
      } else if (data.user.role === "staff") {
        nextRoute = "StaffTabs";
      } else if (data.user.role === "admin") {
        nextRoute = "AdminStack";
      } else {
        setError("This account does not have a supported role.");
        return;
      }

      setSession({
        token: data.token,
        user: data.user,
      });
      navigation.replace(nextRoute);
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.main}>
          <AppBrandHeader
            style={styles.topBar}
            right={
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={styles.back}>Back</Text>
              </Pressable>
            }
          />

          <View style={styles.heroWrap}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Secure Access</Text>
            </View>
            <Text style={styles.heroTitle}>Welcome back to UniGuide AI.</Text>
            <Text style={styles.heroBody}>
              Sign in to manage campus requests, student support, and staff operations from one streamlined workspace.
            </Text>
            <Image
              source={{
                uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCu0XxRo6YfGlYvLY2N9R0EsBUs-gAN7cV0JC0cwnIG6gU8DJVR7IzhWMPvaahk0SXf7v1psYNZF6nL9DLm8efF1axFXW_kB42RNB27ToHIZGPFL8_AtznYv799NOEYKqGYPxBgwRmx_beblzT8xqs7mu_O2M8R0eP9PnW2ZDefsDGEXcyUDOqA8qPaR7VP4VQdvNUOzCaIeCDI-7lpmzflWohptZ70SJzvC5Ux8pQPuXKue4Jxta7NpLctD2T9xYa9hucKlC9if0WY",
              }}
              style={styles.image}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.inputLabel}>University Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. scholar@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#777683"
              value={email}
              onChangeText={setEmail}
            />

            <View style={styles.rowBetween}>
              <Text style={styles.inputLabel}>Password</Text>
              <Pressable onPress={() => navigation.navigate("ForgotPassword", { email })}>
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            </View>

            <PasswordField
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
            />

            {error ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={16} color="#ba1a1a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.signIn, loading && styles.signInDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.signInText}>{loading ? "Signing In..." : "Sign In"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: 18 + insets.bottom }]}>
          <Text style={styles.footerBrand}>UniGuide AI</Text>
          <Text style={styles.footerCopy}>(c) 2024 UniGuide AI. Secure support for every campus channel.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  back: { color: colors.secondary, fontWeight: "700" },
  heroWrap: {
    paddingHorizontal: layout.screenPadding,
    gap: 10,
  },
  heroBadge: {
    alignSelf: "flex-start",
    borderRadius: layout.pillRadius,
    backgroundColor: "rgba(107,56,212,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: type.hero,
    color: colors.primary,
    fontWeight: "800",
    lineHeight: type.heroLine,
  },
  heroBody: {
    color: colors.textMuted,
    lineHeight: 22,
    fontSize: type.body,
  },
  image: {
    marginTop: 4,
    width: "100%",
    height: layout.imageHeight,
    borderRadius: layout.cardRadius,
  },
  card: {
    marginHorizontal: layout.screenPadding,
    padding: layout.cardPadding,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.outline,
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  inputLabel: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#e0e3e5",
    paddingHorizontal: 14,
    color: colors.text,
  },
  link: {
    color: colors.secondary,
    fontWeight: "700",
    fontSize: 12,
  },
  errorBanner: {
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
  signIn: {
    marginTop: 2,
    backgroundColor: colors.secondary,
    borderRadius: layout.pillRadius,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: layout.touchTarget,
  },
  signInText: { color: "white", fontWeight: "800", fontSize: 18 },
  signInDisabled: { opacity: 0.65 },
  footer: {
    marginTop: 8,
    backgroundColor: colors.footer,
    paddingTop: 18,
    paddingHorizontal: layout.screenPadding,
    gap: 6,
  },
  footerBrand: { color: "white", fontSize: 18, fontWeight: "700" },
  footerCopy: { color: "#cfd2ff", fontSize: 12, lineHeight: 18 },
});
