"use client";

import { useSyncExternalStore } from "react";

import { Button } from "@repo/ui/components/ui/button";
import en from "@repo/core/dictionaries/en.json";
import es from "@repo/core/dictionaries/es.json";
import it from "@repo/core/dictionaries/it.json";

// Error boundaries can't receive props, so they read the dictionary directly. The admin has no
// language in its URL: the root layout puts it on <html lang>.
const DICTIONARIES = { en, es, it };

const subscribe = () => () => {};

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useSyncExternalStore(
    subscribe,
    () => document.documentElement.lang,
    () => "en",
  );
  const dictionary = DICTIONARIES[lang as keyof typeof DICTIONARIES] ?? en;

  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
      <p className="text-sm">{dictionary.errors.generic}</p>
      <Button variant="outline" onClick={reset}>
        {dictionary.common.try_again}
      </Button>
    </div>
  );
}
