import { requestApi } from "./client";

export function loginUser(payload) {
  return requestApi("/auth/login", { method: "POST", body: payload, fallbackMessage: "Login failed" });
}

export function requestPasswordReset(email) {
  return requestApi("/auth/forgot-password", {
    method: "POST",
    body: { email },
    fallbackMessage: "Unable to send a verification code right now",
  });
}

export function verifyPasswordResetOtp(email, otp) {
  return requestApi("/auth/verify-otp", {
    method: "POST",
    body: { email, otp },
    fallbackMessage: "Unable to verify the code",
  });
}

export function resetUserPassword(email, otp, password) {
  return requestApi("/auth/reset-password", {
    method: "POST",
    body: { email, otp, password },
    fallbackMessage: "Unable to reset your password",
  });
}
