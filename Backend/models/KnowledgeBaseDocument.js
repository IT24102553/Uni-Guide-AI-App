const mongoose = require("mongoose");

const knowledgeBaseDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
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
    fileId: {
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
    ragStatus: {
      type: String,
      enum: ["pending", "indexed", "error"],
      default: "pending",
    },
    chunkCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    indexError: {
      type: String,
      trim: true,
      default: "",
    },
    lastIndexedAt: {
      type: Date,
      default: null,
    },
    uploadedByName: {
      type: String,
      trim: true,
      default: "Admin",
    },
  },
  { timestamps: true }
);

knowledgeBaseDocumentSchema.index({ createdAt: -1 });
knowledgeBaseDocumentSchema.index({ title: "text", originalName: "text", uploadedByName: "text" });

module.exports = mongoose.model("KnowledgeBaseDocument", knowledgeBaseDocumentSchema);
