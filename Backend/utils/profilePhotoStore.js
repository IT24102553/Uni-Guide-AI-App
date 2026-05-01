const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const appError = require("./appError");

const PROFILE_PHOTO_BUCKET_NAME = "profilePhotos";

function sanitizeBaseName(filename) {
  return String(filename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "profile-photo";
}

function createStoredName(filename) {
  const extension = path.extname(filename || "").toLowerCase();
  const safeBase = sanitizeBaseName(filename);
  const unique = crypto.randomBytes(6).toString("hex");
  return `${Date.now()}-${safeBase}-${unique}${extension}`;
}

function getProfilePhotoBucket() {
  const db = mongoose.connection?.db;

  if (!db) {
    throw appError("Profile photo storage is not available right now", 500);
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: PROFILE_PHOTO_BUCKET_NAME,
  });
}

async function uploadProfilePhoto(file, metadata = {}) {
  if (!Buffer.isBuffer(file?.buffer)) {
    throw appError("Profile photo data is missing", 400);
  }

  const bucket = getProfilePhotoBucket();
  const storedName = createStoredName(file.originalname);

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(storedName, {
      contentType: file.mimetype || "application/octet-stream",
      metadata: {
        originalName: file.originalname || storedName,
        ...metadata,
      },
    });

    Readable.from(file.buffer)
      .on("error", reject)
      .pipe(uploadStream)
      .on("error", reject)
      .on("finish", () => {
        resolve({
          fileId: String(uploadStream.id),
          originalName: file.originalname || storedName,
          storedName,
          mimeType: file.mimetype || "application/octet-stream",
          size: Number(file.size || file.buffer.length || 0),
          url: `/users/profile-photos/${uploadStream.id}`,
          uploadedAt: new Date(),
        });
      });
  });
}

async function deleteStoredProfilePhoto(profilePhoto) {
  const fileId = String(profilePhoto?.fileId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    return;
  }

  const bucket = getProfilePhotoBucket();
  await bucket.delete(new mongoose.Types.ObjectId(fileId)).catch(() => undefined);
}

async function getProfilePhotoDownload(fileId) {
  if (!mongoose.Types.ObjectId.isValid(String(fileId || "").trim())) {
    throw appError("Profile photo not found", 404);
  }

  const objectId = new mongoose.Types.ObjectId(fileId);
  const bucket = getProfilePhotoBucket();
  const file = await bucket.find({ _id: objectId }).next();

  if (!file) {
    throw appError("Profile photo not found", 404);
  }

  return {
    file,
    stream: bucket.openDownloadStream(objectId),
  };
}

module.exports = {
  PROFILE_PHOTO_BUCKET_NAME,
  deleteStoredProfilePhoto,
  getProfilePhotoDownload,
  uploadProfilePhoto,
};
