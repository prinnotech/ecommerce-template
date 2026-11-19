import { unsubscribeFromMarketing } from "@repo/core/actions/unsubscribe";

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header of a
// marketing email. The signed token in the link is the authorization.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const result = await unsubscribeFromMarketing({
    user_id: url.searchParams.get("u") ?? "",
    token: url.searchParams.get("t") ?? "",
  });
  return result.ok ? new Response(null, { status: 200 }) : Response.json({ error: result.error }, { status: 400 });
}
