/**
 * Supabase browser client.
 *
 * Singleton client using the public anon key. This key is safe to ship in
 * browser bundles — it provides no elevated access; RLS and Edge Function
 * auth guards protect all data.
 *
 * Usage for unauthenticated requests (e.g. public catalog reads):
 *   import { supabase } from "./services/supabase";
 *   const { data } = await supabase.from("powerup_skus").select("*");
 *
 * For authenticated Edge Function calls, attach the custom session JWT
 * separately via the `Authorization` header (see auth.ts `fetchWithAuth`).
 *
 * NEVER import SUPABASE_SERVICE_ROLE_KEY here or in any client module.
 * Service role access belongs exclusively inside Supabase Edge Functions.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. " +
    "Copy .env.example → .env and run `npx supabase start`.",
  );
}

/**
 * Singleton Supabase client — anon key only.
 * All tables have RLS enabled; `service_role` operations go through Edge Functions.
 */
export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
