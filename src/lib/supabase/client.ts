import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { getSupabaseEnvironment } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { url, publishableKey } = getSupabaseEnvironment();

  browserClient ??= createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
