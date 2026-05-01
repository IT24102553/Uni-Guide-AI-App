const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const appError = require("./appError");

const CHAT_ATTACHMENT_BUCKET_NAME = "chatAttachments";

function sanitizeBaseName(filename) {
  return String(filename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "attachment";
}

function createStoredName(filename) {
  const extension = path.extname(filename || "").toLowerCase();
  const safeBase = sanitizeBaseName(filename);
  const unique = crypto.randomBytes(6).toString("hex");
  return `${Date.now()}-${safeBase}-${unique}${extension}`;
}

function getAttachmentBucket() {
  const db = mongoose.connection?.db;

  if (!db) {
    throw appError("Chat attachment storage is not available right now", 500);
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: CHAT_ATTACHMENT_BUCKET_NAME,
  });
}

async function uploadAttachment(file, metadata = {}) {
  if (!Buffer.isBuffer(file?.buffer)) {
    throw appError("Attachment data is missing", 400);
  }

  const bucket = getAttachmentBucket();
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
          url: `/chat/attachments/${uploadStream.id}`,
          uploadedAt: new Date(),
        });
      });
  });
}

async function deleteStoredAttachments(attachments = []) {
  const bucket = getAttachmentBucket();

  await Promise.all(
    attachments.map(async (attachment) => {
      const fileId = String(attachment?.fileId || "").trim();

      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return;
      }

      await bucket
        .delete(new mongoose.Types.ObjectId(fileId))
        .catch(() => undefined);
    })
  );
}

async function getAttachmentDownload(fileId) {
  if (!mongoose.Types.ObjectId.isValid(String(fileId || "").trim())) {
    throw appError("Attachment not found", 404);
  }

  const objectId = new mongoose.Types.ObjectId(fileId);
  const bucket = getAttachmentBucket();
  const file = await bucket.find({ _id: objectId }).next();

  if (!file) {
    throw appError("Attachment not found", 404);
  }

  return {
    file,
    stream: bucket.openDownloadStream(objectId),
  };
}

module.exports = {
  CHAT_ATTACHMENT_BUCKET_NAME,
  deleteStoredAttachments,
  getAttachmentDownload,
  uploadAttachment,
};
