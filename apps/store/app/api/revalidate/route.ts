import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { verifyRevalidateHeaders } from "@repo/core/lib/theme-signing";

// Called by the admin app after a theme is published (packages/core/lib/store-revalidate.ts): an
// action can't be used because the caller is another app. Signed with THEME_PREVIEW_SECRET and
// valid for a few minutes; it only refreshes cached pages, nothing else.
export async function POST(request: NextRequest) {
  const is_valid = verifyRevalidateHeaders(
    request.headers.get("x-revalidate-timestamp"),
    request.headers.get("x-revalidate-signature"),
  );
  if (!is_valid) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
