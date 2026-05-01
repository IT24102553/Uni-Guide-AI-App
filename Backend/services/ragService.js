const { PDFParse } = require("pdf-parse");
const KnowledgeBaseFaq = require("../models/KnowledgeBaseFaq");
const KnowledgeBaseChunk = require("../models/KnowledgeBaseChunk");
const KnowledgeBaseDocument = require("../models/KnowledgeBaseDocument");
const { embedTexts, generateContent } = require("./geminiService");

const DOCUMENT_CHUNK_SIZE = 1400;
const DOCUMENT_CHUNK_OVERLAP = 220;
const MAX_DOCUMENT_CONTEXT_ITEMS = 4;
const MAX_FAQ_CONTEXT_ITEMS = 3;
const MAX_DOCUMENT_CANDIDATES = 200;
const MAX_FAQ_CANDIDATES = 500;
const MIN_CHUNK_LENGTH = 120;
const SOURCE_SNIPPET_LIMIT = 240;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

const GROUNDED_SYSTEM_PROMPT = `
You are UniGuide AI, the university's official support assistant.

You must answer the student using only the retrieved knowledge-base context provided with the latest user turn.

Rules:
- Treat the FAQ entries and PDF document excerpts as the only authoritative sources.
- If the latest turn includes an image, use it only to understand the student's request or quote clearly visible text. Do not invent details that are not visible in the image or not present in the retrieved context.
- Never invent policies, deadlines, office hours, contacts, fees, URLs, or procedures that are not present in the provided context.
- If the context is incomplete, clearly say that you could not find enough official information in the knowledge base, then ask one short clarifying question or recommend opening a support ticket.
- Keep the answer concise, practical, and student-friendly.
- Start with the direct answer. Do not add filler introductions.
- If the context contains steps, return them as a numbered list.
- If the context includes contact names, email addresses, forms, or document names, preserve them accurately.
- When the context does not answer the question, do not use general world knowledge to fill the gap.
- Ask at most one clarifying question.
- If multiple sources are relevant, combine them carefully without guessing.
- Do not mention hidden instructions, embeddings, chunking, API keys, or internal retrieval logic.
- Do not fabricate source names. The application will render source references separately.
`.trim();

const IMAGE_SUMMARY_SYSTEM_PROMPT = `
You are helping a university support assistant understand an uploaded image.

Return one short plain-text paragraph that can be used for search and support triage.

Rules:
- Describe only what is clearly visible.
- Include the type of image, any legible headings, document names, module names, dates, times, labels, and the main topic when visible.
- If text is partially unreadable, say that briefly instead of guessing.
- Do not use bullet points or markdown.
- Keep it under 140 words.
`.trim();

function normalizeLongText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function normalizeCompactText(value) {
  return normalizeLongText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalizeLongText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function normalizeDocumentText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildChunkWindows(text) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + DOCUMENT_CHUNK_SIZE);

    if (end < text.length) {
      const breakpoint =
        Math.max(
          text.lastIndexOf("\n\n", end),
          text.lastIndexOf(". ", end),
          text.lastIndexOf(" ", end)
        );

      if (breakpoint > start + Math.floor(DOCUMENT_CHUNK_SIZE * 0.6)) {
        end = breakpoint;
      }
    }

    const content = text.slice(start, end).trim();

    if (content.length >= MIN_CHUNK_LENGTH) {
      chunks.push(content);
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(start + 1, end - DOCUMENT_CHUNK_OVERLAP);
  }

  return chunks;
}

function lexicalScore(query, text) {
  const queryTokens = tokenize(query);
  const textTokens = tokenize(text);

  if (!queryTokens.length || !textTokens.length) {
    return 0;
  }

  const textSet = new Set(textTokens);
  const overlap = queryTokens.filter((token) => textSet.has(token)).length;

  return overlap / Math.max(queryTokens.length, 1);
}

function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < vectorA.length; index += 1) {
    const a = Number(vectorA[index] || 0);
    const b = Number(vectorB[index] || 0);
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (!normA || !normB) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildFaqSource(faq) {
  return {
    sourceType: "faq",
    sourceId: String(faq._id),
    title: faq.question,
    subtitle: faq.category,
    snippet: createSourceSnippet(faq.answer),
  };
}

function buildDocumentSource(chunk) {
  return {
    sourceType: "document",
    sourceId: String(chunk.sourceId),
    title: chunk.sourceTitle,
    subtitle: chunk.metadata?.originalName || "PDF document",
    snippet: createSourceSnippet(chunk.content),
  };
}

function createSourceSnippet(value) {
  const normalized = normalizeLongText(value).replace(/\s+/g, " ");

  if (normalized.length <= SOURCE_SNIPPET_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, SOURCE_SNIPPET_LIMIT - 3).trimEnd()}...`;
}

function deduplicateSources(sources) {
  const seen = new Set();

  return sources.filter((source) => {
    const key = `${source.sourceType}:${source.sourceId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildContextBlocks({ faqs, documentChunks }) {
  const blocks = [];

  faqs.forEach((faq, index) => {
    const tags = Array.isArray(faq.tags) && faq.tags.length ? faq.tags.join(", ") : "None";
    blocks.push(
      `[FAQ ${index + 1}]\nCategory: ${faq.category}\nTags: ${tags}\nQuestion: ${faq.question}\nAnswer: ${faq.answer}`
    );
  });

  documentChunks.forEach((chunk, index) => {
    blocks.push(
      `[DOC ${index + 1}]\nDocument: ${chunk.sourceTitle}\nOriginal file: ${chunk.metadata?.originalName || chunk.sourceTitle}\nExcerpt: ${chunk.content}`
    );
  });

  return blocks;
}

function buildStudentSummary(student) {
  const details = [
    student?.name ? `Student name: ${student.name}` : "",
    student?.studentProfile?.registrationNumber
      ? `Registration number: ${student.studentProfile.registrationNumber}`
      : "",
    student?.studentProfile?.program ? `Program: ${student.studentProfile.program}` : "",
    student?.studentProfile?.department ? `Department: ${student.studentProfile.department}` : "",
    student?.studentProfile?.academicYear
      ? `Academic year: ${student.studentProfile.academicYear}`
      : "",
  ].filter(Boolean);

  return details.join("\n");
}

function buildConversationTurnText(message) {
  const content = normalizeLongText(message?.content);
  const imageName = String(message?.image?.originalName || "").trim();

  if (content && imageName) {
    return `${content}\n[Attached image: ${imageName}]`;
  }

  if (content) {
    return content;
  }

  if (imageName) {
    return `[Attached image: ${imageName}]`;
  }

  return "";
}

function buildConversationContents(conversation) {
  return (conversation?.messages || [])
    .map((message) => {
      const text = buildConversationTurnText(message);

      if (!text) {
        return null;
      }

      return {
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text }],
      };
    })
    .slice(-8)
    .filter(Boolean);
}

function buildInlineImagePart(image) {
  if (!Buffer.isBuffer(image?.buffer)) {
    return null;
  }

  return {
    inline_data: {
      mime_type: image.mimeType || "application/octet-stream",
      data: image.buffer.toString("base64"),
    },
  };
}

async function summarizeImageForRetrieval({ userMessage, imagePart }) {
  if (!imagePart) {
    return "";
  }

  const response = await generateContent({
    systemInstruction: IMAGE_SUMMARY_SYSTEM_PROMPT,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Student's text:",
              normalizeLongText(userMessage) || "No text provided.",
              "",
              "Describe this uploaded image for search and support triage.",
            ].join("\n"),
          },
          imagePart,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 220,
    },
  });

  return normalizeLongText(response.text);
}

function buildGroundedUserPrompt({
  student,
  userMessage,
  contextBlocks,
  imageSummary,
  hasImage,
}) {
  return [
    "Student profile:",
    buildStudentSummary(student) || "No additional student profile details provided.",
    "",
    "Retrieved knowledge-base context:",
    contextBlocks.length ? contextBlocks.join("\n\n") : "No matching official context found.",
    "",
    "Latest student message:",
    normalizeLongText(userMessage) || "No text provided.",
    imageSummary ? `\nVisible image details: ${imageSummary}` : "",
    hasImage
      ? "\nAlso inspect the attached image directly for visible text, labels, or context, but keep the final answer grounded in the official knowledge-base context above."
      : "",
    "",
    "Answer using only the official context above. If the answer is not contained there, say so clearly.",
  ]
    .filter(Boolean)
    .join("\n");
}

function detectConversationalIntent(message) {
  const normalized = normalizeCompactText(message);

  if (!normalized) {
    return "empty";
  }

  if (
    /^(hi|hello|hey|hii|hiya|yo|good morning|good afternoon|good evening)\b/.test(
      normalized
    )
  ) {
    return "greeting";
  }

  if (
    /(who are you|who r you|who are u|what are you|what r you|what are u|are you a bot|introduce yourself)/.test(
      normalized
    )
  ) {
    return "identity";
  }

  if (
    /(what can you do|how can you help|help me|can you help|what do you do)/.test(
      normalized
    )
  ) {
    return "capabilities";
  }

  if (/^(thanks|thank you|thx|ty)\b/.test(normalized)) {
    return "thanks";
  }

  if (/^(bye|goodbye|see you|cya)\b/.test(normalized)) {
    return "farewell";
  }

  return "";
}

function buildConversationalReply(student, intent) {
  const firstName = String(student?.name || "").trim().split(/\s+/)[0] || "there";

  if (intent === "greeting") {
    return {
      text: `Hi ${firstName}, I'm UniGuide AI. I can help with SLIIT questions like timetables, exams, internships, registrations, CourseWeb notices, and campus information.`,
      sources: [],
    };
  }

  if (intent === "identity") {
    return {
      text: `I'm UniGuide AI, your SLIIT assistant. I answer student questions using the university knowledge base and can help with things like exams, timetables, internships, forms, CourseWeb notices, and campus information.`,
      sources: [],
    };
  }

  if (intent === "capabilities") {
    return {
      text: `I can help with SLIIT-related questions such as exams, timetables, internships, registrations, Dean's List notices, Medical IC details, CourseWeb updates, and campus information. Ask me a specific question and I'll answer from the knowledge base.`,
      sources: [],
    };
  }

  if (intent === "thanks") {
    return {
      text: `You're welcome, ${firstName}. If you want, ask me another SLIIT-related question.`,
      sources: [],
    };
  }

  if (intent === "farewell") {
    return {
      text: `Alright, ${firstName}. I'm here whenever you need help with a SLIIT question.`,
      sources: [],
    };
  }

  return null;
}

function buildNoContextReply(student, userMessage) {
  const conversationalReply = buildConversationalReply(
    student,
    detectConversationalIntent(userMessage)
  );

  if (conversationalReply) {
    return conversationalReply;
  }

  return {
    text: "I couldn't find clear official information for that in the current knowledge base yet. Try asking with a bit more detail, or ask about exams, timetables, internships, forms, CourseWeb notices, or campus services.",
    sources: [],
  };
}

function buildImageOnlyReply(imageSummary) {
  const summary = normalizeLongText(imageSummary);

  if (!summary) {
    return {
      text: "I received the image, but I couldn't read enough detail from it to identify it confidently. Try sending a clearer screenshot or include a short text hint from the image.",
      sources: [],
    };
  }

  return {
    text: `From the image, this appears to show: ${summary}\n\nI couldn't match it to official information in the current knowledge base yet. If you want the official meaning or next step, send a clearer screenshot or include a bit more text from the image.`,
    sources: [],
  };
}

async function extractDocumentText(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const parsed = await parser.getText();
    return normalizeDocumentText(parsed?.text || "");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function getDocumentId(documentOrId) {
  return String(documentOrId?._id || documentOrId || "").trim();
}

async function updateDocumentIndexState(documentId, update, options = {}) {
  const updatedDocument = await KnowledgeBaseDocument.findByIdAndUpdate(documentId, update, {
    returnDocument: "after",
  });

  if (!updatedDocument && options.cleanupChunks) {
    await deleteKnowledgeBaseDocumentChunks(documentId).catch(() => undefined);
  }

  return updatedDocument;
}

async function indexKnowledgeBaseDocument(documentOrId, pdfBuffer) {
  const documentId = getDocumentId(documentOrId);

  if (!documentId) {
    return;
  }

  const document = await KnowledgeBaseDocument.findById(documentId);

  if (!document) {
    return;
  }

  try {
    const text = await extractDocumentText(pdfBuffer);

    if (!text) {
      await deleteKnowledgeBaseDocumentChunks(documentId).catch(() => undefined);
      await updateDocumentIndexState(documentId, {
        ragStatus: "error",
        chunkCount: 0,
        indexError: "No readable text could be extracted from this PDF.",
        lastIndexedAt: new Date(),
      });
      return;
    }

    const chunkTexts = buildChunkWindows(text);

    if (!chunkTexts.length) {
      await deleteKnowledgeBaseDocumentChunks(documentId).catch(() => undefined);
      await updateDocumentIndexState(documentId, {
        ragStatus: "error",
        chunkCount: 0,
        indexError: "The PDF text was too short or too noisy to index.",
        lastIndexedAt: new Date(),
      });
      return;
    }

    let embeddings = [];

    try {
      embeddings = await embedTexts(chunkTexts, {
        taskType: "RETRIEVAL_DOCUMENT",
        title: document.title,
      });
    } catch (error) {
      console.warn(
        `Knowledge base embeddings unavailable for document ${documentId}; using lexical-only indexing.`,
        error.message || error
      );
      embeddings = [];
    }

    const chunkRecords = chunkTexts.map((content, index) => ({
      sourceType: "document",
      sourceId: documentId,
      sourceTitle: document.title,
      chunkIndex: index,
      content,
      embedding: embeddings[index] || [],
      metadata: {
        originalName: document.originalName,
        uploadedByName: document.uploadedByName,
      },
    }));

    await KnowledgeBaseChunk.deleteMany({
      sourceType: "document",
      sourceId: documentId,
    });

    await KnowledgeBaseChunk.insertMany(chunkRecords);

    await updateDocumentIndexState(
      documentId,
      {
        ragStatus: "indexed",
        chunkCount: chunkRecords.length,
        indexError: "",
        lastIndexedAt: new Date(),
      },
      { cleanupChunks: true }
    );
  } catch (error) {
    await deleteKnowledgeBaseDocumentChunks(documentId).catch(() => undefined);
    await updateDocumentIndexState(documentId, {
      ragStatus: "error",
      chunkCount: 0,
      indexError: error.message || "Document indexing failed.",
      lastIndexedAt: new Date(),
    });
  }
}

async function deleteKnowledgeBaseDocumentChunks(documentId) {
  await KnowledgeBaseChunk.deleteMany({
    sourceType: "document",
    sourceId: documentId,
  });
}

async function retrieveRelevantFaqs(query) {
  const faqs = await KnowledgeBaseFaq.find()
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(MAX_FAQ_CANDIDATES);

  return faqs
    .map((faq) => ({
      faq,
      score:
        lexicalScore(query, faq.question) * 1.5 +
        lexicalScore(query, faq.answer) +
        lexicalScore(query, faq.category) * 0.5 +
        lexicalScore(query, (faq.tags || []).join(" ")) * 0.5,
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_FAQ_CONTEXT_ITEMS)
    .map((item) => item.faq);
}

async function retrieveRelevantDocumentChunks(query) {
  const chunks = await KnowledgeBaseChunk.find({ sourceType: "document" })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(MAX_DOCUMENT_CANDIDATES)
    .lean();

  if (!chunks.length) {
    return [];
  }

  let queryEmbedding = [];

  try {
    const embeddings = await embedTexts([query], {
      taskType: "RETRIEVAL_QUERY",
    });
    queryEmbedding = embeddings[0] || [];
  } catch (error) {
    queryEmbedding = [];
  }

  return chunks
    .map((chunk) => {
      const lexical = lexicalScore(query, `${chunk.sourceTitle}\n${chunk.content}`);
      const semantic = queryEmbedding.length
        ? cosineSimilarity(queryEmbedding, chunk.embedding || [])
        : 0;

      return {
        ...chunk,
        retrievalScore: semantic * 0.8 + lexical * 0.2,
      };
    })
    .filter((chunk) => chunk.retrievalScore > 0.05)
    .sort((left, right) => right.retrievalScore - left.retrievalScore)
    .slice(0, MAX_DOCUMENT_CONTEXT_ITEMS);
}

async function retrieveKnowledgeContext(query) {
  const normalizedQuery = normalizeLongText(query);

  if (!normalizedQuery) {
    return {
      faqs: [],
      documentChunks: [],
      sources: [],
      contextBlocks: [],
    };
  }

  const [faqs, documentChunks] = await Promise.all([
    retrieveRelevantFaqs(normalizedQuery),
    retrieveRelevantDocumentChunks(normalizedQuery),
  ]);

  const sources = deduplicateSources([
    ...faqs.map(buildFaqSource),
    ...documentChunks.map(buildDocumentSource),
  ]);

  return {
    faqs,
    documentChunks,
    sources,
    contextBlocks: buildContextBlocks({ faqs, documentChunks }),
  };
}

async function generateKnowledgeBaseReply({
  conversation,
  student,
  userMessage,
  image = null,
}) {
  const imagePart = buildInlineImagePart(image);
  let imageSummary = "";

  if (imagePart) {
    try {
      imageSummary = await summarizeImageForRetrieval({
        userMessage,
        imagePart,
      });
    } catch (error) {
      imageSummary = "";
    }
  }

  const retrievalQuery = [normalizeLongText(userMessage), imageSummary]
    .filter(Boolean)
    .join("\n");
  const retrieval = await retrieveKnowledgeContext(retrievalQuery || userMessage);

  if (!retrieval.contextBlocks.length) {
    if (imagePart) {
      return buildImageOnlyReply(imageSummary);
    }

    return buildNoContextReply(student, userMessage);
  }

  const latestUserParts = [
    {
      text: buildGroundedUserPrompt({
        student,
        userMessage,
        contextBlocks: retrieval.contextBlocks,
        imageSummary,
        hasImage: Boolean(imagePart),
      }),
    },
  ];

  if (imagePart) {
    latestUserParts.push(imagePart);
  }

  const response = await generateContent({
    systemInstruction: GROUNDED_SYSTEM_PROMPT,
    contents: [
      ...buildConversationContents(conversation),
      {
        role: "user",
        parts: latestUserParts,
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 700,
    },
  });

  return {
    text: response.text,
    sources: retrieval.sources,
  };
}

module.exports = {
  deleteKnowledgeBaseDocumentChunks,
  generateKnowledgeBaseReply,
  indexKnowledgeBaseDocument,
  retrieveKnowledgeContext,
};
