const ticketFeedbackService = require("../services/ticketFeedbackService");
const {
  notifyTicketChanged,
  notifyTicketFeedbackChanged,
} = require("../realtime/ticketEvents");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function getFeedbackDashboard(req, res) {
  try {
    const data = await ticketFeedbackService.getFeedbackDashboard({
      viewerId: req.user._id,
      viewerRole: req.user.role,
    });

    res.status(200).json({
      message: "Ticket feedback fetched successfully",
      ...data,
    });
  } catch (error) {
    sendError(res, error, "Error fetching ticket feedback");
  }
}

async function upsertTicketFeedback(req, res) {
  try {
    const ticket = await ticketFeedbackService.upsertTicketFeedback(req.params.id, {
      ...req.body,
      viewerId: req.user._id,
      viewerRole: req.user.role,
      attachments: req.files,
    });
    notifyTicketChanged(ticket);
    notifyTicketFeedbackChanged(ticket);

    res.status(200).json({
      message: "Ticket feedback saved successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error saving ticket feedback");
  }
}

async function deleteTicketFeedback(req, res) {
  try {
    const ticket = await ticketFeedbackService.deleteTicketFeedback(req.params.id, {
      ...req.body,
      viewerId: req.user._id,
      viewerRole: req.user.role,
    });
    notifyTicketChanged(ticket);
    notifyTicketFeedbackChanged(ticket);

    res.status(200).json({
      message: "Ticket feedback deleted successfully",
      ticket,
    });
  } catch (error) {
    sendError(res, error, "Error deleting ticket feedback");
  }
}

module.exports = {
  getFeedbackDashboard,
  upsertTicketFeedback,
  deleteTicketFeedback,
};
