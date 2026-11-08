import { readFile } from "node:fs/promises";
import path from "node:path";

import { uploadsDir } from "@repo/backend-sqlite/config";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

// GET /media/<path>: serves an uploaded image (BACKEND=sqlite only). Each app re-exports this
// from app/media/[...path]/route.ts. Files are public, like Supabase's and PocketBase's.
export async function serveMedia(segments: string[]): Promise<Response> {
  if (process.env.BACKEND !== "sqlite") return new Response("Not found", { status: 404 });
  const root = uploadsDir();
  const file = path.resolve(root, ...segments);
  // Never outside the uploads folder ("../" in the URL).
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    // Missing file.
    return new Response("Not found", { status: 404 });
  }
}
