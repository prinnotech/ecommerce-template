"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import type { StaffMember } from "@repo/core/actions/team";
import { useInviteMember, useRoles, useTeamMembers, useUpdateMember } from "@repo/core/hooks/use-team";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Switch } from "@repo/ui/components/ui/switch";

type StaffScreenProps = {
  can_invite: boolean;
  can_edit: boolean;
  can_deactivate: boolean;
  is_admin: boolean;
  current_user_id: string;
  dictionary: AdminDictionary["staff"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
};

type Draft = { email: string; name: string; roles: string[]; is_admin: boolean };

export function StaffScreen({
  can_invite,
  can_edit,
  can_deactivate,
  is_admin,
  current_user_id,
  dictionary,
  common,
  errors,
}: StaffScreenProps) {
  const members = useTeamMembers();
  const roles = useRoles();
  const invite_member = useInviteMember();
  const update_member = useUpdateMember();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const is_saving = invite_member.isPending || update_member.isPending;

  function openInvite() {
    setEditing(null);
    setDraft({ email: "", name: "", roles: [], is_admin: false });
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setDraft({ email: member.email, name: member.name, roles: member.roles, is_admin: member.is_admin });
  }

  function toggleRole(name: string, checked: boolean) {
    setDraft((current) =>
      current
        ? { ...current, roles: checked ? [...current.roles, name] : current.roles.filter((role) => role !== name) }
        : current,
    );
  }

  function save() {
    if (!draft) return;
    const callbacks = {
      onSuccess: () => {
        setDraft(null);
        setEditing(null);
        toast.success(editing ? dictionary.saved : dictionary.invite_sent);
      },
      onError: (error: Error) => toast.error(errorText(errors, error)),
    };
    if (editing) {
      update_member.mutate({ user_id: editing.user_id, roles: draft.roles, is_admin: draft.is_admin }, callbacks);
    } else {
      invite_member.mutate(
        { email: draft.email.trim(), name: draft.name.trim(), roles: draft.roles, is_admin: draft.is_admin },
        callbacks,
      );
    }
  }

  function toggleActive(member: StaffMember, is_active: boolean) {
    update_member.mutate(
      { user_id: member.user_id, is_active },
      { onError: (error) => toast.error(errorText(errors, error)) },
    );
  }

  return (
    <Page
      title={dictionary.title}
      subtitle={dictionary.subtitle}
      width="default"
      primary_action={
        can_invite ? (
          <Button onClick={openInvite}>
            <PlusIcon />
            {dictionary.invite}
          </Button>
        ) : undefined
      }
    >
      {members.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : members.isError ? (
        <p className="text-destructive text-sm">{errorText(errors, members.error)}</p>
      ) : members.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{dictionary.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {members.data.map((member) => (
            <SectionCard
              key={member.user_id}
              title={
                <span className="flex items-center gap-2">
                  {member.name || member.email}
                  {member.is_admin && <Badge>{dictionary.admin}</Badge>}
                </span>
              }
              description={
                <span className="flex flex-col gap-1">
                  <span>{member.email}</span>
                  <span className="flex flex-wrap gap-1">
                    {member.roles.map((role) => (
                      <Badge key={role} variant="outline">
                        {role}
                      </Badge>
                    ))}
                  </span>
                </span>
              }
              action={
                <div className="flex items-center gap-2">
                  <StatusBadge tone={member.is_active ? "success" : "neutral"}>
                    {member.is_active ? dictionary.active : dictionary.deactivated}
                  </StatusBadge>
                  {can_deactivate && member.user_id !== current_user_id && (
                    <Switch
                      checked={member.is_active}
                      aria-label={member.is_active ? dictionary.deactivate : dictionary.reactivate}
                      onCheckedChange={(checked) => toggleActive(member, checked)}
                      disabled={update_member.isPending}
                    />
                  )}
                  {can_edit && (
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(member)}>
                      {dictionary.roles}
                    </Button>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? dictionary.edit_title : dictionary.invite_title}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="flex flex-col gap-4">
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor="member-email">{dictionary.email}</FieldLabel>
                  <Input
                    id="member-email"
                    type="email"
                    value={draft.email}
                    disabled={editing !== null}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, email: event.target.value } : current))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="member-name">{dictionary.name}</FieldLabel>
                  <Input
                    id="member-name"
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, name: event.target.value } : current))
                    }
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Switch
                    id="member-admin"
                    checked={draft.is_admin}
                    disabled={!is_admin}
                    onCheckedChange={(checked) =>
                      setDraft((current) => (current ? { ...current, is_admin: checked } : current))
                    }
                  />
                  <FieldLabel htmlFor="member-admin" className="font-normal">
                    {dictionary.admin}
                  </FieldLabel>
                </div>
              </FieldGroup>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{dictionary.roles}</span>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(roles.data ?? []).map((role) => (
                    <label key={role.name} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draft.roles.includes(role.name)}
                        onCheckedChange={(checked) => toggleRole(role.name, checked === true)}
                      />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={is_saving}>
              {common.cancel}
            </Button>
            <Button type="button" onClick={save} disabled={is_saving || (!editing && !draft?.email.trim())}>
              {editing ? dictionary.save : dictionary.invite}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
