const path = require("path");
const multer = require("multer");

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".docx"]);
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (allowedMimeTypes.has(file.mimetype) || allowedExtensions.has(extension)) {
    cb(null, true);
    return;
  }

  cb(new Error("Only PDF, JPG, PNG, and DOCX files are allowed."));
}

const analyticsLogUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter,
});

module.exports = {
  analyticsLogUpload,
};
