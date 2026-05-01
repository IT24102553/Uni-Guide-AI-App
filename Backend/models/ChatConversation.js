const mongoose = require("mongoose");

const chatMessageAttachmentSchema = new mongoose.Schema(
  {
    fileId: {
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
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
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
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    rating: {
      type: String,
      enum: ["up", "down"],
      default: null,
    },
    image: {
      type: chatMessageAttachmentSchema,
      default: null,
    },
    sources: {
      type: [
        new mongoose.Schema(
          {
            sourceType: {
              type: String,
              enum: ["faq", "document"],
              required: true,
            },
            sourceId: {
              type: String,
              required: true,
              trim: true,
            },
            title: {
              type: String,
              required: true,
              trim: true,
            },
            subtitle: {
              type: String,
              trim: true,
              default: "",
            },
            snippet: {
              type: String,
              trim: true,
              default: "",
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const chatConversationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "New conversation",
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatConversation", chatConversationSchema);
