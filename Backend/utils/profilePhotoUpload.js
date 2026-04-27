const path = require("path");
const multer = require("multer");

const allowedMimeTypes = new Set(["image/jpeg", "image/png"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png"]);
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (allowedMimeTypes.has(file.mimetype) || allowedExtensions.has(extension)) {
    cb(null, true);
    return;
  }

  cb(new Error("Only JPG and PNG profile photos are allowed."));
}

const profilePhotoUpload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

module.exports = {
  profilePhotoUpload,
};
