const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema(
  {
    studentId: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    department: { type: String, trim: true },
    specialization: { type: String, trim: true },
    academicYear: { type: String, trim: true },
    semester: { type: String, trim: true },
    address: { type: String, trim: true },
    nic: { type: String, trim: true },
    faculty: { type: String, trim: true },
    program: { type: String, trim: true },
    year: { type: String, trim: true },
    advisor: { type: String, trim: true },
    campus: { type: String, trim: true },
  },
  { _id: false }
);

const staffProfileSchema = new mongoose.Schema(
  {
    staffId: { type: String, trim: true },
    department: { type: String, trim: true },
    roleTitle: { type: String, trim: true },
    office: { type: String, trim: true },
    availability: { type: String, trim: true },
    specialization: { type: String, trim: true },
  },
  { _id: false }
);

const profilePhotoSchema = new mongoose.Schema(
  {
    fileId: { type: String, trim: true },
    originalName: { type: String, trim: true },
    storedName: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
    url: { type: String, trim: true },
    uploadedAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "staff", "admin"],
      default: "student",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    phone: {
      type: String,
      trim: true,
    },

    studentProfile: studentProfileSchema,
    staffProfile: staffProfileSchema,
    profilePhoto: profilePhotoSchema,

    resetPasswordOtp: {
      type: String,
    },

    resetPasswordOtpExpires: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);


