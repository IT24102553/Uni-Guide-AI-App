const path = require("path");
const http = require("http");
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

dotenv.config({
  path: path.resolve(__dirname, ".env"),
  quiet: true,
});

const authRoutes = require("./routes/auth");
const analyticsLogRoutes = require("./routes/analyticsLogs");
const announcementRoutes = require("./routes/announcements");
const chatRoutes = require("./routes/chat");
const knowledgeBaseRoutes = require("./routes/knowledgeBase");
const ticketFeedbackRoutes = require("./routes/ticketFeedback");
const ticketRoutes = require("./routes/tickets");
const userRoutes = require("./routes/users");
const { initializeRealtime } = require("./realtime/socket");

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPort() {
  const rawPort = process.env.PORT?.trim();

  if (!rawPort) {
    return 5000;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return port;
}

function getMongoUri() {
  return getRequiredEnv("MONGODB_URI");
}

function getMongoTarget(mongoUri) {
  try {
    return new URL(mongoUri).host || "unknown-host";
  } catch (error) {
    return "invalid-uri";
  }
}

function shouldWarnAboutAtlasUri(mongoUri) {
  return (
    mongoUri.startsWith("mongodb://") &&
    mongoUri.includes("mongodb.net") &&
    !mongoUri.includes("replicaSet=")
  );
}

async function connectDB(mongoUri) {
  const target = getMongoTarget(mongoUri);

  console.log(`Attempting MongoDB connection to ${target}`);

  if (shouldWarnAboutAtlasUri(mongoUri)) {
    console.warn(
      "Atlas clusters usually require a mongodb+srv:// URI. Please verify your MONGODB_URI format in Backend/.env."
    );
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed", error);
    throw error;
  }
}

const app = express();
const port = getPort();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "Backend server is running" });
});

app.use("/auth", authRoutes);
app.use("/analytics-logs", analyticsLogRoutes);
app.use("/announcements", announcementRoutes);
app.use("/chat", chatRoutes);
app.use("/knowledge-base", knowledgeBaseRoutes);
app.use("/tickets", ticketFeedbackRoutes);
app.use("/tickets", ticketRoutes);
app.use("/users", userRoutes);

async function startServer() {
  try {
    getRequiredEnv("JWT_SECRET");
    await connectDB(getMongoUri());
    initializeRealtime(server);

    server.listen(port, "0.0.0.0", () => {
      console.log("server is running on port " + port);
    });
  } catch (error) {
    console.error("Server startup aborted because the database connection failed.");
    process.exit(1);
  }
}

startServer();
