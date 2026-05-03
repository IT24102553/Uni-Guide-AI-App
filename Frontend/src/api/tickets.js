import { buildQuery, requestApi } from "./client";
import { appendAttachmentsToFormData } from "../screens/tickets/attachmentUtils";

function buildMultipartFormData(payload = {}, attachments = []) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, String(value));
  });

  appendAttachmentsToFormData(formData, attachments);

  return formData;
}

export function fetchTickets(params) {
  return requestApi(`/tickets${buildQuery(params)}`, {
    fallbackMessage: "Unable to load tickets right now",
  });
}

export function fetchTicketFeedbackDashboard(params) {
  return requestApi(`/tickets/feedback${buildQuery(params)}`, {
    fallbackMessage: "Unable to load ticket feedback right now",
  });
}

export function fetchTicketById(ticketId, params) {
  return requestApi(`/tickets/${ticketId}${buildQuery(params)}`, {
    fallbackMessage: "Unable to load ticket details right now",
  });
}

export function createSupportTicket(payload, attachments = []) {
  return requestApi("/tickets", {
    method: "POST",
    body: buildMultipartFormData(payload, attachments),
    fallbackMessage: "Unable to submit the ticket right now",
  });
}

export function updateSupportTicket(ticketId, payload) {
  return requestApi(`/tickets/${ticketId}`, {
    method: "PATCH",
    body: payload,
    fallbackMessage: "Unable to update the ticket right now",
  });
}

export function deleteSupportTicket(ticketId, payload) {
  return requestApi(`/tickets/${ticketId}`, {
    method: "DELETE",
    body: payload,
    fallbackMessage: "Unable to delete the ticket right now",
  });
}

export function saveTicketFeedback(ticketId, payload, attachments = []) {
  return requestApi(`/tickets/${ticketId}/feedback`, {
    method: "PUT",
    body: buildMultipartFormData(payload, attachments),
    fallbackMessage: "Unable to save your feedback right now",
  });
}

export function deleteTicketFeedback(ticketId, payload) {
  return requestApi(`/tickets/${ticketId}/feedback`, {
    method: "DELETE",
    body: payload,
    fallbackMessage: "Unable to delete your feedback right now",
  });
}

export function sendTicketReply(ticketId, payload, attachments = []) {
  return requestApi(`/tickets/${ticketId}/replies`, {
    method: "POST",
    body: buildMultipartFormData(payload, attachments),
    fallbackMessage: "Unable to send the reply right now",
  });
}
