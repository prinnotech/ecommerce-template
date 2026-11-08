"use client";

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import type { SelectOption } from "../options";
import { ShippingRatesEditor } from "./shipping-rates-editor";
import type { AdminDictionary } from "@repo/core/lib/i18n";
import type { ShippingZone } from "@repo/core/lib/site-settings";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";

type ShippingZonesEditorProps = {
  value: unknown;
  onChange: (value: ShippingZone[]) => void;
  is_disabled: boolean;
  locales: SelectOption[];
  countries: SelectOption[];
  currency: string;
  dictionary: AdminDictionary["settings"]["shipping_zones"];
  rates_dictionary: AdminDictionary["settings"]["shipping_rates"];
};

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function toZones(value: unknown): ShippingZone[] {
  return Array.isArray(value) ? (value as ShippingZone[]) : [];
}

// Settings → Shipping: groups of countries, each with its own rates and tax rate.
export function ShippingZonesEditor({
  value,
  onChange,
  is_disabled,
  locales,
  countries,
  currency,
  dictionary,
  rates_dictionary,
}: ShippingZonesEditorProps) {
  const [zones, setZones] = useState<ShippingZone[]>(() => toZones(value));
  const [searches, setSearches] = useState<Record<string, string>>({});
  const country_label = new Map(countries.map((country) => [country.value, country.label]));

  function commit(next: ShippingZone[]) {
    setZones(next);
    onChange(next);
  }

  function updateZone(id: string, patch: Partial<ShippingZone>) {
    commit(zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)));
  }

  return (
    <div className="flex flex-col gap-4">
      {zones.length === 0 && <p className="text-muted-foreground text-sm">{dictionary.empty}</p>}
      {zones.map((zone, index) => {
        const taken = new Set(zones.filter((other) => other.id !== zone.id).flatMap((other) => other.countries));
        const search = (searches[zone.id] ?? "").trim().toLowerCase();
        const matches = search
          ? countries.filter(
              (country) => country.label.toLowerCase().includes(search) || country.value.toLowerCase() === search,
            )
          : [];
        return (
          <fieldset key={zone.id} className="flex flex-col gap-4 rounded-lg border p-4" disabled={is_disabled}>
            <div className="flex items-center justify-between gap-2">
              <legend className="font-medium">{dictionary.zone_legend.replace("{number}", String(index + 1))}</legend>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => commit(zones.filter((other) => other.id !== zone.id))}
              >
                <Trash2Icon />
                {dictionary.remove}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {locales.map((locale) => (
                <Field key={locale.value}>
                  <FieldLabel htmlFor={`${zone.id}-name-${locale.value}`}>
                    {dictionary.name} ({locale.value.toUpperCase()})
                  </FieldLabel>
                  <Input
                    id={`${zone.id}-name-${locale.value}`}
                    value={zone.name[locale.value as keyof ShippingZone["name"]] ?? ""}
                    onChange={(event) =>
                      updateZone(zone.id, { name: { ...zone.name, [locale.value]: event.target.value } })
                    }
                  />
                </Field>
              ))}
            </div>

            <Field>
              <FieldLabel htmlFor={`${zone.id}-countries`}>{dictionary.countries}</FieldLabel>
              {zone.countries.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {zone.countries.map((code) => (
                    <li key={code} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs">
                      {country_label.get(code) ?? code}
                      <button
                        type="button"
                        aria-label={dictionary.remove_country.replace("{name}", country_label.get(code) ?? code)}
                        onClick={() =>
                          updateZone(zone.id, { countries: zone.countries.filter((item) => item !== code) })
                        }
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Input
                id={`${zone.id}-countries`}
                type="search"
                placeholder={dictionary.search_countries}
                value={searches[zone.id] ?? ""}
                onChange={(event) => setSearches((current) => ({ ...current, [zone.id]: event.target.value }))}
              />
              {matches.length > 0 && (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                  {matches.slice(0, 40).map((country) => {
                    const is_taken = taken.has(country.value as ShippingZone["countries"][number]);
                    const is_on = zone.countries.includes(country.value as ShippingZone["countries"][number]);
                    return (
                      <li key={country.value}>
                        <label className="hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm">
                          <Checkbox
                            checked={is_on}
                            disabled={is_taken}
                            onCheckedChange={(checked) =>
                              updateZone(zone.id, {
                                countries:
                                  checked === true
                                    ? [...zone.countries, country.value as ShippingZone["countries"][number]]
                                    : zone.countries.filter((item) => item !== country.value),
                              })
                            }
                          />
                          {country.label}
                          {is_taken && (
                            <span className="text-muted-foreground text-xs">({dictionary.in_other_zone})</span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Field>

            <Field className="max-w-60">
              <FieldLabel htmlFor={`${zone.id}-tax`}>{dictionary.tax_rate}</FieldLabel>
              <Input
                id={`${zone.id}-tax`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={zone.tax_rate ?? ""}
                placeholder={dictionary.tax_default}
                onChange={(event) =>
                  updateZone(zone.id, { tax_rate: event.target.value === "" ? null : event.target.valueAsNumber })
                }
              />
              <FieldDescription>{dictionary.tax_hint}</FieldDescription>
            </Field>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{dictionary.rates}</p>
              <ShippingRatesEditor
                value={zone.rates}
                onChange={(rates) => updateZone(zone.id, { rates })}
                is_disabled={is_disabled}
                locales={locales}
                currency={currency}
                dictionary={rates_dictionary}
              />
            </div>
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={is_disabled}
        onClick={() =>
          commit([
            ...zones,
            {
              id: newId("zone"),
              name: {},
              countries: [],
              tax_rate: null,
              rates: [{ id: newId("rate"), name: {}, price: 0, min_days: 2, max_days: 5 }],
            },
          ])
        }
      >
        <PlusIcon />
        {dictionary.add}
      </Button>
    </div>
  );
}
