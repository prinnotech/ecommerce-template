import { serveMedia } from "@repo/backend-sqlite/media-route";

// Uploaded images when the store runs on SQLite (other backends serve their own files).
export async function GET(_request: Request, { params }: RouteContext<"/media/[...path]">) {
  return serveMedia((await params).path);
}
