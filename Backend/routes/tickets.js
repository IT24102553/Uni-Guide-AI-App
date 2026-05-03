const express = require("express");
const ticketController = require("../controllers/ticketController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { uploadTicketAttachments } = require("../middleware/ticketAttachmentUpload");

const router = express.Router();

router.use(requireAuth);

router.post("/", requireRoles("student"), uploadTicketAttachments, ticketController.createTicket);
router.get("/", ticketController.getTickets);
router.get("/attachments/:fileId", ticketController.downloadAttachment);
router.get("/:id", ticketController.getTicketById);
router.patch("/:id", ticketController.updateTicket);
router.post("/:id/replies", uploadTicketAttachments, ticketController.addReply);
router.delete("/:id", ticketController.deleteTicket);

module.exports = router;
