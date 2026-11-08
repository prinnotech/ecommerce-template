import "server-only";

import { BackendError } from "@repo/core/backend/errors";
import type { SavedViewsBackend, StaffBackend } from "@repo/core/backend/types";
import type { SqlContext } from "@repo/backend-sql/context";
import { uniqueViolation } from "@repo/backend-sql/errors";
import { bool, iso, json, newId, nowIso } from "@repo/backend-sql/values";

function roleNames(value: unknown): string[] {
  return json<unknown[]>(value, []).filter((role): role is string => typeof role === "string");
}

export function createStaff({ db }: SqlContext): StaffBackend {
  return {
    async getMembership(user_id) {
      const member = await db
        .selectFrom("team_members")
        .select(["roles", "is_admin", "is_active", "locale"])
        .where("user_id", "=", user_id)
        .executeTakeFirst();
      if (!member) return null;
      return {
        is_admin: bool(member.is_admin),
        is_active: bool(member.is_active),
        roles: roleNames(member.roles),
        locale: member.locale,
      };
    },

    async getRoles() {
      const roles = await db.selectFrom("roles").select(["name", "permissions", "is_read_only"]).execute();
      return roles.map((role) => ({
        name: role.name,
        permissions: json<unknown[]>(role.permissions, []),
        is_read_only: bool(role.is_read_only),
      }));
    },

    async setLocale(user_id, locale) {
      const result = await db
        .updateTable("team_members")
        .set({ locale, updated_at: nowIso() })
        .where("user_id", "=", user_id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async listMembers() {
      const rows = await db
        .selectFrom("team_members")
        .innerJoin("users", "users.id", "team_members.user_id")
        .select([
          "team_members.user_id",
          "users.email",
          "users.name",
          "team_members.roles",
          "team_members.is_admin",
          "team_members.is_active",
          "team_members.locale",
          "team_members.created_at",
        ])
        .orderBy("team_members.created_at", "asc")
        .execute();
      return rows.map((row) => ({
        user_id: row.user_id,
        email: row.email,
        name: row.name,
        roles: roleNames(row.roles),
        is_admin: bool(row.is_admin),
        is_active: bool(row.is_active),
        locale: row.locale,
        created_at: iso(row.created_at),
      }));
    },

    async addMember(user_id, fields) {
      try {
        await db
          .insertInto("team_members")
          .values({ id: newId(), user_id, roles: fields.roles, is_admin: fields.is_admin, is_active: true })
          .execute();
      } catch (error) {
        if (uniqueViolation(error)) throw new BackendError("member_exists");
        throw error;
      }
    },

    async updateMember(user_id, fields) {
      const result = await db
        .updateTable("team_members")
        .set({ ...fields, updated_at: nowIso() })
        .where("user_id", "=", user_id)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    // A store has a handful of roles and members: counting in memory beats JSON queries per dialect.
    async listRoles() {
      const [roles, members] = await Promise.all([
        db
          .selectFrom("roles")
          .select(["id", "name", "description", "permissions", "is_system", "is_read_only"])
          .orderBy("created_at", "asc")
          .execute(),
        db.selectFrom("team_members").select(["roles"]).execute(),
      ]);
      const assigned = members.flatMap((member) => roleNames(member.roles));
      return roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: json<unknown[]>(role.permissions, []),
        is_system: bool(role.is_system),
        is_read_only: bool(role.is_read_only),
        member_count: assigned.filter((name) => name === role.name).length,
      }));
    },

    async createRole(fields) {
      const id = newId();
      try {
        await db
          .insertInto("roles")
          .values({ id, ...fields, is_system: false, is_read_only: false })
          .execute();
      } catch (error) {
        if (uniqueViolation(error)) throw new BackendError("role_name_taken");
        throw error;
      }
      return { id };
    },

    async updateRole(name, fields) {
      const result = await db
        .updateTable("roles")
        .set({ ...fields, updated_at: nowIso() })
        .where("name", "=", name)
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) === 0) throw new BackendError("not_found");
    },

    async deleteRole(name) {
      const role = await db.selectFrom("roles").select(["id", "is_system"]).where("name", "=", name).executeTakeFirst();
      if (!role) throw new BackendError("not_found");
      if (bool(role.is_system)) throw new BackendError("system_role");
      const members = await db.selectFrom("team_members").select(["roles"]).execute();
      if (members.some((member) => roleNames(member.roles).includes(name))) throw new BackendError("role_in_use");
      await db.deleteFrom("roles").where("id", "=", role.id).execute();
    },
  };
}

function toFilters(value: unknown): Record<string, string> {
  const record = json<Record<string, unknown>>(value, {});
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function createSavedViews({ db }: SqlContext): SavedViewsBackend {
  return {
    async list(user_id, resource) {
      const rows = await db
        .selectFrom("saved_views")
        .select(["id", "resource", "name", "filters"])
        .where("user_id", "=", user_id)
        .where("resource", "=", resource)
        .orderBy("created_at", "asc")
        .execute();
      return rows.map((row) => ({ ...row, filters: toFilters(row.filters) }));
    },

    async create(user_id, view) {
      const id = newId();
      await db
        .insertInto("saved_views")
        .values({ id, user_id, ...view })
        .execute();
      return { id, ...view };
    },

    async remove(user_id, id) {
      const result = await db
        .deleteFrom("saved_views")
        .where("id", "=", id)
        .where("user_id", "=", user_id)
        .executeTakeFirst();
      if (Number(result.numDeletedRows) === 0) throw new BackendError("not_found");
    },
  };
}
