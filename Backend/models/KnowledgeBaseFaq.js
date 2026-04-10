const mongoose = require("mongoose");

const knowledgeBaseFaqSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    authorName: {
      type: String,
      trim: true,
      default: "Admin",
    },
  },
  { timestamps: true }
);

knowledgeBaseFaqSchema.index({ category: 1, createdAt: -1 });
knowledgeBaseFaqSchema.index({ question: "text", answer: "text", category: "text", tags: "text" });

module.exports = mongoose.model("KnowledgeBaseFaq", knowledgeBaseFaqSchema);
