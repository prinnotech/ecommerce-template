"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { saveCookieConsent, useCookieConsent } from "@repo/core/hooks/use-cookie-consent";
import type { Consent } from "@repo/core/lib/tracking/consent";
import { useConsentDialog } from "@repo/core/store/consent-dialog-store";
import type { Dictionary } from "@repo/core/lib/i18n";
import { Button } from "@repo/ui/components/ui/button";
import { Switch } from "@repo/ui/components/ui/switch";

type CookieConsentProps = { lang: string; dictionary: Dictionary["cookie_consent"] };

export function CookieConsent({ lang, dictionary }: CookieConsentProps) {
  const consent = useCookieConsent();
  const pathname = usePathname();
  const is_reopened = useConsentDialog((state) => state.is_open);
  // undefined = still hydrating; the theme editor's preview never shows the banner.
  const is_visible =
    consent !== undefined && (consent === null || is_reopened) && !pathname.includes("/theme-preview/");
  if (!is_visible) return null;
  // Mounted only while shown, so reopening starts from the saved choice.
  return <ConsentPanel lang={lang} dictionary={dictionary} consent={consent} />;
}

function ConsentPanel({ lang, dictionary, consent }: CookieConsentProps & { consent: Consent | null }) {
  const close = useConsentDialog((state) => state.close);
  const [is_customizing, setIsCustomizing] = useState(consent !== null);
  const [analytics, setAnalytics] = useState(consent?.analytics ?? false);
  const [marketing, setMarketing] = useState(consent?.marketing ?? false);

  function choose(choice: { analytics: boolean; marketing: boolean }) {
    saveCookieConsent(choice);
    setIsCustomizing(false);
    close();
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="bg-background fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-col gap-4 rounded-xl border p-5 shadow-lg sm:inset-x-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="cookie-consent-title" className="font-medium">
          {dictionary.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {dictionary.body}{" "}
          <Link href={`/${lang}/privacy`} className="underline underline-offset-4">
            {dictionary.privacy_link}
          </Link>
        </p>
      </div>

      {is_customizing && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <ConsentRow title={dictionary.necessary} description={dictionary.necessary_hint} checked disabled />
          <ConsentRow
            title={dictionary.analytics}
            description={dictionary.analytics_hint}
            checked={analytics}
            onCheckedChange={setAnalytics}
          />
          <ConsentRow
            title={dictionary.marketing}
            description={dictionary.marketing_hint}
            checked={marketing}
            onCheckedChange={setMarketing}
          />
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {is_customizing ? (
          <Button type="button" variant="outline" onClick={() => choose({ analytics, marketing })}>
            {dictionary.save}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setIsCustomizing(true)}>
            {dictionary.customize}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => choose({ analytics: false, marketing: false })}>
          {dictionary.reject}
        </Button>
        <Button type="button" onClick={() => choose({ analytics: true, marketing: true })}>
          {dictionary.accept}
        </Button>
      </div>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={title} />
    </label>
  );
}

export function CookieSettingsButton({ label }: { label: string }) {
  const open = useConsentDialog((state) => state.open);
  return (
    <button type="button" onClick={open} className="hover:text-foreground underline-offset-4 hover:underline">
      {label}
    </button>
  );
}
