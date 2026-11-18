"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SectionCard } from "@repo/admin-ui/components/detail-layout";
import { Page } from "@repo/admin-ui/components/page";
import type { AiOverview } from "@repo/core/actions/languages";
import { FormField } from "@repo/core/components/form-field";
import { useAiSettings, useSaveAiSettings, useTestAi } from "@repo/core/hooks/use-languages";
import { errorText } from "@repo/core/lib/action-result";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import { AI_PROVIDERS, DEFAULT_AI_MODEL, type AiProvider } from "@repo/core/lib/schemas/ai";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Spinner } from "@repo/ui/components/ui/spinner";

type AiScreenProps = {
  can_edit: boolean;
  dictionary: AdminDictionary["ai_settings"];
  errors: AdminDictionary["errors"];
};

export function AiScreen(props: AiScreenProps) {
  const overview = useAiSettings();
  if (overview.isPending) {
    return (
      <Page title={props.dictionary.title} width="narrow">
        <Skeleton className="h-72 rounded-xl" />
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
  return <AiForm key={JSON.stringify(overview.data)} {...props} overview={overview.data} />;
}

function AiForm({ can_edit, dictionary, errors, overview }: AiScreenProps & { overview: AiOverview }) {
  const save = useSaveAiSettings();
  const test = useTestAi();
  const [provider, setProvider] = useState<AiProvider>(overview.provider);
  const [model, setModel] = useState(overview.model);
  const [api_key, setApiKey] = useState("");
  const key = overview.keys[provider];
  const default_model = DEFAULT_AI_MODEL[provider] ?? "";
  const key_hint = key.is_from_env
    ? dictionary.key_from_env
    : key.is_set
      ? dictionary.key_saved
      : dictionary.key_not_set;
  const onError = (error: unknown) => toast.error(errorText(errors, error));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate(
      { provider, model: model.trim(), api_key: api_key.trim() || undefined },
      {
        onSuccess: () => {
          setApiKey("");
          toast.success(dictionary.saved);
        },
        onError,
      },
    );
  }

  function onRemoveKey() {
    save.mutate({ provider, model: model.trim(), clear_key: true }, { onError });
  }

  function onTest() {
    test.mutate(undefined, {
      onSuccess: (result) => toast.success(dictionary.test_ok.replace("{text}", result.text)),
      onError,
    });
  }

  return (
    <Page title={dictionary.title} subtitle={dictionary.description} width="narrow">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <SectionCard>
          <FormField id="ai-provider" label={dictionary.provider}>
            {(control) => (
              <NativeSelect
                {...control}
                value={provider}
                disabled={!can_edit}
                className="w-full"
                onChange={(event) => {
                  const next = AI_PROVIDERS.find((item) => item === event.target.value);
                  if (next) setProvider(next);
                }}
              >
                {AI_PROVIDERS.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {dictionary.providers[item]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id="ai-model"
            label={dictionary.model}
            description={
              default_model
                ? dictionary.model_hint_default.replace("{model}", default_model)
                : dictionary.model_hint_required
            }
          >
            {(control) => (
              <Input
                {...control}
                value={model}
                placeholder={default_model}
                disabled={!can_edit}
                autoComplete="off"
                onChange={(event) => setModel(event.target.value)}
              />
            )}
          </FormField>
          <FormField id="ai-key" label={dictionary.api_key} description={key_hint}>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="off"
                value={api_key}
                placeholder={key.is_set ? "••••••••" : ""}
                disabled={!can_edit || !overview.can_store_secrets || key.is_from_env}
                onChange={(event) => setApiKey(event.target.value)}
              />
            )}
          </FormField>
          {!overview.can_store_secrets && (
            <p className="bg-warning text-warning-foreground rounded-md px-3 py-2 text-sm">{dictionary.secrets_off}</p>
          )}
        </SectionCard>

        {can_edit && (
          <div className="flex flex-wrap justify-end gap-2">
            {key.is_set && !key.is_from_env && (
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={onRemoveKey}>
                {dictionary.remove_key}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={test.isPending || !key.is_set || provider !== overview.provider}
              onClick={onTest}
            >
              {test.isPending && <Spinner />}
              {dictionary.test}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              {dictionary.save}
            </Button>
          </div>
        )}
      </form>
    </Page>
  );
}
