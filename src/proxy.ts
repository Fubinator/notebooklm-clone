import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasSupabaseEnvironment } from "@/lib/env";
import { refreshGuestSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnvironment()) {
    return NextResponse.next({ request });
  }

  return refreshGuestSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
