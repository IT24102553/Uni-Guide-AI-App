import { buildQuery, requestApi, resolveProtectedFileUrl } from "./client";

function appendDocumentToFormData(formData, document) {
  if (!document) {
    return;
  }

  if (document.file) {
    formData.append("document", document.file, document.name || "document.pdf");
    return;
  }

  formData.append("document", {
    uri: document.uri,
    name: document.name || "document.pdf",
    type: document.mimeType || document.type || "application/pdf",
  });
}

export function fetchKnowledgeBaseFaqs(params = {}) {
  return requestApi(`/knowledge-base/faqs${buildQuery(params)}`, {
    fallbackMessage: "Unable to load knowledge base FAQs right now",
  });
}

export function createKnowledgeBaseFaq(payload) {
  return requestApi("/knowledge-base/faqs", {
    method: "POST",
    body: payload,
    fallbackMessage: "Unable to create the FAQ right now",
  });
}

export function updateKnowledgeBaseFaq(id, payload) {
  return requestApi(`/knowledge-base/faqs/${id}`, {
    method: "PUT",
    body: payload,
    fallbackMessage: "Unable to update the FAQ right now",
  });
}

export function deleteKnowledgeBaseFaq(id) {
  return requestApi(`/knowledge-base/faqs/${id}`, {
    method: "DELETE",
    fallbackMessage: "Unable to delete the FAQ right now",
  });
}

export function fetchKnowledgeBaseDocuments(params = {}) {
  return requestApi(`/knowledge-base/documents${buildQuery(params)}`, {
    fallbackMessage: "Unable to load knowledge base PDF documents right now",
  });
}

export function uploadKnowledgeBaseDocument(payload, document) {
  const formData = new FormData();

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      formData.append(key, String(value));
    }
  });

  appendDocumentToFormData(formData, document);

  return requestApi("/knowledge-base/documents", {
    method: "POST",
    body: formData,
    fallbackMessage: "Unable to upload the PDF document right now",
  });
}

export function deleteKnowledgeBaseDocument(id) {
  return requestApi(`/knowledge-base/documents/${id}`, {
    method: "DELETE",
    fallbackMessage: "Unable to delete the PDF document right now",
  });
}

export function resolveKnowledgeBaseDocumentUrl(url) {
  return resolveProtectedFileUrl(url);
}
