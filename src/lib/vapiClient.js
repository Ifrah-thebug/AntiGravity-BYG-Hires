import Vapi from '@vapi-ai/web';

let vapiInstance = null;

export function getVapi() {
  const apiKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
  if (!apiKey) {
    throw new Error('VAPI is not configured. Missing VITE_VAPI_PUBLIC_KEY.');
  }
  if (!vapiInstance) {
    vapiInstance = new Vapi(apiKey);
  }
  return vapiInstance;
}

export function getAssistantId() {
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
  if (!assistantId) {
    throw new Error('VAPI assistant is not configured. Missing VITE_VAPI_ASSISTANT_ID.');
  }
  return assistantId;
}
