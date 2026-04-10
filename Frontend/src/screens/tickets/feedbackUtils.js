export const FEEDBACK_MAX_COMMENT_LENGTH = 500;

const RATING_TITLES = {
  1: "Needs attention",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent!",
};

const RATING_EMOJIS = {
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
};

export function isFeedbackEligibleStatus(status) {
  return ["Resolved", "Closed"].includes(String(status || ""));
}

export function createFeedbackForm(feedback) {
  return {
    rating: Number(feedback?.rating || 0),
    comment: String(feedback?.comment || ""),
  };
}

export function validateFeedbackForm(form) {
  const rating = Number(form?.rating || 0);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Please select a star rating before saving your feedback.";
  }

  if (String(form?.comment || "").trim().length > FEEDBACK_MAX_COMMENT_LENGTH) {
    return `Feedback must be ${FEEDBACK_MAX_COMMENT_LENGTH} characters or fewer.`;
  }

  return "";
}

export function getRatingTitle(rating) {
  return RATING_TITLES[Number(rating)] || "Your Feedback";
}

export function getRatingEmoji(rating) {
  return RATING_EMOJIS[Number(rating)] || "";
}

export function getRatingLabel(rating) {
  const title = getRatingTitle(rating);
  const emoji = getRatingEmoji(rating);

  return emoji ? `${title} ${emoji}` : title;
}
