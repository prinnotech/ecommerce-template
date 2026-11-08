"use server";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import type { StaffMember, StaffRole } from "@repo/core/backend/types";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { authorize, callerCan, deny, type Caller } from "@repo/core/lib/auth";
import { SUPER_ADMIN } from "@repo/core/lib/permissions";
import {
  invite_member_schema,
  update_member_schema,
  type InviteMemberInput,
  type UpdateMemberInput,
} from "@repo/core/lib/schemas/admin";

export type { StaffMember };

// Only admins hand out admin access or a role that grants everything (style guide §11).
function grantsEverything(role_names: string[], roles: StaffRole[]): boolean {
  return roles.some((role) => role_names.includes(role.name) && role.permissions.includes(SUPER_ADMIN));
}

// Every role name must exist; returns false otherwise.
function rolesExist(role_names: string[], roles: StaffRole[]): boolean {
  return role_names.every((name) => roles.some((role) => role.name === name));
}

function log(caller: Caller, action: string, user_id: string, details: Record<string, unknown>) {
  return logActivity({ actor_id: caller.user_id, action, target_type: "team_members", target_id: user_id, details });
}

export async function getTeamMembers(): Promise<ActionResult<StaffMember[]>> {
  const auth = await authorize("users.view", "view the team");
  if (!auth.ok) return auth;

  try {
    return ok(await getBackend().staff.listMembers());
  } catch (error) {
    return failFrom(error, "team", "getTeamMembers");
  }
}

// Adds someone to the team. A new email gets an account and an email with a link to choose a
// password; an existing customer keeps their password and just gains admin access.
export async function inviteMember(input: InviteMemberInput): Promise<ActionResult<{ user_id: string }>> {
  const auth = await authorize("users.invite", "invite a team member");
  if (!auth.ok) return auth;
  const parsed = invite_member_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { email, name, roles: role_names, is_admin } = parsed.data;

  try {
    const backend = getBackend();
    const roles = await backend.staff.getRoles();
    if (!rolesExist(role_names, roles)) return fail("invalid_input");
    if ((is_admin || grantsEverything(role_names, roles)) && !auth.caller.is_admin) {
      return deny(auth.caller, "invite a team member with admin access");
    }

    const { user_id, is_new } = await backend.auth.ensureUser({ email, name });
    await backend.staff.addMember(user_id, { roles: role_names, is_admin });
    if (is_new) await backend.auth.sendStaffInvite(email);
    await log(auth.caller, "invite a team member", user_id, { email, roles: role_names, is_admin, is_new });
    return ok({ user_id });
  } catch (error) {
    return failFrom(error, "team", "inviteMember");
  }
}

// Roles and admin flag need users.edit; switching someone on or off needs users.deactivate.
// Nobody changes their own access unless they're an admin; only admins touch other admins.
export async function updateMember(input: UpdateMemberInput): Promise<ActionResult<null>> {
  const parsed = update_member_schema.safeParse(input);
  const changes_access = parsed.success && (parsed.data.roles !== undefined || parsed.data.is_admin !== undefined);
  const auth = await authorize(changes_access ? "users.edit" : "users.deactivate", "change a team member");
  if (!auth.ok) return auth;
  if (!parsed.success) return fail("invalid_input");
  const { user_id, ...fields } = parsed.data;
  if (fields.is_active !== undefined && !callerCan(auth.caller, "users.deactivate")) {
    return deny(auth.caller, "activate or deactivate a team member");
  }

  try {
    const backend = getBackend();
    const [members, roles] = await Promise.all([backend.staff.listMembers(), backend.staff.getRoles()]);
    const member = members.find((entry) => entry.user_id === user_id);
    if (!member) return fail("not_found");
    if (user_id === auth.caller.user_id && !auth.caller.is_admin) return fail("cannot_change_self");
    // Admins can't switch themselves off either: the store must keep someone who can sign in.
    if (user_id === auth.caller.user_id && fields.is_active === false) return fail("cannot_change_self");
    if (fields.roles && !rolesExist(fields.roles, roles)) return fail("invalid_input");
    const touches_admin =
      member.is_admin ||
      fields.is_admin !== undefined ||
      grantsEverything(member.roles, roles) ||
      (fields.roles !== undefined && grantsEverything(fields.roles, roles));
    if (touches_admin && !auth.caller.is_admin) return deny(auth.caller, "change an admin's access");

    await backend.staff.updateMember(user_id, fields);
    await log(auth.caller, "change a team member", user_id, {
      email: member.email,
      before: { roles: member.roles, is_admin: member.is_admin, is_active: member.is_active },
      after: fields,
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "team", "updateMember");
  }
}
