// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.warn('[Supabase] Missing or invalid VITE_SUPABASE_URL. Using fallback to prevent crash.');
  supabaseUrl = 'https://dummy-project.supabase.co';
}

if (!supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_ANON_KEY.');
  supabaseAnonKey = 'dummy-key';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
