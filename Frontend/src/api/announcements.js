import { buildQuery, requestApi } from "./client";

export function fetchAnnouncements(params = {}) {
  return requestApi(`/announcements${buildQuery(params)}`, {
    fallbackMessage: "Unable to load announcements right now",
  });
}

export function createAnnouncement(payload) {
  return requestApi("/announcements", {
    method: "POST",
    body: payload,
    fallbackMessage: "Unable to publish the announcement",
  });
}

export function updateAnnouncement(id, payload) {
  return requestApi(`/announcements/${id}`, {
    method: "PUT",
    body: payload,
    fallbackMessage: "Unable to update the announcement",
  });
}

export function deleteAnnouncement(id) {
  return requestApi(`/announcements/${id}`, {
    method: "DELETE",
    fallbackMessage: "Unable to delete the announcement",
  });
}
