const Ticket = require("../models/Ticket");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  storeAttachments,
} = require("../utils/ticketAttachmentStore");
const {
  FEEDBACK_ATTACHMENT_LIMIT,
  assertCanManageFeedback,
  assertValidTicketRecord,
  formatAssignedTo,
  formatStudentSnapshot,
  formatTicketFeedback,
  isValidTicketRecord,
  loadTicketOrThrow,
  normalizeFeedbackComment,
  normalizeFeedbackRating,
  normalizeIdList,
  resolveViewer,
  serializeTicket,
} = require("./ticketSharedService");

async function upsertTicketFeedback(ticketId, data) {
  const viewer = await resolveViewer(data.viewerId, data.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanManageFeedback(ticket, viewer);

  const removedAttachmentIds = new Set(normalizeIdList(data.removedAttachmentIds));
  const currentAttachments = Array.isArray(ticket.feedback?.attachments)
    ? ticket.feedback.attachments.map((attachment) =>
        attachment?.toObject ? attachment.toObject() : attachment
      )
    : [];
  const attachmentsToRemove = currentAttachments.filter(
    (attachment) =>
      removedAttachmentIds.has(String(attachment.fileId || "")) ||
      removedAttachmentIds.has(String(attachment._id || ""))
  );
  const remainingAttachments = currentAttachments.filter(
    (attachment) =>
      !removedAttachmentIds.has(String(attachment.fileId || "")) &&
      !removedAttachmentIds.has(String(attachment._id || ""))
  );
  const uploadedAttachmentCount = Array.isArray(data.attachments) ? data.attachments.length : 0;

  if (remainingAttachments.length + uploadedAttachmentCount > FEEDBACK_ATTACHMENT_LIMIT) {
    throw appError(
      `You can attach up to ${FEEDBACK_ATTACHMENT_LIMIT} files to ticket feedback`,
      400
    );
  }

  const uploadedAttachments = await storeAttachments(data.attachments, {
    scope: "feedback",
    ticketId: String(ticket._id),
    studentId: String(viewer._id),
  });

  try {
    const now = new Date();
    const nextFeedback = {
      ...(ticket.feedback?.toObject ? ticket.feedback.toObject() : ticket.feedback || {}),
      rating: normalizeFeedbackRating(data.rating),
      comment: normalizeFeedbackComment(data.comment),
      attachments: [...remainingAttachments, ...uploadedAttachments],
      submittedAt: ticket.feedback?.submittedAt || now,
      updatedAt: now,
    };

    ticket.feedback = nextFeedback;

    await ticket.save();

    if (attachmentsToRemove.length) {
      await deleteStoredAttachments(attachmentsToRemove).catch(() => undefined);
    }

    const updatedTicket = await loadTicketOrThrow(ticket._id);
    return serializeTicket(updatedTicket, viewer.role);
  } catch (error) {
    await deleteStoredAttachments(uploadedAttachments).catch(() => undefined);
    throw error;
  }
}

async function deleteTicketFeedback(ticketId, data) {
  const viewer = await resolveViewer(data.viewerId, data.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanManageFeedback(ticket, viewer);

  if (!ticket.feedback?.rating) {
    throw appError("No feedback has been submitted for this ticket yet", 404);
  }

  const attachmentsToDelete = Array.isArray(ticket.feedback?.attachments)
    ? ticket.feedback.attachments.map((attachment) =>
        attachment?.toObject ? attachment.toObject() : attachment
      )
    : [];

  ticket.feedback = null;

  await ticket.save();

  if (attachmentsToDelete.length) {
    await deleteStoredAttachments(attachmentsToDelete).catch(() => undefined);
  }

  const updatedTicket = await loadTicketOrThrow(ticket._id);
  return serializeTicket(updatedTicket, viewer.role);
}

async function getFeedbackDashboard(filters = {}) {
  const viewer = await resolveViewer(filters.viewerId, filters.viewerRole);

  if (viewer.role !== "admin") {
    throw appError("Only admins can review ticket feedback", 403);
  }

  const tickets = await Ticket.find({
    "feedback.rating": { $exists: true },
  })
    .populate("student", "name email phone studentProfile")
    .populate("assignedTo", "name email staffProfile")
    .sort({ "feedback.updatedAt": -1, updatedAt: -1 });

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingTotal = 0;

  const feedbacks = tickets.filter(isValidTicketRecord).map((ticket) => {
    const rating = Number(ticket.feedback?.rating || 0);

    if (breakdown[rating] !== undefined) {
      breakdown[rating] += 1;
      ratingTotal += rating;
    }

    return {
      ticketId: ticket._id,
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      priority: ticket.priority,
      requestType: ticket.requestType,
      requestSubType: ticket.requestSubType || "",
      subject: ticket.subject,
      student: formatStudentSnapshot(ticket),
      assignedTo: formatAssignedTo(ticket),
      feedback: formatTicketFeedback(ticket.feedback),
      updatedAt: ticket.updatedAt,
    };
  });

  const totalSubmissions = feedbacks.length;
  const averageRating = totalSubmissions ? Number((ratingTotal / totalSubmissions).toFixed(1)) : 0;

  return {
    summary: {
      averageRating,
      totalSubmissions,
      breakdown,
    },
    feedbacks,
  };
}

module.exports = {
  upsertTicketFeedback,
  deleteTicketFeedback,
  getFeedbackDashboard,
};
