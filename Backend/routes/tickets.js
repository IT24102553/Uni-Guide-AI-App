const express = require("express");
const ticketController = require("../controllers/ticketController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { attachmentUpload } = require("../utils/ticketUpload");

const router = express.Router();

function uploadAttachments(req, res, next) {
  attachmentUpload.array("attachments", 5)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each attachment must be 5MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "You can attach up to 5 files per ticket."
          : error.message || "Unable to upload attachments.";

    res.status(400).json({ message });
  });
}

router.use(requireAuth);

router.post("/", requireRoles("student"), uploadAttachments, ticketController.createTicket);
router.get("/", ticketController.getTickets);
router.get("/feedback", requireRoles("admin"), ticketController.getFeedbackDashboard);
router.get("/attachments/:fileId", ticketController.downloadAttachment);
router.get("/:id", ticketController.getTicketById);
router.patch("/:id", ticketController.updateTicket);
router.put("/:id/feedback", requireRoles("student"), uploadAttachments, ticketController.upsertTicketFeedback);
router.delete("/:id/feedback", requireRoles("student"), ticketController.deleteTicketFeedback);
router.post("/:id/replies", uploadAttachments, ticketController.addReply);

module.exports = router;
