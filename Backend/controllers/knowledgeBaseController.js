const knowledgeBaseService = require("../services/knowledgeBaseService");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function getFaqs(req, res) {
  try {
    const faqs = await knowledgeBaseService.getFaqs({
      search: req.query.search,
      category: req.query.category,
    });

    res.status(200).json({
      message: "Knowledge base FAQs fetched successfully",
      count: faqs.length,
      faqs,
    });
  } catch (error) {
    sendError(res, error, "Error fetching knowledge base FAQs");
  }
}

async function createFaq(req, res) {
  try {
    const faq = await knowledgeBaseService.createFaq({
      ...req.body,
      authorName: req.user.name,
    });

    res.status(201).json({
      message: "FAQ created successfully",
      faq,
    });
  } catch (error) {
    sendError(res, error, "Error creating FAQ");
  }
}

async function updateFaq(req, res) {
  try {
    const faq = await knowledgeBaseService.updateFaq(req.params.id, {
      ...req.body,
      authorName: req.user.name,
    });

    res.status(200).json({
      message: "FAQ updated successfully",
      faq,
    });
  } catch (error) {
    sendError(res, error, "Error updating FAQ");
  }
}

async function deleteFaq(req, res) {
  try {
    const faq = await knowledgeBaseService.deleteFaq(req.params.id);

    res.status(200).json({
      message: "FAQ deleted successfully",
      faq,
    });
  } catch (error) {
    sendError(res, error, "Error deleting FAQ");
  }
}

async function getDocuments(req, res) {
  try {
    const documents = await knowledgeBaseService.getDocuments({
      search: req.query.search,
    });

    res.status(200).json({
      message: "Knowledge base documents fetched successfully",
      count: documents.length,
      documents,
    });
  } catch (error) {
    sendError(res, error, "Error fetching knowledge base documents");
  }
}

async function uploadDocument(req, res) {
  try {
    const document = await knowledgeBaseService.uploadDocument(
      {
        ...req.body,
        uploadedByName: req.user.name,
      },
      req.file
    );

    res.status(201).json({
      message: "PDF document uploaded successfully",
      document,
    });
  } catch (error) {
    sendError(res, error, "Error uploading PDF document");
  }
}

async function deleteDocument(req, res) {
  try {
    const document = await knowledgeBaseService.deleteDocument(req.params.id);

    res.status(200).json({
      message: "PDF document deleted successfully",
      document,
    });
  } catch (error) {
    sendError(res, error, "Error deleting PDF document");
  }
}

function sanitizeContentDispositionName(filename) {
  return String(filename || "document.pdf").replace(/["\r\n\\]+/g, "_");
}

async function downloadDocument(req, res) {
  try {
    const { file, stream } = await knowledgeBaseService.getDocumentDownload(req.params.id);
    const downloadName = sanitizeContentDispositionName(
      file.metadata?.originalName || file.filename || "document.pdf"
    );

    res.setHeader("Content-Type", file.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);

    if (Number.isFinite(file.length)) {
      res.setHeader("Content-Length", String(file.length));
    }

    stream.on("error", (error) => {
      if (!res.headersSent) {
        sendError(res, error, "Error downloading document");
        return;
      }

      res.destroy(error);
    });

    stream.pipe(res);
  } catch (error) {
    sendError(res, error, "Error downloading document");
  }
}

module.exports = {
  createFaq,
  deleteDocument,
  deleteFaq,
  downloadDocument,
  getDocuments,
  getFaqs,
  updateFaq,
  uploadDocument,
};
