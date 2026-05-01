const analyticsLogService = require("../services/analyticsLogService");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function getSummary(req, res) {
  try {
    const summary = await analyticsLogService.getSummary();

    res.status(200).json({
      message: "Analytics summary fetched successfully",
      ...summary,
    });
  } catch (error) {
    sendError(res, error, "Error fetching analytics summary");
  }
}

async function getRecords(req, res) {
  try {
    const records = await analyticsLogService.getRecords({
      search: req.query.search,
      category: req.query.category,
      severity: req.query.severity,
      status: req.query.status,
    });

    res.status(200).json({
      message: "Analytics logs fetched successfully",
      count: records.length,
      records,
    });
  } catch (error) {
    sendError(res, error, "Error fetching analytics logs");
  }
}

async function createRecord(req, res) {
  try {
    const record = await analyticsLogService.createRecord({
      ...req.body,
      reportedByName: req.user.name,
      attachments: req.files,
    });

    res.status(201).json({
      message: "Log record created successfully",
      record,
    });
  } catch (error) {
    sendError(res, error, "Error creating log record");
  }
}

async function updateRecord(req, res) {
  try {
    const record = await analyticsLogService.updateRecord(req.params.id, {
      ...req.body,
      reportedByName: req.user.name,
      attachments: req.files,
    });

    res.status(200).json({
      message: "Log record updated successfully",
      record,
    });
  } catch (error) {
    sendError(res, error, "Error updating log record");
  }
}

async function deleteRecord(req, res) {
  try {
    const record = await analyticsLogService.deleteRecord(req.params.id);

    res.status(200).json({
      message: "Log record deleted successfully",
      record,
    });
  } catch (error) {
    sendError(res, error, "Error deleting log record");
  }
}

function sanitizeContentDispositionName(filename) {
  return String(filename || "attachment").replace(/["\r\n\\]+/g, "_");
}

async function downloadAttachment(req, res) {
  try {
    const { file, stream } = await analyticsLogService.getAttachmentDownload(req.params.fileId);
    const downloadName = sanitizeContentDispositionName(
      file.metadata?.originalName || file.filename || "attachment"
    );

    res.setHeader("Content-Type", file.contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${downloadName}"`);

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
  getSummary,
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  downloadAttachment,
};
