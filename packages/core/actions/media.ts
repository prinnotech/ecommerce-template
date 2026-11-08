"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { MediaItem } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, callerCan } from "@repo/core/lib/auth";

export type { MediaItem };

// The media library: images uploaded from the theme editor, reusable in any section.

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export async function getMedia(): Promise<ActionResult<MediaItem[]>> {
  const auth = await authorize("themes.view", "view the media library");
  if (!auth.ok) return auth;
  try {
    return ok(await getBackend().media.list());
  } catch (error) {
    return failFrom(error, "media", "getMedia");
  }
}

// FormData: file. Anyone who edits themes or pages may upload.
export async function uploadMedia(form_data: FormData): Promise<ActionResult<MediaItem>> {
  const auth = await authorize("themes.view", "upload an image");
  if (!auth.ok) return auth;
  if (auth.caller.is_read_only) return fail("demo_read_only");
  if (!callerCan(auth.caller, "themes.edit") && !callerCan(auth.caller, "pages.edit")) return fail("forbidden");

  const file = form_data.get("file");
  if (!(file instanceof File)) return fail("invalid_input");
  if (!MEDIA_TYPES.includes(file.type)) return fail("invalid_image");
  if (file.size > MAX_MEDIA_BYTES) return fail("image_too_large");

  try {
    const item = await getBackend().media.upload(file);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "upload an image",
      target_type: "media",
      target_id: item.id,
    });
    return ok(item);
  } catch (error) {
    return failFrom(error, "media", "uploadMedia");
  }
}
