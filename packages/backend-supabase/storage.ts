import "server-only";

import type { FileStorage } from "@repo/backend-sql/context";
import { newId } from "@repo/backend-sql/values";
import { createAdminClient } from "@repo/backend-supabase/clients";
import { HAS_IMAGE_TRANSFORMS, MEDIA_BUCKET, SUPABASE_URL } from "@repo/backend-supabase/config";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

// Images in the public "media" bucket (created by the 0002_supabase migration).
export const supabase_storage: FileStorage = {
  async upload(folder, file) {
    const path = `${folder}/${newId()}.${EXTENSIONS[file.type] ?? "bin"}`;
    const { error } = await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },

  async remove(paths) {
    if (paths.length === 0) return;
    const { error } = await createAdminClient().storage.from(MEDIA_BUCKET).remove(paths);
    if (error) throw error;
  },

  // Resized renditions need Supabase image transformations (paid plans); otherwise the original.
  url(path, width) {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    if (width && HAS_IMAGE_TRANSFORMS) {
      return `${SUPABASE_URL}/storage/v1/render/image/public/${MEDIA_BUCKET}/${encoded}?width=${width}&resize=contain`;
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
  },
};
