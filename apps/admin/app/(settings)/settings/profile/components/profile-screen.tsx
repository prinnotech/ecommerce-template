"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "@repo/core/components/form-field";
import { PasswordInput } from "@repo/core/components/password-input";
import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { useChangePassword, useMyProfile, useUpdateProfile } from "@repo/core/hooks/use-account";
import { useSetAdminLocale } from "@repo/core/hooks/use-admin";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { change_password_schema } from "@repo/core/lib/schemas/account";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";
import type { Locale } from "@repo/core/i18nConfig";
import { Button } from "@repo/ui/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type ProfileScreenProps = {
  lang: Locale;
  language_options: { value: Locale; label: string }[];
  dictionary: AdminDictionary["profile"];
  password_input: AdminDictionary["auth"]["password_input"];
  common: AdminDictionary["common"];
  errors: AdminDictionary["errors"];
  validation: AdminDictionary["validation"];
};

export function ProfileScreen({
  lang,
  language_options,
  dictionary,
  password_input,
  common,
  errors,
  validation,
}: ProfileScreenProps) {
  const router = useRouter();
  const profile = useMyProfile();
  const update_profile = useUpdateProfile();
  const change_password = useChangePassword();
  const set_locale = useSetAdminLocale();
  // null = never edited; falls back to the stored name so the field doesn't fight the query.
  const [name, setName] = useState<string | null>(null);
  const [password_errors, setPasswordErrors] = useState<FieldErrors>({});

  const display_name = name ?? profile.data?.name ?? "";
  const can_save_name = name !== null && name.trim().length > 0 && name.trim() !== profile.data?.name;

  function saveName() {
    if (!profile.data) return;
    update_profile.mutate(
      { name: display_name.trim(), phone: profile.data.phone },
      {
        onSuccess: () => {
          setName(null);
          toast.success(dictionary.saved);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function onLanguageChange(value: string) {
    set_locale.mutate(
      { locale: value as Locale },
      {
        onSuccess: () => router.refresh(),
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  function onSubmitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = change_password_schema.safeParse({
      old_password: form_data.get("old_password"),
      password: form_data.get("password"),
      password_confirm: form_data.get("password_confirm"),
    });
    if (!parsed.success) {
      setPasswordErrors(fieldErrors(parsed.error));
      return;
    }
    setPasswordErrors({});
    change_password.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(dictionary.password_changed);
        event.currentTarget.reset();
      },
      onError: (error) => toast.error(errorText(errors, error)),
    });
  }

  const passwordError = (field: string) => (password_errors[field] ? validation[password_errors[field]] : undefined);

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="default">
      {profile.isPending ? (
        <Skeleton className="h-40" />
      ) : profile.isError ? (
        <p className="text-destructive text-sm">{errorText(errors, profile.error)}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <SectionCard title={dictionary.details_title}>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="profile-name">{dictionary.name}</FieldLabel>
                <Input id="profile-name" value={display_name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-email">{dictionary.email}</FieldLabel>
                <Input id="profile-email" value={profile.data?.email ?? ""} disabled />
              </Field>
              <div className="flex justify-end">
                <Button type="button" onClick={saveName} disabled={!can_save_name || update_profile.isPending}>
                  {update_profile.isPending && <Spinner aria-label={common.loading} />}
                  {dictionary.save}
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title={dictionary.language}>
            <NativeSelect
              aria-label={dictionary.language}
              value={lang}
              disabled={set_locale.isPending}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="max-w-64"
            >
              {language_options.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SectionCard>

          <SectionCard title={dictionary.password_title}>
            <form onSubmit={onSubmitPassword} noValidate className="flex flex-col gap-4">
              <FieldGroup>
                <FormField
                  id="field-old_password"
                  label={dictionary.current_password}
                  error={passwordError("old_password")}
                >
                  {(control) => (
                    <PasswordInput
                      name="old_password"
                      autoComplete="current-password"
                      required
                      show_label={password_input.show}
                      hide_label={password_input.hide}
                      {...control}
                    />
                  )}
                </FormField>
                <FormField
                  id="field-password"
                  label={dictionary.new_password}
                  description={dictionary.password_hint}
                  error={passwordError("password")}
                >
                  {(control) => (
                    <PasswordInput
                      name="password"
                      autoComplete="new-password"
                      required
                      show_label={password_input.show}
                      hide_label={password_input.hide}
                      {...control}
                    />
                  )}
                </FormField>
                <FormField
                  id="field-password_confirm"
                  label={dictionary.confirm_password}
                  error={passwordError("password_confirm")}
                >
                  {(control) => (
                    <PasswordInput
                      name="password_confirm"
                      autoComplete="new-password"
                      required
                      show_label={password_input.show}
                      hide_label={password_input.hide}
                      {...control}
                    />
                  )}
                </FormField>
              </FieldGroup>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={change_password.isPending}>
                  {change_password.isPending && <Spinner aria-label={common.loading} />}
                  {dictionary.change_password}
                </Button>
              </div>
            </form>
          </SectionCard>
        </div>
      )}
    </Page>
  );
}
