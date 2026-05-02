const mongoose = require("mongoose");
const ticketAttachmentSchema = require("./schemas/ticketAttachmentSchema");

const ticketReplySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorRole: {
      type: String,
      enum: ["student", "staff", "admin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: {
      type: [ticketAttachmentSchema],
      default: [],
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const ticketSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    registrationNumber: { type: String, required: true, trim: true },
    faculty: { type: String, required: true, trim: true },
    campus: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    studentSnapshot: {
      type: ticketSnapshotSchema,
      required: true,
    },
    requestType: {
      type: String,
      required: true,
      trim: true,
    },
    requestSubType: {
      type: String,
      trim: true,
      default: "",
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: {
      type: [ticketAttachmentSchema],
      default: [],
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["New", "In Progress", "Escalated", "Resolved", "Closed"],
      default: "New",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedDepartment: {
      type: String,
      trim: true,
      default: "",
    },
    replies: {
      type: [ticketReplySchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
