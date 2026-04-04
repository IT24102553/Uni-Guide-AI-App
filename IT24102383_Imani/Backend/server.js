const express = require("express");
const cors = require("cors");
const tickets = require("./data/tickets");
const { createFeedbackService } = require("./services/feedbackService");
const createFeedbackRoutes = require("./routes/feedbackRoutes");

const app = express();
const port = Number(process.env.PORT || 5050);
const feedbackService = createFeedbackService(tickets);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "IT24102383 feedback backend is running.",
    endpoints: [
      "GET /api/resolved-tickets",
      "GET /api/feedback-dashboard",
      "PUT /api/tickets/:ticketId/feedback",
      "DELETE /api/tickets/:ticketId/feedback",
    ],
  });
});

app.use("/api", createFeedbackRoutes(feedbackService));

app.listen(port, () => {
  console.log(`Feedback backend running on http://localhost:${port}`);
});
