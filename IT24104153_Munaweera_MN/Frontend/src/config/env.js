function getRawApiUrl() {
  return process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:5000';
}

export function getApiBaseUrl() {
  const apiUrl = getRawApiUrl();

  if (!/^https?:\/\//i.test(apiUrl)) {
    throw new Error('EXPO_PUBLIC_API_URL must start with http:// or https://.');
  }

  return apiUrl.replace(/\/+$/, '');
}

export function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
