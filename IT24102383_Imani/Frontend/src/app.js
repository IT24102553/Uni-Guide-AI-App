const apiBaseUrl = window.FEEDBACK_API_URL || "http://localhost:5050/api";

const state = {
  tickets: [],
};

const ticketList = document.getElementById("ticketList");
const ticketSelect = document.getElementById("ticketSelect");
const ratingSelect = document.getElementById("ratingSelect");
const commentInput = document.getElementById("commentInput");
const message = document.getElementById("message");
const averageRating = document.getElementById("averageRating");
const totalSubmissions = document.getElementById("totalSubmissions");

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function setMessage(text, type = "success") {
  message.textContent = text;
  message.dataset.type = type;
}

function renderTickets() {
  ticketList.innerHTML = "";
  ticketSelect.innerHTML = "";

  if (!state.tickets.length) {
    ticketList.innerHTML = '<p class="empty">No resolved or closed tickets are available for feedback.</p>';
    ticketSelect.innerHTML = '<option value="">No eligible tickets</option>';
    return;
  }

  state.tickets.forEach((ticket) => {
    const option = document.createElement("option");
    option.value = ticket.id;
    option.textContent = `${ticket.ticketCode} - ${ticket.subject}`;
    ticketSelect.appendChild(option);

    const card = document.createElement("article");
    card.className = "ticket-card";
    card.innerHTML = `
      <div class="ticket-heading">
        <div>
          <strong>${ticket.ticketCode}</strong>
          <p>${ticket.subject}</p>
        </div>
        <span>${ticket.status}</span>
      </div>
      <p class="muted">${ticket.requestType} request handled by ${ticket.assignedTo.name}</p>
      <p class="feedback-text">
        ${
          ticket.feedback
            ? `${"★".repeat(ticket.feedback.rating)} ${ticket.feedback.comment || "No written comment"}`
            : "No feedback submitted yet."
        }
      </p>
    `;
    card.addEventListener("click", () => selectTicket(ticket.id));
    ticketList.appendChild(card);
  });
}

function selectTicket(ticketId) {
  const ticket = state.tickets.find((item) => item.id === ticketId);

  if (!ticket) {
    return;
  }

  ticketSelect.value = ticket.id;
  ratingSelect.value = ticket.feedback?.rating ? String(ticket.feedback.rating) : "";
  commentInput.value = ticket.feedback?.comment || "";
}

async function loadDashboard() {
  const data = await request("/feedback-dashboard");
  averageRating.textContent = Number(data.summary.averageRating || 0).toFixed(1);
  totalSubmissions.textContent = String(data.summary.totalSubmissions || 0);
}

async function loadTickets() {
  const data = await request("/resolved-tickets");
  state.tickets = data.tickets || [];
  renderTickets();

  if (state.tickets.length) {
    selectTicket(state.tickets[0].id);
  }
}

async function refresh() {
  try {
    await loadTickets();
    await loadDashboard();
    setMessage("Feedback data refreshed.");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

document.getElementById("feedbackForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const ticketId = ticketSelect.value;
    if (!ticketId) {
      throw new Error("Select a resolved ticket before saving feedback.");
    }

    await request(`/tickets/${ticketId}/feedback`, {
      method: "PUT",
      body: JSON.stringify({
        rating: ratingSelect.value,
        comment: commentInput.value,
      }),
    });
    await refresh();
    selectTicket(ticketId);
    setMessage("Feedback saved successfully.");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.getElementById("deleteButton").addEventListener("click", async () => {
  try {
    const ticketId = ticketSelect.value;
    if (!ticketId) {
      throw new Error("Select a resolved ticket before deleting feedback.");
    }

    await request(`/tickets/${ticketId}/feedback`, { method: "DELETE" });
    await refresh();
    selectTicket(ticketId);
    setMessage("Feedback deleted successfully.");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.getElementById("refreshButton").addEventListener("click", refresh);

refresh();
