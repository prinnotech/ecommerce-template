import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { fail, type ErrorCode } from "@/lib/action-result";
import { logActivity } from "@/lib/activity-log";
import { isRolePermission, SUPER_ADMIN, type Permission, type RolePermission } from "@/lib/permissions";
import { createAdminPocketBase, createServerPocketBase } from "@/lib/pocketbase/pocketbase-server";
import { reportError } from "@/lib/server-log";
import type { UsersResponse } from "@/types/pocketbase-types";

export type CurrentUser = Pick<UsersResponse, "id" | "email" | "name" | "phone" | "verified">;

export type Caller = {
  user_id: string;
  email: string;
  name: string;
  is_admin: boolean;
  roles: string[];
  permissions: RolePermission[];
};

const role_names_schema = z.array(z.string()).catch([]);

// The signed-in user, verified against PocketBase (never trust the cookie alone). Cached per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const pb = await createServerPocketBase();
  if (!pb.authStore.token) return null;
  try {
    // `fields` applies to the whole auth response ({ token, record }), hence the record. prefix.
    const { record } = await pb
      .collection("users")
      .authRefresh({ fields: "record.id,record.email,record.name,record.phone,record.verified" });
    if (!record?.id) return null;
    return { id: record.id, email: record.email, name: record.name, phone: record.phone, verified: record.verified };
  } catch {
    // Invalid, expired or revoked token: treat as signed out.
    return null;
  }
});

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

// The signed-in, active team member with roles resolved into permissions. Customers get null.
export const getCaller = cache(async (): Promise<Caller | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const pb = await createAdminPocketBase();
    const member = await pb
      .collection("team_members")
      .getFirstListItem(pb.filter("user = {:user}", { user: user.id }))
      .catch(() => null);
    if (!member || !member.is_active) return null;

    const role_names = role_names_schema.parse(member.roles);
    // A store has a handful of roles, so reading them all is cheaper than building an OR filter.
    const roles = role_names.length > 0 ? await pb.collection("roles").getFullList({ fields: "name,permissions" }) : [];
    const permissions = new Set<RolePermission>();
    for (const role of roles.filter((role) => role_names.includes(role.name))) {
      for (const permission of z.array(z.unknown()).catch([]).parse(role.permissions)) {
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
    };
  } catch (error) {
    await reportError("auth", "getCaller", error);
    return null;
  }
});

export function callerCan(caller: Caller | null, permission: Permission): boolean {
  if (!caller) return false;
  return caller.is_admin || caller.permissions.includes(SUPER_ADMIN) || caller.permissions.includes(permission);
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
  if (!callerCan(caller, permission)) {
    await logActivity({ actor_id: user.id, action: attempted, details: { permission }, is_denied: true });
    return fail("forbidden");
  }
  return { ok: true, caller: caller as Caller };
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

export async function requireCaller(lang: string): Promise<Caller> {
  await requireUser(lang, `/${lang}/dashboard`);
  const caller = await getCaller();
  // Customers and inactive staff go home, not back into a login loop.
  if (!caller || !callerCan(caller, "dashboard.view")) redirect(`/${lang}`);
  return caller;
}

export async function requirePermission(lang: string, permission: Permission): Promise<Caller> {
  const caller = await requireCaller(lang);
  if (!callerCan(caller, permission)) redirect(`/${lang}/dashboard`);
  return caller;
}
