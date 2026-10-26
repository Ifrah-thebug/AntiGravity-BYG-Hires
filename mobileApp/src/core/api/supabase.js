import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/core/config/env';

let supabaseUrl = env.supabaseUrl;
let supabaseAnonKey = env.supabaseAnonKey;

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.warn('[Supabase] Missing or invalid SUPABASE_URL in mobileApp/.env. Using fallback to prevent crash.');
  supabaseUrl = 'https://dummy-project.supabase.co';
}

if (!supabaseAnonKey) {
  console.warn('[Supabase] Missing SUPABASE_ANON_KEY in mobileApp/.env.');
  supabaseAnonKey = 'dummy-key';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
