const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const test = require("node:test");

async function loadStoreWithFixture(initialFaqs) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "faq-store-"));
  const dataFile = path.join(tempDir, "faqs.json");

  await fs.writeFile(dataFile, `${JSON.stringify(initialFaqs, null, 2)}\n`);
  process.env.FAQ_DATA_FILE = dataFile;

  const storePath = path.resolve(__dirname, "../src/faqStore.js");
  delete require.cache[storePath];

  return {
    dataFile,
    store: require(storePath),
  };
}

test("listFaqs filters FAQs by searchable content", async () => {
  const { store } = await loadStoreWithFixture([
    {
      id: "faq-1",
      category: "Registration",
      question: "How do I register?",
      answer: "Use the student portal.",
      tags: ["portal"],
      status: "published",
      updatedAt: "2026-04-23T08:00:00.000Z",
    },
    {
      id: "faq-2",
      category: "Payments",
      question: "How do I pay fees?",
      answer: "Use online payment.",
      tags: ["finance"],
      status: "draft",
      updatedAt: "2026-04-23T08:00:00.000Z",
    },
  ]);

  const faqs = await store.listFaqs({ search: "portal" });

  assert.equal(faqs.length, 1);
  assert.equal(faqs[0].id, "faq-1");
});

test("createFaq validates required fields and stores tags", async () => {
  const { store } = await loadStoreWithFixture([]);

  await assert.rejects(
    () => store.createFaq({ category: "Support", answer: "Contact support." }),
    /Question is required/
  );

  const faq = await store.createFaq({
    category: "Support",
    question: "Who helps with login issues?",
    answer: "The IT help desk supports login issues.",
    tags: "login, support",
    status: "published",
  });

  assert.match(faq.id, /^faq-who-helps-with-login-issues/);
  assert.deepEqual(faq.tags, ["login", "support"]);
  assert.equal((await store.listFaqs()).length, 1);
});

test("updateFaq and deleteFaq manage existing records", async () => {
  const { store } = await loadStoreWithFixture([
    {
      id: "faq-1",
      category: "Registration",
      question: "Old question?",
      answer: "Old answer.",
      tags: [],
      status: "draft",
      updatedAt: "2026-04-23T08:00:00.000Z",
    },
  ]);

  const updated = await store.updateFaq("faq-1", {
    question: "Updated question?",
    answer: "Updated answer.",
    status: "published",
  });

  assert.equal(updated.question, "Updated question?");
  assert.equal(updated.status, "published");
  assert.equal(await store.updateFaq("missing", { question: "Nope" }), null);

  const deleted = await store.deleteFaq("faq-1");

  assert.equal(deleted.id, "faq-1");
  assert.deepEqual(await store.listFaqs(), []);
  assert.equal(await store.deleteFaq("missing"), null);
});

