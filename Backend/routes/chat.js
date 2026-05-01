const express = require("express");
const chatController = require("../controllers/chatController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { chatImageUpload } = require("../utils/chatUpload");

const router = express.Router();

router.use(requireAuth, requireRoles("student"));

function uploadChatImage(req, res, next) {
  chatImageUpload.single("image")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each chat image must be 5MB or smaller."
        : error.message || "Unable to upload chat image.";

    res.status(400).json({ message });
  });
}

router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createConversation);
router.get("/attachments/:fileId", chatController.downloadAttachment);
router.get("/conversations/:id", chatController.getConversationById);
router.patch("/conversations/:id", chatController.renameConversation);
router.delete("/conversations/:id", chatController.deleteConversation);
router.post("/conversations/:id/messages", uploadChatImage, chatController.sendMessage);
router.patch(
  "/conversations/:id/messages/:messageId/rating",
  chatController.rateMessage
);

module.exports = router;
