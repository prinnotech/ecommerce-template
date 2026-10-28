"use client";

import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import en from "@/dictionaries/en.json";
import es from "@/dictionaries/es.json";
import it from "@/dictionaries/it.json";

// Error boundaries can't receive props, so they read the dictionary directly.
const DICTIONARIES = { en, es, it };

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useParams<{ lang: string }>();
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
