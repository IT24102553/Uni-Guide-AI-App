const path = require("path");
const KnowledgeBaseFaq = require("../models/KnowledgeBaseFaq");
const KnowledgeBaseDocument = require("../models/KnowledgeBaseDocument");
const {
  deleteKnowledgeBaseDocumentChunks,
  indexKnowledgeBaseDocument,
} = require("./ragService");
const appError = require("../utils/appError");
const {
  deleteStoredKnowledgeBaseDocument,
  getKnowledgeBaseDocumentDownload,
  uploadKnowledgeBaseDocument,
} = require("../utils/knowledgeBaseDocumentStore");

const FAQ_CATEGORY_LIMIT = 60;
const FAQ_QUESTION_LIMIT = 220;
const FAQ_ANSWER_LIMIT = 6000;
const FAQ_TAG_LIMIT = 10;
const FAQ_TAG_LENGTH_LIMIT = 30;
const DOCUMENT_TITLE_LIMIT = 120;

function queueDocumentIndexing(documentId, pdfBuffer) {
  if (!documentId || !Buffer.isBuffer(pdfBuffer)) {
    return;
  }

  const bufferCopy = Buffer.from(pdfBuffer);

  setImmediate(() => {
    indexKnowledgeBaseDocument(documentId, bufferCopy).catch((error) => {
      console.error(`Knowledge base indexing failed for document ${documentId}`, error);
    });
  });
}

function normalizeString(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLongText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized || "";
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTags(value) {
  const rawTags = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((tag) => tag.trim());

  const seen = new Set();
  const tags = [];

  for (const rawTag of rawTags) {
    const normalizedTag = normalizeString(rawTag);

    if (!normalizedTag) {
      continue;
    }

    if (normalizedTag.length > FAQ_TAG_LENGTH_LIMIT) {
      throw appError(`Each tag must be ${FAQ_TAG_LENGTH_LIMIT} characters or fewer`, 400);
    }

    const key = normalizedTag.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(normalizedTag);
  }

  if (tags.length > FAQ_TAG_LIMIT) {
    throw appError(`Use up to ${FAQ_TAG_LIMIT} tags per FAQ`, 400);
  }

  return tags;
}

function serializeFaq(faq) {
  const item = faq.toObject ? faq.toObject() : faq;

  return {
    _id: item._id,
    category: item.category,
    tags: Array.isArray(item.tags) ? item.tags : [],
    question: item.question,
    answer: item.answer,
    authorName: item.authorName || "Admin",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function titleFromFilename(filename) {
  return String(filename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function serializeDocument(document) {
  const item = document.toObject ? document.toObject() : document;

  return {
    _id: item._id,
    title: item.title,
    originalName: item.originalName,
    storedName: item.storedName,
    fileId: item.fileId,
    mimeType: item.mimeType,
    size: Number(item.size || 0),
    ragStatus: item.ragStatus || "pending",
    chunkCount: Number(item.chunkCount || 0),
    indexError: item.indexError || "",
    lastIndexedAt: item.lastIndexedAt || null,
    uploadedByName: item.uploadedByName || "Admin",
    downloadUrl: `/knowledge-base/documents/${item._id}/download`,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function prepareFaqPayload(data, existingFaq) {
  const current = existingFaq?.toObject ? existingFaq.toObject() : existingFaq || {};
  const category = normalizeString(data.category !== undefined ? data.category : current.category);
  const question = normalizeString(data.question !== undefined ? data.question : current.question);
  const answer = normalizeLongText(data.answer !== undefined ? data.answer : current.answer);
  const authorName =
    normalizeString(data.authorName !== undefined ? data.authorName : current.authorName || "Admin") ||
    "Admin";
  const tags = normalizeTags(data.tags !== undefined ? data.tags : current.tags || []);

  if (!category) {
    throw appError("Category is required", 400);
  }

  if (category.length > FAQ_CATEGORY_LIMIT) {
    throw appError(`Category must be ${FAQ_CATEGORY_LIMIT} characters or fewer`, 400);
  }

  if (!question) {
    throw appError("Question is required", 400);
  }

  if (question.length > FAQ_QUESTION_LIMIT) {
    throw appError(`Question must be ${FAQ_QUESTION_LIMIT} characters or fewer`, 400);
  }

  if (!answer) {
    throw appError("Answer is required", 400);
  }

  if (answer.length > FAQ_ANSWER_LIMIT) {
    throw appError(`Answer must be ${FAQ_ANSWER_LIMIT} characters or fewer`, 400);
  }

  return {
    category,
    tags,
    question,
    answer,
    authorName,
  };
}

async function getFaqs(filters = {}) {
  const query = {};
  const search = normalizeOptionalString(filters.search);
  const category = normalizeOptionalString(filters.category);

  if (category) {
    query.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  }

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { category: searchRegex },
      { tags: searchRegex },
      { question: searchRegex },
      { answer: searchRegex },
      { authorName: searchRegex },
    ];
  }

  const faqs = await KnowledgeBaseFaq.find(query).sort({ updatedAt: -1, createdAt: -1 });
  return faqs.map(serializeFaq);
}

async function createFaq(data) {
  const payload = prepareFaqPayload(data);
  const faq = await KnowledgeBaseFaq.create(payload);
  return serializeFaq(faq);
}

async function updateFaq(id, data) {
  const faq = await KnowledgeBaseFaq.findById(id);

  if (!faq) {
    throw appError("FAQ not found", 404);
  }

  const payload = prepareFaqPayload(data, faq);
  faq.category = payload.category;
  faq.tags = payload.tags;
  faq.question = payload.question;
  faq.answer = payload.answer;
  faq.authorName = payload.authorName;

  await faq.save();
  return serializeFaq(faq);
}

async function deleteFaq(id) {
  const faq = await KnowledgeBaseFaq.findByIdAndDelete(id);

  if (!faq) {
    throw appError("FAQ not found", 404);
  }

  return serializeFaq(faq);
}

async function getDocuments(filters = {}) {
  const query = {};
  const search = normalizeOptionalString(filters.search);

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { title: searchRegex },
      { originalName: searchRegex },
      { uploadedByName: searchRegex },
      { ragStatus: searchRegex },
    ];
  }

  const documents = await KnowledgeBaseDocument.find(query).sort({ updatedAt: -1, createdAt: -1 });
  return documents.map(serializeDocument);
}

async function uploadDocument(data, file) {
  if (!file) {
    throw appError("Please upload a PDF document", 400);
  }

  const extension = path.extname(file.originalname || "").toLowerCase();

  if (extension && extension !== ".pdf") {
    throw appError("Only PDF files are allowed", 400);
  }

  const uploadedByName = normalizeString(data.uploadedByName) || "Admin";
  const requestedTitle = normalizeString(data.title);
  const title = requestedTitle || titleFromFilename(file.originalname) || "PDF Document";

  if (title.length > DOCUMENT_TITLE_LIMIT) {
    throw appError(`Document title must be ${DOCUMENT_TITLE_LIMIT} characters or fewer`, 400);
  }

  const storedFile = await uploadKnowledgeBaseDocument(file, {
    scope: "knowledge-base",
    uploadedByName,
  });

  try {
    const document = await KnowledgeBaseDocument.create({
      title,
      originalName: storedFile.originalName,
      storedName: storedFile.storedName,
      fileId: storedFile.fileId,
      mimeType: storedFile.mimeType,
      size: storedFile.size,
      ragStatus: "pending",
      chunkCount: 0,
      uploadedByName,
    });

    queueDocumentIndexing(document._id, file.buffer);
    return serializeDocument(document);
  } catch (error) {
    await deleteStoredKnowledgeBaseDocument(storedFile.fileId).catch(() => undefined);
    throw error;
  }
}

async function deleteDocument(id) {
  const document = await KnowledgeBaseDocument.findById(id);

  if (!document) {
    throw appError("Document not found", 404);
  }

  await deleteKnowledgeBaseDocumentChunks(document._id).catch(() => undefined);
  await deleteStoredKnowledgeBaseDocument(document.fileId).catch(() => undefined);
  await document.deleteOne();

  return serializeDocument(document);
}

async function getDocumentDownload(documentId) {
  const document = await KnowledgeBaseDocument.findById(documentId);

  if (!document) {
    throw appError("Document not found", 404);
  }

  const download = await getKnowledgeBaseDocumentDownload(document.fileId);

  return {
    document: serializeDocument(document),
    file: download.file,
    stream: download.stream,
  };
}

module.exports = {
  createFaq,
  deleteDocument,
  deleteFaq,
  getDocumentDownload,
  getDocuments,
  getFaqs,
  updateFaq,
  uploadDocument,
};
