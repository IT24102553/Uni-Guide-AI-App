import { io } from "socket.io-client";
import { getApiBaseUrl } from "../config/env";

let authToken = "";
let socket = null;
const eventHandlers = new Map();

function getHandlerSet(eventName) {
  const current = eventHandlers.get(eventName);

  if (current) {
    return current;
  }

  const next = new Set();
  eventHandlers.set(eventName, next);
  return next;
}

function dispatchEvent(eventName, payload) {
  const handlers = eventHandlers.get(eventName);

  if (!handlers?.size) {
    return;
  }

  handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch (error) {
      console.warn(`Realtime handler failed for ${eventName}`, error);
    }
  });
}

function attachSocketListeners(nextSocket) {
  nextSocket.onAny((eventName, payload) => {
    dispatchEvent(eventName, payload);
  });

  nextSocket.on("connect_error", (error) => {
    console.warn("Realtime connection error:", error?.message || error);
  });
}

function createSocket() {
  const nextSocket = io(getApiBaseUrl(), {
    autoConnect: false,
    transports: ["websocket", "polling"],
    auth: { token: authToken },
  });

  attachSocketListeners(nextSocket);
  return nextSocket;
}

function ensureSocket() {
  if (!authToken) {
    return null;
  }

  if (!socket) {
    socket = createSocket();
  }

  socket.auth = { token: authToken };
  return socket;
}

export function setRealtimeAuthToken(token) {
  authToken = String(token || "").trim();

  if (!authToken && socket) {
    socket.disconnect();
    socket = null;
  }
}

export function connectRealtime() {
  const instance = ensureSocket();

  if (instance && !instance.connected) {
    instance.connect();
  }

  return instance;
}

export function disconnectRealtime() {
  if (!socket) {
    return;
  }

  socket.disconnect();
  socket = null;
}

export function subscribeRealtimeEvent(eventName, handler) {
  if (typeof handler !== "function") {
    return () => undefined;
  }

  const handlers = getHandlerSet(eventName);
  handlers.add(handler);
  connectRealtime();

  return () => {
    handlers.delete(handler);

    if (!handlers.size) {
      eventHandlers.delete(eventName);
    }
  };
}
