const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = process.env.FAQ_DATA_FILE
  ? path.resolve(process.env.FAQ_DATA_FILE)
  : path.resolve(__dirname, "../data/faqs.json");
const VALID_STATUSES = new Set(["draft", "published"]);

async function readFaqs() {
  const content = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(content);
}

async function writeFaqs(faqs) {
  await fs.writeFile(DATA_FILE, `${JSON.stringify(faqs, null, 2)}\n`);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map(cleanText)
    .filter(Boolean);
}

function createId(question) {
  const slug = cleanText(question)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  return `faq-${slug || "item"}-${Date.now()}`;
}

function validateFaqPayload(payload, partial = false) {
  const category = cleanText(payload.category);
  const question = cleanText(payload.question);
  const answer = String(payload.answer || "").trim();
  const status = cleanText(payload.status || "published").toLowerCase();

  if (!partial || payload.category !== undefined) {
    if (!category) throw new Error("Category is required.");
  }

  if (!partial || payload.question !== undefined) {
    if (!question) throw new Error("Question is required.");
  }

  if (!partial || payload.answer !== undefined) {
    if (!answer) throw new Error("Answer is required.");
  }

  if (status && !VALID_STATUSES.has(status)) {
    throw new Error("Status must be draft or published.");
  }

  return {
    category,
    question,
    answer,
    tags: normalizeTags(payload.tags),
    status: status || "published",
  };
}

async function listFaqs(filters = {}) {
  const faqs = await readFaqs();
  const query = normalizeText(filters.search);

  if (!query) {
    return faqs;
  }

  return faqs.filter((faq) => {
    const haystack = [faq.category, faq.question, faq.answer, faq.status, ...(faq.tags || [])]
      .map(normalizeText)
      .join(" ");

    return haystack.includes(query);
  });
}

async function createFaq(payload) {
  const faqs = await readFaqs();
  const faq = {
    id: createId(payload.question),
    ...validateFaqPayload(payload),
    updatedAt: new Date().toISOString(),
  };

  faqs.unshift(faq);
  await writeFaqs(faqs);
  return faq;
}

async function updateFaq(id, payload) {
  const faqs = await readFaqs();
  const index = faqs.findIndex((faq) => faq.id === id);

  if (index === -1) {
    return null;
  }

  const current = faqs[index];
  const next = {
    ...current,
    ...validateFaqPayload({ ...current, ...payload }, true),
    updatedAt: new Date().toISOString(),
  };

  faqs[index] = next;
  await writeFaqs(faqs);
  return next;
}

async function deleteFaq(id) {
  const faqs = await readFaqs();
  const index = faqs.findIndex((faq) => faq.id === id);

  if (index === -1) {
    return null;
  }

  const [deleted] = faqs.splice(index, 1);
  await writeFaqs(faqs);
  return deleted;
}

module.exports = {
  createFaq,
  deleteFaq,
  listFaqs,
  updateFaq,
};
