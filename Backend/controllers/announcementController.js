const announcementService = require("../services/announcementService");
const { emitToRoles } = require("../realtime/socket");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

function notifyAnnouncementsChanged(announcement) {
  emitToRoles(["admin", "student", "staff"], "announcement:changed", {
    announcementId: String(announcement?._id || ""),
    targetAudience: announcement?.targetAudience || "all",
    at: new Date().toISOString(),
  });
}

async function getAnnouncements(req, res) {
  try {
    const announcements = await announcementService.getAnnouncements({
      viewerRole: req.user.role,
      includeExpired: req.query.includeExpired,
      pinnedOnly: req.query.pinnedOnly,
      targetAudience: req.query.targetAudience,
      search: req.query.search,
    });

    res.status(200).json({
      message: "Announcements fetched successfully",
      count: announcements.length,
      announcements,
    });
  } catch (error) {
    sendError(res, error, "Error fetching announcements");
  }
}

async function getAnnouncementById(req, res) {
  try {
    const announcement = await announcementService.getAnnouncementById(
      req.params.id,
      req.user.role
    );

    res.status(200).json({
      message: "Announcement fetched successfully",
      announcement,
    });
  } catch (error) {
    sendError(res, error, "Error fetching announcement");
  }
}

async function createAnnouncement(req, res) {
  try {
    const announcement = await announcementService.createAnnouncement({
      ...req.body,
      authorName: req.user.name,
      attachments: req.files,
    });
    notifyAnnouncementsChanged(announcement);

    res.status(201).json({
      message: "Announcement published successfully",
      announcement,
    });
  } catch (error) {
    sendError(res, error, "Error publishing announcement");
  }
}

async function updateAnnouncement(req, res) {
  try {
    const announcement = await announcementService.updateAnnouncement(req.params.id, {
      ...req.body,
      authorName: req.user.name,
      attachments: req.files,
    });
    notifyAnnouncementsChanged(announcement);

    res.status(200).json({
      message: "Announcement updated successfully",
      announcement,
    });
  } catch (error) {
    sendError(res, error, "Error updating announcement");
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const announcement = await announcementService.deleteAnnouncement(req.params.id);
    notifyAnnouncementsChanged(announcement);

    res.status(200).json({
      message: "Announcement deleted successfully",
      announcement,
    });
  } catch (error) {
    sendError(res, error, "Error deleting announcement");
  }
}

function sanitizeContentDispositionName(filename) {
  return String(filename || "attachment").replace(/["\r\n\\]+/g, "_");
}

async function downloadAttachment(req, res) {
  try {
    const { file, stream } = await announcementService.getAttachmentDownloadForViewer(
      req.params.fileId,
      req.user.role
    );
    const downloadName = sanitizeContentDispositionName(
      file.metadata?.originalName || file.filename || "attachment.pdf"
    );

    res.setHeader("Content-Type", file.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);

    if (Number.isFinite(file.length)) {
      res.setHeader("Content-Length", String(file.length));
    }

    stream.on("error", (error) => {
      if (!res.headersSent) {
        sendError(res, error, "Error downloading attachment");
        return;
      }

      res.destroy(error);
    });

    stream.pipe(res);
  } catch (error) {
    sendError(res, error, "Error downloading attachment");
  }
}

module.exports = {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  downloadAttachment,
};
