const faqList = document.querySelector("#faqList");
const faqCount = document.querySelector("#faqCount");
const publishedCount = document.querySelector("#publishedCount");
const draftCount = document.querySelector("#draftCount");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const faqForm = document.querySelector("#faqForm");
const faqId = document.querySelector("#faqId");
const categoryInput = document.querySelector("#categoryInput");
const questionInput = document.querySelector("#questionInput");
const answerInput = document.querySelector("#answerInput");
const tagsInput = document.querySelector("#tagsInput");
const statusInput = document.querySelector("#statusInput");
const saveButton = document.querySelector("#saveButton");
const clearButton = document.querySelector("#clearButton");
const feedback = document.querySelector("#feedback");

let currentFaqs = [];

function formatDate(value) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "recently";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderFaqs(faqs) {
  currentFaqs = faqs;
  faqCount.textContent = faqs.length;
  publishedCount.textContent = faqs.filter((faq) => faq.status === "published").length;
  draftCount.textContent = faqs.filter((faq) => faq.status === "draft").length;

  if (!faqs.length) {
    faqList.innerHTML = '<div class="empty">No matching FAQs found.</div>';
    return;
  }

  faqList.innerHTML = faqs
    .map((faq) => {
      const tags = [faq.category, ...(faq.tags || [])]
        .map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`)
        .join("");

      return `
        <article class="faq-card">
          <div class="badge-row">${tags}</div>
          <h2>${escapeHtml(faq.question)}</h2>
          <p>${escapeHtml(faq.answer)}</p>
          <div class="faq-meta">
            Status: ${escapeHtml(faq.status || "published")} | Updated: ${escapeHtml(formatDate(faq.updatedAt))}
          </div>
          <div class="card-actions">
            <button type="button" class="secondary" data-action="edit" data-id="${escapeHtml(faq.id)}">Edit</button>
            <button type="button" class="danger" data-action="delete" data-id="${escapeHtml(faq.id)}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.style.color = isError ? "#b91c1c" : "#166534";
}

function resetForm() {
  faqForm.reset();
  faqId.value = "";
  saveButton.textContent = "Add FAQ";
}

function getPayload() {
  return {
    category: categoryInput.value,
    question: questionInput.value,
    answer: answerInput.value,
    tags: tagsInput.value,
    status: statusInput.value,
  };
}

async function saveFaq(event) {
  event.preventDefault();
  const id = faqId.value;
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/faqs/${encodeURIComponent(id)}` : "/api/faqs";
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getPayload()),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to save FAQ.");
  }

  setFeedback(data.message);
  resetForm();
  await loadFaqs();
}

async function deleteFaq(id) {
  const faq = currentFaqs.find((item) => item.id === id);
  const label = faq ? `"${faq.question}"` : "this FAQ";

  if (!window.confirm(`Delete ${label}?`)) {
    return;
  }

  const response = await fetch(`/api/faqs/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to delete FAQ.");
  }

  setFeedback(data.message);
  await loadFaqs();
}

function editFaq(id) {
  const faq = currentFaqs.find((item) => item.id === id);

  if (!faq) {
    return;
  }

  faqId.value = faq.id;
  categoryInput.value = faq.category || "";
  questionInput.value = faq.question || "";
  answerInput.value = faq.answer || "";
  tagsInput.value = (faq.tags || []).join(", ");
  statusInput.value = faq.status || "published";
  saveButton.textContent = "Update FAQ";
  setFeedback("Editing selected FAQ.");
  categoryInput.focus();
}

async function loadFaqs() {
  const query = searchInput.value.trim();
  const response = await fetch(`/api/faqs?search=${encodeURIComponent(query)}`);
  const data = await response.json();
  renderFaqs(Array.isArray(data.faqs) ? data.faqs : []);
}

faqForm.addEventListener("submit", (event) => {
  saveFaq(event).catch((error) => setFeedback(error.message, true));
});

clearButton.addEventListener("click", () => {
  resetForm();
  setFeedback("");
});

faqList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const id = button.dataset.id;

  if (button.dataset.action === "edit") {
    editFaq(id);
  }

  if (button.dataset.action === "delete") {
    deleteFaq(id).catch((error) => setFeedback(error.message, true));
  }
});

searchInput.addEventListener("input", () => {
  loadFaqs().catch(() => {
    faqList.innerHTML = '<div class="empty">Unable to load FAQs.</div>';
  });
});

refreshButton.addEventListener("click", () => {
  loadFaqs()
    .then(() => setFeedback("FAQ library refreshed."))
    .catch(() => {
      faqList.innerHTML = '<div class="empty">Unable to load FAQs.</div>';
    });
});

loadFaqs().catch(() => {
  faqList.innerHTML = '<div class="empty">Unable to load FAQs.</div>';
});
