"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { MediaItem, Page } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, callerCanAny, deny } from "@repo/core/lib/auth";
import type { Permission } from "@repo/core/lib/permissions";
import { id_schema } from "@repo/core/lib/schemas/ids";
import {
  MAX_MEDIA_BYTES,
  MEDIA_TYPES,
  media_filters_schema,
  update_media_schema,
  type MediaFilters,
  type UpdateMediaInput,
} from "@repo/core/lib/schemas/media";

export type { MediaItem };

// Content → Files: the media library. Anyone who can work on themes, pages, products or collections
// may browse it and upload to it (the pickers); renaming and deleting need files.edit.

const PAGE_SIZE = 48;

const USERS: Record<"view" | "upload", Permission[]> = {
  view: ["files.view", "themes.view", "pages.view", "products.view", "collections.view"],
  upload: ["files.edit", "themes.edit", "pages.edit", "products.edit", "collections.edit"],
};

async function authorizeLibrary(kind: "view" | "upload", attempted: string) {
  const auth = await authorize("dashboard.view", attempted);
  if (!auth.ok) return auth;
  if (kind === "upload" && auth.caller.is_read_only) return fail("demo_read_only");
  if (!callerCanAny(auth.caller, USERS[kind])) return deny(auth.caller, attempted);
  return auth;
}

export async function getMediaPage(input: Partial<MediaFilters>): Promise<ActionResult<Page<MediaItem>>> {
  const auth = await authorizeLibrary("view", "view the media library");
  if (!auth.ok) return auth;
  try {
    return ok(await getBackend().media.list(media_filters_schema.parse(input), PAGE_SIZE));
  } catch (error) {
    return failFrom(error, "media", "getMediaPage");
  }
}

// FormData: file. One file per call keeps each request under the body size limit.
export async function uploadMedia(form_data: FormData): Promise<ActionResult<MediaItem>> {
  const auth = await authorizeLibrary("upload", "upload an image");
  if (!auth.ok) return auth;

  const file = form_data.get("file");
  if (!(file instanceof File)) return fail("invalid_input");
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) return fail("invalid_image");
  if (file.size > MAX_MEDIA_BYTES) return fail("image_too_large");

  try {
    const item = await getBackend().media.upload(file);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "upload an image",
      target_type: "media",
      target_id: item.id,
      details: { name: item.name },
    });
    return ok(item);
  } catch (error) {
    return failFrom(error, "media", "uploadMedia");
  }
}

export async function updateMedia(input: UpdateMediaInput): Promise<ActionResult<MediaItem>> {
  const auth = await authorize("files.edit", "edit a file");
  if (!auth.ok) return auth;
  const parsed = update_media_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  try {
    const item = await getBackend().media.update(parsed.data.id, { name: parsed.data.name, alt: parsed.data.alt });
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit a file",
      target_type: "media",
      target_id: item.id,
      details: { name: item.name },
    });
    return ok(item);
  } catch (error) {
    return failFrom(error, "media", "updateMedia");
  }
}

// Sections and pages that point at the image keep its link, which stops working.
export async function deleteMedia(id: string): Promise<ActionResult<null>> {
  const auth = await authorize("files.edit", "delete a file");
  if (!auth.ok) return auth;
  if (!id_schema.safeParse(id).success) return fail("not_found");
  try {
    await getBackend().media.remove(id);
    await logActivity({ actor_id: auth.caller.user_id, action: "delete a file", target_type: "media", target_id: id });
    return ok(null);
  } catch (error) {
    return failFrom(error, "media", "deleteMedia");
  }
}
