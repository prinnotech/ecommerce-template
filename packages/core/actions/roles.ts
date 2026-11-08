"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { AdminRole } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, deny } from "@repo/core/lib/auth";
import { SUPER_ADMIN } from "@repo/core/lib/permissions";
import { role_name_input_schema, role_schema, type RoleInput, type RoleNameInput } from "@repo/core/lib/schemas/admin";

export type { AdminRole };

function logRole(actor_id: string, action: string, name: string, details: Record<string, unknown> = {}) {
  return logActivity({ actor_id, action, target_type: "roles", target_id: name, details });
}

export async function getRoles(): Promise<ActionResult<AdminRole[]>> {
  const auth = await authorize("roles.view", "view roles");
  if (!auth.ok) return auth;

  try {
    return ok(await getBackend().staff.listRoles());
  } catch (error) {
    return failFrom(error, "roles", "getRoles");
  }
}

export async function createRole(input: RoleInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("roles.edit", "create a role");
  if (!auth.ok) return auth;
  const parsed = role_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  // Only admins create a role that grants everything.
  if (parsed.data.permissions.includes(SUPER_ADMIN) && !auth.caller.is_admin) {
    return deny(auth.caller, "create a role with full access");
  }

  try {
    const created = await getBackend().staff.createRole(parsed.data);
    await logRole(auth.caller.user_id, "create a role", parsed.data.name, { permissions: parsed.data.permissions });
    return ok(created);
  } catch (error) {
    return failFrom(error, "roles", "createRole");
  }
}

// Changes a role's description and permissions (its name stays: members refer to it by name).
export async function updateRole(input: RoleInput): Promise<ActionResult<null>> {
  const auth = await authorize("roles.edit", "edit a role");
  if (!auth.ok) return auth;
  const parsed = role_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { name, description, permissions } = parsed.data;

  try {
    const backend = getBackend();
    const role = (await backend.staff.listRoles()).find((entry) => entry.name === name);
    if (!role) return fail("not_found");
    // Granting or editing full access is for admins only.
    const involves_super_admin = permissions.includes(SUPER_ADMIN) || role.permissions.includes(SUPER_ADMIN);
    if (involves_super_admin && !auth.caller.is_admin) return deny(auth.caller, "edit a role with full access");

    await backend.staff.updateRole(name, { description, permissions });
    await logRole(auth.caller.user_id, "edit a role", name, { before: role.permissions, after: permissions });
    return ok(null);
  } catch (error) {
    return failFrom(error, "roles", "updateRole");
  }
}

export async function deleteRole(input: RoleNameInput): Promise<ActionResult<null>> {
  const auth = await authorize("roles.edit", "delete a role");
  if (!auth.ok) return auth;
  const parsed = role_name_input_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");

  try {
    const backend = getBackend();
    const role = (await backend.staff.listRoles()).find((entry) => entry.name === parsed.data.name);
    if (!role) return fail("not_found");
    if (role.permissions.includes(SUPER_ADMIN) && !auth.caller.is_admin) {
      return deny(auth.caller, "delete a role with full access");
    }
    await backend.staff.deleteRole(parsed.data.name);
    await logRole(auth.caller.user_id, "delete a role", parsed.data.name);
    return ok(null);
  } catch (error) {
    return failFrom(error, "roles", "deleteRole");
  }
}
