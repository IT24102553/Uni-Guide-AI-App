const FEEDBACK_COMMENT_LIMIT = 500;
const FEEDBACK_ELIGIBLE_STATUSES = ["Resolved", "Closed"];

function isFeedbackEligibleStatus(status) {
  return FEEDBACK_ELIGIBLE_STATUSES.includes(String(status || ""));
}

function normalizeRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5 stars.");
  }

  return rating;
}

function normalizeComment(value) {
  const comment = String(value || "").trim();

  if (comment.length > FEEDBACK_COMMENT_LIMIT) {
    throw new Error(`Feedback comment must be ${FEEDBACK_COMMENT_LIMIT} characters or fewer.`);
  }

  return comment;
}

function createTicketFeedback(payload = {}, existingFeedback = null) {
  const now = new Date().toISOString();

  return {
    rating: normalizeRating(payload.rating),
    comment: normalizeComment(payload.comment),
    submittedAt: existingFeedback?.submittedAt || now,
    updatedAt: now,
  };
}

function createFeedbackSummary(tickets) {
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const feedbackTickets = tickets.filter((ticket) => isFeedbackEligibleStatus(ticket.status) && ticket.feedback);
  const totalRating = feedbackTickets.reduce((sum, ticket) => {
    const rating = Number(ticket.feedback.rating);
    breakdown[rating] += 1;
    return sum + rating;
  }, 0);

  return {
    totalSubmissions: feedbackTickets.length,
    averageRating: feedbackTickets.length ? Number((totalRating / feedbackTickets.length).toFixed(1)) : 0,
    breakdown,
  };
}

module.exports = {
  FEEDBACK_COMMENT_LIMIT,
  FEEDBACK_ELIGIBLE_STATUSES,
  createFeedbackSummary,
  createTicketFeedback,
  isFeedbackEligibleStatus,
  normalizeComment,
  normalizeRating,
};
