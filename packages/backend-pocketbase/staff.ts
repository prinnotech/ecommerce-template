import "server-only";

import { z } from "zod";

import { BackendError } from "@repo/core/backend/errors";
import type { SavedViewsBackend, StaffBackend } from "@repo/core/backend/types";
import { createAdminPocketBase } from "@repo/backend-pocketbase/client";
import { pocketBaseFieldCode, pocketBaseStatus } from "@repo/backend-pocketbase/errors";
import type { TypedPocketBase } from "@repo/backend-pocketbase/pocketbase-types";

const string_list_schema = z.array(z.string()).catch([]);
const unknown_list_schema = z.array(z.unknown()).catch([]);
const filters_schema = z.record(z.string(), z.unknown()).catch({});

async function memberRecord(pb: TypedPocketBase, user_id: string) {
  return pb
    .collection("team_members")
    .getFirstListItem(pb.filter("user = {:user}", { user: user_id }))
    .catch(() => null);
}

async function roleRecord(pb: TypedPocketBase, name: string) {
  return pb
    .collection("roles")
    .getFirstListItem(pb.filter("name = {:name}", { name }))
    .catch(() => null);
}

export const staff: StaffBackend = {
  async getMembership(user_id) {
    const member = await memberRecord(await createAdminPocketBase(), user_id);
    if (!member) return null;
    return {
      is_admin: member.is_admin,
      is_active: member.is_active,
      roles: string_list_schema.parse(member.roles),
      locale: member.locale ?? "",
    };
  },

  // A store has a handful of roles, so reading them all is cheaper than filtering.
  async getRoles() {
    const pb = await createAdminPocketBase();
    const roles = await pb.collection("roles").getFullList({ fields: "name,permissions,is_read_only" });
    return roles.map((role) => ({
      name: role.name,
      permissions: unknown_list_schema.parse(role.permissions),
      is_read_only: role.is_read_only ?? false,
    }));
  },

  async setLocale(user_id, locale) {
    const pb = await createAdminPocketBase();
    const member = await memberRecord(pb, user_id);
    if (!member) throw new BackendError("not_found");
    await pb.collection("team_members").update(member.id, { locale });
  },

  async listMembers() {
    const pb = await createAdminPocketBase();
    const members = await pb.collection("team_members").getFullList<{
      user: string;
      roles: unknown;
      is_admin: boolean;
      is_active: boolean;
      locale: string;
      created_at: string;
      expand?: { user?: { email: string; name: string } };
    }>({ sort: "created_at", expand: "user" });
    return members.map((member) => ({
      user_id: member.user,
      email: member.expand?.user?.email ?? "",
      name: member.expand?.user?.name ?? "",
      roles: string_list_schema.parse(member.roles),
      is_admin: member.is_admin,
      is_active: member.is_active,
      locale: member.locale ?? "",
      created_at: member.created_at,
    }));
  },

  async addMember(user_id, fields) {
    const pb = await createAdminPocketBase();
    try {
      await pb.collection("team_members").create({ user: user_id, ...fields, is_active: true });
    } catch (error) {
      if (pocketBaseFieldCode(error, "user") === "validation_not_unique") throw new BackendError("member_exists");
      throw error;
    }
  },

  async updateMember(user_id, fields) {
    const pb = await createAdminPocketBase();
    const member = await memberRecord(pb, user_id);
    if (!member) throw new BackendError("not_found");
    await pb.collection("team_members").update(member.id, fields);
  },

  async listRoles() {
    const pb = await createAdminPocketBase();
    const [roles, members] = await Promise.all([
      pb.collection("roles").getFullList({ sort: "created_at" }),
      pb.collection("team_members").getFullList({ fields: "roles" }),
    ]);
    const assigned = members.flatMap((member) => string_list_schema.parse(member.roles));
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      permissions: unknown_list_schema.parse(role.permissions),
      is_system: role.is_system ?? false,
      is_read_only: role.is_read_only ?? false,
      member_count: assigned.filter((name) => name === role.name).length,
    }));
  },

  async createRole(fields) {
    const pb = await createAdminPocketBase();
    try {
      const record = await pb.collection("roles").create({ ...fields, is_system: false, is_read_only: false });
      return { id: record.id };
    } catch (error) {
      if (pocketBaseFieldCode(error, "name") === "validation_not_unique") throw new BackendError("role_name_taken");
      throw error;
    }
  },

  async updateRole(name, fields) {
    const pb = await createAdminPocketBase();
    const role = await roleRecord(pb, name);
    if (!role) throw new BackendError("not_found");
    await pb.collection("roles").update(role.id, fields);
  },

  async deleteRole(name) {
    const pb = await createAdminPocketBase();
    const role = await roleRecord(pb, name);
    if (!role) throw new BackendError("not_found");
    if (role.is_system) throw new BackendError("system_role");
    const members = await pb.collection("team_members").getFullList({ fields: "roles" });
    if (members.some((member) => string_list_schema.parse(member.roles).includes(name))) {
      throw new BackendError("role_in_use");
    }
    await pb.collection("roles").delete(role.id);
  },
};

function toFilters(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters_schema.parse(value)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export const saved_views: SavedViewsBackend = {
  async list(user_id, resource) {
    const pb = await createAdminPocketBase();
    const rows = await pb.collection("saved_views").getFullList({
      filter: pb.filter("user = {:user} && resource = {:resource}", { user: user_id, resource }),
      sort: "created_at",
      fields: "id,resource,name,filters",
    });
    return rows.map((row) => ({ id: row.id, resource: row.resource, name: row.name, filters: toFilters(row.filters) }));
  },

  async create(user_id, view) {
    const pb = await createAdminPocketBase();
    const record = await pb.collection("saved_views").create({ user: user_id, ...view });
    return { id: record.id, ...view };
  },

  async remove(user_id, id) {
    const pb = await createAdminPocketBase();
    const record = await pb
      .collection("saved_views")
      .getOne(id, { fields: "id,user" })
      .catch((error: unknown) => {
        if (pocketBaseStatus(error) === 404) return null;
        throw error;
      });
    // Another member's view is "not found" too: nobody deletes someone else's views.
    if (!record || record.user !== user_id) throw new BackendError("not_found");
    await pb.collection("saved_views").delete(id);
  },
};
