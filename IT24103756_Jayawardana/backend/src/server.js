const path = require("path");
const express = require("express");
const cors = require("cors");
const { listFaqs } = require("./faqStore");

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

app.listen(port, () => {
  console.log(`Knowledge base FAQ module running at http://localhost:${port}`);
});

