const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const mongoose = require("mongoose");
const appError = require("./appError");

const KNOWLEDGE_BASE_BUCKET_NAME = "knowledgeBaseDocuments";

function sanitizeBaseName(filename) {
  return String(filename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "document";
}

function createStoredName(filename) {
  const extension = path.extname(filename || "").toLowerCase();
  const safeBase = sanitizeBaseName(filename);
  const unique = crypto.randomBytes(6).toString("hex");
  return `${Date.now()}-${safeBase}-${unique}${extension}`;
}

function getKnowledgeBaseBucket() {
  const db = mongoose.connection?.db;

  if (!db) {
    throw appError("Knowledge base document storage is not available right now", 500);
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: KNOWLEDGE_BASE_BUCKET_NAME,
  });
}

async function uploadKnowledgeBaseDocument(file, metadata = {}) {
  if (!Buffer.isBuffer(file?.buffer)) {
    throw appError("PDF document data is missing", 400);
  }

  const bucket = getKnowledgeBaseBucket();
  const storedName = createStoredName(file.originalname);

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(storedName, {
      contentType: file.mimetype || "application/pdf",
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
          mimeType: file.mimetype || "application/pdf",
          size: Number(file.size || file.buffer.length || 0),
        });
      });
  });
}

async function deleteStoredKnowledgeBaseDocument(fileId) {
  const id = String(fileId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return;
  }

  const bucket = getKnowledgeBaseBucket();
  await bucket.delete(new mongoose.Types.ObjectId(id)).catch(() => undefined);
}

async function getKnowledgeBaseDocumentDownload(fileId) {
  const id = String(fileId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw appError("Document not found", 404);
  }

  const objectId = new mongoose.Types.ObjectId(id);
  const bucket = getKnowledgeBaseBucket();
  const file = await bucket.find({ _id: objectId }).next();

  if (!file) {
    throw appError("Document not found", 404);
  }

  return {
    file,
    stream: bucket.openDownloadStream(objectId),
  };
}

module.exports = {
  KNOWLEDGE_BASE_BUCKET_NAME,
  deleteStoredKnowledgeBaseDocument,
  getKnowledgeBaseDocumentDownload,
  uploadKnowledgeBaseDocument,
};
