const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT || 5050);
const JWT_SECRET = String(process.env.JWT_SECRET || "manith-demo-secret");
const DATA_DIR = path.join(__dirname, "data");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const LOGIN_ACTIVITY_FILE = path.join(DATA_DIR, "loginActivity.json");

const LOG_CATEGORIES = ["usage", "incident", "security", "maintenance", "report", "other"];
const LOG_SEVERITIES = ["Low", "Medium", "High", "Critical"];
const LOG_STATUSES = ["Open", "In Review", "Resolved", "Archived"];

app.use(cors());
app.use(express.json());

function ensureDataFile(filePath, fallbackValue) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2));
  }
}

function readJson(filePath) {
  ensureDataFile(filePath, []);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeLog(payload, existing = {}) {
  const title = clean(payload.title || existing.title);
  const category = clean(payload.category || existing.category || "incident").toLowerCase();
  const severity = clean(payload.severity || existing.severity || "Medium");
  const status = clean(payload.status || existing.status || "Open");
  const source = clean(payload.source || existing.source || "");
  const notes = clean(payload.notes || existing.notes);
  const eventDate = clean(payload.eventDate || existing.eventDate);
  const reportedByName = clean(payload.reportedByName || existing.reportedByName || "Manith Fernando");

  if (!title) {
    throw createError("Title is required", 400);
  }
  if (!notes) {
    throw createError("Notes are required", 400);
  }
  if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) {
    throw createError("A valid event date is required", 400);
  }
  if (!LOG_CATEGORIES.includes(category)) {
    throw createError("Select a valid category", 400);
  }
  if (!LOG_SEVERITIES.includes(severity)) {
    throw createError("Select a valid severity", 400);
  }
  if (!LOG_STATUSES.includes(status)) {
    throw createError("Select a valid status", 400);
  }

  return {
    title,
    category,
    severity,
    status,
    source,
    notes,
    eventDate: new Date(eventDate).toISOString(),
    reportedByName,
  };
}

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAdminUser() {
  const email = clean(process.env.ADMIN_EMAIL || "admin@my.sliit.lk").toLowerCase();
  const password = clean(process.env.ADMIN_PASSWORD || "Admin@123");
  const name = clean(process.env.ADMIN_NAME || "Manith Fernando");
  const hashedPassword = bcrypt.hashSync(password, 10);

  return {
    id: "admin-001",
    name,
    email,
    role: "admin",
    status: "active",
    hashedPassword,
  };
}

function getTokenFromRequest(req) {
  const authorization = clean(req.headers.authorization);
  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, "").trim();
  }
  return "";
}

function requireAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      throw createError("Authentication required", 401);
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(error.statusCode || 401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access is required" });
    return;
  }
  next();
}

function getFilteredLogs(query) {
  const logs = readJson(LOGS_FILE);
  const search = clean(query.search).toLowerCase();
  const status = clean(query.status);
  const severity = clean(query.severity);
  const category = clean(query.category).toLowerCase();

  return logs
    .filter((item) => {
      const matchesSearch =
        !search ||
        [
          item.title,
          item.category,
          item.severity,
          item.status,
          item.source,
          item.notes,
          item.reportedByName,
        ].some((value) => String(value || "").toLowerCase().includes(search));

      const matchesStatus = !status || status === "all" || item.status === status;
      const matchesSeverity = !severity || severity === "all" || item.severity === severity;
      const matchesCategory = !category || category === "all" || item.category === category;

      return matchesSearch && matchesStatus && matchesSeverity && matchesCategory;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getSummary() {
  const logs = readJson(LOGS_FILE);
  const loginActivity = readJson(LOGIN_ACTIVITY_FILE);
  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);
  const recentLogins = [...loginActivity]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return {
    summary: {
      logins: {
        total: loginActivity.length,
        successful: loginActivity.filter((item) => item.status === "success").length,
        failed: loginActivity.filter((item) => item.status === "failed").length,
      },
      logs: {
        totalLogs: logs.length,
        openLogs: logs.filter((item) => item.status === "Open" || item.status === "In Review").length,
        resolvedLogs: logs.filter((item) => item.status === "Resolved").length,
        criticalLogs: logs.filter((item) => item.severity === "Critical").length,
      },
    },
    breakdowns: {
      logsBySeverity: LOG_SEVERITIES.map((severity) => ({
        key: severity,
        count: logs.filter((item) => item.severity === severity).length,
      })).filter((item) => item.count > 0),
      logsByCategory: LOG_CATEGORIES.map((category) => ({
        key: category,
        count: logs.filter((item) => item.category === category).length,
      })).filter((item) => item.count > 0),
    },
    recentLogs,
    recentLogins,
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "IT24103229_Manith backend is running",
  });
});

app.post("/api/auth/login", async (req, res) => {
  const admin = getAdminUser();
  const email = clean(req.body?.email).toLowerCase();
  const password = clean(req.body?.password);
  const loginActivity = readJson(LOGIN_ACTIVITY_FILE);

  if (email !== admin.email) {
    loginActivity.push({
      id: createId("login"),
      email,
      status: "failed",
      message: "Unknown account",
      createdAt: new Date().toISOString(),
    });
    writeJson(LOGIN_ACTIVITY_FILE, loginActivity);
    res.status(404).json({ message: "User not found" });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, admin.hashedPassword);
  if (!passwordMatches) {
    loginActivity.push({
      id: createId("login"),
      email,
      status: "failed",
      message: "Invalid password",
      createdAt: new Date().toISOString(),
    });
    writeJson(LOGIN_ACTIVITY_FILE, loginActivity);
    res.status(401).json({ message: "Invalid password" });
    return;
  }

  const token = jwt.sign(
    {
      sub: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  loginActivity.push({
    id: createId("login"),
    email,
    status: "success",
    message: "Login successful",
    createdAt: new Date().toISOString(),
  });
  writeJson(LOGIN_ACTIVITY_FILE, loginActivity);

  res.json({
    message: "Login successful",
    token,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    },
  });
});

app.get("/api/analytics/summary", requireAuth, requireAdmin, (req, res) => {
  res.json(getSummary());
});

app.get("/api/analytics/logs", requireAuth, requireAdmin, (req, res) => {
  const records = getFilteredLogs(req.query);
  res.json({
    count: records.length,
    records,
  });
});

app.post("/api/analytics/logs", requireAuth, requireAdmin, (req, res) => {
  try {
    const logs = readJson(LOGS_FILE);
    const payload = normalizeLog(
      {
        ...req.body,
        reportedByName: req.user.name,
      },
      {}
    );
    const now = new Date().toISOString();
    const record = {
      id: createId("log"),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };

    logs.push(record);
    writeJson(LOGS_FILE, logs);

    res.status(201).json({
      message: "Log record created successfully",
      record,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Unable to create record" });
  }
});

app.put("/api/analytics/logs/:id", requireAuth, requireAdmin, (req, res) => {
  try {
    const logs = readJson(LOGS_FILE);
    const index = logs.findIndex((item) => item.id === req.params.id);
    if (index === -1) {
      throw createError("Log record not found", 404);
    }

    const payload = normalizeLog(
      {
        ...req.body,
        reportedByName: req.user.name,
      },
      logs[index]
    );

    logs[index] = {
      ...logs[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    writeJson(LOGS_FILE, logs);

    res.json({
      message: "Log record updated successfully",
      record: logs[index],
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message || "Unable to update record" });
  }
});

app.delete("/api/analytics/logs/:id", requireAuth, requireAdmin, (req, res) => {
  const logs = readJson(LOGS_FILE);
  const index = logs.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ message: "Log record not found" });
    return;
  }

  const [removed] = logs.splice(index, 1);
  writeJson(LOGS_FILE, logs);

  res.json({
    message: "Log record deleted successfully",
    record: removed,
  });
});

app.listen(PORT, () => {
  console.log(`IT24103229_Manith backend running on http://localhost:${PORT}`);
});
