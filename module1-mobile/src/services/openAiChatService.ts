/**
 * Swaram ASHA Copilot Chatbot Service (Powered by Google Gemini)
 * Re-exports from geminiChatService for seamless backward compatibility.
 */

export * from './geminiChatService';

import {
  sendChatMessageToGemini,
  getCustomGeminiChatApiKey,
  setCustomGeminiChatApiKey,
  getGeminiModel,
  ChatMessage
} from './geminiChatService';

// Aliases for backward compatibility
export const sendChatMessageToOpenAi = sendChatMessageToGemini;
export const getCustomOpenAiApiKey = getCustomGeminiChatApiKey;
export const setCustomOpenAiApiKey = setCustomGeminiChatApiKey;
export const getOpenAiModel = getGeminiModel;
