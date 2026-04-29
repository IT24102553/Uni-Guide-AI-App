const appError = require("../utils/appError");

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MAX_EMBED_BATCH_SIZE = 100;
let nextApiKeyIndex = 0;

function getConfiguredApiKeys() {
  const discovered = [];
  const directKey = process.env.GEMINI_API_KEY?.trim();

  if (directKey) {
    discovered.push(directKey);
  }

  for (let index = 1; index <= 20; index += 1) {
    const value = process.env[`GEMINI_API_KEY_${index}`]?.trim();

    if (value) {
      discovered.push(value);
    }
  }

  return [...new Set(discovered)];
}

function getGenerationModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
}

function getTimeoutMs() {
  const rawValue = process.env.GEMINI_TIMEOUT_MS?.trim();
  const timeoutMs = Number(rawValue || 45000);

  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45000;
}

function normalizeErrorPayload(statusCode, payload, fallbackMessage) {
  const message =
    payload?.error?.message ||
    payload?.message ||
    fallbackMessage ||
    `Gemini API request failed with status ${statusCode}`;
  const status = payload?.error?.status || payload?.status || "";

  return {
    statusCode,
    status,
    message,
    payload,
  };
}

function isRetriableAcrossKeys(errorInfo) {
  const statusCode = Number(errorInfo?.statusCode || 0);
  const status = String(errorInfo?.status || "").toUpperCase();
  const message = String(errorInfo?.message || "").toLowerCase();

  if ([401, 403, 429, 500, 503, 504].includes(statusCode)) {
    return true;
  }

  return (
    status === "RESOURCE_EXHAUSTED" ||
    status === "UNAVAILABLE" ||
    status === "INTERNAL" ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource has been exhausted") ||
    message.includes("api key was reported as leaked")
  );
}

async function postJsonWithKeyRotation(path, body, options = {}) {
  const apiKeys = getConfiguredApiKeys();

  if (!apiKeys.length) {
    throw appError(
      "Gemini API keys are not configured. Add GEMINI_API_KEY_1..n in Backend/.env.",
      500
    );
  }

  const attempts = [];
  const timeoutMs = options.timeoutMs || getTimeoutMs();

  for (let offset = 0; offset < apiKeys.length; offset += 1) {
    const keyIndex = (nextApiKeyIndex + offset) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GEMINI_API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let payload = {};

      try {
        payload = await response.json();
      } catch (error) {
        payload = {};
      }

      if (response.ok) {
        nextApiKeyIndex = (keyIndex + 1) % apiKeys.length;
        return payload;
      }

      const errorInfo = normalizeErrorPayload(
        response.status,
        payload,
        "Gemini API request failed"
      );

      attempts.push(errorInfo);

      if (!isRetriableAcrossKeys(errorInfo) || offset === apiKeys.length - 1) {
        throw appError(errorInfo.message, response.status || 500);
      }
    } catch (error) {
      clearTimeout(timeout);

      if (error.name === "AbortError") {
        attempts.push({
          statusCode: 504,
          status: "DEADLINE_EXCEEDED",
          message: "Gemini API request timed out.",
        });

        if (offset === apiKeys.length - 1) {
          throw appError("Gemini API request timed out.", 504);
        }

        continue;
      }

      if (error.statusCode) {
        if (offset === apiKeys.length - 1) {
          throw error;
        }

        continue;
      }

      attempts.push({
        statusCode: 500,
        status: "REQUEST_FAILED",
        message: error.message || "Gemini API request failed.",
      });

      if (offset === apiKeys.length - 1) {
        throw appError(
          attempts[attempts.length - 1].message || "Gemini API request failed.",
          500
        );
      }
    }
  }

  const finalAttempt = attempts[attempts.length - 1];
  throw appError(finalAttempt?.message || "Gemini API request failed.", finalAttempt?.statusCode || 500);
}

function extractGeneratedText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];

  return parts
    .map((part) => part?.text || "")
    .join("\n")
    .trim();
}

async function generateContent({
  model = getGenerationModel(),
  systemInstruction,
  contents,
  generationConfig,
}) {
  const payload = await postJsonWithKeyRotation(
    `/models/${encodeURIComponent(model)}:generateContent`,
    {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents,
      generationConfig,
    }
  );

  const text = extractGeneratedText(payload);

  if (!text) {
    throw appError("Gemini returned an empty response.", 502);
  }

  return {
    text,
    raw: payload,
  };
}

async function embedTexts(
  texts,
  {
    model = getEmbeddingModel(),
    taskType,
    title,
  } = {}
) {
  const values = (Array.isArray(texts) ? texts : [texts])
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!values.length) {
    return [];
  }

  const embeddings = [];

  for (let start = 0; start < values.length; start += MAX_EMBED_BATCH_SIZE) {
    const batchValues = values.slice(start, start + MAX_EMBED_BATCH_SIZE);
    const payload = await postJsonWithKeyRotation(
      `/models/${encodeURIComponent(model)}:batchEmbedContents`,
      {
        requests: batchValues.map((text) => ({
          model: `models/${model}`,
          content: {
            parts: [{ text }],
          },
          ...(taskType ? { taskType } : {}),
          ...(title ? { title } : {}),
        })),
      }
    );

    embeddings.push(...(payload?.embeddings || []).map((item) => item?.values || []));
  }

  return embeddings;
}

module.exports = {
  embedTexts,
  generateContent,
  getConfiguredApiKeys,
  getEmbeddingModel,
  getGenerationModel,
};
