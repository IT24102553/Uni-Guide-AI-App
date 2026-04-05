import { buildQuery, requestApi } from "./client";

export function fetchChatConversations(params) {
  return requestApi(`/chat/conversations${buildQuery(params)}`, {
    fallbackMessage: "Unable to load conversations right now",
  });
}

export function fetchChatConversationById(conversationId, params) {
  return requestApi(`/chat/conversations/${conversationId}${buildQuery(params)}`, {
    fallbackMessage: "Unable to load this conversation right now",
  });
}

export function createChatConversation(payload) {
  return requestApi("/chat/conversations", {
    method: "POST",
    body: payload,
    fallbackMessage: "Unable to create a new conversation right now",
  });
}

export function renameChatConversation(conversationId, payload) {
  return requestApi(`/chat/conversations/${conversationId}`, {
    method: "PATCH",
    body: payload,
    fallbackMessage: "Unable to rename the conversation right now",
  });
}

export function deleteChatConversation(conversationId, payload) {
  return requestApi(`/chat/conversations/${conversationId}`, {
    method: "DELETE",
    body: payload,
    fallbackMessage: "Unable to delete the conversation right now",
  });
}

export function sendChatMessage(conversationId, payload) {
  return requestApi(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: payload,
    fallbackMessage: "Unable to send the message right now",
  });
}

export function rateChatMessage(conversationId, messageId, payload) {
  return requestApi(
    `/chat/conversations/${conversationId}/messages/${messageId}/rating`,
    {
      method: "PATCH",
      body: payload,
      fallbackMessage: "Unable to save the message rating right now",
    }
  );
}
