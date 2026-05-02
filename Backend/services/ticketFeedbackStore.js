const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const TicketFeedback = require("../models/TicketFeedback");

function normalizeTicketId(ticketOrId) {
  const value = ticketOrId?._id || ticketOrId;
  const stringValue = String(value || "").trim();

  if (!mongoose.Types.ObjectId.isValid(stringValue)) {
    return null;
  }

  return new mongoose.Types.ObjectId(stringValue);
}

function uniqueObjectIds(ids = []) {
  const seen = new Set();
  const objectIds = [];

  ids.forEach((value) => {
    const objectId = normalizeTicketId(value);

    if (!objectId) {
      return;
    }

    const key = String(objectId);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    objectIds.push(objectId);
  });

  return objectIds;
}

function toPlainAttachments(attachments = []) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
    fileId: String(attachment?.fileId || "").trim(),
    originalName: attachment?.originalName || "",
    storedName: attachment?.storedName || "",
    mimeType: attachment?.mimeType || "",
    size: Number(attachment?.size || 0),
    url: attachment?.url || "",
    uploadedAt: attachment?.uploadedAt ? new Date(attachment.uploadedAt) : new Date(),
  }));
}

function extractLegacyFeedback(ticket) {
  const feedback = ticket?.feedback;
  const rating = Number(feedback?.rating || 0);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  return {
    rating,
    comment: String(feedback?.comment || "").trim(),
    attachments: toPlainAttachments(feedback?.attachments),
    submittedAt: feedback?.submittedAt ? new Date(feedback.submittedAt) : new Date(),
    updatedAt: feedback?.updatedAt ? new Date(feedback.updatedAt) : new Date(),
  };
}

function buildFeedbackPayload(ticket) {
  const legacyFeedback = extractLegacyFeedback(ticket);

  if (!legacyFeedback) {
    return null;
  }

  const ticketId = normalizeTicketId(ticket?._id);
  const studentId = normalizeTicketId(ticket?.student);

  if (!ticketId || !studentId) {
    return null;
  }

  return {
    ticket: ticketId,
    student: studentId,
    rating: legacyFeedback.rating,
    comment: legacyFeedback.comment,
    attachments: legacyFeedback.attachments,
    submittedAt: legacyFeedback.submittedAt,
    updatedAt: legacyFeedback.updatedAt,
  };
}

async function clearLegacyFeedbackForTicketIds(ticketIds = []) {
  const objectIds = uniqueObjectIds(ticketIds);

  if (!objectIds.length) {
    return;
  }

  await Ticket.collection
    .updateMany(
      {
        _id: { $in: objectIds },
      },
      {
        $unset: { feedback: "" },
      }
    )
    .catch(() => undefined);
}

async function migrateLegacyFeedbacks(rawTickets = []) {
  const payloads = rawTickets.map(buildFeedbackPayload).filter(Boolean);

  if (!payloads.length) {
    return new Map();
  }

  await TicketFeedback.bulkWrite(
    payloads.map((payload) => ({
      updateOne: {
        filter: { ticket: payload.ticket },
        update: { $setOnInsert: payload },
        upsert: true,
      },
    }))
  );

  await clearLegacyFeedbackForTicketIds(payloads.map((payload) => payload.ticket));

  const migratedFeedbacks = await TicketFeedback.find({
    ticket: {
      $in: payloads.map((payload) => payload.ticket),
    },
  });

  return new Map(
    migratedFeedbacks.map((feedback) => [String(feedback.ticket), feedback])
  );
}

async function migrateLegacyFeedbacksForTicketIds(ticketIds = []) {
  const objectIds = uniqueObjectIds(ticketIds);

  if (!objectIds.length) {
    return new Map();
  }

  const rawTickets = await Ticket.collection
    .find({
      _id: { $in: objectIds },
      "feedback.rating": { $exists: true },
    })
    .toArray();

  return migrateLegacyFeedbacks(rawTickets);
}

async function migrateAllLegacyFeedbacks() {
  const rawTickets = await Ticket.collection
    .find({
      "feedback.rating": { $exists: true },
    })
    .toArray();

  return migrateLegacyFeedbacks(rawTickets);
}

async function getFeedbackMapForTickets(tickets = []) {
  const objectIds = uniqueObjectIds(tickets);

  if (!objectIds.length) {
    return new Map();
  }

  const existingFeedbacks = await TicketFeedback.find({
    ticket: { $in: objectIds },
  });
  const feedbackMap = new Map(
    existingFeedbacks.map((feedback) => [String(feedback.ticket), feedback])
  );
  const missingIds = objectIds.filter((objectId) => !feedbackMap.has(String(objectId)));

  if (!missingIds.length) {
    return feedbackMap;
  }

  const migratedFeedbackMap = await migrateLegacyFeedbacksForTicketIds(missingIds);

  migratedFeedbackMap.forEach((feedback, key) => {
    feedbackMap.set(key, feedback);
  });

  return feedbackMap;
}

async function getFeedbackForTicket(ticketOrId) {
  const feedbackMap = await getFeedbackMapForTickets([ticketOrId]);
  return feedbackMap.get(String(ticketOrId?._id || ticketOrId || "")) || null;
}

async function findFeedbackByAttachmentFileId(fileId) {
  const normalizedFileId = String(fileId || "").trim();

  if (!normalizedFileId) {
    return null;
  }

  const feedback = await TicketFeedback.findOne({
    "attachments.fileId": normalizedFileId,
  });

  if (feedback) {
    return feedback;
  }

  const rawTicket = await Ticket.collection.findOne(
    {
      "feedback.attachments.fileId": normalizedFileId,
    },
    {
      projection: { _id: 1, student: 1, feedback: 1 },
    }
  );

  if (!rawTicket) {
    return null;
  }

  const migratedFeedbackMap = await migrateLegacyFeedbacks([rawTicket]);
  return migratedFeedbackMap.get(String(rawTicket._id)) || null;
}

module.exports = {
  clearLegacyFeedbackForTicketIds,
  findFeedbackByAttachmentFileId,
  getFeedbackForTicket,
  getFeedbackMapForTickets,
  migrateAllLegacyFeedbacks,
};
