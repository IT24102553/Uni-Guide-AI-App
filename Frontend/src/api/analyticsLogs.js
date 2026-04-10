import { buildQuery, requestApi } from "./client";

export function fetchAnalyticsSummary() {
  return requestApi("/analytics-logs/summary", {
    fallbackMessage: "Unable to load analytics right now",
  });
}

export function fetchAnalyticsLogs(params = {}) {
  return requestApi(`/analytics-logs/records${buildQuery(params)}`, {
    fallbackMessage: "Unable to load log records right now",
  });
}

export function createAnalyticsLog(payload) {
  return requestApi("/analytics-logs/records", {
    method: "POST",
    body: payload,
    fallbackMessage: "Unable to create the log record right now",
  });
}

export function updateAnalyticsLog(id, payload) {
  return requestApi(`/analytics-logs/records/${id}`, {
    method: "PUT",
    body: payload,
    fallbackMessage: "Unable to update the log record right now",
  });
}

export function deleteAnalyticsLog(id) {
  return requestApi(`/analytics-logs/records/${id}`, {
    method: "DELETE",
    fallbackMessage: "Unable to delete the log record right now",
  });
}
