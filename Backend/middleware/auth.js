const User = require("../models/User");
const { verifyAuthToken } = require("../utils/authToken");

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function extractAuthToken(req) {
  const authorizationHeader = String(req.headers.authorization || "").trim();

  if (/^Bearer\s+/i.test(authorizationHeader)) {
    return authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  }

  const queryToken = String(req.query?.token || "").trim();
  return queryToken || "";
}

async function requireAuth(req, res, next) {
  try {
    const token = extractAuthToken(req);

    if (!token) {
      throw createError("Authentication required", 401);
    }

    let payload;

    try {
      payload = verifyAuthToken(token);
    } catch (error) {
      throw createError("Invalid or expired authentication token", 401);
    }

    const user = await User.findById(String(payload.sub || "").trim());

    if (!user) {
      throw createError("Authentication failed. User no longer exists.", 401);
    }

    if (user.status === "inactive") {
      throw createError("Your account is inactive. Contact admin.", 403);
    }

    req.user = user;
    req.authToken = token;
    next();
  } catch (error) {
    sendError(res, error, "Authentication failed");
  }
}

function requireRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => String(role || "").trim().toLowerCase());

  return function authorizeRole(req, res, next) {
    if (!req.user) {
      sendError(res, createError("Authentication required", 401), "Authentication failed");
      return;
    }

    const currentRole = String(req.user.role || "").trim().toLowerCase();

    if (normalizedRoles.includes(currentRole)) {
      next();
      return;
    }

    sendError(res, createError("You do not have permission to perform this action", 403), "Access denied");
  };
}

function requireSelfOrRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => String(role || "").trim().toLowerCase());

  return function authorizeSelfOrRole(req, res, next) {
    if (!req.user) {
      sendError(res, createError("Authentication required", 401), "Authentication failed");
      return;
    }

    const currentRole = String(req.user.role || "").trim().toLowerCase();
    const currentUserId = String(req.user._id || "");
    const targetUserId = String(req.params.id || "");

    if (currentUserId && targetUserId && currentUserId === targetUserId) {
      next();
      return;
    }

    if (normalizedRoles.includes(currentRole)) {
      next();
      return;
    }

    sendError(res, createError("You do not have permission to access this resource", 403), "Access denied");
  };
}

module.exports = {
  requireAuth,
  requireRoles,
  requireSelfOrRoles,
};
