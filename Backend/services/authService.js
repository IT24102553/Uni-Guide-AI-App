const crypto = require("crypto");
const User = require("../models/User");
const appError = require("../utils/appError");
const { createAuthToken } = require("../utils/authToken");
const { hashPassword, verifyPasswordAndUpgrade } = require("../utils/passwords");
const { sendPasswordResetOtp } = require("./mailService");
const { safeUser, normalizeEmail } = require("./userService");

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function validateEmailOrThrow(email) {
  if (!email) {
    throw appError("Email is required", 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw appError("Enter a valid email address", 400);
  }
}

function validateStrongPassword(password) {
  if (!password || password.length < 8) {
    throw appError("Password must be at least 8 characters", 400);
  }

  if (!/[A-Z]/.test(password)) {
    throw appError("Password must include at least one uppercase letter", 400);
  }

  if (!/\d/.test(password)) {
    throw appError("Password must include at least one number", 400);
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw appError("Password must include at least one special character", 400);
  }
}

async function login(email, password) {
  const normalizedEmail = normalizeEmail(email);

  validateEmailOrThrow(normalizedEmail);

  if (!password) {
    throw appError("Password is required", 400);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw appError("User not found", 404);
  }

  if (user.status === "inactive") {
    throw appError("Your account is inactive. Contact admin.", 403);
  }

  const passwordMatches = await verifyPasswordAndUpgrade(user, password);

  if (!passwordMatches) {
    throw appError("Invalid password", 401);
  }

  return {
    token: createAuthToken(user),
    user: safeUser(user),
  };
}

async function requestPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email);

  validateEmailOrThrow(normalizedEmail);

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw appError("User not found", 404);
  }

  const otp = generateOtp();
  user.resetPasswordOtp = otp;
  user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  await sendPasswordResetOtp({
    email: normalizedEmail,
    name: user.name,
    otp,
  });

  return {
    email: normalizedEmail,
    deliveryMessage: "Verification code sent to your email address",
  };
}

async function verifyResetOtp(email, otp) {
  const normalizedEmail = normalizeEmail(email);

  validateEmailOrThrow(normalizedEmail);

  if (!otp) {
    throw appError("OTP is required", 400);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw appError("User not found", 404);
  }

  if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
    throw appError("Invalid OTP", 400);
  }

  if (!user.resetPasswordOtpExpires || user.resetPasswordOtpExpires < new Date()) {
    throw appError("OTP expired", 400);
  }

  return true;
}

async function resetPassword(email, otp, newPassword) {
  validateStrongPassword(newPassword);

  const normalizedEmail = normalizeEmail(email);
  await verifyResetOtp(normalizedEmail, otp);

  const user = await User.findOne({ email: normalizedEmail });
  user.password = await hashPassword(newPassword);
  user.resetPasswordOtp = undefined;
  user.resetPasswordOtpExpires = undefined;
  await user.save();

  return safeUser(user);
}

module.exports = {
  login,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword,
};
