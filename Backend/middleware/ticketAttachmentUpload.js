const { attachmentUpload } = require("../utils/ticketUpload");

function uploadTicketAttachments(req, res, next) {
  attachmentUpload.array("attachments", 5)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each attachment must be 5MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "You can attach up to 5 files per request."
          : error.message || "Unable to upload attachments.";

    res.status(400).json({ message });
  });
}

module.exports = {
  uploadTicketAttachments,
};
