import { buildApiUrl, getApiBaseUrl } from "../config/env";

let authToken = "";

export function setApiAuthToken(token) {
  authToken = String(token || "").trim();
}

export function getApiAuthToken() {
  return authToken;
}

export function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function buildRequestHeaders(isMultipart) {
  const headers = {};

  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return Object.keys(headers).length ? headers : undefined;
}

export async function requestApi(path, { method = "GET", body, fallbackMessage }) {
  const isMultipart = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(buildApiUrl(path), {
    method,
    headers: buildRequestHeaders(isMultipart),
    body:
      body === undefined
        ? undefined
        : isMultipart
          ? body
          : JSON.stringify(body),
  });

  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
}

export function resolveProtectedFileUrl(url) {
  if (!url) {
    return "";
  }

  const absoluteUrl = /^https?:\/\//i.test(url) ? url : buildApiUrl(url);

  if (!authToken || !absoluteUrl.startsWith(getApiBaseUrl())) {
    return absoluteUrl;
  }

  const separator = absoluteUrl.includes("?") ? "&" : "?";
  return `${absoluteUrl}${separator}token=${encodeURIComponent(authToken)}`;
}
