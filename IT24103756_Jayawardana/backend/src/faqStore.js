const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = path.resolve(__dirname, "../data/faqs.json");

async function readFaqs() {
  const content = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(content);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

async function listFaqs(filters = {}) {
  const faqs = await readFaqs();
  const query = normalizeText(filters.search);

  if (!query) {
    return faqs;
  }

  return faqs.filter((faq) => {
    const haystack = [faq.category, faq.question, faq.answer, ...(faq.tags || [])]
      .map(normalizeText)
      .join(" ");

    return haystack.includes(query);
  });
}

module.exports = {
  listFaqs,
};

