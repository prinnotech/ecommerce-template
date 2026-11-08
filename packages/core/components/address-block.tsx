import { countryName } from "@repo/core/lib/locale/countries";
import type { AddressFields } from "@repo/core/lib/schemas/account";

// Postal address as stacked lines. Used by the account pages, order pages and (later) checkout.
type AddressLike = Omit<AddressFields, "country"> & { country: string };

export function AddressBlock({ address, lang }: { address: AddressLike; lang: string }) {
  const city_line = [address.postal_code, address.city, address.region].filter(Boolean).join(" ");

  return (
    <address className="text-sm leading-relaxed not-italic">
      <span className="font-medium">{address.full_name}</span>
      <br />
      {address.line1}
      {address.line2 && (
        <>
          <br />
          {address.line2}
        </>
      )}
      <br />
      {city_line}
      <br />
      {countryName(address.country, lang)}
      {address.phone && (
        <>
          <br />
          <span className="text-muted-foreground">{address.phone}</span>
        </>
      )}
    </address>
  );
}
