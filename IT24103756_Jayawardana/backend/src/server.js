const path = require("path");
const express = require("express");
const cors = require("cors");
const { createFaq, deleteFaq, listFaqs, updateFaq } = require("./faqStore");

const app = express();
const port = Number(process.env.PORT || 5056);
const frontendPath = path.resolve(__dirname, "../../frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/api/faqs", async (req, res) => {
  try {
    const faqs = await listFaqs({ search: req.query.search });
    res.json({ count: faqs.length, faqs });
  } catch (error) {
    res.status(500).json({ message: "Unable to load FAQs." });
  }
});

app.post("/api/faqs", async (req, res) => {
  try {
    const faq = await createFaq(req.body);
    res.status(201).json({ message: "FAQ created successfully.", faq });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to create FAQ." });
  }
});

app.put("/api/faqs/:id", async (req, res) => {
  try {
    const faq = await updateFaq(req.params.id, req.body);

    if (!faq) {
      res.status(404).json({ message: "FAQ not found." });
      return;
    }

    res.json({ message: "FAQ updated successfully.", faq });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to update FAQ." });
  }
});

app.delete("/api/faqs/:id", async (req, res) => {
  try {
    const faq = await deleteFaq(req.params.id);

    if (!faq) {
      res.status(404).json({ message: "FAQ not found." });
      return;
    }

    res.json({ message: "FAQ deleted successfully.", faq });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete FAQ." });
  }
});

app.listen(port, () => {
  console.log(`Knowledge base FAQ module running at http://localhost:${port}`);
});
