import { buildQuery, requestApi, resolveProtectedFileUrl } from "./client";

export function fetchUsers(params = {}) {
  return requestApi(`/users${buildQuery(params)}`, {
    fallbackMessage: "Unable to load users right now",
  });
}

export function createUserAccount(payload) {
  return requestApi("/users", {
    method: "POST",
    body: payload,
    fallbackMessage: "Unable to create the user account",
  });
}

export function updateUserAccount(userId, payload) {
  return requestApi(`/users/${userId}`, {
    method: "PUT",
    body: payload,
    fallbackMessage: "Unable to update the user account",
  });
}

export function updateUserAccountStatus(userId, status) {
  return requestApi(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
    fallbackMessage: "Unable to update the account status",
  });
}

export function deleteUserAccount(userId) {
  return requestApi(`/users/${userId}`, {
    method: "DELETE",
    fallbackMessage: "Unable to delete the user account",
  });
}

export function fetchUserProfile(userId) {
  return requestApi(`/users/${userId}/profile`, {
    fallbackMessage: "Unable to load the profile right now",
  });
}

export function updateUserProfile(userId, payload) {
  return requestApi(`/users/${userId}/profile`, {
    method: "PUT",
    body: payload,
    fallbackMessage: "Unable to update the profile right now",
  });
}

export function uploadUserProfilePhoto(userId, asset) {
  const formData = new FormData();

  if (asset?.file) {
    formData.append("photo", asset.file, asset.name || "profile-photo");
  } else {
    formData.append("photo", {
      uri: asset.uri,
      name: asset.name || "profile-photo",
      type: asset.mimeType || asset.type || "image/jpeg",
    });
  }

  return requestApi(`/users/${userId}/profile-photo`, {
    method: "POST",
    body: formData,
    fallbackMessage: "Unable to upload the profile photo right now",
  });
}

export function resolveUserFileUrl(url) {
  return resolveProtectedFileUrl(url);
}
