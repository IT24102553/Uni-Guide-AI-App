const faqList = document.querySelector("#faqList");
const faqCount = document.querySelector("#faqCount");
const searchInput = document.querySelector("#searchInput");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderFaqs(faqs) {
  faqCount.textContent = faqs.length;

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
        </article>
      `;
    })
    .join("");
}

async function loadFaqs() {
  const query = searchInput.value.trim();
  const response = await fetch(`/api/faqs?search=${encodeURIComponent(query)}`);
  const data = await response.json();
  renderFaqs(Array.isArray(data.faqs) ? data.faqs : []);
}

searchInput.addEventListener("input", () => {
  loadFaqs().catch(() => {
    faqList.innerHTML = '<div class="empty">Unable to load FAQs.</div>';
  });
});

loadFaqs().catch(() => {
  faqList.innerHTML = '<div class="empty">Unable to load FAQs.</div>';
});

