const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const KnowledgeBaseFaq = require("../models/KnowledgeBaseFaq");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const seedPath = path.resolve(__dirname, "./knowledgeBaseFaqSeed.txt");

function normalize(value) {
  return String(value || "").trim();
}

function normalizeMultiline(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function parseBlock(block) {
  const lines = String(block || "").replace(/\r\n/g, "\n").split("\n");
  const data = {
    question: "",
    answer: "",
    category: "",
    tags: [],
  };
  const answerLines = [];
  let currentField = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("Q:")) {
      data.question = normalize(trimmed.slice(2));
      currentField = "question";
      continue;
    }

    if (trimmed.startsWith("A:")) {
      answerLines.push(trimmed.slice(2).trim());
      currentField = "answer";
      continue;
    }

    if (trimmed.startsWith("Category:")) {
      data.category = normalize(trimmed.slice("Category:".length));
      currentField = "category";
      continue;
    }

    if (trimmed.startsWith("Tags:")) {
      data.tags = normalize(trimmed.slice("Tags:".length))
        .split(",")
        .map((tag) => normalize(tag))
        .filter(Boolean);
      currentField = "tags";
      continue;
    }

    if (currentField === "answer") {
      answerLines.push(line);
    }
  }

  data.answer = normalizeMultiline(answerLines.join("\n"));
  return data;
}

function parseSeedFile(rawText) {
  return String(rawText || "")
    .split(/\n---\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseBlock)
    .filter((item) => item.question && item.answer && item.category);
}

async function upsertFaq(faq) {
  const existing = await KnowledgeBaseFaq.findOne({ question: faq.question });

  if (existing) {
    existing.category = faq.category;
    existing.tags = faq.tags;
    existing.answer = faq.answer;
    existing.authorName = "Admin";
    await existing.save();
    return "updated";
  }

  await KnowledgeBaseFaq.create({
    ...faq,
    authorName: "Admin",
  });
  return "inserted";
}

async function main() {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found: ${seedPath}`);
  }

  const rawText = fs.readFileSync(seedPath, "utf8");
  const faqs = parseSeedFile(rawText);

  if (!faqs.length) {
    throw new Error("No FAQs were parsed from the seed file.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let inserted = 0;
  let updated = 0;

  for (const faq of faqs) {
    const result = await upsertFaq(faq);

    if (result === "inserted") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  const total = await KnowledgeBaseFaq.countDocuments();

  console.log(
    JSON.stringify(
      {
        parsed: faqs.length,
        inserted,
        updated,
        total,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (error) {
      // Ignore disconnect cleanup errors.
    }
  });
