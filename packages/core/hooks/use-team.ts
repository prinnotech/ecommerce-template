"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { createRole, deleteRole, getRoles, updateRole } from "@repo/core/actions/roles";
import { getTeamMembers, inviteMember, updateMember } from "@repo/core/actions/team";
import { unwrap } from "@repo/core/lib/action-result";
import { query_keys } from "@repo/core/lib/query-keys";
import type { InviteMemberInput, RoleInput, RoleNameInput, UpdateMemberInput } from "@repo/core/lib/schemas/admin";

export function useTeamMembers() {
  return useQuery({ queryKey: query_keys.team_members, queryFn: async () => unwrap(await getTeamMembers()) });
}

export function useRoles() {
  return useQuery({ queryKey: query_keys.roles, queryFn: async () => unwrap(await getRoles()) });
}

// Access changes can change what the current staff member sees (sidebar, buttons): refresh the
// server-rendered layout too, not just the lists.
function useInvalidateTeam() {
  const query_client = useQueryClient();
  const router = useRouter();
  return () => {
    router.refresh();
    return Promise.all([
      query_client.invalidateQueries({ queryKey: query_keys.team_members }),
      query_client.invalidateQueries({ queryKey: query_keys.roles }),
    ]);
  };
}

export function useInviteMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async (input: InviteMemberInput) => unwrap(await inviteMember(input)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async (input: UpdateMemberInput) => unwrap(await updateMember(input)),
    onSuccess: () => invalidate(),
  });
}

export function useCreateRole() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async (input: RoleInput) => unwrap(await createRole(input)),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRole() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async (input: RoleInput) => unwrap(await updateRole(input)),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async (input: RoleNameInput) => unwrap(await deleteRole(input)),
    onSuccess: () => invalidate(),
  });
}
