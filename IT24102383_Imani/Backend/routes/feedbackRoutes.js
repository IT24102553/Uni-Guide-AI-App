const express = require("express");
const createFeedbackController = require("../controllers/feedbackController");

function createFeedbackRoutes(feedbackService) {
  const router = express.Router();
  const controller = createFeedbackController(feedbackService);

  router.get("/resolved-tickets", controller.listResolvedTickets);
  router.get("/feedback-dashboard", controller.getDashboard);
  router.put("/tickets/:ticketId/feedback", controller.saveFeedback);
  router.delete("/tickets/:ticketId/feedback", controller.removeFeedback);

  return router;
}

module.exports = createFeedbackRoutes;
