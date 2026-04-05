const chatService = require("../services/chatService");
const { emitToUser } = require("../realtime/socket");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

function buildConversationEventPayload(conversationId) {
  return {
    conversationId: String(conversationId || ""),
    at: new Date().toISOString(),
  };
}

async function createConversation(req, res) {
  try {
    const conversation = await chatService.createConversation({
      ...req.body,
      userId: req.user._id,
    });
    emitToUser(
      req.user._id,
      "chat:conversationChanged",
      buildConversationEventPayload(conversation._id)
    );

    res.status(201).json({
      message: "Conversation created successfully",
      conversation,
    });
  } catch (error) {
    sendError(res, error, "Error creating conversation");
  }
}

async function getConversations(req, res) {
  try {
    const conversations = await chatService.getConversations({
      userId: req.user._id,
    });

    res.status(200).json({
      message: "Conversations fetched successfully",
      conversations,
    });
  } catch (error) {
    sendError(res, error, "Error fetching conversations");
  }
}

async function getConversationById(req, res) {
  try {
    const conversation = await chatService.getConversationById(req.params.id, {
      userId: req.user._id,
    });

    res.status(200).json({
      message: "Conversation fetched successfully",
      conversation,
    });
  } catch (error) {
    sendError(res, error, "Error fetching conversation");
  }
}

async function renameConversation(req, res) {
  try {
    const conversation = await chatService.renameConversation(req.params.id, {
      ...req.body,
      userId: req.user._id,
    });
    emitToUser(
      req.user._id,
      "chat:conversationChanged",
      buildConversationEventPayload(conversation._id)
    );

    res.status(200).json({
      message: "Conversation renamed successfully",
      conversation,
    });
  } catch (error) {
    sendError(res, error, "Error renaming conversation");
  }
}

async function deleteConversation(req, res) {
  try {
    const result = await chatService.deleteConversation(req.params.id, {
      ...req.body,
      userId: req.user._id,
    });
    emitToUser(req.user._id, "chat:conversationDeleted", {
      conversationId: String(result._id || ""),
      at: new Date().toISOString(),
    });

    res.status(200).json({
      message: "Conversation deleted successfully",
      conversationId: result._id,
    });
  } catch (error) {
    sendError(res, error, "Error deleting conversation");
  }
}

async function sendMessage(req, res) {
  try {
    const conversation = await chatService.sendMessage(req.params.id, {
      ...req.body,
      userId: req.user._id,
      image: req.file,
    });
    emitToUser(
      req.user._id,
      "chat:conversationChanged",
      buildConversationEventPayload(conversation._id)
    );

    res.status(200).json({
      message: "Message sent successfully",
      conversation,
    });
  } catch (error) {
    sendError(res, error, "Error sending message");
  }
}

function sanitizeContentDispositionName(filename) {
  return String(filename || "attachment").replace(/["\r\n\\]+/g, "_");
}

async function downloadAttachment(req, res) {
  try {
    const { file, stream } = await chatService.getAttachmentDownloadForUser(
      req.params.fileId,
      req.user._id
    );
    const downloadName = sanitizeContentDispositionName(
      file.metadata?.originalName || file.filename || "attachment"
    );

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);

    if (Number.isFinite(file.length)) {
      res.setHeader("Content-Length", String(file.length));
    }

    stream.on("error", (error) => {
      if (!res.headersSent) {
        sendError(res, error, "Error downloading attachment");
        return;
      }

      res.destroy(error);
    });

    stream.pipe(res);
  } catch (error) {
    sendError(res, error, "Error downloading attachment");
  }
}

async function rateMessage(req, res) {
  try {
    const result = await chatService.rateMessage(
      req.params.id,
      req.params.messageId,
      {
        ...req.body,
        userId: req.user._id,
      }
    );
    emitToUser(
      req.user._id,
      "chat:conversationChanged",
      buildConversationEventPayload(req.params.id)
    );

    res.status(200).json({
      message: "Message rating saved successfully",
      messageData: result.message,
    });
  } catch (error) {
    sendError(res, error, "Error rating message");
  }
}

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  renameConversation,
  deleteConversation,
  sendMessage,
  rateMessage,
  downloadAttachment,
};
