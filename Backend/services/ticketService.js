const crypto = require("crypto");
const Ticket = require("../models/Ticket");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  getAttachmentDownload,
  storeAttachments,
} = require("../utils/ticketAttachmentStore");
const {
  PRIORITIES,
  STATUSES,
  assertCanViewTicket,
  assertValidTicketRecord,
  buildTicketSnapshot,
  loadTicketOrThrow,
  normalizeOptionalString,
  parseBoolean,
  requireField,
  resolveStaffAssignee,
  resolveStudent,
  resolveViewer,
  serializeTicket,
} = require("./ticketSharedService");

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
    .filter((ticket) => {
      try {
        assertValidTicketRecord(ticket);
        return true;
      } catch (error) {
        return false;
      }
    })
    .map((ticket) => serializeTicket(ticket, viewer.role));
}

async function getTicketById(ticketId, filters = {}) {
  const viewer = await resolveViewer(filters.viewerId, filters.viewerRole);
  const ticket = await loadTicketOrThrow(ticketId);
  assertValidTicketRecord(ticket);

  assertCanViewTicket(ticket, viewer);

  return serializeTicket(ticket, viewer.role);
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
  addReply,
};
