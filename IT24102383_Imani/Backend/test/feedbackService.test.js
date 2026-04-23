const assert = require("node:assert/strict");
const test = require("node:test");
const { createFeedbackService } = require("../services/feedbackService");

function createTickets() {
  return [
    {
      id: "T-1",
      ticketCode: "T-1",
      subject: "Resolved ticket",
      requestType: "Academic",
      status: "Resolved",
      student: { name: "Student One" },
      assignedTo: { name: "Staff One" },
      feedback: null,
    },
    {
      id: "T-2",
      ticketCode: "T-2",
      subject: "Closed ticket",
      requestType: "Facilities",
      status: "Closed",
      student: { name: "Student Two" },
      assignedTo: { name: "Staff Two" },
      feedback: { rating: 5, comment: "Great", submittedAt: "2026-04-01", updatedAt: "2026-04-01" },
    },
    {
      id: "T-3",
      ticketCode: "T-3",
      subject: "Open ticket",
      requestType: "Accommodation",
      status: "In Progress",
      student: { name: "Student Three" },
      assignedTo: { name: "Staff Three" },
      feedback: null,
    },
  ];
}

test("lists only resolved and closed tickets for feedback", () => {
  const service = createFeedbackService(createTickets());

  assert.deepEqual(
    service.listResolvedTickets().map((ticket) => ticket.id),
    ["T-1", "T-2"]
  );
});

test("saves feedback for an eligible ticket", () => {
  const service = createFeedbackService(createTickets());
  const ticket = service.saveFeedback("T-1", {
    rating: 4,
    comment: "Helpful support response",
  });

  assert.equal(ticket.feedback.rating, 4);
  assert.equal(ticket.feedback.comment, "Helpful support response");
  assert.ok(ticket.feedback.submittedAt);
});

test("rejects feedback for an in-progress ticket", () => {
  const service = createFeedbackService(createTickets());

  assert.throws(
    () => service.saveFeedback("T-3", { rating: 3, comment: "Trying early" }),
    /resolved or closed/
  );
});

test("builds dashboard totals from submitted feedback", () => {
  const service = createFeedbackService(createTickets());
  service.saveFeedback("T-1", { rating: 3, comment: "Good" });
  const dashboard = service.getDashboard();

  assert.equal(dashboard.summary.totalSubmissions, 2);
  assert.equal(dashboard.summary.averageRating, 4);
  assert.equal(dashboard.summary.breakdown[3], 1);
  assert.equal(dashboard.summary.breakdown[5], 1);
});

test("removes existing feedback", () => {
  const service = createFeedbackService(createTickets());
  const ticket = service.removeFeedback("T-2");

  assert.equal(ticket.feedback, null);
});
