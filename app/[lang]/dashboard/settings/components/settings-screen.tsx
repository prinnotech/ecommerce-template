"use client";

import { SettingRow } from "./setting-row";
import type { SettingEntry } from "@/app/actions/site-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllSettings } from "@/hooks/use-site-settings";
import { errorText } from "@/lib/action-result";
import type { Dictionary } from "@/lib/i18n";
import type { SettingCategory } from "@/lib/site-settings";

export type SelectOption = { value: string; label: string };

export type SettingOptions = {
  currencies: SelectOption[];
  timezones: SelectOption[];
  locales: SelectOption[];
  countries: SelectOption[];
};

const CATEGORY_ORDER: SettingCategory[] = [
  "general",
  "storefront",
  "contact",
  "localization",
  "shipping",
  "payments",
  "content",
];

type SettingsScreenProps = {
  lang: string;
  can_edit: boolean;
  options: SettingOptions;
  dictionary: Dictionary["settings"];
  common: Dictionary["common"];
  errors: Dictionary["errors"];
};

export function SettingsScreen({ lang, can_edit, options, dictionary, common, errors }: SettingsScreenProps) {
  const settings = useAllSettings();

  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.title}</h1>
      <p className="text-muted-foreground text-sm">{dictionary.subtitle}</p>
      {!can_edit && <p className="text-muted-foreground text-sm">{dictionary.read_only}</p>}
    </div>
  );

  if (settings.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (settings.isError) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-destructive text-sm">{errorText(errors, settings.error)}</p>
      </div>
    );
  }

  const by_category = new Map<SettingCategory, SettingEntry[]>();
  for (const entry of settings.data) {
    by_category.set(entry.category, [...(by_category.get(entry.category) ?? []), entry]);
  }
  const currency = settings.data.find((entry) => entry.key === "CURRENCY")?.value;

  return (
    <div className="flex flex-col gap-6">
      {header}
      <Tabs defaultValue={CATEGORY_ORDER[0]} className="gap-4">
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList>
            {CATEGORY_ORDER.map((category) => (
              <TabsTrigger key={category} value={category}>
                {dictionary.categories[category]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {CATEGORY_ORDER.map((category) => (
          <TabsContent key={category} value={category}>
            <Card className="py-0">
              <CardContent className="divide-y px-0">
                {(by_category.get(category) ?? []).map((entry) => (
                  <SettingRow
                    // Remount after a save or reset so the draft starts from the stored value.
                    key={`${entry.key}:${entry.updated_at ?? "default"}:${entry.is_default}`}
                    lang={lang}
                    entry={entry}
                    can_edit={can_edit}
                    options={options}
                    currency={typeof currency === "string" ? currency : "EUR"}
                    dictionary={dictionary}
                    common={common}
                    errors={errors}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
