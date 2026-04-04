function createFeedbackController(feedbackService) {
  function sendError(res, error) {
    res.status(400).json({ message: error.message || "Feedback request failed." });
  }

  function listResolvedTickets(req, res) {
    res.json({
      message: "Resolved tickets loaded successfully.",
      tickets: feedbackService.listResolvedTickets(),
    });
  }

  function saveFeedback(req, res) {
    try {
      const ticket = feedbackService.saveFeedback(req.params.ticketId, req.body);

      res.json({
        message: "Feedback saved successfully.",
        ticket,
      });
    } catch (error) {
      sendError(res, error);
    }
  }

  function removeFeedback(req, res) {
    try {
      const ticket = feedbackService.removeFeedback(req.params.ticketId);

      res.json({
        message: "Feedback removed successfully.",
        ticket,
      });
    } catch (error) {
      sendError(res, error);
    }
  }

  function getDashboard(req, res) {
    res.json({
      message: "Feedback dashboard loaded successfully.",
      ...feedbackService.getDashboard(),
    });
  }

  return {
    getDashboard,
    listResolvedTickets,
    removeFeedback,
    saveFeedback,
  };
}

module.exports = createFeedbackController;
