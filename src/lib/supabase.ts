import { createClient } from "@supabase/supabase-js";

// Safe access to Vite import.meta.env or Node process.env
const metaEnv = (import.meta as any).env || {};

const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://xyzcompany.supabase.co";

const supabaseAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key";

// Supabase Client instance for client/server side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    supabaseUrl !== "https://xyzcompany.supabase.co" &&
    Boolean(supabaseAnonKey) &&
    supabaseAnonKey !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key"
  );
}
