import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthStorage } from "@/lib/authStorage";
import type { Database } from "./types";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? "";

/** False when Vercel/build env is missing — AuthContext shows a config error instead of a blank page. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/**
 * Always construct a client so module import never throws.
 * Calls fail until real VITE_SUPABASE_* values are set in the host env.
 * Native (Capacitor) uses Preferences for session persistence.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1wbGFjZWhvbGRlciJ9.placeholder",
  {
    auth: {
      storage: createAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);
