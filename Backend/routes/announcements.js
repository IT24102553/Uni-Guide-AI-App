const express = require("express");
const announcementController = require("../controllers/announcementController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { announcementUpload } = require("../utils/announcementUpload");

const router = express.Router();

function uploadAnnouncementAttachments(req, res, next) {
  announcementUpload.array("attachments", 3)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each PDF must be 10MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "You can attach up to 3 PDFs per announcement."
          : error.message || "Unable to upload announcement attachments.";

    res.status(400).json({ message });
  });
}

router.use(requireAuth);

router.get("/", announcementController.getAnnouncements);
router.post("/", requireRoles("admin"), uploadAnnouncementAttachments, announcementController.createAnnouncement);
router.get("/attachments/:fileId", announcementController.downloadAttachment);
router.get("/:id", announcementController.getAnnouncementById);
router.put("/:id", requireRoles("admin"), uploadAnnouncementAttachments, announcementController.updateAnnouncement);
router.delete("/:id", requireRoles("admin"), announcementController.deleteAnnouncement);

module.exports = router;
