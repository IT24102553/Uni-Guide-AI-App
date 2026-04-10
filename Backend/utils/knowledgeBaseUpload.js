const path = require("path");
const multer = require("multer");

const allowedMimeTypes = new Set(["application/pdf"]);
const allowedExtensions = new Set([".pdf"]);
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (allowedMimeTypes.has(file.mimetype) || allowedExtensions.has(extension)) {
    cb(null, true);
    return;
  }

  cb(new Error("Only PDF files are allowed."));
}

const knowledgeBaseUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

module.exports = {
  knowledgeBaseUpload,
};
