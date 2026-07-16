-- One chat session per talent user (safe for concurrent session loads).
-- Run after talent_chat.sql if you already created the tables.

CREATE UNIQUE INDEX IF NOT EXISTS idx_talent_chat_sessions_user_unique
  ON public.talent_chat_sessions (user_id);
