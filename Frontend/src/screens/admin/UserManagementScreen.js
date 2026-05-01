import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminShell } from "../../components/AdminShell";
import { PasswordField } from "../../components/PasswordField";
import {
  createUserAccount,
  deleteUserAccount,
  fetchUsers,
  updateUserAccount,
  updateUserAccountStatus,
} from "../../api/users";
import { colors, layout, type } from "../../theme";

const STAFF_DEPARTMENTS = ["Student Services", "Examinations", "IT Support", "Library", "Finance"];
const ACADEMIC_YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];
const SEMESTERS = ["Semester 1", "Semester 2"];
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const PHONE_PATTERN = /^0\d{9}$/;
const NIC_PATTERN = /^(?:\d{12}|\d{9}[VvXx])$/;

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function hasFirstAndLastName(name) {
  return normalizeName(name).split(" ").filter(Boolean).length >= 2;
}

function isStrongPassword(password) {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function emptyForm(role = "student") {
  return {
    role,
    status: "active",
    name: "",
    email: "",
    password: "",
    phone: "",
    studentProfile: {
      registrationNumber: "",
      department: "",
      specialization: "",
      academicYear: "",
      semester: "",
      address: "",
      nic: "",
    },
    staffProfile: { department: "" },
  };
}

function userId(user) {
  return user?._id || user?.id || "";
}

function studentProfile(user) {
  return user?.studentProfile || {};
}

function staffProfile(user) {
  return user?.staffProfile || {};
}

function buildPayload(form, editingId) {
  const payload = {
    name: normalizeName(form.name),
    email: form.email.trim().toLowerCase(),
    role: form.role,
    status: form.status,
    phone: form.phone.trim(),
  };
  const password = form.password.trim();

  if (!editingId || password) {
    payload.password = password;
  }

  if (form.role === "student") {
    const registrationNumber = form.studentProfile.registrationNumber.trim();
    const academicYear = form.studentProfile.academicYear.trim();

    payload.studentProfile = {
      registrationNumber,
      studentId: registrationNumber,
      department: form.studentProfile.department.trim(),
      specialization: form.studentProfile.specialization.trim(),
      academicYear,
      year: academicYear,
      semester: form.studentProfile.semester.trim(),
      address: form.studentProfile.address.trim(),
      nic: form.studentProfile.nic.trim(),
    };
  }

  if (form.role === "staff") {
    payload.staffProfile = {
      department: form.staffProfile.department.trim(),
    };
  }

  return payload;
}

function validateForm(form, editingId) {
  const name = normalizeName(form.name);
  const email = form.email.trim().toLowerCase();
  const phone = form.phone.trim();
  const password = form.password.trim();

  if (!name) return "Full name is required.";
  if ((form.role === "student" || form.role === "staff") && !hasFirstAndLastName(name)) return "Enter both first name and last name.";
  if (!email) return "Email address is required.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  if ((form.role === "student" || form.role === "staff") && !phone) return "Contact number is required.";
  if (phone && !PHONE_PATTERN.test(phone)) return "Contact number must be in the format 07XXXXXXXX.";
  if (!editingId && !password) return "Password is required.";
  if (password && !isStrongPassword(password)) return "Password must be at least 8 characters and include uppercase, number, and special character.";

  if (form.role === "student") {
    if (!form.studentProfile.registrationNumber.trim()) return "Registration number is required.";
    if (!form.studentProfile.department.trim()) return "Student department is required.";
    if (!form.studentProfile.specialization.trim()) return "Specialization is required.";
    if (!form.studentProfile.academicYear.trim()) return "Academic year is required.";
    if (!form.studentProfile.semester.trim()) return "Semester is required.";
    if (!form.studentProfile.address.trim()) return "Address is required.";
    if (!form.studentProfile.nic.trim()) return "NIC is required.";
    if (!NIC_PATTERN.test(form.studentProfile.nic.trim())) return "NIC must be 12 digits or 9 digits followed by V/X.";
  }

  if (form.role === "staff" && !form.staffProfile.department.trim()) {
    return "Staff department is required.";
  }

  return "";
}

function matchesSearch(user, query) {
  const search = query.trim().toLowerCase();
  const student = studentProfile(user);
  const staff = staffProfile(user);

  if (!search) return true;

  return [
    user.name,
    user.email,
    user.role,
    user.phone,
    student.registrationNumber || student.studentId,
    student.department,
    student.specialization,
    student.nic,
    staff.department,
  ].some((value) => String(value || "").toLowerCase().includes(search));
}

function detailLines(user) {
  const student = studentProfile(user);
  const staff = staffProfile(user);

  if (user.role === "student") {
    return [
      student.registrationNumber || student.studentId ? `Registration: ${student.registrationNumber || student.studentId}` : null,
      student.department ? `Department: ${student.department}` : null,
      student.specialization ? `Specialization: ${student.specialization}` : null,
      student.academicYear || student.semester ? [student.academicYear, student.semester].filter(Boolean).join(" | ") : null,
      user.phone ? `Contact: ${user.phone}` : null,
      student.nic ? `NIC: ${student.nic}` : null,
    ].filter(Boolean);
  }

  if (user.role === "staff") {
    return [staff.department ? `Department: ${staff.department}` : null, user.phone ? `Contact: ${user.phone}` : null].filter(Boolean);
  }

  return [user.phone ? `Contact: ${user.phone}` : "System administrator"];
}

export function UserManagementScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState("");
  const [deleteBusyId, setDeleteBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [openSelect, setOpenSelect] = useState("");
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers(options = {}) {
    try {
      setLoading(true);
      const data = await fetchUsers();
      setUsers(Array.isArray(data.users) ? data.users : []);
      if (!options.keepFeedback) setFeedback(null);
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to load users right now." });
    } finally {
      setLoading(false);
    }
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProfile(section, key, value) {
    setForm((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  }

  function changeRole(role) {
    setOpenSelect("");
    updateField("role", role);
  }

  function resetForm(role = "student") {
    setEditingId("");
    setOpenSelect("");
    setForm(emptyForm(role));
  }

  function startEdit(user) {
    const student = studentProfile(user);
    const staff = staffProfile(user);

    setEditingId(userId(user));
    setOpenSelect("");
    setForm({
      role: user.role || "student",
      status: user.status || "active",
      name: user.name || "",
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      studentProfile: {
        registrationNumber: student.registrationNumber || student.studentId || "",
        department: student.department || "",
        specialization: student.specialization || "",
        academicYear: student.academicYear || student.year || "",
        semester: student.semester || "",
        address: student.address || "",
        nic: student.nic || "",
      },
      staffProfile: { department: staff.department || "" },
    });
  }

  async function submit() {
    const errorMessage = validateForm(form, editingId);
    if (errorMessage) {
      setFeedback({ type: "error", message: errorMessage });
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload(form, editingId);

      if (editingId) {
        await updateUserAccount(editingId, payload);
        setFeedback({ type: "success", message: "User account updated successfully." });
      } else {
        await createUserAccount(payload);
        setFeedback({ type: "success", message: `${form.role === "staff" ? "Staff" : "Student"} account created successfully.` });
      }

      resetForm(form.role === "admin" ? "student" : form.role);
      await loadUsers({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to save the user account." });
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user) {
    try {
      const id = userId(user);
      setDeleteBusyId(id);
      await deleteUserAccount(id);
      if (editingId === id) resetForm();
      setFeedback({ type: "success", message: "User account deleted successfully." });
      await loadUsers({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to delete the user account." });
    } finally {
      setDeleteBusyId("");
    }
  }

  function confirmDelete(user) {
    const message = `Delete ${user.name}? This action cannot be undone.`;

    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(message)) void removeUser(user);
      return;
    }

    Alert.alert("Delete User", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void removeUser(user) },
    ]);
  }

  async function toggleStatus(user) {
    const id = userId(user);
    const nextStatus = user.status === "active" ? "inactive" : "active";

    try {
      setStatusBusyId(id);
      await updateUserAccountStatus(id, nextStatus);
      if (editingId === id) updateField("status", nextStatus);
      setFeedback({ type: "success", message: `${user.name} is now ${nextStatus}.` });
      await loadUsers({ keepFeedback: true });
    } catch (error) {
      setFeedback({ type: "error", message: error.message || "Unable to update the account status." });
    } finally {
      setStatusBusyId("");
    }
  }

  const filteredUsers = users.filter((user) => (filter === "all" || user.role === filter) && matchesSearch(user, query));
  const showAdminOption = Boolean(editingId && form.role === "admin");
  const studentCount = users.filter((user) => user.role === "student").length;
  const staffCount = users.filter((user) => user.role === "staff").length;
  const adminCount = users.filter((user) => user.role === "admin").length;

  return (
    <AdminShell navigation={navigation} currentRoute="UserManagement">
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>Admin creates and maintains all student and staff accounts from here.</Text>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total Users" value={users.length} />
          <SummaryCard label="Students" value={studentCount} />
          <SummaryCard label="Staff" value={staffCount} />
          <SummaryCard label="Admins" value={adminCount} />
        </View>

        {feedback ? <Banner feedback={feedback} /> : null}

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>{editingId ? "Edit User Account" : "Create New User"}</Text>
              <Text style={styles.panelNote}>Fill in the details below.</Text>
            </View>
            <MaterialIcons name={editingId ? "edit" : "person-add"} size={22} color={colors.primary} />
          </View>

          <Label text="Account Type" />
          <View style={styles.choiceRow}>
            <Choice label="Student" icon="school" active={form.role === "student"} onPress={() => changeRole("student")} />
            <Choice label="Staff" icon="badge" active={form.role === "staff"} onPress={() => changeRole("staff")} />
            {showAdminOption ? <Choice label="Admin" icon="verified-user" active={form.role === "admin"} onPress={() => changeRole("admin")} /> : null}
          </View>

          <Label text="Account Status" />
          <View style={styles.choiceRow}>
            <Choice label="Active" icon="check-circle" active={form.status === "active"} onPress={() => updateField("status", "active")} />
            <Choice label="Inactive" icon="pause-circle-filled" active={form.status === "inactive"} onPress={() => updateField("status", "inactive")} />
          </View>

          <Field label="Full Name*" value={form.name} placeholder="e.g. John Smith" onChangeText={(value) => updateField("name", value)} />
          <Field label="Email Address*" value={form.email} placeholder="user@university.edu" keyboardType="email-address" autoCapitalize="none" onChangeText={(value) => updateField("email", value)} />
          <PasswordRow
            editing={Boolean(editingId)}
            value={form.password}
            onChangeText={(value) => updateField("password", value)}
          />

          {(form.role === "student" || form.role === "staff") ? (
            <Field label="Contact No.*" value={form.phone} placeholder="07XXXXXXXX" keyboardType="phone-pad" autoCapitalize="none" onChangeText={(value) => updateField("phone", value)} />
          ) : null}

          {form.role === "student" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Student Details</Text>
              <Field label="Registration Number*" value={form.studentProfile.registrationNumber} placeholder="e.g. IT24102553" autoCapitalize="characters" onChangeText={(value) => updateProfile("studentProfile", "registrationNumber", value)} />
              <Field label="Department*" value={form.studentProfile.department} placeholder="Type student department" onChangeText={(value) => updateProfile("studentProfile", "department", value)} />
              <Field label="Specialization*" value={form.studentProfile.specialization} placeholder="e.g. Software Engineering" onChangeText={(value) => updateProfile("studentProfile", "specialization", value)} />
              <SelectField label="Academic Year*" value={form.studentProfile.academicYear} placeholder="Select..." options={ACADEMIC_YEARS} open={openSelect === "year"} onToggle={() => setOpenSelect((current) => current === "year" ? "" : "year")} onSelect={(value) => { updateProfile("studentProfile", "academicYear", value); setOpenSelect(""); }} />
              <SelectField label="Semester*" value={form.studentProfile.semester} placeholder="Select..." options={SEMESTERS} open={openSelect === "semester"} onToggle={() => setOpenSelect((current) => current === "semester" ? "" : "semester")} onSelect={(value) => { updateProfile("studentProfile", "semester", value); setOpenSelect(""); }} />
              <Field label="Address*" value={form.studentProfile.address} placeholder="e.g. 123 Main Street, Colombo" multiline onChangeText={(value) => updateProfile("studentProfile", "address", value)} />
              <Field label="NIC*" value={form.studentProfile.nic} placeholder="200012345678 or 952341234V" autoCapitalize="characters" helperText="New: 12 digits | Old: 9 digits + V/X" onChangeText={(value) => updateProfile("studentProfile", "nic", value)} />
            </View>
          ) : null}

          {form.role === "staff" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Staff Details</Text>
              <SelectField label="Department*" value={form.staffProfile.department} placeholder="Select..." options={STAFF_DEPARTMENTS} open={openSelect === "staffDepartment"} onToggle={() => setOpenSelect((current) => current === "staffDepartment" ? "" : "staffDepartment")} onSelect={(value) => { updateProfile("staffProfile", "department", value); setOpenSelect(""); }} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={[styles.secondaryButton, (saving || loading) && styles.disabled]} onPress={() => resetForm()} disabled={saving || loading}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, (saving || loading) && styles.disabled]} onPress={submit} disabled={saving || loading}>
              <Text style={styles.primaryText}>{saving ? (editingId ? "Saving..." : "Creating...") : editingId ? "Save Changes" : "Create Account"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={18} color="#777683" />
          <TextInput style={styles.searchInput} placeholder="Search name, email, role, department, registration number, or NIC" placeholderTextColor="#777683" value={query} onChangeText={setQuery} />
        </View>

        <View style={styles.filters}>
          <Filter label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <Filter label="Students" active={filter === "student"} onPress={() => setFilter("student")} />
          <Filter label="Staff" active={filter === "staff"} onPress={() => setFilter("staff")} />
          <Filter label="Admins" active={filter === "admin"} onPress={() => setFilter("admin")} />
        </View>

        {loading ? (
          <EmptyState title="Loading users..." body="Fetching the latest student and staff accounts." />
        ) : filteredUsers.length ? (
          <View style={styles.list}>
            {filteredUsers.map((user) => (
              <UserCard
                key={userId(user)}
                user={user}
                busy={saving || statusBusyId === userId(user) || deleteBusyId === userId(user)}
                onEdit={() => startEdit(user)}
                onDelete={() => confirmDelete(user)}
                onToggleStatus={() => toggleStatus(user)}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No matching users found" body="Try changing the filter or search to see more accounts." />
        )}
      </ScrollView>
    </AdminShell>
  );
}

function SummaryCard({ label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Banner({ feedback }) {
  const error = feedback.type === "error";

  return (
    <View style={[styles.banner, error ? styles.bannerError : styles.bannerSuccess]}>
      <MaterialIcons name={error ? "error-outline" : "check-circle-outline"} size={16} color={error ? "#b42318" : "#166534"} />
      <Text style={[styles.bannerText, error ? styles.bannerErrorText : styles.bannerSuccessText]}>{feedback.message}</Text>
    </View>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function FieldShell({ label, helperText, children }) {
  return (
    <View style={styles.fieldWrap}>
      <Label text={label} />
      {children}
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

function Field({ label, value, placeholder, onChangeText, keyboardType = "default", autoCapitalize = "words", helperText, multiline = false }) {
  return (
    <FieldShell label={label} helperText={helperText}>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#777683"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        onChangeText={onChangeText}
      />
    </FieldShell>
  );
}

function PasswordRow({ editing, value, onChangeText }) {
  return (
    <FieldShell
      label={`Password${editing ? "" : "*"}`}
      helperText={
        editing
          ? "Leave password empty if you do not want to change it."
          : "At least 8 characters with uppercase, number, and special character."
      }
    >
      <PasswordField
        value={value}
        onChangeText={onChangeText}
        placeholder={editing ? "Leave blank to keep current password" : "Enter a strong password"}
      />
    </FieldShell>
  );
}

function SelectField({ label, value, placeholder, options, open, onToggle, onSelect }) {
  return (
    <FieldShell label={label}>
      <Pressable style={styles.selectTrigger} onPress={onToggle}>
        <Text style={value ? styles.selectValue : styles.selectPlaceholder}>{value || placeholder}</Text>
        <MaterialIcons name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.selectMenu}>
          {options.map((option) => {
            const active = option === value;
            return (
              <Pressable key={option} style={[styles.selectOption, active && styles.selectOptionActive]} onPress={() => onSelect(option)}>
                <Text style={[styles.selectOptionText, active && styles.selectOptionTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </FieldShell>
  );
}

function Choice({ label, icon, active, onPress }) {
  return (
    <Pressable style={[styles.choice, active && styles.choiceActive]} onPress={onPress}>
      <MaterialIcons name={icon} size={18} color={active ? "white" : colors.textMuted} />
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Filter({ label, active, onPress }) {
  return (
    <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
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

function UserCard({ user, busy, onEdit, onDelete, onToggleStatus }) {
  const initials = normalizeName(user.name).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";
  const active = user.status === "active";

  return (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {detailLines(user).map((line) => (
            <Text key={line} style={styles.userMeta}>{line}</Text>
          ))}
        </View>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user.role}</Text>
        </View>
        <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, active ? styles.statusTextActive : styles.statusTextInactive]}>{user.status}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable style={[styles.cardButton, busy && styles.disabled]} onPress={onEdit} disabled={busy}>
          <Text style={styles.cardButtonText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.cardButton, styles.cardDanger, busy && styles.disabled]} onPress={onDelete} disabled={busy}>
          <Text style={styles.cardDangerText}>Delete</Text>
        </Pressable>
        <Pressable style={[styles.cardButton, styles.cardAccent, busy && styles.disabled]} onPress={onToggleStatus} disabled={busy}>
          <Text style={styles.cardAccentText}>{active ? "Deactivate" : "Activate"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 4, paddingBottom: 28, gap: 12 },
  title: { color: colors.primary, fontSize: type.h1, fontWeight: "800" },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryCard: { minWidth: 120, flexGrow: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: "#e0e3e5", padding: 12 },
  summaryValue: { color: colors.primary, fontSize: 24, fontWeight: "800" },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  banner: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerSuccess: { backgroundColor: "#ecfdf3", borderColor: "#b7ebc6" },
  bannerError: { backgroundColor: "#fff1f3", borderColor: "#fecdd3" },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700" },
  bannerSuccessText: { color: "#166534" },
  bannerErrorText: { color: "#b42318" },
  panel: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 14, gap: 12 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  panelTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  panelNote: { color: colors.textMuted, marginTop: 2, fontSize: 12 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "white" },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.textMuted, fontWeight: "800" },
  choiceTextActive: { color: "white" },
  fieldWrap: { gap: 6 },
  helperText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", color: colors.text, paddingHorizontal: 12, paddingVertical: 12 },
  multiline: { minHeight: 92 },
  section: { gap: 10, paddingTop: 4 },
  sectionTitle: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  selectTrigger: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "#f8fafc", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  selectValue: { color: colors.text },
  selectPlaceholder: { color: "#777683" },
  selectMenu: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: "#d9dde3", backgroundColor: "white", overflow: "hidden" },
  selectOption: { paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#eef2f7" },
  selectOptionActive: { backgroundColor: "#eef2ff" },
  selectOptionText: { color: colors.text, fontWeight: "600" },
  selectOptionTextActive: { color: colors.primary, fontWeight: "800" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingTop: 4 },
  secondaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, backgroundColor: "white" },
  secondaryText: { color: colors.textMuted, fontWeight: "800" },
  primaryButton: { minHeight: layout.touchTarget, borderRadius: layout.pillRadius, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.6 },
  searchBox: { backgroundColor: colors.surface, borderRadius: layout.pillRadius, borderWidth: 1, borderColor: "#e0e3e5", paddingHorizontal: 12, minHeight: layout.touchTarget, alignItems: "center", flexDirection: "row", gap: 6 },
  searchInput: { flex: 1, color: colors.text },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white" },
  filterActive: { backgroundColor: "#e9ddff", borderColor: colors.secondary },
  filterText: { color: colors.textMuted, fontWeight: "700", fontSize: 12 },
  filterTextActive: { color: colors.primary },
  list: { gap: 10 },
  emptyState: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 18, gap: 6 },
  emptyTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.textMuted, lineHeight: 20 },
  userCard: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, borderWidth: 1, borderColor: "#e0e3e5", padding: 12, gap: 12 },
  userHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800", fontSize: 13 },
  userInfo: { flex: 1, gap: 3 },
  userName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  userEmail: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  userMeta: { color: colors.secondary, fontSize: 11, fontWeight: "700" },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  roleBadge: { borderRadius: 999, backgroundColor: "#eef2ff", paddingHorizontal: 9, paddingVertical: 4 },
  roleBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusActive: { backgroundColor: "rgba(16,185,129,0.14)" },
  statusInactive: { backgroundColor: "rgba(239,68,68,0.12)" },
  statusText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  statusTextActive: { color: "#047857" },
  statusTextInactive: { color: "#b91c1c" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cardButton: { borderRadius: layout.pillRadius, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "white" },
  cardButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  cardDanger: { borderColor: "#fda4af", backgroundColor: "#fff1f2" },
  cardDangerText: { color: "#be123c", fontSize: 12, fontWeight: "800" },
  cardAccent: { borderColor: "#d8b4fe", backgroundColor: "#faf5ff" },
  cardAccentText: { color: colors.secondary, fontSize: 12, fontWeight: "800" },
});
