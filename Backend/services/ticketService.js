const crypto = require("crypto");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  getAttachmentDownload,
  storeAttachments,
} = require("../utils/ticketAttachmentStore");

const ROLES = ["student", "staff", "admin"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["New", "In Progress", "Escalated", "Resolved", "Closed"];
const FEEDBACK_ELIGIBLE_STATUSES = ["Resolved", "Closed"];
const PHONE_PATTERN = /^0\d{9}$/;
const FEEDBACK_COMMENT_LIMIT = 500;
const FEEDBACK_ATTACHMENT_LIMIT = 5;

function normalizeString(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || "";
}

function normalizeLongText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return Boolean(value);
}

function normalizeIdList(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeIdList(item));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[")) {
      try {
        return normalizeIdList(JSON.parse(trimmed));
      } catch (error) {
        return [];
      }
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

function normalizeRole(role) {
  const normalized = normalizeOptionalString(role).toLowerCase();

  if (!ROLES.includes(normalized)) {
    throw appError("Invalid viewer role", 400);
  }

  return normalized;
}

function requireField(value, message) {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw appError(message, 400);
  }

  return normalized;
}

async function generateTicketCode() {
  for (let index = 0; index < 5; index += 1) {
    const ticketCode = `TIC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const exists = await Ticket.exists({ ticketCode });

    if (!exists) {
      return ticketCode;
    }
  }

  throw appError("Unable to generate a unique ticket code", 500);
}

async function resolveStudent(studentId) {
  const id = normalizeOptionalString(studentId);

  if (!id) {
    throw appError("Student account is required", 400);
  }

  const student = await User.findById(id);

  if (!student || student.role !== "student") {
    throw appError("Student account not found", 404);
  }

  if (student.status === "inactive") {
    throw appError("Student account is inactive", 403);
  }

  return student;
}

async function resolveViewer(viewerId, viewerRole) {
  const role = normalizeRole(viewerRole);
  const id = normalizeOptionalString(viewerId);

  if (!id) {
    throw appError("Viewer account is required", 400);
  }

  const viewer = await User.findById(id);

  if (!viewer) {
    throw appError("Viewer not found", 404);
  }

  if (viewer.role !== role) {
    throw appError("Viewer role mismatch", 400);
  }

  if (viewer.status === "inactive") {
    throw appError("Viewer account is inactive", 403);
  }

  return viewer;
}

async function resolveStaffAssignee(assigneeId) {
  const id = normalizeOptionalString(assigneeId);

  if (!id) {
    return null;
  }

  const user = await User.findById(id);

  if (!user || user.role !== "staff") {
    throw appError("Assigned staff member not found", 404);
  }

  if (user.status === "inactive") {
    throw appError("Assigned staff member is inactive", 400);
  }

  return user;
}

function studentOwnsTicket(ticket, studentId) {
  return String(ticket.student?._id || ticket.student) === String(studentId);
}

function staffOwnsTicket(ticket, staffId) {
  return String(ticket.assignedTo?._id || ticket.assignedTo || "") === String(staffId);
}

function assertCanViewTicket(ticket, viewer) {
  if (viewer.role === "admin") {
    return;
  }

  if (viewer.role === "student" && studentOwnsTicket(ticket, viewer._id)) {
    return;
  }

  if (viewer.role === "staff" && staffOwnsTicket(ticket, viewer._id)) {
    return;
  }

  throw appError("You do not have access to this ticket", 403);
}

function formatStudentSnapshot(ticket) {
  const student = ticket.student && typeof ticket.student === "object" ? ticket.student : null;
  const snapshot = ticket.studentSnapshot || {};

  return {
    _id: student?._id || ticket.student || null,
    name: snapshot.name || student?.name || "",
    email: snapshot.email || student?.email || "",
    registrationNumber:
      snapshot.registrationNumber ||
      student?.studentProfile?.registrationNumber ||
      student?.studentProfile?.studentId ||
      "",
    faculty: snapshot.faculty || student?.studentProfile?.faculty || "",
    campus: snapshot.campus || student?.studentProfile?.campus || "",
    contactNumber: snapshot.contactNumber || student?.phone || "",
  };
}

function formatAssignedTo(ticket) {
  const assignee = ticket.assignedTo && typeof ticket.assignedTo === "object" ? ticket.assignedTo : null;

  if (!assignee && !ticket.assignedTo) {
    return null;
  }

  return {
    _id: assignee?._id || ticket.assignedTo || null,
    name: assignee?.name || "",
    email: assignee?.email || "",
    department: assignee?.staffProfile?.department || ticket.assignedDepartment || "",
  };
}

function formatTicketFeedback(feedback) {
  if (!feedback?.rating) {
    return null;
  }

  return {
    _id: feedback._id,
    rating: feedback.rating,
    comment: feedback.comment || "",
    attachments: formatAttachments(feedback.attachments),
    submittedAt: feedback.submittedAt,
    updatedAt: feedback.updatedAt,
  };
}

function formatAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
    _id: attachment._id,
    fileId: attachment.fileId || "",
    originalName: attachment.originalName,
    storedName: attachment.storedName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.url,
    uploadedAt: attachment.uploadedAt,
  }));
}

function formatReplies(ticket, viewerRole) {
  const replies = Array.isArray(ticket.replies) ? ticket.replies : [];

  return replies
    .filter((reply) => !(viewerRole === "student" && reply.isInternal))
    .map((reply) => ({
      _id: reply._id,
      authorId: reply.author || null,
      authorName: reply.authorName,
      authorRole: reply.authorRole,
      message: reply.message,
      attachments: formatAttachments(reply.attachments),
      isInternal: Boolean(reply.isInternal),
      createdAt: reply.createdAt,
    }));
}

function isValidTicketRecord(ticket) {
  const snapshot = ticket?.studentSnapshot || {};

  return (
    Boolean(normalizeOptionalString(ticket?.ticketCode)) &&
    Boolean(normalizeOptionalString(ticket?.requestType)) &&
    Boolean(normalizeOptionalString(ticket?.department)) &&
    Boolean(normalizeOptionalString(ticket?.subject)) &&
    Boolean(normalizeLongText(ticket?.message)) &&
    Boolean(normalizeOptionalString(snapshot.name)) &&
    Boolean(normalizeOptionalString(snapshot.email)) &&
    PRIORITIES.includes(normalizeOptionalString(ticket?.priority)) &&
    STATUSES.includes(normalizeOptionalString(ticket?.status))
  );
}

function assertValidTicketRecord(ticket) {
  if (!isValidTicketRecord(ticket)) {
    throw appError(
      "This ticket record is incomplete and cannot be shown in the current ticket workspace",
      404
    );
  }
}

function serializeTicket(ticket, viewerRole) {
  const replies = formatReplies(ticket, viewerRole);

  return {
    _id: ticket._id,
    ticketCode: ticket.ticketCode,
    requestType: ticket.requestType,
    requestSubType: ticket.requestSubType || "",
    department: ticket.department,
    subject: ticket.subject,
    message: ticket.message,
    attachments: formatAttachments(ticket.attachments),
    priority: ticket.priority,
    status: ticket.status,
    student: formatStudentSnapshot(ticket),
    assignedTo: formatAssignedTo(ticket),
    feedback: formatTicketFeedback(ticket.feedback),
    replyCount: replies.length,
    replies,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

async function loadTicketOrThrow(ticketId) {
  const ticket = await Ticket.findById(ticketId)
    .populate("student", "name email phone studentProfile")
    .populate("assignedTo", "name email staffProfile");

  if (!ticket) {
    throw appError("Ticket not found", 404);
  }

  return ticket;
}

function buildTicketSnapshot(data, student) {
  const registrationNumber = requireField(
    data.registrationNumber || student.studentProfile?.registrationNumber || student.studentProfile?.studentId,
    "Registration number is required"
  );
  const faculty = requireField(
    data.faculty || student.studentProfile?.faculty,
    "Faculty / School is required"
  );
  const campus = requireField(
    data.campus || student.studentProfile?.campus,
    "Campus / Center is required"
  );
  const contactNumber = requireField(
    data.contactNumber || student.phone,
    "Contact number is required"
  );

  if (!PHONE_PATTERN.test(contactNumber)) {
    throw appError("Contact number must be in the format 07XXXXXXXX", 400);
  }

  return {
    name: requireField(data.fullName || student.name, "Full name is required"),
    email: requireField(data.email || student.email, "Email is required").toLowerCase(),
    registrationNumber,
    faculty,
    campus,
    contactNumber,
  };
}

async function createTicket(data) {
  const student = await resolveStudent(data.studentId);
  const studentSnapshot = buildTicketSnapshot(data, student);
  const requestType = requireField(data.requestType, "Request / Inquiry Type is required");
  const requestSubType = normalizeOptionalString(data.requestSubType);
  const department = requireField(data.department, "Department is required");
  const subject = requireField(data.subject, "Subject is required");
  const message = requireField(data.message, "Message is required");
  const attachments = await storeAttachments(data.attachments, {
    scope: "ticket",
    studentId: String(student._id),
  });

  try {
    const ticket = await Ticket.create({
      ticketCode: await generateTicketCode(),
      student: student._id,
      studentSnapshot,
      requestType,
      requestSubType,
      department,
      subject,
      message,
      attachments,
      priority: "Medium",
      status: "New",
    });

    const hydratedTicket = await loadTicketOrThrow(ticket._id);

    return serializeTicket(hydratedTicket, "student");
  } catch (error) {
    await deleteStoredAttachments(attachments).catch(() => undefined);
    throw error;
  }
}

async function getTickets(filters = {}) {
  const viewer = await resolveViewer(filters.viewerId, filters.viewerRole);
  const query = {};

  if (viewer.role === "student") {
    query.student = viewer._id;
  } else if (viewer.role === "staff") {
    query.assignedTo = viewer._id;
  }

  const tickets = await Ticket.find(query)
    .populate("student", "name email phone studentProfile")
    .populate("assignedTo", "name email staffProfile")
    .sort({ updatedAt: -1, createdAt: -1 });

  return tickets
    .filter(isValidTicketRecord)
    .map((ticket) => serializeTicket(ticket, viewer.role));
}

async function getTicketById(ticketId, filters = {}) {
  const viewer = await resolveViewer(filters.viewerId, filters.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanViewTicket(ticket, viewer);

  return serializeTicket(ticket, viewer.role);
}

function assertCanManageFeedback(ticket, viewer) {
  if (viewer.role !== "student" || !studentOwnsTicket(ticket, viewer._id)) {
    throw appError("Only the student who created this ticket can manage feedback", 403);
  }

  if (!FEEDBACK_ELIGIBLE_STATUSES.includes(ticket.status)) {
    throw appError("Feedback can only be submitted for resolved or closed tickets", 400);
  }
}

function normalizeFeedbackRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw appError("Rating must be between 1 and 5 stars", 400);
  }

  return rating;
}

function normalizeFeedbackComment(value) {
  const comment = normalizeLongText(value);

  if (comment.length > FEEDBACK_COMMENT_LIMIT) {
    throw appError(`Feedback comment must be ${FEEDBACK_COMMENT_LIMIT} characters or fewer`, 400);
  }

  return comment;
}

async function updateTicket(ticketId, data) {
  const viewer = await resolveViewer(data.viewerId, data.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanViewTicket(ticket, viewer);

  if (viewer.role === "student") {
    const requestedStatus = normalizeOptionalString(data.status);

    if (requestedStatus !== "Closed") {
      throw appError("Students can only close their own tickets", 403);
    }

    if (ticket.status === "Resolved" || ticket.status === "Closed") {
      ticket.status = "Closed";
    } else {
      throw appError("Only resolved tickets can be closed by students", 400);
    }
  } else {
    if (data.status !== undefined) {
      const nextStatus = requireField(data.status, "Status is required");

      if (!STATUSES.includes(nextStatus)) {
        throw appError("Invalid ticket status", 400);
      }

      ticket.status = nextStatus;
    }

    if (data.priority !== undefined) {
      if (viewer.role !== "admin") {
        throw appError("Only admins can change ticket priority", 403);
      }

      const nextPriority = requireField(data.priority, "Priority is required");

      if (!PRIORITIES.includes(nextPriority)) {
        throw appError("Invalid ticket priority", 400);
      }

      ticket.priority = nextPriority;
    }

    if (data.assignedToId !== undefined) {
      if (viewer.role !== "admin") {
        throw appError("Only admins can assign tickets", 403);
      }

      const assignee = await resolveStaffAssignee(data.assignedToId);
      ticket.assignedTo = assignee?._id || null;
      ticket.assignedDepartment = assignee?.staffProfile?.department || "";
    }
  }

  await ticket.save();

  const updatedTicket = await loadTicketOrThrow(ticket._id);
  return serializeTicket(updatedTicket, viewer.role);
}

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

async function addReply(ticketId, data) {
  const viewer = await resolveViewer(data.viewerId, data.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanViewTicket(ticket, viewer);

  const message = requireField(data.message, "Reply message is required");
  const isInternal = viewer.role === "student" ? false : parseBoolean(data.isInternal);
  const attachments = await storeAttachments(data.attachments, {
    scope: "reply",
    ticketId: String(ticket._id),
    authorId: String(viewer._id),
  });

  try {
    ticket.replies.push({
      author: viewer._id,
      authorName: viewer.name,
      authorRole: viewer.role,
      message,
      attachments,
      isInternal,
    });

    if (!isInternal && (viewer.role === "admin" || viewer.role === "staff") && ticket.status === "New") {
      ticket.status = "In Progress";
    }

    await ticket.save();

    const updatedTicket = await loadTicketOrThrow(ticket._id);
    return serializeTicket(updatedTicket, viewer.role);
  } catch (error) {
    await deleteStoredAttachments(attachments).catch(() => undefined);
    throw error;
  }
}

async function getAttachmentDownloadForViewer(fileId, viewerId, viewerRole) {
  const normalizedFileId = normalizeOptionalString(fileId);

  if (!normalizedFileId) {
    throw appError("Attachment not found", 404);
  }

  const viewer = await resolveViewer(viewerId, viewerRole);
  const ticket = await Ticket.findOne({
    $or: [
      { "attachments.fileId": normalizedFileId },
      { "feedback.attachments.fileId": normalizedFileId },
      { "replies.attachments.fileId": normalizedFileId },
    ],
  })
    .populate("student", "name email phone studentProfile")
    .populate("assignedTo", "name email staffProfile");

  if (!ticket) {
    throw appError("Attachment not found", 404);
  }

  assertValidTicketRecord(ticket);
  assertCanViewTicket(ticket, viewer);
  return getAttachmentDownload(normalizedFileId);
}

module.exports = {
  getAttachmentDownloadForViewer,
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  upsertTicketFeedback,
  deleteTicketFeedback,
  getFeedbackDashboard,
  addReply,
};
