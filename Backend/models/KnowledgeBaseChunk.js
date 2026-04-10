const mongoose = require("mongoose");

const knowledgeBaseChunkSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["document"],
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sourceTitle: {
      type: String,
      required: true,
      trim: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    metadata: {
      originalName: {
        type: String,
        trim: true,
        default: "",
      },
      uploadedByName: {
        type: String,
        trim: true,
        default: "",
      },
    },
  },
  { timestamps: true }
);

knowledgeBaseChunkSchema.index(
  { sourceType: 1, sourceId: 1, chunkIndex: 1 },
  { unique: true }
);
knowledgeBaseChunkSchema.index({
  sourceTitle: "text",
  content: "text",
  "metadata.originalName": "text",
  "metadata.uploadedByName": "text",
});

module.exports = mongoose.model("KnowledgeBaseChunk", knowledgeBaseChunkSchema);
