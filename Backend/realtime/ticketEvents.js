const { emitToRoles, emitToUser } = require("./socket");

function buildTicketEventPayload(ticket) {
  return {
    ticketId: String(ticket?._id || ""),
    status: ticket?.status || "",
    priority: ticket?.priority || "",
    at: new Date().toISOString(),
  };
}

function notifyTicketChanged(ticket) {
  const payload = buildTicketEventPayload(ticket);

  if (ticket?.student?._id) {
    emitToUser(ticket.student._id, "ticket:changed", payload);
  }

  emitToRoles(["admin", "staff"], "ticket:changed", payload);
}

function notifyTicketFeedbackChanged(ticket) {
  const payload = buildTicketEventPayload(ticket);

  if (ticket?.student?._id) {
    emitToUser(ticket.student._id, "ticket:feedbackChanged", payload);
  }

  emitToRoles(["admin"], "ticket:feedbackChanged", payload);
}

module.exports = {
  notifyTicketChanged,
  notifyTicketFeedbackChanged,
};
