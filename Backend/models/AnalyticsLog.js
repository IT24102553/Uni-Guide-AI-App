const mongoose = require("mongoose");

const analyticsLogAttachmentSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      trim: true,
      default: "",
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    storedName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const analyticsLogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["usage", "incident", "security", "maintenance", "report", "other"],
      default: "incident",
    },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Open", "In Review", "Resolved", "Archived"],
      default: "Open",
    },
    source: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      required: true,
      trim: true,
    },
    eventDate: {
      type: Date,
      required: true,
    },
    reportedByName: {
      type: String,
      trim: true,
      default: "Admin",
    },
    attachments: {
      type: [analyticsLogAttachmentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

analyticsLogSchema.index({ eventDate: -1, createdAt: -1 });
analyticsLogSchema.index({ category: 1, severity: 1, status: 1 });
analyticsLogSchema.index({
  title: "text",
  source: "text",
  notes: "text",
  reportedByName: "text",
});

module.exports = mongoose.model("AnalyticsLog", analyticsLogSchema);
