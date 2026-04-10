const authService = require("../services/authService");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function createUser(req, res) {
  res.status(403).json({
    message: "Self-signup is disabled. Only admins can create student and staff accounts from User Management.",
  });
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.status(200).json({
      message: "Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    sendError(res, error, "Error during login");
  }
}

async function forgotPassword(req, res) {
  try {
    const result = await authService.requestPasswordReset(req.body.email);

    res.status(200).json({
      message: result.deliveryMessage || "Verification code sent to your email address",
      email: result.email,
    });
  } catch (error) {
    sendError(res, error, "Error generating verification code");
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    await authService.verifyResetOtp(email, otp);

    res.status(200).json({
      message: "OTP verified successfully",
    });
  } catch (error) {
    sendError(res, error, "Error verifying OTP");
  }
}

async function resetPassword(req, res) {
  try {
    const { email, otp, password } = req.body;
    const user = await authService.resetPassword(email, otp, password);

    res.status(200).json({
      message: "Password reset successfully",
      user,
    });
  } catch (error) {
    sendError(res, error, "Error resetting password");
  }
}

module.exports = {
  createUser,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
