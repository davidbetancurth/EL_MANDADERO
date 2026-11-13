import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost:54321", key ?? "sin-configurar", {
  auth: { persistSession: true, autoRefreshToken: true },
});
