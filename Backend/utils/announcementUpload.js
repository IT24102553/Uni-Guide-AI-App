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

  cb(new Error("Only PDF files are allowed for announcements."));
}

const announcementUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 3,
  },
  fileFilter,
});

module.exports = {
  announcementUpload,
};
