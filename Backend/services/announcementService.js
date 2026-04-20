const Announcement = require("../models/Announcement");
const appError = require("../utils/appError");
const {
  deleteStoredAttachments,
  getAttachmentDownload,
  storeAttachments,
} = require("../utils/ticketAttachmentStore");

const TYPES = ["general", "event", "important", "urgent"];
const AUDIENCES = ["all", "students", "staff"];
const VIEWER_ROLES = ["student", "staff", "admin"];
const TITLE_LIMIT = 120;
const CONTENT_LIMIT = 2000;
const ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME = "announcementAttachments";

function normalizeString(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLongText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || "";
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
    return buildLocalDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
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

  return buildLocalDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function normalizeExpiryDate(value) {
  const selectedDate = parseDateInput(value);

  if (!selectedDate) {
    throw appError("Enter a valid expiry date", 400);
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (selectedDate <= todayStart) {
    throw appError("Expiry date must be a future date", 400);
  }

  return new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    23,
    59,
    59,
    999
  );
}

function normalizeViewerRole(value) {
  const normalized = normalizeOptionalString(value).toLowerCase();

  if (!normalized) {
    return "";
  }

  if (!VIEWER_ROLES.includes(normalized)) {
    throw appError("Invalid viewer role", 400);
  }

  return normalized;
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

function serializeAnnouncement(announcement) {
  const item = announcement.toObject ? announcement.toObject() : announcement;
  const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;

  return {
    _id: item._id,
    title: item.title,
    type: item.type,
    content: item.content,
    targetAudience: item.targetAudience,
    pinnedToTop: Boolean(item.pinnedToTop),
    authorName: item.authorName || "Admin",
    attachments: formatAttachments(item.attachments),
    expiryDate,
    isExpired: expiryDate ? expiryDate < new Date() : false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function viewerCanAccessAudience(viewerRole, targetAudience) {
  if (viewerRole === "admin") {
    return true;
  }

  if (viewerRole === "student") {
    return targetAudience === "all" || targetAudience === "students";
  }

  if (viewerRole === "staff") {
    return targetAudience === "all" || targetAudience === "staff";
  }

  return false;
}

function assertAnnouncementVisibleToViewer(announcement, viewerRole) {
  const normalizedViewerRole = normalizeViewerRole(viewerRole);

  if (!viewerCanAccessAudience(normalizedViewerRole, announcement.targetAudience)) {
    throw appError("You do not have access to this announcement", 403);
  }

  if (
    normalizedViewerRole !== "admin" &&
    announcement.expiryDate &&
    new Date(announcement.expiryDate) < new Date()
  ) {
    throw appError("Announcement not found", 404);
  }
}

function validateType(type) {
  if (!TYPES.includes(type)) {
    throw appError("Select a valid announcement type", 400);
  }
}

function validateAudience(targetAudience) {
  if (!AUDIENCES.includes(targetAudience)) {
    throw appError("Select a valid target audience", 400);
  }
}

function prepareAnnouncementPayload(data, existingAnnouncement) {
  const current = existingAnnouncement?.toObject ? existingAnnouncement.toObject() : existingAnnouncement || {};
  const title = normalizeString(
    data.title !== undefined ? data.title : current.title
  );
  const type = normalizeOptionalString(
    data.type !== undefined ? data.type : current.type
  ).toLowerCase();
  const content = normalizeLongText(
    data.content !== undefined ? data.content : current.content
  );
  const targetAudience = normalizeOptionalString(
    data.targetAudience !== undefined ? data.targetAudience : current.targetAudience || "all"
  ).toLowerCase();
  const pinnedToTop =
    data.pinnedToTop !== undefined ? parseBoolean(data.pinnedToTop) : Boolean(current.pinnedToTop);
  const authorName = normalizeString(
    data.authorName !== undefined ? data.authorName : current.authorName || "Admin"
  ) || "Admin";
  const expiryDate = normalizeExpiryDate(
    data.expiryDate !== undefined ? data.expiryDate : current.expiryDate
  );

  if (!title) {
    throw appError("Title is required", 400);
  }

  if (title.length > TITLE_LIMIT) {
    throw appError(`Title must be ${TITLE_LIMIT} characters or fewer`, 400);
  }

  validateType(type);
  validateAudience(targetAudience);

  if (!content) {
    throw appError("Content is required", 400);
  }

  if (content.length > CONTENT_LIMIT) {
    throw appError(`Content must be ${CONTENT_LIMIT} characters or fewer`, 400);
  }

  return {
    title,
    type,
    content,
    targetAudience,
    pinnedToTop,
    authorName,
    expiryDate,
  };
}

async function getAnnouncements(filters = {}) {
  const viewerRole = normalizeViewerRole(filters.viewerRole);
  const includeExpired =
    viewerRole === "admin"
      ? (
          filters.includeExpired !== undefined
            ? parseBoolean(filters.includeExpired)
            : true
        )
      : false;
  const pinnedOnly = parseBoolean(filters.pinnedOnly);
  const query = {};

  if (viewerRole === "student") {
    query.targetAudience = { $in: ["all", "students"] };
  } else if (viewerRole === "staff") {
    query.targetAudience = { $in: ["all", "staff"] };
  } else if (filters.targetAudience) {
    const targetAudience = normalizeOptionalString(filters.targetAudience).toLowerCase();
    validateAudience(targetAudience);
    query.targetAudience = targetAudience;
  }

  if (!includeExpired) {
    query.expiryDate = { $gte: new Date() };
  }

  if (pinnedOnly) {
    query.pinnedToTop = true;
  }

  if (filters.search) {
    const searchRegex = new RegExp(normalizeOptionalString(filters.search), "i");
    query.$or = [{ title: searchRegex }, { content: searchRegex }, { authorName: searchRegex }];
  }

  const announcements = await Announcement.find(query).sort({
    pinnedToTop: -1,
    createdAt: -1,
  });

  return announcements.map(serializeAnnouncement);
}

async function getAnnouncementById(id, viewerRole) {
  const announcement = await Announcement.findById(id);

  if (!announcement) {
    throw appError("Announcement not found", 404);
  }

  assertAnnouncementVisibleToViewer(announcement, viewerRole);
  return serializeAnnouncement(announcement);
}

async function createAnnouncement(data) {
  const payload = prepareAnnouncementPayload(data);
  const attachments = await storeAttachments(
    data.attachments,
    {
      scope: "announcement",
      title: payload.title,
      targetAudience: payload.targetAudience,
    },
    { bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME }
  );

  try {
    const announcement = await Announcement.create({
      ...payload,
      attachments,
    });

    return serializeAnnouncement(announcement);
  } catch (error) {
    await deleteStoredAttachments(attachments, {
      bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
    }).catch(() => undefined);
    throw error;
  }
}

async function updateAnnouncement(id, data) {
  const announcement = await Announcement.findById(id);

  if (!announcement) {
    throw appError("Announcement not found", 404);
  }

  const payload = prepareAnnouncementPayload(data, announcement);
  const removedAttachmentIds = new Set(normalizeIdList(data.removedAttachmentIds));
  const currentAttachments = Array.isArray(announcement.attachments)
    ? announcement.attachments.map((attachment) =>
        attachment.toObject ? attachment.toObject() : attachment
      )
    : [];
  const attachmentsToRemove = currentAttachments.filter((attachment) =>
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
      scope: "announcement",
      announcementId: String(announcement._id),
      title: payload.title,
      targetAudience: payload.targetAudience,
    },
    { bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME }
  );

  try {
    announcement.title = payload.title;
    announcement.type = payload.type;
    announcement.content = payload.content;
    announcement.targetAudience = payload.targetAudience;
    announcement.pinnedToTop = payload.pinnedToTop;
    announcement.authorName = payload.authorName;
    announcement.expiryDate = payload.expiryDate;
    announcement.attachments = [...remainingAttachments, ...uploadedAttachments];

    await announcement.save();

    if (attachmentsToRemove.length) {
      await deleteStoredAttachments(attachmentsToRemove, {
        bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
      }).catch(() => undefined);
    }

    return serializeAnnouncement(announcement);
  } catch (error) {
    await deleteStoredAttachments(uploadedAttachments, {
      bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
    }).catch(() => undefined);
    throw error;
  }
}

async function deleteAnnouncement(id) {
  const announcement = await Announcement.findByIdAndDelete(id);

  if (!announcement) {
    throw appError("Announcement not found", 404);
  }

  await deleteStoredAttachments(announcement.attachments, {
    bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
  }).catch(() => undefined);

  return serializeAnnouncement(announcement);
}

module.exports = {
  TYPES,
  AUDIENCES,
  ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAttachmentDownload(fileId) {
    return getAttachmentDownload(fileId, {
      bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
    });
  },
  async getAttachmentDownloadForViewer(fileId, viewerRole) {
    const normalizedFileId = normalizeOptionalString(fileId);

    if (!normalizedFileId) {
      throw appError("Attachment not found", 404);
    }

    const announcement = await Announcement.findOne({
      "attachments.fileId": normalizedFileId,
    });

    if (!announcement) {
      throw appError("Attachment not found", 404);
    }

    assertAnnouncementVisibleToViewer(announcement, viewerRole);
    return getAttachmentDownload(normalizedFileId, {
      bucketName: ANNOUNCEMENT_ATTACHMENT_BUCKET_NAME,
    });
  },
};
