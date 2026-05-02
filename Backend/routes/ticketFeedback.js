const express = require("express");
const ticketFeedbackController = require("../controllers/ticketFeedbackController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { uploadTicketAttachments } = require("../middleware/ticketAttachmentUpload");

const router = express.Router();

router.use(requireAuth);

router.get("/feedback", requireRoles("admin"), ticketFeedbackController.getFeedbackDashboard);
router.put(
  "/:id/feedback",
  requireRoles("student"),
  uploadTicketAttachments,
  ticketFeedbackController.upsertTicketFeedback
);
router.delete("/:id/feedback", requireRoles("student"), ticketFeedbackController.deleteTicketFeedback);

module.exports = router;
