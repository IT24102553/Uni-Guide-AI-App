const {
  FEEDBACK_ELIGIBLE_STATUSES,
  createFeedbackSummary,
  createTicketFeedback,
  isFeedbackEligibleStatus,
} = require("../models/TicketFeedback");

function cloneTicket(ticket) {
  return JSON.parse(JSON.stringify(ticket));
}

function isFeedbackEligible(ticket) {
  return isFeedbackEligibleStatus(ticket.status);
}

function createFeedbackService(tickets) {
  function listResolvedTickets() {
    return tickets.filter(isFeedbackEligible).map(cloneTicket);
  }

  function saveFeedback(ticketId, payload) {
    const ticket = tickets.find((item) => item.id === ticketId);

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!isFeedbackEligible(ticket)) {
      throw new Error("Feedback can only be added for resolved or closed tickets.");
    }

    ticket.feedback = createTicketFeedback(payload, ticket.feedback);
    ticket.updatedAt = ticket.feedback.updatedAt;

    return cloneTicket(ticket);
  }

  function removeFeedback(ticketId) {
    const ticket = tickets.find((item) => item.id === ticketId);

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    if (!ticket.feedback) {
      throw new Error("No feedback is available for this ticket.");
    }

    ticket.feedback = null;
    ticket.updatedAt = new Date().toISOString();

    return cloneTicket(ticket);
  }

  function getDashboard() {
    const feedbackTickets = tickets.filter((ticket) => isFeedbackEligible(ticket) && ticket.feedback);

    return {
      summary: createFeedbackSummary(tickets),
      feedbacks: feedbackTickets.map(cloneTicket),
    };
  }

  return {
    getDashboard,
    listResolvedTickets,
    removeFeedback,
    saveFeedback,
  };
}

module.exports = {
  createFeedbackService,
  eligibleStatuses: FEEDBACK_ELIGIBLE_STATUSES,
};
