const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const appError = require("./appError");

const ATTACHMENT_BUCKET_NAME = "ticketAttachments";

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

function getAttachmentBucket(bucketName = ATTACHMENT_BUCKET_NAME) {
  const db = mongoose.connection?.db;

  if (!db) {
    throw appError("Attachment storage is not available right now", 500);
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName,
  });
}

async function uploadAttachment(file, metadata = {}, options = {}) {
  if (!Buffer.isBuffer(file?.buffer)) {
    throw appError("Attachment data is missing", 400);
  }

  const bucket = getAttachmentBucket(options.bucketName);
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
          url: `/tickets/attachments/${uploadStream.id}`,
          uploadedAt: new Date(),
        });
      });
  });
}

async function deleteStoredAttachments(attachments = [], options = {}) {
  const bucket = getAttachmentBucket(options.bucketName);

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

async function storeAttachments(files = [], metadata = {}, options = {}) {
  const attachments = [];

  try {
    for (const file of Array.isArray(files) ? files : []) {
      attachments.push(await uploadAttachment(file, metadata, options));
    }

    return attachments;
  } catch (error) {
    await deleteStoredAttachments(attachments, options).catch(() => undefined);
    throw error;
  }
}

async function getAttachmentDownload(fileId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(fileId || "").trim())) {
    throw appError("Attachment not found", 404);
  }

  const objectId = new mongoose.Types.ObjectId(fileId);
  const bucket = getAttachmentBucket(options.bucketName);
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
  ATTACHMENT_BUCKET_NAME,
  deleteStoredAttachments,
  getAttachmentDownload,
  storeAttachments,
};
