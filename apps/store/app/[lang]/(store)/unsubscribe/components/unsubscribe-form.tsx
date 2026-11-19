"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";

import { unsubscribeFromMarketing } from "@repo/core/actions/unsubscribe";
import { errorText, unwrap } from "@repo/core/lib/action-result";
import type { Dictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";
import { Spinner } from "@repo/ui/components/ui/spinner";

type UnsubscribeFormProps = {
  lang: string;
  user_id: string;
  token: string;
  dictionary: Dictionary["unsubscribe"];
  errors: Dictionary["errors"];
};

export function UnsubscribeForm({ lang, user_id, token, dictionary, errors }: UnsubscribeFormProps) {
  const unsubscribe = useMutation({
    mutationFn: async () => unwrap(await unsubscribeFromMarketing({ user_id, token })),
  });

  if (!user_id || !token) return <p className="text-muted-foreground">{errors.invalid_token}</p>;

  if (unsubscribe.isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p role="status" className="text-muted-foreground">
          {dictionary.done}
        </p>
        <Button asChild variant="outline">
          <Link href={`/${lang}`}>{dictionary.back}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-muted-foreground">{dictionary.body}</p>
      <Button type="button" disabled={unsubscribe.isPending} onClick={() => unsubscribe.mutate()}>
        {unsubscribe.isPending && <Spinner aria-label={dictionary.confirm} />}
        {dictionary.confirm}
      </Button>
      {unsubscribe.isError && (
        <p role="alert" className="text-destructive text-sm">
          {errorText(errors, unsubscribe.error)}
        </p>
      )}
      <p className="text-muted-foreground text-xs">{dictionary.account_hint}</p>
    </div>
  );
}
