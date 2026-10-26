import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  BACKEND_URL,
  WEB_APP_URL,
  GEMINI_API_KEY,
  VAPI_PUBLIC_KEY,
  VAPI_ASSISTANT_ID,
} from '@env';

const trimSlash = (value) => String(value || '').trim().replace(/\/$/, '');

/** Live site — the Express API is served from the same domain (https://byghires.com/api/...). */
const LIVE_URL = 'https://byghires.com';

/** Runtime config — values come from mobileApp/.env (see .env.example). */
export const env = {
  supabaseUrl: String(SUPABASE_URL || '').trim(),
  supabaseAnonKey: String(SUPABASE_ANON_KEY || '').trim(),
  backendUrl: trimSlash(BACKEND_URL) || LIVE_URL,
  webAppUrl: trimSlash(WEB_APP_URL) || LIVE_URL,
  geminiApiKey: String(GEMINI_API_KEY || '').trim(),
  vapiPublicKey: String(VAPI_PUBLIC_KEY || '').trim(),
  vapiAssistantId: String(VAPI_ASSISTANT_ID || '').trim(),
};
