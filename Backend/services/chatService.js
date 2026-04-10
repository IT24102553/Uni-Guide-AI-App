const ChatConversation = require("../models/ChatConversation");
const User = require("../models/User");
const { generateKnowledgeBaseReply } = require("./ragService");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  getAttachmentDownload,
  uploadAttachment,
} = require("../utils/chatAttachmentStore");

const RATINGS = ["up", "down"];

function normalizeString(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || "";
}

function normalizeLongText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function hasMessageContent(value) {
  return Boolean(normalizeLongText(value));
}

function requireField(value, message) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw appError(message, 400);
  }

  return normalized;
}

async function resolveStudent(userId) {
  const normalizedId = normalizeOptionalString(userId);

  if (!normalizedId) {
    throw appError("Student account is required", 400);
  }

  const student = await User.findById(normalizedId);

  if (!student || student.role !== "student") {
    throw appError("Only student accounts can access AI chat", 403);
  }

  if (student.status === "inactive") {
    throw appError("Student account is inactive", 403);
  }

  return student;
}

function buildConversationTitle(rawContent, image) {
  const baseTitle = normalizeLongText(rawContent).split("\n")[0].slice(0, 48).trim();

  if (baseTitle) {
    return baseTitle;
  }

  const imageName = normalizeOptionalString(image?.originalName)
    .replace(/\.[^/.]+$/, "")
    .slice(0, 48)
    .trim();

  if (imageName) {
    return imageName;
  }

  return "Image question";
}

function buildMessagePreview(rawContent, image) {
  const message = normalizeLongText(rawContent);

  if (message) {
    return `"${message.slice(0, 160)}${message.length > 160 ? "..." : ""}"`;
  }

  if (image?.originalName) {
    return `Image attached: ${image.originalName}`;
  }

  return "No text message provided yet.";
}

function buildServiceFallbackReply(content, student, options = {}) {
  const firstName = normalizeString(student?.name).split(" ")[0] || "there";
  const preview = buildMessagePreview(content, options.image);

  return [
    `Hi ${firstName}, I saved your message but I could not reach the official knowledge service just now.`,
    `Your latest request: ${preview}`,
    options.image
      ? "I also received your image, but the current fallback mode only uses the written message."
      : null,
    "Please try again in a moment. If the issue is urgent, open a support ticket so staff can confirm the answer directly.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function serializeMessage(message) {
  return {
    _id: message._id,
    role: message.role,
    content: message.content,
    rating: message.rating || null,
    image: message.image || null,
    sources: Array.isArray(message.sources) ? message.sources : [],
    createdAt: message.createdAt,
  };
}

function serializeConversation(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages.map(serializeMessage) : [];
  const lastMessage = messages[messages.length - 1] || null;

  return {
    _id: conversation._id,
    title: conversation.title,
    studentId: conversation.student?._id || conversation.student,
    lastMessagePreview: lastMessage?.content || "No messages yet",
    lastMessageAt: conversation.lastMessageAt,
    messageCount: messages.length,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages,
  };
}

function serializeConversationSummary(conversation) {
  const serialized = serializeConversation(conversation);

  return {
    _id: serialized._id,
    title: serialized.title,
    lastMessagePreview: serialized.lastMessagePreview,
    lastMessageAt: serialized.lastMessageAt,
    messageCount: serialized.messageCount,
    createdAt: serialized.createdAt,
    updatedAt: serialized.updatedAt,
  };
}

async function loadConversationOrThrow(conversationId) {
  const conversation = await ChatConversation.findById(conversationId);

  if (!conversation) {
    throw appError("Conversation not found", 404);
  }

  return conversation;
}

function assertConversationOwner(conversation, studentId) {
  if (String(conversation.student) !== String(studentId)) {
    throw appError("You do not have access to this conversation", 403);
  }
}

function collectConversationAttachments(conversation) {
  return (conversation?.messages || [])
    .map((message) => message?.image)
    .filter(Boolean);
}

async function createConversation(data) {
  const student = await resolveStudent(data.userId);
  const title = normalizeOptionalString(data.title) || "New conversation";

  const conversation = await ChatConversation.create({
    student: student._id,
    title,
    messages: [],
    lastMessageAt: new Date(),
  });

  return serializeConversation(conversation);
}

async function getConversations(filters = {}) {
  const student = await resolveStudent(filters.userId);
  const conversations = await ChatConversation.find({ student: student._id }).sort({
    lastMessageAt: -1,
    updatedAt: -1,
    createdAt: -1,
  });

  return conversations.map(serializeConversationSummary);
}

async function getConversationById(conversationId, filters = {}) {
  const student = await resolveStudent(filters.userId);
  const conversation = await loadConversationOrThrow(conversationId);

  assertConversationOwner(conversation, student._id);

  return serializeConversation(conversation);
}

async function renameConversation(conversationId, data) {
  const student = await resolveStudent(data.userId);
  const conversation = await loadConversationOrThrow(conversationId);

  assertConversationOwner(conversation, student._id);

  conversation.title = requireField(data.title, "Conversation title is required");
  await conversation.save();

  return serializeConversation(conversation);
}

async function deleteConversation(conversationId, data) {
  const student = await resolveStudent(data.userId);
  const conversation = await loadConversationOrThrow(conversationId);

  assertConversationOwner(conversation, student._id);
  const attachments = collectConversationAttachments(conversation);
  await conversation.deleteOne();
  await deleteStoredAttachments(attachments).catch(() => undefined);

  return {
    _id: conversation._id,
  };
}

async function sendMessage(conversationId, data) {
  const student = await resolveStudent(data.userId);
  const conversation = await loadConversationOrThrow(conversationId);

  assertConversationOwner(conversation, student._id);
  const content = normalizeLongText(data.content);
  const imageFile = data.image;

  if (!hasMessageContent(content) && !imageFile?.buffer) {
    throw appError("Message content or an image is required", 400);
  }

  let storedImage = null;

  if (imageFile?.buffer) {
    storedImage = await uploadAttachment(imageFile, {
      conversationId: String(conversation._id),
      studentId: String(student._id),
      kind: "chat-image",
    });
  }

  const conversationForModel = {
    messages: Array.isArray(conversation.messages) ? conversation.messages.slice() : [],
  };

  const userMessage = {
    role: "user",
    content,
    image: storedImage,
  };

  try {
    conversation.messages.push(userMessage);

    if (
      !normalizeOptionalString(conversation.title) ||
      conversation.title === "New conversation"
    ) {
      conversation.title = buildConversationTitle(content, storedImage);
    }

    conversation.lastMessageAt = new Date();
    await conversation.save();
  } catch (error) {
    await deleteStoredAttachments(storedImage ? [storedImage] : []).catch(() => undefined);
    throw error;
  }

  let assistantReply;

  try {
    assistantReply = await generateKnowledgeBaseReply({
      conversation: conversationForModel,
      student,
      userMessage: content,
      image: imageFile?.buffer
        ? {
            buffer: imageFile.buffer,
            mimeType:
              imageFile.mimetype ||
              storedImage?.mimeType ||
              "application/octet-stream",
            originalName:
              imageFile.originalname || storedImage?.originalName || "chat-image",
          }
        : null,
    });
  } catch (error) {
    assistantReply = {
      text: buildServiceFallbackReply(content, student, { image: storedImage }),
      sources: [],
    };
  }

  conversation.messages.push({
    role: "assistant",
    content: assistantReply.text,
    sources: Array.isArray(assistantReply.sources) ? assistantReply.sources : [],
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return serializeConversation(conversation);
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = normalizeOptionalString(value).toLowerCase();

  if (!RATINGS.includes(normalized)) {
    throw appError("Invalid message rating", 400);
  }

  return normalized;
}

async function rateMessage(conversationId, messageId, data) {
  const student = await resolveStudent(data.userId);
  const conversation = await loadConversationOrThrow(conversationId);

  assertConversationOwner(conversation, student._id);

  const message = conversation.messages.id(messageId);

  if (!message) {
    throw appError("Message not found", 404);
  }

  if (message.role !== "assistant") {
    throw appError("Only assistant messages can be rated", 400);
  }

  message.rating = normalizeRating(data.rating);
  await conversation.save();

  return {
    message: serializeMessage(message),
  };
}

async function getAttachmentDownloadForUser(fileId, userId) {
  const student = await resolveStudent(userId);
  const normalizedFileId = normalizeOptionalString(fileId);

  if (!normalizedFileId) {
    throw appError("Attachment not found", 404);
  }

  const conversation = await ChatConversation.findOne({
    "messages.image.fileId": normalizedFileId,
  });

  if (!conversation) {
    throw appError("Attachment not found", 404);
  }

  assertConversationOwner(conversation, student._id);
  return getAttachmentDownload(normalizedFileId);
}

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  renameConversation,
  deleteConversation,
  sendMessage,
  rateMessage,
  getAttachmentDownloadForUser,
};
