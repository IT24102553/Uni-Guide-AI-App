const ticketService = require("../services/ticketService");
const { notifyTicketChanged } = require("../realtime/ticketEvents");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function createTicket(req, res) {
  try {
    const ticket = await ticketService.createTicket({
      ...req.body,
      studentId: req.user._id,
      attachments: req.files,
    });
    notifyTicketChanged(ticket);

    res.status(201).json({
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error creating ticket");
  }
}

async function getTickets(req, res) {
  try {
    const tickets = await ticketService.getTickets({
      viewerId: req.user._id,
      viewerRole: req.user.role,
    });

    res.status(200).json({
      message: "Tickets fetched successfully",
      tickets,
    });
  } catch (error) {
    sendError(res, error, "Error fetching tickets");
  }
}

async function getTicketById(req, res) {
  try {
    const ticket = await ticketService.getTicketById(req.params.id, {
      viewerId: req.user._id,
      viewerRole: req.user.role,
    });

    res.status(200).json({
      message: "Ticket fetched successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error fetching ticket");
  }
}

async function updateTicket(req, res) {
  try {
    const ticket = await ticketService.updateTicket(req.params.id, {
      ...req.body,
      viewerId: req.user._id,
      viewerRole: req.user.role,
    });
    notifyTicketChanged(ticket);

    res.status(200).json({
      message: "Ticket updated successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error updating ticket");
  }
}

async function addReply(req, res) {
  try {
    const ticket = await ticketService.addReply(req.params.id, {
      ...req.body,
      viewerId: req.user._id,
      viewerRole: req.user.role,
      attachments: req.files,
    });
    notifyTicketChanged(ticket);

    res.status(200).json({
      message: "Reply sent successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error sending reply");
  }
}

async function deleteTicket(req, res) {
  try {
    const ticket = await ticketService.deleteTicket(req.params.id, {
      viewerId: req.user._id,
      viewerRole: req.user.role,
    });
    notifyTicketChanged(ticket);

    res.status(200).json({
      message: "Ticket deleted successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error deleting ticket");
  }
}

function sanitizeContentDispositionName(filename) {
  return String(filename || "attachment").replace(/["\r\n\\]+/g, "_");
}

async function downloadAttachment(req, res) {
  try {
    const { file, stream } = await ticketService.getAttachmentDownloadForViewer(
      req.params.fileId,
      req.user._id,
      req.user.role
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

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  addReply,
  deleteTicket,
  downloadAttachment,
};
