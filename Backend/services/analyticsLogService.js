const AnalyticsLog = require("../models/AnalyticsLog");
const Announcement = require("../models/Announcement");
const KnowledgeBaseDocument = require("../models/KnowledgeBaseDocument");
const KnowledgeBaseFaq = require("../models/KnowledgeBaseFaq");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  getAttachmentDownload,
  storeAttachments,
} = require("../utils/ticketAttachmentStore");

const LOG_CATEGORIES = ["usage", "incident", "security", "maintenance", "report", "other"];
const LOG_SEVERITIES = ["Low", "Medium", "High", "Critical"];
const LOG_STATUSES = ["Open", "In Review", "Resolved", "Archived"];
const ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME = "analyticsLogAttachments";
const TITLE_LIMIT = 120;
const SOURCE_LIMIT = 120;
const NOTES_LIMIT = 4000;
const OPEN_TICKET_STATUSES = ["New", "In Progress", "Escalated"];
const RESOLVED_TICKET_STATUSES = ["Resolved", "Closed"];
const URGENT_TICKET_PRIORITIES = ["High", "Urgent"];

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

function buildLocalDate(year, month, day) {
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseDateInput(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value);
  }

  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return buildLocalDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    return buildLocalDate(Number(slashMatch[3]), Number(slashMatch[1]), Number(slashMatch[2]));
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds(),
    parsed.getMilliseconds()
  );
}

function normalizeEventDate(value) {
  const eventDate = parseDateInput(value);

  if (!eventDate) {
    throw appError("Enter a valid event date", 400);
  }

  return eventDate;
}

function validateEnum(label, value, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw appError(`Select a valid ${label}`, 400);
  }
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

function formatAttachments(attachments = []) {
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

function serializeLog(log) {
  const item = log.toObject ? log.toObject() : log;

  return {
    _id: item._id,
    title: item.title,
    category: item.category,
    severity: item.severity,
    status: item.status,
    source: item.source || "",
    notes: item.notes,
    eventDate: item.eventDate,
    reportedByName: item.reportedByName || "Admin",
    attachments: formatAttachments(item.attachments),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function prepareLogPayload(data, existingLog) {
  const current = existingLog?.toObject ? existingLog.toObject() : existingLog || {};
  const title = normalizeString(data.title !== undefined ? data.title : current.title);
  const category = normalizeOptionalString(
    data.category !== undefined ? data.category : current.category || "incident"
  ).toLowerCase();
  const severity = normalizeOptionalString(
    data.severity !== undefined ? data.severity : current.severity || "Medium"
  );
  const status = normalizeOptionalString(
    data.status !== undefined ? data.status : current.status || "Open"
  );
  const source = normalizeOptionalString(data.source !== undefined ? data.source : current.source);
  const notes = normalizeLongText(data.notes !== undefined ? data.notes : current.notes);
  const eventDate = normalizeEventDate(
    data.eventDate !== undefined ? data.eventDate : current.eventDate
  );
  const reportedByName =
    normalizeString(
      data.reportedByName !== undefined
        ? data.reportedByName
        : current.reportedByName || "Admin"
    ) || "Admin";

  if (!title) {
    throw appError("Title is required", 400);
  }

  if (title.length > TITLE_LIMIT) {
    throw appError(`Title must be ${TITLE_LIMIT} characters or fewer`, 400);
  }

  validateEnum("category", category, LOG_CATEGORIES);
  validateEnum("severity", severity, LOG_SEVERITIES);
  validateEnum("status", status, LOG_STATUSES);

  if (source.length > SOURCE_LIMIT) {
    throw appError(`Source must be ${SOURCE_LIMIT} characters or fewer`, 400);
  }

  if (!notes) {
    throw appError("Notes are required", 400);
  }

  if (notes.length > NOTES_LIMIT) {
    throw appError(`Notes must be ${NOTES_LIMIT} characters or fewer`, 400);
  }

  return {
    title,
    category,
    severity,
    status,
    source,
    notes,
    eventDate,
    reportedByName,
  };
}

async function getSummary() {
  const [
    totalUsers,
    studentUsers,
    staffUsers,
    adminUsers,
    totalAnnouncements,
    activeAnnouncements,
    totalTickets,
    openTickets,
    urgentTickets,
    pendingAssignmentTickets,
    resolvedTickets,
    totalKnowledgeBaseDocuments,
    totalKnowledgeBaseFaqs,
    totalLogs,
    openLogs,
    resolvedLogs,
    criticalLogs,
    logsByCategory,
    logsBySeverity,
    recentLogs,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "staff" }),
    User.countDocuments({ role: "admin" }),
    Announcement.countDocuments({}),
    Announcement.countDocuments({ expiryDate: { $gte: new Date() } }),
    Ticket.countDocuments({}),
    Ticket.countDocuments({ status: { $in: OPEN_TICKET_STATUSES } }),
    Ticket.countDocuments({
      status: { $in: OPEN_TICKET_STATUSES },
      priority: { $in: URGENT_TICKET_PRIORITIES },
    }),
    Ticket.countDocuments({
      status: { $in: OPEN_TICKET_STATUSES },
      assignedTo: null,
    }),
    Ticket.countDocuments({ status: { $in: RESOLVED_TICKET_STATUSES } }),
    KnowledgeBaseDocument.countDocuments({}),
    KnowledgeBaseFaq.countDocuments({}),
    AnalyticsLog.countDocuments({}),
    AnalyticsLog.countDocuments({ status: { $in: ["Open", "In Review"] } }),
    AnalyticsLog.countDocuments({ status: "Resolved" }),
    AnalyticsLog.countDocuments({ severity: "Critical" }),
    AnalyticsLog.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    AnalyticsLog.aggregate([
      { $group: { _id: "$severity", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    AnalyticsLog.find({}).sort({ eventDate: -1, updatedAt: -1 }).limit(5),
  ]);

  return {
    summary: {
      users: {
        total: totalUsers,
        students: studentUsers,
        staff: staffUsers,
        admins: adminUsers,
      },
      support: {
        totalTickets,
        openTickets,
        urgentTickets,
        pendingAssignmentTickets,
        resolvedTickets,
      },
      content: {
        announcements: totalAnnouncements,
        activeAnnouncements,
        knowledgeBaseDocuments: totalKnowledgeBaseDocuments,
        knowledgeBaseFaqs: totalKnowledgeBaseFaqs,
      },
      logs: {
        totalLogs,
        openLogs,
        resolvedLogs,
        criticalLogs,
      },
    },
    breakdowns: {
      logsByCategory: logsByCategory.map((item) => ({
        key: item._id || "other",
        count: item.count,
      })),
      logsBySeverity: logsBySeverity.map((item) => ({
        key: item._id || "Unknown",
        count: item.count,
      })),
    },
    recentLogs: recentLogs.map(serializeLog),
  };
}

async function getRecords(filters = {}) {
  const query = {};

  if (filters.category) {
    const category = normalizeOptionalString(filters.category).toLowerCase();

    if (category && category !== "all") {
      validateEnum("category", category, LOG_CATEGORIES);
      query.category = category;
    }
  }

  if (filters.severity) {
    const severity = normalizeOptionalString(filters.severity);

    if (severity && severity !== "all") {
      validateEnum("severity", severity, LOG_SEVERITIES);
      query.severity = severity;
    }
  }

  if (filters.status) {
    const status = normalizeOptionalString(filters.status);

    if (status && status !== "all") {
      validateEnum("status", status, LOG_STATUSES);
      query.status = status;
    }
  }

  if (filters.search) {
    const searchRegex = new RegExp(normalizeOptionalString(filters.search), "i");
    query.$or = [
      { title: searchRegex },
      { source: searchRegex },
      { notes: searchRegex },
      { reportedByName: searchRegex },
    ];
  }

  const records = await AnalyticsLog.find(query).sort({
    eventDate: -1,
    updatedAt: -1,
    createdAt: -1,
  });

  return records.map(serializeLog);
}

async function createRecord(data) {
  const payload = prepareLogPayload(data);
  const attachments = await storeAttachments(
    data.attachments,
    {
      scope: "analytics-log",
      title: payload.title,
      category: payload.category,
      severity: payload.severity,
    },
    { bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME }
  );

  try {
    const record = await AnalyticsLog.create({
      ...payload,
      attachments,
    });

    return serializeLog(record);
  } catch (error) {
    await deleteStoredAttachments(attachments, {
      bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME,
    }).catch(() => undefined);
    throw error;
  }
}

async function updateRecord(id, data) {
  const record = await AnalyticsLog.findById(id);

  if (!record) {
    throw appError("Log record not found", 404);
  }

  const payload = prepareLogPayload(data, record);
  const removedAttachmentIds = new Set(normalizeIdList(data.removedAttachmentIds));
  const currentAttachments = Array.isArray(record.attachments)
    ? record.attachments.map((attachment) =>
        attachment.toObject ? attachment.toObject() : attachment
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
  const uploadedAttachments = await storeAttachments(
    data.attachments,
    {
      scope: "analytics-log",
      logId: String(record._id),
      title: payload.title,
      category: payload.category,
      severity: payload.severity,
    },
    { bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME }
  );

  try {
    record.title = payload.title;
    record.category = payload.category;
    record.severity = payload.severity;
    record.status = payload.status;
    record.source = payload.source;
    record.notes = payload.notes;
    record.eventDate = payload.eventDate;
    record.reportedByName = payload.reportedByName;
    record.attachments = [...remainingAttachments, ...uploadedAttachments];

    await record.save();

    if (attachmentsToRemove.length) {
      await deleteStoredAttachments(attachmentsToRemove, {
        bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME,
      }).catch(() => undefined);
    }

    return serializeLog(record);
  } catch (error) {
    await deleteStoredAttachments(uploadedAttachments, {
      bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME,
    }).catch(() => undefined);
    throw error;
  }
}

async function deleteRecord(id) {
  const record = await AnalyticsLog.findByIdAndDelete(id);

  if (!record) {
    throw appError("Log record not found", 404);
  }

  await deleteStoredAttachments(record.attachments, {
    bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME,
  }).catch(() => undefined);

  return serializeLog(record);
}

module.exports = {
  LOG_CATEGORIES,
  LOG_SEVERITIES,
  LOG_STATUSES,
  ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME,
  getSummary,
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  getAttachmentDownload(fileId) {
    return getAttachmentDownload(fileId, {
      bucketName: ANALYTICS_LOG_ATTACHMENT_BUCKET_NAME,
    });
  },
};
