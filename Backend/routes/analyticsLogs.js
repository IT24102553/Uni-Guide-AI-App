const express = require("express");
const analyticsLogController = require("../controllers/analyticsLogController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { analyticsLogUpload } = require("../utils/analyticsLogUpload");

const router = express.Router();

router.use(requireAuth, requireRoles("admin"));

function uploadAttachments(req, res, next) {
  analyticsLogUpload.array("attachments", 5)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each attachment must be 5MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "You can attach up to 5 files per log record."
          : error.message || "Unable to upload log attachments.";

    res.status(400).json({ message });
  });
}

router.get("/summary", analyticsLogController.getSummary);
router.get("/records", analyticsLogController.getRecords);
router.post("/records", uploadAttachments, analyticsLogController.createRecord);
router.get("/attachments/:fileId", analyticsLogController.downloadAttachment);
router.put("/records/:id", uploadAttachments, analyticsLogController.updateRecord);
router.delete("/records/:id", analyticsLogController.deleteRecord);

module.exports = router;
