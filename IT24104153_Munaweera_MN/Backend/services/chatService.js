const ChatConversation = require('../models/ChatConversation');
const User = require('../models/User');
const appError = require('../utils/appError');
const {
  deleteStoredAttachments,
  getAttachmentDownload,
  uploadAttachment,
} = require('../utils/chatAttachmentStore');

const RATINGS = ['up', 'down'];

function normalizeString(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || '';
}

function normalizeLongText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
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
    throw appError('Student account is required', 400);
  }

  const student = await User.findById(normalizedId);

  if (!student || student.role !== 'student') {
    throw appError('Only student accounts can access AI chat', 403);
  }

  if (student.status === 'inactive') {
    throw appError('Student account is inactive', 403);
  }

  return student;
}

function buildConversationTitle(rawContent, image) {
  const baseTitle = normalizeLongText(rawContent).split('\n')[0].slice(0, 48).trim();

  if (baseTitle) {
    return baseTitle;
  }

  const imageName = normalizeOptionalString(image?.originalName)
    .replace(/\.[^/.]+$/, '')
    .slice(0, 48)
    .trim();

  if (imageName) {
    return imageName;
  }

  return 'Image question';
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
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map(serializeMessage)
    : [];
  const lastMessage = messages[messages.length - 1] || null;

  return {
    _id: conversation._id,
    title: conversation.title,
    studentId: conversation.student?._id || conversation.student,
    lastMessagePreview: lastMessage?.content || 'No messages yet',
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
    throw appError('Conversation not found', 404);
  }

  return conversation;
}

function assertConversationOwner(conversation, studentId) {
  if (String(conversation.student) !== String(studentId)) {
    throw appError('You do not have access to this conversation', 403);
  }
}

function collectConversationAttachments(conversation) {
  return (conversation?.messages || []).map((message) => message?.image).filter(Boolean);
}

function buildAssistantReply({ content, student, image }) {
  const normalizedContent = normalizeLongText(content);
  const firstName = normalizeString(student?.name).split(' ')[0] || 'Student';
  const supportChecklist = [
    'Check the module brief, LMS notice, or faculty email for the exact instruction.',
    'Keep your registration number and module code ready before contacting staff.',
    'If the issue affects a deadline or submission, take a screenshot and raise it early.',
  ];

  const messageParts = [
    `Hi ${firstName}, I received your question${normalizedContent ? `: "${normalizedContent}".` : '.'}`,
    image ? 'Your uploaded image is attached to the conversation for reference.' : null,
    'This standalone build is focused on demonstrating the student chat workflow, so the assistant response here is a guided support reply.',
    'Suggested next steps:',
    supportChecklist.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    normalizedContent
      ? 'If you want, send a follow-up message with more details and this chat will keep the full conversation history.'
      : 'Send your question in the chat box and the conversation history will update here.',
  ];

  return {
    text: messageParts.filter(Boolean).join('\n\n'),
    sources: [
      {
        sourceType: 'faq',
        sourceId: 'student-chat-demo',
        title: 'Standalone student chat demo',
        subtitle: 'Submission-ready isolated module',
        snippet: 'This response is generated by the standalone student chat backend prepared for individual feature review.',
      },
    ],
  };
}

async function createConversation(data) {
  const student = await resolveStudent(data.userId);
  const title = normalizeOptionalString(data.title) || 'New conversation';

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
  conversation.title = requireField(data.title, 'Conversation title is required');
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
    throw appError('Message content or an image is required', 400);
  }

  let storedImage = null;

  if (imageFile?.buffer) {
    storedImage = await uploadAttachment(imageFile, {
      conversationId: String(conversation._id),
      studentId: String(student._id),
      kind: 'chat-image',
    });
  }

  try {
    conversation.messages.push({
      role: 'user',
      content,
      image: storedImage,
    });

    if (!normalizeOptionalString(conversation.title) || conversation.title === 'New conversation') {
      conversation.title = buildConversationTitle(content, storedImage);
    }

    conversation.lastMessageAt = new Date();
    await conversation.save();
  } catch (error) {
    await deleteStoredAttachments(storedImage ? [storedImage] : []).catch(() => undefined);
    throw error;
  }

  const assistantReply = buildAssistantReply({
    content,
    student,
    image: storedImage,
  });

  conversation.messages.push({
    role: 'assistant',
    content: assistantReply.text,
    sources: assistantReply.sources,
  });
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return serializeConversation(conversation);
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = normalizeOptionalString(value).toLowerCase();

  if (!RATINGS.includes(normalized)) {
    throw appError('Invalid message rating', 400);
  }

  return normalized;
}

async function rateMessage(conversationId, messageId, data) {
  const student = await resolveStudent(data.userId);
  const conversation = await loadConversationOrThrow(conversationId);

  assertConversationOwner(conversation, student._id);

  const message = conversation.messages.id(messageId);

  if (!message) {
    throw appError('Message not found', 404);
  }

  if (message.role !== 'assistant') {
    throw appError('Only assistant messages can be rated', 400);
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
    throw appError('Attachment not found', 404);
  }

  const conversation = await ChatConversation.findOne({
    'messages.image.fileId': normalizedFileId,
  });

  if (!conversation) {
    throw appError('Attachment not found', 404);
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
