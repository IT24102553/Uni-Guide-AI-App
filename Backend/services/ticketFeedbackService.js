const TicketFeedback = require("../models/TicketFeedback");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  storeAttachments,
} = require("../utils/ticketAttachmentStore");
const {
  clearLegacyFeedbackForTicketIds,
  getFeedbackForTicket,
  migrateAllLegacyFeedbacks,
} = require("./ticketFeedbackStore");
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

function toPlainAttachments(attachments = []) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) =>
    attachment?.toObject ? attachment.toObject() : attachment
  );
}

async function upsertTicketFeedback(ticketId, data) {
  const viewer = await resolveViewer(data.viewerId, data.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanManageFeedback(ticket, viewer);

  const currentFeedback = await getFeedbackForTicket(ticket);
  const removedAttachmentIds = new Set(normalizeIdList(data.removedAttachmentIds));
  const currentAttachments = toPlainAttachments(currentFeedback?.attachments);
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
    const feedback = currentFeedback || new TicketFeedback();

    feedback.ticket = ticket._id;
    feedback.student = ticket.student?._id || ticket.student;
    feedback.rating = normalizeFeedbackRating(data.rating);
    feedback.comment = normalizeFeedbackComment(data.comment);
    feedback.attachments = [...remainingAttachments, ...uploadedAttachments];
    feedback.submittedAt = currentFeedback?.submittedAt || now;
    feedback.updatedAt = now;

    await feedback.save();

    ticket.updatedAt = now;
    await ticket.save();
    await clearLegacyFeedbackForTicketIds([ticket._id]);

    if (attachmentsToRemove.length) {
      await deleteStoredAttachments(attachmentsToRemove).catch(() => undefined);
    }

    const updatedTicket = await loadTicketOrThrow(ticket._id);
    return serializeTicket(updatedTicket, viewer.role, feedback);
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

  const currentFeedback = await getFeedbackForTicket(ticket);

  if (!currentFeedback?.rating) {
    throw appError("No feedback has been submitted for this ticket yet", 404);
  }

  const attachmentsToDelete = toPlainAttachments(currentFeedback.attachments);
  const now = new Date();

  await TicketFeedback.deleteOne({ ticket: ticket._id });

  ticket.updatedAt = now;
  await ticket.save();
  await clearLegacyFeedbackForTicketIds([ticket._id]);

  if (attachmentsToDelete.length) {
    await deleteStoredAttachments(attachmentsToDelete).catch(() => undefined);
  }

  const updatedTicket = await loadTicketOrThrow(ticket._id);
  return serializeTicket(updatedTicket, viewer.role, null);
}

async function getFeedbackDashboard(filters = {}) {
  const viewer = await resolveViewer(filters.viewerId, filters.viewerRole);

  if (viewer.role !== "admin") {
    throw appError("Only admins can review ticket feedback", 403);
  }

  await migrateAllLegacyFeedbacks();

  const feedbackRecords = await TicketFeedback.find({})
    .populate({
      path: "ticket",
      populate: [
        { path: "student", select: "name email phone studentProfile" },
        { path: "assignedTo", select: "name email staffProfile" },
      ],
    })
    .sort({ updatedAt: -1, submittedAt: -1 });

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingTotal = 0;

  const feedbacks = feedbackRecords
    .filter((record) => record.ticket && isValidTicketRecord(record.ticket))
    .map((record) => {
      const rating = Number(record.rating || 0);

      if (breakdown[rating] !== undefined) {
        breakdown[rating] += 1;
        ratingTotal += rating;
      }

      return {
        ticketId: record.ticket._id,
        ticketCode: record.ticket.ticketCode,
        status: record.ticket.status,
        priority: record.ticket.priority,
        requestType: record.ticket.requestType,
        requestSubType: record.ticket.requestSubType || "",
        subject: record.ticket.subject,
        student: formatStudentSnapshot(record.ticket),
        assignedTo: formatAssignedTo(record.ticket),
        feedback: formatTicketFeedback(record),
        updatedAt: record.updatedAt,
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
