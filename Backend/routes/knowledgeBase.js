const express = require("express");
const knowledgeBaseController = require("../controllers/knowledgeBaseController");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { knowledgeBaseUpload } = require("../utils/knowledgeBaseUpload");

const router = express.Router();

function uploadPdf(req, res, next) {
  knowledgeBaseUpload.single("document")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The PDF must be 15MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "Upload one PDF at a time."
          : error.message || "Unable to upload the PDF document.";

    res.status(400).json({ message });
  });
}

router.use(requireAuth);

router.get("/faqs", knowledgeBaseController.getFaqs);
router.post("/faqs", requireRoles("admin"), knowledgeBaseController.createFaq);
router.put("/faqs/:id", requireRoles("admin"), knowledgeBaseController.updateFaq);
router.delete("/faqs/:id", requireRoles("admin"), knowledgeBaseController.deleteFaq);

router.get("/documents", knowledgeBaseController.getDocuments);
router.post("/documents", requireRoles("admin"), uploadPdf, knowledgeBaseController.uploadDocument);
router.get("/documents/:id/download", knowledgeBaseController.downloadDocument);
router.delete("/documents/:id", requireRoles("admin"), knowledgeBaseController.deleteDocument);

module.exports = router;
