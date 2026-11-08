import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { getBackend } from "@repo/core/backend/index";
import type { SessionUser } from "@repo/core/backend/types";
import { fail, type ErrorCode } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { currentApiUser } from "@repo/core/lib/api-keys";
import { isRolePermission, SUPER_ADMIN, type Permission, type RolePermission } from "@repo/core/lib/permissions";
import { reportError } from "@repo/core/lib/server-log";
import { SITE_URL } from "@repo/core/lib/site-config";

export type CurrentUser = SessionUser;

export type Caller = {
  user_id: string;
  email: string;
  name: string;
  is_admin: boolean;
  roles: string[];
  permissions: RolePermission[];
  // A read-only role (the public demo): may open every screen it can view, changes are refused.
  is_read_only: boolean;
  // The admin language from the staff profile ("" = not chosen).
  locale: string;
};

const role_names_schema = z.array(z.string()).catch([]);

// The signed-in user, verified by the backend (never trust the cookie alone). Cached per request.
// Inside an MCP request it is the account of the verified API key instead (lib/api-keys.ts).
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => currentApiUser() ?? getBackend().auth.getCurrentUser(),
);

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

// The signed-in, active team member with roles resolved into permissions. Customers get null.
export const getCaller = cache(async (): Promise<Caller | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const backend = getBackend();
    const member = await backend.staff.getMembership(user.id);
    if (!member || !member.is_active) return null;

    const role_names = role_names_schema.parse(member.roles);
    const roles = role_names.length > 0 ? await backend.staff.getRoles() : [];
    const permissions = new Set<RolePermission>();
    const member_roles = roles.filter((role) => role_names.includes(role.name));
    for (const role of member_roles) {
      for (const permission of role.permissions) {
        if (isRolePermission(permission)) permissions.add(permission);
      }
    }

    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      is_admin: member.is_admin,
      roles: role_names,
      permissions: [...permissions],
      // Admins are never read-only, whatever roles they also hold.
      is_read_only: !member.is_admin && member_roles.some((role) => role.is_read_only),
      locale: member.locale,
    };
  } catch (error) {
    await reportError("auth", "getCaller", error);
    return null;
  }
});

export function callerCan(caller: Caller | null, permission: Permission): boolean {
  if (!caller) return false;
  if (caller.is_admin || caller.permissions.includes(SUPER_ADMIN) || caller.permissions.includes(permission))
    return true;
  // Any permission in a group implies seeing it: "categories.edit" can open the Categories page.
  if (!permission.endsWith(".view")) return false;
  const group = `${permission.split(".")[0]}.`;
  return caller.permissions.some((granted) => granted.startsWith(group));
}

// UI only: whether to show the screens and controls for `permission`. A read-only role (the public
// demo) sees them in every section it can view, so visitors see the real admin; the server refuses
// each change with demo_read_only (authorize). Never use this to allow anything.
export function callerShows(caller: Caller | null, permission: Permission): boolean {
  if (callerCan(caller, permission)) return true;
  if (!caller?.is_read_only) return false;
  return callerCan(caller, `${permission.split(".")[0]}.view` as Permission);
}

export function callerCanAny(caller: Caller | null, permissions: Permission[]): boolean {
  return permissions.some((permission) => callerCan(caller, permission));
}

// Refuses a signed-in caller in an action: logs the attempt and returns fail("forbidden").
export async function deny(caller: Caller | null, attempted: string) {
  await logActivity({ actor_id: caller?.user_id ?? null, action: attempted, is_denied: true });
  return fail("forbidden");
}

type Authorization = { ok: true; caller: Caller } | { ok: false; error: ErrorCode };

// Actions: the signed-in, active team member with `permission`, or a failure to return as-is.
// Refusals of signed-in users are written to the activity log.
export async function authorize(permission: Permission, attempted: string): Promise<Authorization> {
  const user = await getCurrentUser();
  if (!user) return fail("not_signed_in");
  const caller = await getCaller();
  // Read-only roles (the demo) may read what they can view, and nothing else.
  if (caller?.is_read_only && !isViewPermission(permission)) {
    await logActivity({ actor_id: user.id, action: attempted, details: { permission }, is_denied: true });
    return fail("demo_read_only");
  }
  if (!callerCan(caller, permission)) {
    await logActivity({ actor_id: user.id, action: attempted, details: { permission }, is_denied: true });
    return fail("forbidden");
  }
  return { ok: true, caller: caller as Caller };
}

// Actions that only read: they end in ".view".
function isViewPermission(permission: Permission): boolean {
  return permission.endsWith(".view");
}

// Pages and layouts only.
export async function requireUser(lang: string, next_path?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = next_path ? `?next=${encodeURIComponent(next_path)}` : "";
    redirect(`/${lang}/auth/login${next}`);
  }
  return user;
}

// Admin pages and layouts only. The admin app has no language in its URLs; the proxy passes the
// requested path in ADMIN_PATH_HEADER so the login page can send the user back to it.
export const ADMIN_PATH_HEADER = "x-admin-path";

export async function requireCaller(): Promise<Caller> {
  const user = await getCurrentUser();
  if (!user) {
    const next_path = (await headers()).get(ADMIN_PATH_HEADER) ?? "/";
    redirect(next_path === "/" ? "/login" : `/login?next=${encodeURIComponent(next_path)}`);
  }
  const caller = await getCaller();
  // Signed in but not staff (or deactivated): to the shop, an absolute URL since it's another app.
  if (!caller || !callerCan(caller, "dashboard.view")) redirect(SITE_URL);
  return caller;
}

export async function requirePermission(permission: Permission): Promise<Caller> {
  const caller = await requireCaller();
  // Pages only: the demo may open an edit page to look at it (its saves are refused).
  if (!callerShows(caller, permission)) redirect("/");
  return caller;
}
