"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { TextField } from "@repo/core/components/form-field";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { FieldGroup } from "@repo/ui/components/ui/field";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { useMyProfile, useUpdateProfile } from "@repo/core/hooks/use-account";
import { errorText } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { profile_schema } from "@repo/core/lib/schemas/account";
import { fieldErrors, type FieldErrors } from "@repo/core/lib/schemas/validation";

type ProfileFormProps = {
  dictionary: Dictionary["account"]["profile"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
  validation: Dictionary["validation"];
};

export function ProfileForm({ dictionary, common, errors, validation }: ProfileFormProps) {
  const router = useRouter();
  const profile = useMyProfile();
  const update_profile = useUpdateProfile();
  const [field_errors, setFieldErrors] = useState<FieldErrors>({});
  const error = (field: string) => (field_errors[field] ? validation[field_errors[field]] : undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form_data = new FormData(event.currentTarget);
    const parsed = profile_schema.safeParse({
      name: String(form_data.get("name") ?? ""),
      phone: String(form_data.get("phone") ?? ""),
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    update_profile.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(dictionary.saved);
        // The greeting in the account layout shows the name.
        router.refresh();
      },
      onError: (mutation_error) => toast.error(errorText(errors, mutation_error)),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dictionary.details_title}</CardTitle>
      </CardHeader>
      {profile.isPending ? (
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </CardContent>
      ) : profile.isError ? (
        <CardContent>
          <p className="text-destructive text-sm">{errorText(errors, profile.error)}</p>
        </CardContent>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <CardContent>
            <FieldGroup>
              <TextField
                name="name"
                label={dictionary.name}
                autoComplete="name"
                defaultValue={profile.data.name}
                error={error("name")}
                required
              />
              <TextField
                name="email"
                type="email"
                label={dictionary.email}
                description={dictionary.email_hint}
                defaultValue={profile.data.email}
                readOnly
                disabled
              />
              <TextField
                name="phone"
                type="tel"
                label={dictionary.phone}
                optional_label={common.optional}
                autoComplete="tel"
                defaultValue={profile.data.phone}
                error={error("phone")}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={update_profile.isPending}>
              {update_profile.isPending && <Spinner aria-label={common.loading} />}
              {dictionary.save}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
