const API_BASE_URL = "http://localhost:5050";

const state = {
  token: "",
  user: null,
  summary: null,
  records: [],
};

const elements = {
  loginView: document.getElementById("login-view"),
  dashboardView: document.getElementById("dashboard-view"),
  loginForm: document.getElementById("login-form"),
  loginMessage: document.getElementById("login-message"),
  recordForm: document.getElementById("record-form"),
  recordMessage: document.getElementById("record-message"),
  metricsGrid: document.getElementById("metrics-grid"),
  loginActivity: document.getElementById("login-activity"),
  recordsList: document.getElementById("records-list"),
  welcomeText: document.getElementById("welcome-text"),
  logoutButton: document.getElementById("logout-button"),
  clearButton: document.getElementById("clear-button"),
  search: document.getElementById("search"),
  filterStatus: document.getElementById("filter-status"),
  filterSeverity: document.getElementById("filter-severity"),
  filterCategory: document.getElementById("filter-category"),
};

function setMessage(node, text, type = "") {
  node.textContent = text || "";
  node.className = `message${type ? ` ${type}` : ""}`;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${state.token}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function showDashboard() {
  elements.loginView.classList.add("hidden");
  elements.dashboardView.classList.remove("hidden");
  elements.welcomeText.textContent = `${state.user.name} | ${state.user.email}`;
}

function showLogin() {
  elements.dashboardView.classList.add("hidden");
  elements.loginView.classList.remove("hidden");
}

function resetRecordForm() {
  document.getElementById("record-id").value = "";
  document.getElementById("title").value = "";
  document.getElementById("category").value = "incident";
  document.getElementById("severity").value = "Medium";
  document.getElementById("status").value = "Open";
  document.getElementById("source").value = "";
  document.getElementById("eventDate").value = todayInputValue();
  document.getElementById("notes").value = "";
}

function renderMetrics() {
  const summary = state.summary?.summary;
  if (!summary) {
    elements.metricsGrid.innerHTML = "";
    return;
  }

  const metrics = [
    { label: "Total Logins", value: summary.logins.total },
    { label: "Successful Logins", value: summary.logins.successful },
    { label: "Failed Logins", value: summary.logins.failed },
    { label: "Analytics Records", value: summary.logs.totalLogs },
    { label: "Open Records", value: summary.logs.openLogs },
    { label: "Resolved Records", value: summary.logs.resolvedLogs },
    { label: "Critical Records", value: summary.logs.criticalLogs },
  ];

  elements.metricsGrid.innerHTML = metrics
    .map(
      (item) => `
        <article class="metric-card">
          <div class="metric-label">${item.label}</div>
          <div class="metric-value">${item.value}</div>
        </article>
      `
    )
    .join("");
}

function renderLoginActivity() {
  const items = state.summary?.recentLogins || [];

  if (!items.length) {
    elements.loginActivity.innerHTML = `<div class="activity-card">No login activity yet.</div>`;
    return;
  }

  elements.loginActivity.innerHTML = items
    .map(
      (item) => `
        <article class="activity-card">
          <div class="activity-top">
            <strong>${item.email}</strong>
            <span class="pill ${item.status === "failed" ? "severity-critical" : "status"}">${item.status}</span>
          </div>
          <div class="meta-row">
            <span class="meta">${item.message}</span>
            <span class="meta">${new Date(item.createdAt).toLocaleString()}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderRecords() {
  if (!state.records.length) {
    elements.recordsList.innerHTML = `<div class="record-card">No matching analytics records found.</div>`;
    return;
  }

  elements.recordsList.innerHTML = state.records
    .map(
      (record) => `
        <article class="record-card">
          <div class="record-top">
            <div>
              <strong>${record.title}</strong>
              <div class="meta-row">
                <span class="meta">Saved by ${record.reportedByName}</span>
                <span class="meta">${new Date(record.updatedAt).toLocaleString()}</span>
              </div>
            </div>
            <span class="pill status">${record.status}</span>
          </div>
          <div class="pill-row">
            <span class="pill ${record.severity === "Critical" ? "severity-critical" : "severity"}">${record.severity}</span>
            <span class="pill status">${record.category}</span>
            <span class="pill status">${record.source || "No source"}</span>
          </div>
          <p class="muted">${record.notes}</p>
          <div class="record-actions">
            <button type="button" data-edit="${record.id}">Edit</button>
            <button type="button" class="danger-button" data-delete="${record.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.records.find((item) => item.id === button.dataset.edit);
      if (!record) return;

      document.getElementById("record-id").value = record.id;
      document.getElementById("title").value = record.title;
      document.getElementById("category").value = record.category;
      document.getElementById("severity").value = record.severity;
      document.getElementById("status").value = record.status;
      document.getElementById("source").value = record.source;
      document.getElementById("eventDate").value = record.eventDate.slice(0, 10);
      document.getElementById("notes").value = record.notes;
      setMessage(elements.recordMessage, "Editing selected record.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const confirmed = window.confirm("Delete this record?");
      if (!confirmed) return;

      try {
        await request(`/api/analytics/logs/${button.dataset.delete}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        setMessage(elements.recordMessage, "Record deleted successfully.", "success");
        await loadDashboard();
      } catch (error) {
        setMessage(elements.recordMessage, error.message, "error");
      }
    });
  });
}

async function loadDashboard() {
  const searchParams = new URLSearchParams();
  const search = elements.search.value.trim();
  const status = elements.filterStatus.value;
  const severity = elements.filterSeverity.value;
  const category = elements.filterCategory.value;

  if (search) searchParams.set("search", search);
  if (status && status !== "all") searchParams.set("status", status);
  if (severity && severity !== "all") searchParams.set("severity", severity);
  if (category && category !== "all") searchParams.set("category", category);

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const [summaryData, recordsData] = await Promise.all([
    request("/api/analytics/summary", { headers: getAuthHeaders() }),
    request(`/api/analytics/logs${query}`, { headers: getAuthHeaders() }),
  ]);

  state.summary = summaryData;
  state.records = recordsData.records || [];
  renderMetrics();
  renderLoginActivity();
  renderRecords();
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(elements.loginMessage, "Signing in...");

  try {
    const data = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      }),
    });

    state.token = data.token;
    state.user = data.user;
    setMessage(elements.loginMessage, "Login successful.", "success");
    showDashboard();
    resetRecordForm();
    await loadDashboard();
  } catch (error) {
    setMessage(elements.loginMessage, error.message, "error");
  }
});

elements.recordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = document.getElementById("record-id").value;
  const payload = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value,
    severity: document.getElementById("severity").value,
    status: document.getElementById("status").value,
    source: document.getElementById("source").value.trim(),
    eventDate: document.getElementById("eventDate").value,
    notes: document.getElementById("notes").value.trim(),
  };

  try {
    if (id) {
      await request(`/api/analytics/logs/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      setMessage(elements.recordMessage, "Record updated successfully.", "success");
    } else {
      await request("/api/analytics/logs", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      setMessage(elements.recordMessage, "Record created successfully.", "success");
    }

    resetRecordForm();
    await loadDashboard();
  } catch (error) {
    setMessage(elements.recordMessage, error.message, "error");
  }
});

elements.clearButton.addEventListener("click", () => {
  resetRecordForm();
  setMessage(elements.recordMessage, "");
});

elements.logoutButton.addEventListener("click", () => {
  state.token = "";
  state.user = null;
  state.summary = null;
  state.records = [];
  showLogin();
  setMessage(elements.loginMessage, "");
});

[elements.search, elements.filterStatus, elements.filterSeverity, elements.filterCategory].forEach((node) => {
  node.addEventListener("input", () => {
    if (state.token) {
      loadDashboard().catch((error) => setMessage(elements.recordMessage, error.message, "error"));
    }
  });
  node.addEventListener("change", () => {
    if (state.token) {
      loadDashboard().catch((error) => setMessage(elements.recordMessage, error.message, "error"));
    }
  });
});

resetRecordForm();
