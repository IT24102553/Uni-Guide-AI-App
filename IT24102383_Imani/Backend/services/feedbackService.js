const eligibleStatuses = ["Resolved", "Closed"];

function cloneTicket(ticket) {
  return JSON.parse(JSON.stringify(ticket));
}

function isFeedbackEligible(ticket) {
  return eligibleStatuses.includes(ticket.status);
}

function validateRating(rating) {
  const numericRating = Number(rating);

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error("Rating must be between 1 and 5 stars.");
  }

  return numericRating;
}

function validateComment(comment) {
  const cleanComment = String(comment || "").trim();

  if (cleanComment.length > 500) {
    throw new Error("Feedback comment must be 500 characters or fewer.");
  }

  return cleanComment;
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

    const now = new Date().toISOString();
    ticket.feedback = {
      rating: validateRating(payload.rating),
      comment: validateComment(payload.comment),
      submittedAt: ticket.feedback?.submittedAt || now,
      updatedAt: now,
    };
    ticket.updatedAt = now;

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
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const totalRating = feedbackTickets.reduce((sum, ticket) => {
      const rating = Number(ticket.feedback.rating);
      breakdown[rating] += 1;
      return sum + rating;
    }, 0);

    return {
      summary: {
        totalSubmissions: feedbackTickets.length,
        averageRating: feedbackTickets.length
          ? Number((totalRating / feedbackTickets.length).toFixed(1))
          : 0,
        breakdown,
      },
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
  eligibleStatuses,
};
