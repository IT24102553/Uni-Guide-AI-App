const User = require("../models/User");
const appError = require("../utils/appError");
const { hashPassword } = require("../utils/passwords");
const {
  deleteStoredProfilePhoto,
  getProfilePhotoDownload,
  uploadProfilePhoto,
} = require("../utils/profilePhotoStore");

const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const PHONE_PATTERN = /^0\d{9}$/;
const NIC_PATTERN = /^(?:\d{12}|\d{9}[VvXx])$/;
const ROLES = ["student", "staff", "admin"];
const STATUSES = ["active", "inactive"];

function safeUser(user) {
  if (!user) {
    return null;
  }

  const obj = user.toObject ? user.toObject() : user;

  delete obj.password;
  delete obj.resetPasswordOtp;
  delete obj.resetPasswordOtpExpires;

  return obj;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function toPlainObject(value) {
  if (!value) {
    return {};
  }

  return value.toObject ? value.toObject() : value;
}

function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
}

function hasFirstAndLastName(name) {
  return normalizeName(name).split(" ").filter(Boolean).length >= 2;
}

function validateStrongPassword(password) {
  if (!password || password.length < 8) {
    throw appError("Password must be at least 8 characters", 400);
  }

  if (!/[A-Z]/.test(password)) {
    throw appError("Password must include at least one uppercase letter", 400);
  }

  if (!/\d/.test(password)) {
    throw appError("Password must include at least one number", 400);
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw appError("Password must include at least one special character", 400);
  }
}

function validatePhone(phone) {
  if (!phone) {
    throw appError("Contact number is required", 400);
  }

  if (!PHONE_PATTERN.test(phone)) {
    throw appError("Contact number must be in the format 07XXXXXXXX", 400);
  }
}

function normalizeStudentProfile(profile, existingProfile) {
  const merged = {
    ...toPlainObject(existingProfile),
    ...toPlainObject(profile),
  };
  const registrationNumber = normalizeOptionalString(
    merged.registrationNumber || merged.studentId
  );
  const academicYear = normalizeOptionalString(merged.academicYear || merged.year);

  return cleanObject({
    studentId: registrationNumber,
    registrationNumber,
    department: normalizeOptionalString(merged.department),
    specialization: normalizeOptionalString(merged.specialization),
    academicYear,
    semester: normalizeOptionalString(merged.semester),
    address: normalizeOptionalString(merged.address),
    nic: normalizeOptionalString(merged.nic),
    faculty: normalizeOptionalString(merged.faculty),
    program: normalizeOptionalString(merged.program),
    year: academicYear,
    advisor: normalizeOptionalString(merged.advisor),
    campus: normalizeOptionalString(merged.campus),
  });
}

function normalizeStaffProfile(profile, existingProfile) {
  const merged = {
    ...toPlainObject(existingProfile),
    ...toPlainObject(profile),
  };

  return cleanObject({
    staffId: normalizeOptionalString(merged.staffId),
    department: normalizeOptionalString(merged.department),
    roleTitle: normalizeOptionalString(merged.roleTitle),
    office: normalizeOptionalString(merged.office),
    availability: normalizeOptionalString(merged.availability),
    specialization: normalizeOptionalString(merged.specialization),
  });
}

function validateCommonFields({ name, email, role, status, phone }, { requirePassword, password }) {
  if (!name) {
    throw appError("Full name is required", 400);
  }

  if ((role === "student" || role === "staff") && !hasFirstAndLastName(name)) {
    throw appError("Enter both first name and last name", 400);
  }

  if (!email) {
    throw appError("Email address is required", 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw appError("Enter a valid email address", 400);
  }

  if (!ROLES.includes(role)) {
    throw appError("Invalid role", 400);
  }

  if (!STATUSES.includes(status)) {
    throw appError("Invalid status", 400);
  }

  if ((role === "student" || role === "staff") && !phone) {
    throw appError("Contact number is required", 400);
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    throw appError("Contact number must be in the format 07XXXXXXXX", 400);
  }

  if (requirePassword && !password) {
    throw appError("Password is required", 400);
  }

  if (password !== undefined) {
    validateStrongPassword(password);
  }
}

function validateStudentProfile(profile) {
  if (!profile.registrationNumber) {
    throw appError("Registration number is required", 400);
  }

  if (!profile.department) {
    throw appError("Student department is required", 400);
  }

  if (!profile.specialization) {
    throw appError("Student specialization is required", 400);
  }

  if (!profile.academicYear) {
    throw appError("Academic year is required", 400);
  }

  if (!profile.semester) {
    throw appError("Semester is required", 400);
  }

  if (!profile.address) {
    throw appError("Address is required", 400);
  }

  if (!profile.nic) {
    throw appError("NIC is required", 400);
  }

  if (!NIC_PATTERN.test(profile.nic)) {
    throw appError("NIC must be 12 digits or 9 digits followed by V/X", 400);
  }
}

function validateStaffProfile(profile) {
  if (!profile.department) {
    throw appError("Staff department is required", 400);
  }
}

function ensureNoRestrictedStudentProfileUpdates(data) {
  const restrictedFields = ["name", "email", "role", "status", "studentProfile", "staffProfile", "profile"];
  const hasRestrictedField = restrictedFields.some((field) => data[field] !== undefined);

  if (hasRestrictedField) {
    throw appError(
      "Students can only update their phone number, password, and profile photo.",
      403
    );
  }
}

function prepareUserPayload(data, existingUser) {
  const currentUser = existingUser ? safeUser(existingUser) : {};
  const role = normalizeOptionalString(data.role || currentUser.role || "student")?.toLowerCase();
  const status = normalizeOptionalString(data.status || currentUser.status || "active")?.toLowerCase();
  const name = normalizeName(data.name !== undefined ? data.name : currentUser.name);
  const email =
    data.email !== undefined ? normalizeEmail(data.email) : normalizeEmail(currentUser.email);
  const phone =
    data.phone !== undefined ? normalizeOptionalString(data.phone) : normalizeOptionalString(currentUser.phone);
  const password = data.password !== undefined ? String(data.password) : undefined;
  const studentProfile = normalizeStudentProfile(data.studentProfile, currentUser.studentProfile);
  const staffProfile = normalizeStaffProfile(data.staffProfile, currentUser.staffProfile);

  validateCommonFields(
    { name, email, role, status, phone },
    { requirePassword: !existingUser, password }
  );

  if (role === "student") {
    validateStudentProfile(studentProfile);
  }

  if (role === "staff") {
    validateStaffProfile(staffProfile);
  }

  return cleanObject({
    name,
    email,
    password,
    role,
    status,
    phone,
    studentProfile: role === "student" ? studentProfile : undefined,
    staffProfile: role === "staff" ? staffProfile : undefined,
  });
}

async function ensureUniqueEmail(email, excludedUserId) {
  const existingUser = await User.findOne({ email });

  if (!existingUser) {
    return;
  }

  if (excludedUserId && existingUser._id.toString() === String(excludedUserId)) {
    return;
  }

  throw appError("User already exists with this email", 409);
}

async function createUser(data) {
  const payload = prepareUserPayload(data);
  await ensureUniqueEmail(payload.email);
  payload.password = await hashPassword(payload.password);

  const user = await User.create(payload);

  return {
    user: safeUser(user),
  };
}

async function getUsers(filters = {}) {
  const query = {};

  if (filters.role && filters.role !== "all") {
    query.role = filters.role;
  }

  if (filters.search) {
    const searchRegex = new RegExp(filters.search, "i");
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { role: searchRegex },
      { phone: searchRegex },
      { "studentProfile.registrationNumber": searchRegex },
      { "studentProfile.department": searchRegex },
      { "studentProfile.specialization": searchRegex },
      { "studentProfile.nic": searchRegex },
      { "staffProfile.department": searchRegex },
    ];
  }

  const users = await User.find(query).sort({ createdAt: -1 });
  return users.map(safeUser);
}

async function getUserById(id) {
  const user = await User.findById(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  return safeUser(user);
}

async function updateUser(id, data) {
  const user = await User.findById(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  const payload = prepareUserPayload(data, user);
  await ensureUniqueEmail(payload.email, id);

  user.name = payload.name;
  user.email = payload.email;
  user.role = payload.role;
  user.status = payload.status;
  user.phone = payload.phone;

  if (payload.password !== undefined) {
    user.password = await hashPassword(payload.password);
  }

  user.studentProfile = payload.role === "student" ? payload.studentProfile : undefined;
  user.staffProfile = payload.role === "staff" ? payload.staffProfile : undefined;

  await user.save();

  return safeUser(user);
}

async function updateUserStatus(id, status) {
  const normalizedStatus = normalizeOptionalString(status)?.toLowerCase();

  if (!STATUSES.includes(normalizedStatus)) {
    throw appError("Invalid status", 400);
  }

  const user = await User.findById(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  user.status = normalizedStatus;
  await user.save();

  return safeUser(user);
}

async function deleteUser(id) {
  const user = await User.findByIdAndDelete(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  if (user.profilePhoto?.fileId) {
    await deleteStoredProfilePhoto(user.profilePhoto).catch(() => undefined);
  }

  return safeUser(user);
}

async function getUserProfile(id) {
  const user = await User.findById(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  return {
    user: safeUser(user),
    profile: user.role === "staff" ? user.staffProfile : user.studentProfile,
  };
}

async function updateUserProfile(id, data) {
  const user = await User.findById(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  if (user.role === "student") {
    ensureNoRestrictedStudentProfileUpdates(data);

    if (data.phone !== undefined) {
      const phone = normalizeOptionalString(data.phone);
      validatePhone(phone);
      user.phone = phone;
    }

    if (data.password !== undefined) {
      const password = String(data.password || "");
      validateStrongPassword(password);
      user.password = await hashPassword(password);
    }

    await user.save();
    return safeUser(user);
  }

  const payload = cleanObject({
    name: data.name,
    email: data.email,
    phone: data.phone,
    studentProfile:
      user.role === "student"
        ? {
            ...toPlainObject(data.studentProfile),
            ...toPlainObject(data.profile),
          }
        : undefined,
    staffProfile:
      user.role === "staff"
        ? {
            ...toPlainObject(data.staffProfile),
            ...toPlainObject(data.profile),
          }
        : undefined,
  });

  return updateUser(id, payload);
}

async function uploadUserProfilePhoto(id, file) {
  const user = await User.findById(id);

  if (!user) {
    throw appError("User not found", 404);
  }

  const previousPhoto = user.profilePhoto ? { ...toPlainObject(user.profilePhoto) } : null;
  const nextPhoto = await uploadProfilePhoto(file, {
    userId: String(user._id),
    role: user.role,
  });

  try {
    user.profilePhoto = nextPhoto;
    await user.save();
  } catch (error) {
    await deleteStoredProfilePhoto(nextPhoto).catch(() => undefined);
    throw error;
  }

  if (previousPhoto?.fileId && previousPhoto.fileId !== nextPhoto.fileId) {
    await deleteStoredProfilePhoto(previousPhoto).catch(() => undefined);
  }

  return {
    user: safeUser(user),
    profilePhoto: nextPhoto,
  };
}

async function getUserProfilePhotoDownload(fileId, actor) {
  const normalizedFileId = String(fileId || "").trim();

  if (!normalizedFileId) {
    throw appError("Profile photo not found", 404);
  }

  const user = await User.findOne({ "profilePhoto.fileId": normalizedFileId });

  if (!user?.profilePhoto?.fileId) {
    throw appError("Profile photo not found", 404);
  }

  const actorId = String(actor?._id || "");
  const ownerId = String(user._id || "");

  if (actor?.role !== "admin" && actorId !== ownerId) {
    throw appError("You do not have access to this profile photo", 403);
  }

  return getProfilePhotoDownload(normalizedFileId);
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
  getUserProfile,
  getUserProfilePhotoDownload,
  updateUserProfile,
  uploadUserProfilePhoto,
  safeUser,
  normalizeEmail,
};
