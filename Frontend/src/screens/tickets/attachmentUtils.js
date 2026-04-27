import * as DocumentPicker from "expo-document-picker";
import { resolveProtectedFileUrl } from "../../api/client";

export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ATTACHMENT_HELPER_TEXT = "Accepted: PDF, JPG, PNG, DOCX up to 5MB each.";
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function attachmentKey(attachment) {
  return String(
    attachment?._id ||
      attachment?.uri ||
      `${attachment?.name || attachment?.originalName || "attachment"}-${attachment?.size || 0}`
  );
}

export function formatAttachmentSize(bytes) {
  const size = Number(bytes || 0);

  if (!size) {
    return "";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function resolveAttachmentUrl(url) {
  return resolveProtectedFileUrl(url);
}

export async function pickAttachments(existingAttachments = []) {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ATTACHMENT_MIME_TYPES,
    base64: false,
  });

  if (result.canceled) {
    return { attachments: existingAttachments, error: "" };
  }

  const nextAttachments = [...existingAttachments];
  const invalid = [];

  for (const asset of result.assets || []) {
    const size = Number(asset?.size || 0);

    if (size && size > MAX_ATTACHMENT_BYTES) {
      invalid.push(asset.name || "Attachment");
      continue;
    }

    nextAttachments.push(asset);
  }

  return {
    attachments: nextAttachments,
    error: invalid.length ? `${invalid.join(", ")} exceeds the 5MB limit.` : "",
  };
}

export function removePendingAttachment(collection, key) {
  return collection.filter((attachment) => attachmentKey(attachment) !== key);
}

export function appendAttachmentsToFormData(formData, attachments = []) {
  attachments.forEach((attachment, index) => {
    if (!attachment) {
      return;
    }

    if (attachment.file) {
      formData.append("attachments", attachment.file, attachment.name || `attachment-${index}`);
      return;
    }

    formData.append("attachments", {
      uri: attachment.uri,
      name: attachment.name || `attachment-${index}`,
      type: attachment.mimeType || attachment.type || "application/octet-stream",
    });
  });
}
