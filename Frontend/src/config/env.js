function getRawApiUrl() {
  return process.env.EXPO_PUBLIC_API_URL?.trim();
}

export function getApiBaseUrl() {
  const apiUrl = getRawApiUrl();

  if (!apiUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_URL. Add it to Frontend/.env before starting Expo.");
  }

  if (!/^https?:\/\//i.test(apiUrl)) {
    throw new Error("EXPO_PUBLIC_API_URL must start with http:// or https://.");
  }

  return apiUrl.replace(/\/+$/, "");
}

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
