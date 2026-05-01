export const FACULTY_OPTIONS = [
  "Faculty of Computing",
  "School of Business",
  "Faculty of Engineering",
  "Faculty of Humanities & Sciences",
  "School of Architecture",
  "Faculty of Graduate Studies & Research",
];

export const DEPARTMENT_OPTIONS = [
  "Student Services",
  "Examinations",
  "IT Support",
  "Library",
  "Finance",
];

export const CAMPUS_OPTIONS = [
  "Malabe Campus",
  "Metro Campus",
  "Kandy Center",
  "Matara Center",
  "Kurunegala Center",
  "Jaffna Center",
];

export const REQUEST_TYPE_OPTIONS = [
  {
    value: "Official Document Request",
    label: "Request an official document",
    description: "Letters, transcripts, certificates, and related records.",
    subLabel: "Document Type",
    department: "Student Services",
    subOptions: [
      "Letters",
      "Certificate",
      "Transcript",
      "Results Sheet",
      "Certified Student Profile",
      "Module Outlines",
    ],
  },
  {
    value: "Registration Inquiry",
    label: "I have a question about Registration",
    description: "Registration changes, semester setup, and program transfer support.",
    subLabel: "Registration Sub-type",
    department: "Student Services",
    subOptions: [
      "Campus / Center / Study program Transfer",
      "Semester Registrations",
      "Prorata / Repeat Registrations",
      "Postponing / Withdrawing from program",
    ],
  },
  {
    value: "Examinations Inquiry",
    label: "I have a question about Examinations",
    description: "Timetables, results, medical submissions, and exam eligibility.",
    subLabel: "Examination Sub-type",
    department: "Examinations",
    subOptions: [
      "Exam timetable / venue",
      "Result / marks issue",
      "Medical / absence submission",
      "Repeat / resit examination",
    ],
  },
  {
    value: "IT Support Request",
    label: "I want technical help",
    description: "Portal, LMS, Wi-Fi, and access related support.",
    subLabel: "Issue Type",
    department: "IT Support",
    subOptions: [
      "Portal login issue",
      "LMS / Moodle issue",
      "Email / account access",
      "Wi-Fi / network issue",
    ],
  },
  {
    value: "Library Inquiry",
    label: "I need library support",
    description: "Borrowing, digital access, fines, and library services.",
    subLabel: "Library Sub-type",
    department: "Library",
    subOptions: [
      "Borrowing / returns",
      "Digital library access",
      "Library membership",
      "Overdue fine question",
    ],
  },
  {
    value: "Finance Inquiry",
    label: "I have a finance question",
    description: "Payments, balances, receipts, and refunds.",
    subLabel: "Finance Sub-type",
    department: "Finance",
    subOptions: [
      "Payment receipt",
      "Tuition balance",
      "Refund request",
      "Installment plan",
    ],
  },
  {
    value: "Other",
    label: "Other",
    description: "Use this if your issue does not fit the listed categories.",
    subLabel: "",
    department: "",
    subOptions: [],
  },
];

export function findRequestTypeOption(value) {
  return REQUEST_TYPE_OPTIONS.find((option) => option.value === value) || null;
}
