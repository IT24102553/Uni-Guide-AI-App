const Ticket = require("../models/Ticket");
const User = require("../models/User");
const appError = require("../utils/appError");

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

function assertCanDeleteTicket(ticket, viewer) {
  if (viewer.role === "admin") {
    return;
  }

  if (viewer.role === "student" && studentOwnsTicket(ticket, viewer._id)) {
    if (ticket.status !== "New") {
      throw appError("Students can only delete their own tickets while the status is New", 400);
    }

    return;
  }

  throw appError("You do not have permission to delete this ticket", 403);
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

function serializeTicket(ticket, viewerRole, feedbackOverride = null) {
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
    feedback: formatTicketFeedback(feedbackOverride),
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

module.exports = {
  FEEDBACK_ATTACHMENT_LIMIT,
  PRIORITIES,
  STATUSES,
  assertCanManageFeedback,
  assertCanDeleteTicket,
  assertCanViewTicket,
  assertValidTicketRecord,
  buildTicketSnapshot,
  formatAssignedTo,
  formatStudentSnapshot,
  formatTicketFeedback,
  isValidTicketRecord,
  loadTicketOrThrow,
  normalizeFeedbackComment,
  normalizeFeedbackRating,
  normalizeIdList,
  normalizeLongText,
  normalizeOptionalString,
  parseBoolean,
  requireField,
  resolveStaffAssignee,
  resolveStudent,
  resolveViewer,
  serializeTicket,
};
