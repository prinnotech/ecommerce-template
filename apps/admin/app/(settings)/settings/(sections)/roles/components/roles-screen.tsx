"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@repo/admin-ui/components/confirm-dialog";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import type { AdminRole } from "@repo/core/actions/roles";
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from "@repo/core/hooks/use-team";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { PERMISSION_GROUPS, SUPER_ADMIN, type RolePermission } from "@repo/core/lib/permissions";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";
import { Textarea } from "@repo/ui/components/ui/textarea";

type RolesScreenProps = {
  can_edit: boolean;
  is_admin: boolean;
  dictionary: AdminDictionary["roles"];
  permissions_dictionary: AdminDictionary["permissions"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

// Fall back to the key itself if a label is missing (the grid must always render).
function permissionLabel(dictionary: AdminDictionary["permissions"], group: string, action: string): string {
  const entry = (dictionary as Record<string, Record<string, string>>)[group];
  return entry?.[action] ?? `${group}.${action}`;
}

type Draft = { name: string; description: string; permissions: string[]; full_access: boolean };

function fromRole(role: AdminRole): Draft {
  return {
    name: role.name,
    description: role.description,
    permissions: role.permissions.filter((permission) => permission !== SUPER_ADMIN) as string[],
    full_access: role.permissions.includes(SUPER_ADMIN),
  };
}

export function RolesScreen({
  can_edit,
  is_admin,
  dictionary,
  permissions_dictionary,
  common,
  errors,
}: RolesScreenProps) {
  const roles = useRoles();
  const create_role = useCreateRole();
  const update_role = useUpdateRole();
  const delete_role = useDeleteRole();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing_name, setEditingName] = useState<string | null>(null);
  const [pending_delete, setPendingDelete] = useState<AdminRole | null>(null);
  const is_saving = create_role.isPending || update_role.isPending;

  function open(role: AdminRole | null) {
    setEditingName(role?.name ?? null);
    setDraft(role ? fromRole(role) : { name: "", description: "", permissions: [], full_access: false });
  }

  function toggle(permission: string, checked: boolean) {
    setDraft((current) =>
      current
        ? {
            ...current,
            permissions: checked
              ? [...current.permissions, permission]
              : current.permissions.filter((entry) => entry !== permission),
          }
        : current,
    );
  }

  function save() {
    if (!draft) return;
    const input = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      permissions: (draft.full_access ? [...draft.permissions, SUPER_ADMIN] : draft.permissions) as RolePermission[],
    };
    const callbacks = {
      onSuccess: () => {
        setDraft(null);
        setEditingName(null);
        toast.success(editing_name ? dictionary.saved : dictionary.created);
      },
      onError: (error: Error) => toast.error(errorText(errors, error)),
    };
    if (editing_name) update_role.mutate(input, callbacks);
    else create_role.mutate(input, callbacks);
  }

  function confirmDelete() {
    if (!pending_delete) return;
    delete_role.mutate(
      { name: pending_delete.name },
      {
        onSuccess: () => {
          setPendingDelete(null);
          toast.success(dictionary.deleted);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="default"
      primary_action={
        can_edit ? (
          <Button onClick={() => open(null)}>
            <PlusIcon />
            {dictionary.add}
          </Button>
        ) : undefined
      }
    >
      {roles.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : roles.isError ? (
        <p className="text-destructive text-sm">{errorText(errors, roles.error)}</p>
      ) : roles.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{dictionary.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {roles.data.map((role) => (
            <SectionCard
              key={role.name}
              title={
                <span className="flex items-center gap-2">
                  {role.name}
                  {role.is_system && <Badge variant="outline">{dictionary.system}</Badge>}
                </span>
              }
              description={role.description}
              action={
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs" title={dictionary.members}>
                    {role.member_count}
                  </span>
                  {can_edit && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={() => open(role)}>
                        {dictionary.permissions}
                      </Button>
                      {/* Built-in roles can't be deleted (the server refuses too), so don't offer it. */}
                      {!role.is_system && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setPendingDelete(role)}
                        >
                          {dictionary.delete}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              }
            >
              {null}
            </SectionCard>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(is_open) => !is_open && setDraft(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing_name ? dictionary.permissions : dictionary.add_title}</DialogTitle>
            <DialogDescription className="sr-only">{dictionary.permissions}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="flex flex-col gap-4">
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor="role-name">{dictionary.name}</FieldLabel>
                  <Input
                    id="role-name"
                    value={draft.name}
                    disabled={editing_name !== null}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, name: event.target.value } : current))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="role-description">{dictionary.description}</FieldLabel>
                  <Textarea
                    id="role-description"
                    rows={2}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, description: event.target.value } : current))
                    }
                  />
                </Field>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="role-full-access"
                      checked={draft.full_access}
                      disabled={!is_admin}
                      onCheckedChange={(full_access) =>
                        setDraft((current) => (current ? { ...current, full_access } : current))
                      }
                    />
                    <FieldLabel htmlFor="role-full-access" className="font-normal">
                      {dictionary.full_access}
                    </FieldLabel>
                  </div>
                  <span className="text-muted-foreground text-xs">{dictionary.full_access_hint}</span>
                </div>
              </FieldGroup>
              <div className="flex flex-col gap-4">
                {Object.entries(PERMISSION_GROUPS).map(([group, actions]) => (
                  <fieldset key={group} className="flex flex-col gap-2">
                    <legend className="text-sm font-medium">{group}</legend>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {actions.map((action) => {
                        const permission = `${group}.${action}`;
                        return (
                          <label key={permission} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={draft.permissions.includes(permission)}
                              onCheckedChange={(checked) => toggle(permission, checked === true)}
                            />
                            {permissionLabel(permissions_dictionary, group, action)}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={is_saving}>
              {common.cancel}
            </Button>
            <Button type="button" onClick={save} disabled={is_saving || !draft?.name.trim()}>
              {dictionary.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        is_open={pending_delete !== null}
        onOpenChange={(is_open) => !is_open && setPendingDelete(null)}
        title={dictionary.delete_title}
        body={dictionary.delete_body}
        confirm_label={dictionary.delete}
        cancel_label={common.cancel}
        onConfirm={confirmDelete}
        is_pending={delete_role.isPending}
        is_destructive
      />
    </Page>
  );
}
