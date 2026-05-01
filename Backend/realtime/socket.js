const { Server } = require("socket.io");
const User = require("../models/User");
const { verifyAuthToken } = require("../utils/authToken");

let io = null;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return normalizeString(value).toLowerCase();
}

function userRoom(userId) {
  return `user:${normalizeString(userId)}`;
}

function roleRoom(role) {
  return `role:${normalizeRole(role)}`;
}

function extractSocketToken(socket) {
  const authToken = normalizeString(socket.handshake?.auth?.token);

  if (authToken) {
    return authToken;
  }

  const authorizationHeader = normalizeString(
    socket.handshake?.headers?.authorization
  );

  if (/^Bearer\s+/i.test(authorizationHeader)) {
    return authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  }

  return normalizeString(socket.handshake?.query?.token);
}

async function authenticateSocket(socket) {
  const token = extractSocketToken(socket);

  if (!token) {
    const error = new Error("Authentication required");
    error.data = { statusCode: 401 };
    throw error;
  }

  let payload;

  try {
    payload = verifyAuthToken(token);
  } catch (error) {
    const authError = new Error("Invalid or expired authentication token");
    authError.data = { statusCode: 401 };
    throw authError;
  }

  const user = await User.findById(normalizeString(payload.sub));

  if (!user) {
    const error = new Error("Authentication failed. User no longer exists.");
    error.data = { statusCode: 401 };
    throw error;
  }

  if (user.status === "inactive") {
    const error = new Error("Your account is inactive. Contact admin.");
    error.data = { statusCode: 403 };
    throw error;
  }

  return user;
}

function initializeRealtime(server) {
  if (io) {
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: true,
      credentials: false,
    },
  });

  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;

    socket.join(userRoom(user._id));
    socket.join(roleRoom(user.role));

    socket.emit("realtime:ready", {
      userId: String(user._id),
      role: user.role,
      connectedAt: new Date().toISOString(),
    });

    socket.on("realtime:ping", () => {
      socket.emit("realtime:pong", {
        connectedAt: new Date().toISOString(),
      });
    });
  });

  return io;
}

function emitToUser(userId, eventName, payload) {
  if (!io || !normalizeString(userId)) {
    return;
  }

  io.to(userRoom(userId)).emit(eventName, payload);
}

function emitToRole(role, eventName, payload) {
  if (!io || !normalizeRole(role)) {
    return;
  }

  io.to(roleRoom(role)).emit(eventName, payload);
}

function emitToRoles(roles, eventName, payload) {
  const normalizedRoles = Array.isArray(roles)
    ? roles.map(normalizeRole).filter(Boolean)
    : [];

  Array.from(new Set(normalizedRoles)).forEach((role) => {
    emitToRole(role, eventName, payload);
  });
}

module.exports = {
  initializeRealtime,
  emitToUser,
  emitToRole,
  emitToRoles,
};
