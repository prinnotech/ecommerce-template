// Shipping zones and taxes per country. Pure and shared (checkout, drafts, admin).
//
// SHIPPING_RATES are the rates for "everywhere else". Each SHIPPING_ZONES entry lists countries
// with their own rates and, optionally, their own tax rate. With SHIP_ONLY_TO_ZONES on, countries
// outside every zone get no rates (the checkout says it can't deliver there).

import type { ShippingRate, ShippingZone, SiteSettings } from "@repo/core/lib/site-settings";

type ShippingSettings = Pick<SiteSettings, "SHIPPING_RATES" | "SHIPPING_ZONES" | "SHIP_ONLY_TO_ZONES" | "TAX_RATE">;

export function zoneForCountry(settings: ShippingSettings, country: string): ShippingZone | null {
  if (!country) return null;
  return settings.SHIPPING_ZONES.find((zone) => zone.countries.includes(country as never)) ?? null;
}

// The rates a customer in `country` can choose ("" = not known yet: the default rates).
export function shippingRatesFor(settings: ShippingSettings, country: string): ShippingRate[] {
  const zone = zoneForCountry(settings, country);
  if (zone) return zone.rates;
  if (country && settings.SHIP_ONLY_TO_ZONES) return [];
  return settings.SHIPPING_RATES;
}

export function taxRateFor(settings: ShippingSettings, country: string): number {
  return zoneForCountry(settings, country)?.tax_rate ?? settings.TAX_RATE;
}

// Every rate, from every zone (rate ids are unique), e.g. to show a stored method's name.
export function allShippingRates(settings: ShippingSettings): ShippingRate[] {
  return [...settings.SHIPPING_RATES, ...settings.SHIPPING_ZONES.flatMap((zone) => zone.rates)];
}
