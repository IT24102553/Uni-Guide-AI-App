const tickets = [
  {
    id: "UG-1001",
    ticketCode: "UG-1001",
    subject: "Course registration issue",
    requestType: "Academic",
    status: "Resolved",
    student: {
      id: "ST-001",
      name: "Imani Student",
      email: "imani.student@example.com",
    },
    assignedTo: {
      name: "Support Staff",
      email: "support@example.com",
    },
    feedback: null,
    updatedAt: new Date("2026-04-04T08:30:00.000Z").toISOString(),
  },
  {
    id: "UG-1002",
    ticketCode: "UG-1002",
    subject: "Library access card activation",
    requestType: "Facilities",
    status: "Closed",
    student: {
      id: "ST-002",
      name: "Demo Student",
      email: "demo.student@example.com",
    },
    assignedTo: {
      name: "Student Services",
      email: "services@example.com",
    },
    feedback: {
      rating: 4,
      comment: "The issue was resolved quickly.",
      submittedAt: new Date("2026-04-04T09:10:00.000Z").toISOString(),
      updatedAt: new Date("2026-04-04T09:10:00.000Z").toISOString(),
    },
    updatedAt: new Date("2026-04-04T09:10:00.000Z").toISOString(),
  },
  {
    id: "UG-1003",
    ticketCode: "UG-1003",
    subject: "Pending hostel request",
    requestType: "Accommodation",
    status: "In Progress",
    student: {
      id: "ST-003",
      name: "Another Student",
      email: "another.student@example.com",
    },
    assignedTo: {
      name: "Housing Team",
      email: "housing@example.com",
    },
    feedback: null,
    updatedAt: new Date("2026-04-04T10:15:00.000Z").toISOString(),
  },
];

module.exports = tickets;
