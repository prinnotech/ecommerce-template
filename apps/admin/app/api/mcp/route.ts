import { handleMcpRequest } from "@repo/mcp/server";

// The store's MCP endpoint for AI assistants (Claude and others): Streamable HTTP, authenticated
// with a staff API key from Settings → API keys. Called from outside our UI, so it is a route.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
