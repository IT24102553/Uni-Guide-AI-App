const mongoose = require("mongoose");

const ticketAttachmentSchema = new mongoose.Schema(
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

module.exports = ticketAttachmentSchema;
