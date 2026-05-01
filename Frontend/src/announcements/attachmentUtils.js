import * as DocumentPicker from "expo-document-picker";

export const ANNOUNCEMENT_ATTACHMENT_MIME_TYPES = ["application/pdf"];
export const ANNOUNCEMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ANNOUNCEMENT_ATTACHMENT_HELPER_TEXT =
  "PDF only, up to 10MB each. Students will be able to download these files.";

export async function pickAnnouncementAttachments(existingAttachments = []) {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ANNOUNCEMENT_ATTACHMENT_MIME_TYPES,
    base64: false,
  });

  if (result.canceled) {
    return { attachments: existingAttachments, error: "" };
  }

  const nextAttachments = [...existingAttachments];
  const invalid = [];

  for (const asset of result.assets || []) {
    const size = Number(asset?.size || 0);

    if (size && size > ANNOUNCEMENT_ATTACHMENT_MAX_BYTES) {
      invalid.push(asset.name || "PDF");
      continue;
    }

    nextAttachments.push(asset);
  }

  return {
    attachments: nextAttachments,
    error: invalid.length ? `${invalid.join(", ")} exceeds the 10MB limit.` : "",
  };
}
