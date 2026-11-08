"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import { StatusBadge } from "@repo/admin-ui/components/status-badge";
import { getTracking, saveTracking, type SaveTrackingInput, type TrackingOverview } from "@repo/core/actions/tracking";
import { FormField } from "@repo/core/components/form-field";
import { errorText, unwrap } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { query_keys } from "@repo/core/lib/query-keys";
import { tracking_schema, type TrackingSettings } from "@repo/core/lib/site-settings";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type TrackingScreenProps = {
  can_edit: boolean;
  dictionary: AdminDictionary["tracking"];
  errors: AdminDictionary["errors"];
};

type TrackingField = keyof TrackingSettings;

export function TrackingScreen(props: TrackingScreenProps) {
  const overview = useQuery({ queryKey: query_keys.tracking, queryFn: async () => unwrap(await getTracking()) });
  if (overview.isPending) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <Skeleton className="h-80 rounded-xl" />
      </Page>
    );
  }
  if (overview.isError) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <p className="text-destructive text-sm">{errorText(props.errors, overview.error)}</p>
      </Page>
    );
  }
  return <TrackingForm key={JSON.stringify(overview.data)} {...props} overview={overview.data} />;
}

function TrackingForm({
  can_edit,
  dictionary,
  errors,
  overview,
}: TrackingScreenProps & { overview: TrackingOverview }) {
  const query_client = useQueryClient();
  const save = useMutation({
    mutationFn: async (input: SaveTrackingInput) => unwrap(await saveTracking(input)),
    onSuccess: () => query_client.invalidateQueries({ queryKey: query_keys.tracking }),
  });
  const [tracking, setTracking] = useState<TrackingSettings>(overview.tracking);
  const [token, setToken] = useState("");
  const parsed = tracking_schema.safeParse(tracking);
  const invalid = (field: TrackingField) =>
    !parsed.success && parsed.error.issues.some((issue) => issue.path[0] === field) ? dictionary.invalid : undefined;
  const token_hint = overview.capi_token.is_from_env
    ? dictionary.capi_from_env
    : overview.capi_token.is_set
      ? dictionary.capi_saved
      : dictionary.capi_not_set;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      toast.error(errors.invalid_input);
      return;
    }
    save.mutate(
      { tracking: parsed.data, capi_token: token.trim() || undefined },
      {
        onSuccess: () => {
          setToken("");
          toast.success(dictionary.saved);
        },
        onError: (error) => toast.error(errorText(errors, error)),
      },
    );
  }

  return (
    <Page title={dictionary.title} subtitle={dictionary.subtitle} width="narrow">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <SectionCard title={dictionary.google_title} description={dictionary.google_hint}>
          {(["gtm_id", "google_tag_id", "google_ads_conversion"] as const).map((field) => (
            <FormField
              key={field}
              id={`tracking-${field}`}
              label={dictionary.fields[field]}
              description={dictionary.hints[field]}
              error={invalid(field)}
            >
              {(control) => (
                <Input
                  {...control}
                  value={tracking[field]}
                  disabled={!can_edit}
                  placeholder={dictionary.placeholders[field]}
                  onChange={(event) => setTracking((current) => ({ ...current, [field]: event.target.value.trim() }))}
                />
              )}
            </FormField>
          ))}
        </SectionCard>

        <SectionCard
          title={dictionary.meta_title}
          description={dictionary.meta_hint}
          action={
            tracking.meta_pixel_id && (overview.capi_token.is_set || token) ? (
              <StatusBadge tone="success">{dictionary.capi_on}</StatusBadge>
            ) : undefined
          }
        >
          <FormField
            id="tracking-meta_pixel_id"
            label={dictionary.fields.meta_pixel_id}
            description={dictionary.hints.meta_pixel_id}
            error={invalid("meta_pixel_id")}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={tracking.meta_pixel_id}
                disabled={!can_edit}
                placeholder={dictionary.placeholders.meta_pixel_id}
                onChange={(event) =>
                  setTracking((current) => ({ ...current, meta_pixel_id: event.target.value.trim() }))
                }
              />
            )}
          </FormField>
          <FormField id="tracking-capi-token" label={dictionary.capi_token} description={token_hint}>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="off"
                value={token}
                placeholder={overview.capi_token.is_set ? "••••••••" : ""}
                disabled={!can_edit || !overview.can_store_secrets}
                onChange={(event) => setToken(event.target.value)}
              />
            )}
          </FormField>
          {!overview.can_store_secrets && (
            <p className="bg-warning text-warning-foreground rounded-md px-3 py-2 text-sm">
              {dictionary.encryption_missing}
            </p>
          )}
        </SectionCard>

        <p className="text-muted-foreground text-sm">{dictionary.consent_note}</p>

        {can_edit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending || !parsed.success}>
              {save.isPending && <Spinner />}
              {dictionary.save}
            </Button>
          </div>
        )}
      </form>
    </Page>
  );
}
