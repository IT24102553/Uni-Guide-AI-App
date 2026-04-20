const mongoose = require("mongoose");

const announcementAttachmentSchema = new mongoose.Schema(
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

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["general", "event", "important", "urgent"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    targetAudience: {
      type: String,
      enum: ["all", "students", "staff"],
      default: "all",
    },
    pinnedToTop: {
      type: Boolean,
      default: false,
    },
    authorName: {
      type: String,
      trim: true,
      default: "Admin",
    },
    attachments: {
      type: [announcementAttachmentSchema],
      default: [],
    },
    expiryDate: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ pinnedToTop: -1, createdAt: -1 });
announcementSchema.index({ targetAudience: 1, expiryDate: 1 });

module.exports = mongoose.model("Announcement", announcementSchema);
