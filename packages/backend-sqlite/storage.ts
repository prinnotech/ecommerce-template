import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FileStorage } from "@repo/backend-sql/context";
import { newId } from "@repo/backend-sql/values";
import { MEDIA_ROUTE, uploadsDir } from "@repo/backend-sqlite/config";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

// Images in a local folder, served by each app's /media route (media-route.ts). Paths are
// "<folder>/<uuid>.<ext>", so they never contain anything the visitor chose.
export const local_storage: FileStorage = {
  async upload(folder, file) {
    const relative = `${folder}/${newId()}.${EXTENSIONS[file.type] ?? "bin"}`;
    const target = path.join(uploadsDir(), relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    return relative;
  },

  async remove(paths) {
    await Promise.all(paths.map((relative) => rm(path.join(uploadsDir(), relative), { force: true })));
  },

  // Relative URL: both apps serve /media, so it works on the store and in the admin.
  url(relative) {
    return `${MEDIA_ROUTE}/${relative.split("/").map(encodeURIComponent).join("/")}`;
  },
};
