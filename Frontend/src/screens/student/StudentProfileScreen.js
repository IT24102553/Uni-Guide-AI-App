import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { AppBrandHeader } from "../../components/AppBrandHeader";
import { PasswordField } from "../../components/PasswordField";
import { useSession } from "../../context/SessionContext";
import {
  fetchUserProfile,
  resolveUserFileUrl,
  updateUserProfile,
  uploadUserProfilePhoto,
} from "../../api/users";
import { colors, layout, type } from "../../theme";

const PHONE_PATTERN = /^0\d{9}$/;
const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;
const PROFILE_PHOTO_MIME_TYPES = ["image/jpeg", "image/png"];

function hasStrongPassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function getStudentRegistration(profile) {
  return profile?.registrationNumber || profile?.studentId || "";
}

function getDisplayValue(value) {
  const text = String(value || "").trim();
  return text || "Not available";
}

export function StudentProfileScreen() {
  const { currentUser, setCurrentUser } = useSession();
  const [profileUser, setProfileUser] = useState(currentUser);
  const [studentProfile, setStudentProfile] = useState(currentUser?.studentProfile || {});
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!currentUser?._id || currentUser.role !== "student") {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        const data = await fetchUserProfile(currentUser._id);

        if (!active) {
          return;
        }

        setProfileUser(data.user);
        setStudentProfile(data.profile || data.user?.studentProfile || {});
        setPhone(data.user?.phone || "");
        setCurrentUser(data.user);
        setFeedback(null);
      } catch (error) {
        if (!active) {
          return;
        }

        setFeedback({
          type: "error",
          message: error.message || "Unable to load your profile right now.",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [currentUser?._id, currentUser?.role, setCurrentUser]);

  const avatarUri = useMemo(
    () => resolveUserFileUrl(profileUser?.profilePhoto?.url),
    [profileUser?.profilePhoto?.url]
  );

  if (!currentUser || currentUser.role !== "student") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <AppBrandHeader style={styles.brandHeader} />
          <EmptyState
            title="Sign in as a student"
            body="The student profile becomes available after logging in with a student account."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const initials = String(profileUser?.name || currentUser?.name || "Student")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function cancelEditing() {
    setEditing(false);
    setPhone(profileUser?.phone || "");
    setPassword("");
    setConfirmPassword("");
    setFeedback(null);
  }

  async function saveProfile() {
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    const payload = {};

    if (!trimmedPhone) {
      setFeedback({ type: "error", message: "Contact number is required." });
      return;
    }

    if (!PHONE_PATTERN.test(trimmedPhone)) {
      setFeedback({
        type: "error",
        message: "Contact number must be in the format 07XXXXXXXX.",
      });
      return;
    }

    if (trimmedPassword || trimmedConfirmPassword) {
      if (!trimmedPassword) {
        setFeedback({ type: "error", message: "Enter the new password." });
        return;
      }

      if (!hasStrongPassword(trimmedPassword)) {
        setFeedback({
          type: "error",
          message:
            "Password must be at least 8 characters and include uppercase, number, and special character.",
        });
        return;
      }

      if (trimmedPassword !== trimmedConfirmPassword) {
        setFeedback({ type: "error", message: "New password and confirm password must match." });
        return;
      }

      payload.password = trimmedPassword;
    }

    if (trimmedPhone !== String(profileUser?.phone || "").trim()) {
      payload.phone = trimmedPhone;
    }

    if (!Object.keys(payload).length) {
      setFeedback({ type: "success", message: "There are no changes to save." });
      setEditing(false);
      return;
    }

    try {
      setSaving(true);
      const data = await updateUserProfile(currentUser._id, payload);
      setProfileUser(data.user);
      setStudentProfile(data.user?.studentProfile || studentProfile);
      setPhone(data.user?.phone || "");
      setPassword("");
      setConfirmPassword("");
      setCurrentUser(data.user);
      setEditing(false);
      setFeedback({ type: "success", message: "Your profile was updated successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to update your profile right now.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleProfilePhotoPick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: PROFILE_PHOTO_MIME_TYPES,
        base64: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const size = Number(asset?.size || 0);

      if (size && size > MAX_PROFILE_PHOTO_BYTES) {
        setFeedback({
          type: "error",
          message: "Profile photo must be 3MB or smaller.",
        });
        return;
      }

      setUploadingPhoto(true);
      const data = await uploadUserProfilePhoto(currentUser._id, asset);
      setProfileUser(data.user);
      setStudentProfile(data.user?.studentProfile || studentProfile);
      setPhone(data.user?.phone || phone);
      setCurrentUser(data.user);
      setFeedback({ type: "success", message: "Profile photo updated successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "Unable to upload the profile photo right now.",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <AppBrandHeader style={styles.brandHeader} />

        <View style={styles.profileTopRow}>
          <View style={styles.profileTopText}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>
              Students can update only their contact number, password, and profile photo.
            </Text>
          </View>
          <View style={styles.topActions}>
            {editing ? (
              <Pressable
                style={[styles.smallActionBtn, styles.cancelActionBtn]}
                onPress={cancelEditing}
                disabled={saving}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.smallActionBtn, editing && styles.smallActionBtnActive, saving && styles.disabled]}
              onPress={editing ? () => void saveProfile() : () => setEditing(true)}
              disabled={saving || loading}
            >
              <Text style={[styles.smallActionText, editing && styles.smallActionTextActive]}>
                {saving ? "Saving..." : editing ? "Save" : "Edit"}
              </Text>
            </Pressable>
          </View>
        </View>

        {feedback ? <FeedbackBanner feedback={feedback} /> : null}

        <View style={styles.profileHeroCard}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.profileHeroText}>
            <Text style={styles.profileName}>{getDisplayValue(profileUser?.name)}</Text>
            <Text style={styles.profileMeta}>
              {getDisplayValue(studentProfile?.specialization)} | {getDisplayValue(studentProfile?.academicYear)}
            </Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>Student</Text>
            </View>
          </View>
          <Pressable
            style={[styles.photoUploadButton, uploadingPhoto && styles.disabled]}
            onPress={() => void handleProfilePhotoPick()}
            disabled={uploadingPhoto || loading}
          >
            <MaterialIcons name="photo-camera" size={18} color={colors.secondary} />
            <Text style={styles.photoUploadText}>{uploadingPhoto ? "Uploading..." : "Upload Photo"}</Text>
          </Pressable>
        </View>

        {loading ? (
          <EmptyState title="Loading profile..." body="Fetching your latest student profile details." />
        ) : (
          <>
            <SectionLabel title="Personal Details" />
            <ReadOnlyField label="Full Name" value={getDisplayValue(profileUser?.name)} />
            <ReadOnlyField label="Email Address" value={getDisplayValue(profileUser?.email)} />
            <EditableField
              label="Contact No."
              value={phone}
              editing={editing}
              alwaysEditable
              keyboardType="phone-pad"
              placeholder="07XXXXXXXX"
              helperText={editing ? "This is the only personal detail students can update here." : ""}
              onFocus={() => {
                if (!editing) {
                  setEditing(true);
                }
              }}
              onChangeText={setPhone}
            />

            <SectionLabel title="Student Details" />
            <ReadOnlyField label="Registration Number" value={getDisplayValue(getStudentRegistration(studentProfile))} />
            <ReadOnlyField label="Department" value={getDisplayValue(studentProfile?.department)} />
            <ReadOnlyField label="Specialization" value={getDisplayValue(studentProfile?.specialization)} />
            <ReadOnlyField label="Academic Year" value={getDisplayValue(studentProfile?.academicYear || studentProfile?.year)} />
            <ReadOnlyField label="Semester" value={getDisplayValue(studentProfile?.semester)} />
            <ReadOnlyField label="Address" value={getDisplayValue(studentProfile?.address)} multiline />
            <ReadOnlyField label="NIC" value={getDisplayValue(studentProfile?.nic)} />

            <SectionLabel title="Security" />
            <View style={styles.securityCard}>
              <View style={styles.securityHeader}>
                <View style={styles.securityIcon}>
                  <MaterialIcons name="lock-reset" size={18} color={colors.primary} />
                </View>
                <View style={styles.securityTextWrap}>
                  <Text style={styles.securityTitle}>Update Password</Text>
                  <Text style={styles.securityDesc}>
                    {editing
                      ? "Enter a new password only if you want to change it."
                      : "Tap Edit to change your contact number or password."}
                  </Text>
                </View>
              </View>

              <PasswordFieldRow
                label="New Password"
                value={password}
                editable={editing}
                alwaysEditable
                placeholder="Enter a new password"
                helperText="At least 8 characters with uppercase, number, and special character."
                onFocus={() => {
                  if (!editing) {
                    setEditing(true);
                  }
                }}
                onChangeText={setPassword}
              />
              <PasswordFieldRow
                label="Confirm Password"
                value={confirmPassword}
                editable={editing}
                alwaysEditable
                placeholder="Confirm the new password"
                onFocus={() => {
                  if (!editing) {
                    setEditing(true);
                  }
                }}
                onChangeText={setConfirmPassword}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedbackBanner({ feedback }) {
  const error = feedback.type === "error";

  return (
    <View style={[styles.banner, error ? styles.bannerError : styles.bannerSuccess]}>
      <MaterialIcons
        name={error ? "error-outline" : "check-circle-outline"}
        size={16}
        color={error ? "#b42318" : "#166534"}
      />
      <Text style={[styles.bannerText, error ? styles.bannerErrorText : styles.bannerSuccessText]}>
        {feedback.message}
      </Text>
    </View>
  );
}

function EmptyState({ title, body }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function SectionLabel({ title }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function ReadOnlyField({ label, value, multiline = false }) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text
        style={[styles.readOnlyValue, multiline && styles.readOnlyValueMultiline]}
        numberOfLines={multiline ? undefined : 2}
      >
        {value}
      </Text>
    </View>
  );
}

function EditableField({
  label,
  value,
  editing,
  onChangeText,
  keyboardType = "default",
  placeholder = "",
  helperText = "",
  alwaysEditable = false,
  onFocus,
}) {
  const inputEditable = editing || alwaysEditable;

  return (
    <View style={styles.fieldCard}>
      <Text style={styles.profileLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, !inputEditable && styles.editInputLocked]}
        value={value}
        editable={inputEditable}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#777683"
        onFocus={onFocus}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

function PasswordFieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  editable,
  helperText = "",
  alwaysEditable = false,
  onFocus,
}) {
  const inputEditable = editable || alwaysEditable;

  return (
    <View style={styles.passwordFieldWrap}>
      <Text style={styles.profileLabel}>{label}</Text>
      <PasswordField
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={inputEditable}
        onFocus={onFocus}
        containerStyle={!inputEditable ? styles.passwordFieldLocked : undefined}
        inputStyle={!inputEditable ? styles.passwordInputLocked : undefined}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
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
  subtitle: { color: colors.textMuted, marginBottom: 8, lineHeight: 20 },
  profileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  profileTopText: {
    flex: 1,
    minWidth: 0,
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 0,
    justifyContent: "flex-end",
  },
  smallActionBtn: {
    borderRadius: layout.pillRadius,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 38,
    backgroundColor: colors.surface,
  },
  cancelActionBtn: {
    borderColor: colors.outline,
  },
  smallActionBtnActive: { backgroundColor: colors.secondary },
  smallActionText: { color: colors.secondary, fontWeight: "700", fontSize: 12 },
  smallActionTextActive: { color: "white" },
  cancelActionText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerSuccess: { backgroundColor: "#ecfdf3", borderColor: "#b7ebc6" },
  bannerError: { backgroundColor: "#fff1f3", borderColor: "#fecdd3" },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700" },
  bannerSuccessText: { color: "#166534" },
  bannerErrorText: { color: "#b42318" },
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#d9dde3",
  },
  avatarText: { color: "white", fontWeight: "800", fontSize: 20 },
  profileHeroText: { flex: 1 },
  profileName: { color: colors.primary, fontSize: 21, fontWeight: "800" },
  profileMeta: { color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  rolePill: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#e9ddff",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  photoUploadButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8b4fe",
    backgroundColor: "#faf5ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 100,
  },
  photoUploadText: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  sectionLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 8,
  },
  fieldCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 12,
    gap: 6,
  },
  profileLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  readOnlyValue: { color: colors.text, fontWeight: "700", lineHeight: 20 },
  readOnlyValueMultiline: { minHeight: 42 },
  editInput: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#e0e3e5",
    color: colors.text,
    paddingHorizontal: 12,
    fontWeight: "700",
  },
  editInputLocked: { backgroundColor: "transparent", paddingHorizontal: 0 },
  helperText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  securityCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 12,
    gap: 12,
  },
  securityHeader: {
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
  securityDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 18 },
  passwordFieldWrap: { gap: 6 },
  passwordFieldLocked: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e0e3e5",
  },
  passwordInputLocked: {
    color: "#777683",
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: "#e0e3e5",
    padding: 18,
    gap: 6,
  },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, lineHeight: 20 },
  disabled: { opacity: 0.6 },
});
