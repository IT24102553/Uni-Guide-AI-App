export const ANNOUNCEMENT_TYPES = [
  {
    value: "general",
    label: "General Info",
    color: "#16a34a",
    softColor: "#dcfce7",
    icon: "info",
  },
  {
    value: "event",
    label: "Event / Workshop",
    color: "#2563eb",
    softColor: "#dbeafe",
    icon: "event",
  },
  {
    value: "important",
    label: "Important Alert",
    color: "#d97706",
    softColor: "#fef3c7",
    icon: "priority-high",
  },
  {
    value: "urgent",
    label: "Urgent / Emergency",
    color: "#dc2626",
    softColor: "#fee2e2",
    icon: "warning",
  },
];

export const ANNOUNCEMENT_AUDIENCES = [
  { value: "all", label: "all", icon: "groups" },
  { value: "students", label: "students", icon: "school" },
  { value: "staff", label: "staff", icon: "badge" },
];

const TITLE_LIMIT = 120;
const CONTENT_LIMIT = 2000;

function buildDate(year, month, day) {
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getAnnouncementTypeMeta(type) {
  return (
    ANNOUNCEMENT_TYPES.find((item) => item.value === type) || ANNOUNCEMENT_TYPES[0]
  );
}

export function getAnnouncementAudienceMeta(audience) {
  return (
    ANNOUNCEMENT_AUDIENCES.find((item) => item.value === audience) ||
    ANNOUNCEMENT_AUDIENCES[0]
  );
}

export function parseAnnouncementDateInput(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return buildDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    return buildDate(Number(slashMatch[3]), Number(slashMatch[1]), Number(slashMatch[2]));
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return buildDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

export function isFutureDateOnly(value) {
  const parsedDate = parseAnnouncementDateInput(value);

  if (!parsedDate) {
    return false;
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return parsedDate > todayStart;
}

export function formatAnnouncementInputDate(value) {
  const parsedDate = parseAnnouncementDateInput(value);

  if (!parsedDate) {
    return "";
  }

  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const year = parsedDate.getFullYear();

  return `${month}/${day}/${year}`;
}

export function formatAnnouncementApiDate(value) {
  const parsedDate = parseAnnouncementDateInput(value);

  if (!parsedDate) {
    return "";
  }

  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const year = parsedDate.getFullYear();

  return `${year}-${month}-${day}`;
}

export function formatAnnouncementDate(value, { longMonth = true } = {}) {
  const parsedDate = parseAnnouncementDateInput(value);

  if (!parsedDate) {
    return "";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: longMonth ? "long" : "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function getAnnouncementFormDefaults() {
  return {
    title: "",
    type: "",
    expiryDate: "",
    targetAudience: "all",
    pinnedToTop: false,
    content: "",
  };
}

export function validateAnnouncementDraft(draft) {
  const errors = {};
  const title = String(draft.title || "").trim();
  const type = String(draft.type || "").trim().toLowerCase();
  const expiryDate = String(draft.expiryDate || "").trim();
  const targetAudience = String(draft.targetAudience || "").trim().toLowerCase();
  const content = String(draft.content || "").trim();

  if (!title) {
    errors.title = "Title is required.";
  } else if (title.length > TITLE_LIMIT) {
    errors.title = `Title must be ${TITLE_LIMIT} characters or fewer.`;
  }

  if (!type) {
    errors.type = "Type is required.";
  } else if (!ANNOUNCEMENT_TYPES.some((item) => item.value === type)) {
    errors.type = "Select a valid announcement type.";
  }

  if (!expiryDate) {
    errors.expiryDate = "Expiry date is required.";
  } else if (!parseAnnouncementDateInput(expiryDate)) {
    errors.expiryDate = "Use MM/DD/YYYY for the expiry date.";
  } else if (!isFutureDateOnly(expiryDate)) {
    errors.expiryDate = "Expiry date must be a future date.";
  }

  if (
    !ANNOUNCEMENT_AUDIENCES.some((item) => item.value === targetAudience)
  ) {
    errors.targetAudience = "Select a valid target audience.";
  }

  if (!content) {
    errors.content = "Content is required.";
  } else if (content.length > CONTENT_LIMIT) {
    errors.content = `Content must be ${CONTENT_LIMIT} characters or fewer.`;
  }

  return errors;
}

export function toAnnouncementPayload(draft) {
  return {
    title: String(draft.title || "").trim(),
    type: String(draft.type || "").trim().toLowerCase(),
    expiryDate: formatAnnouncementApiDate(draft.expiryDate),
    targetAudience: String(draft.targetAudience || "all").trim().toLowerCase(),
    pinnedToTop: Boolean(draft.pinnedToTop),
    content: String(draft.content || "").trim(),
  };
}
