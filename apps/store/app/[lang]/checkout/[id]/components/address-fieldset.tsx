"use client";

import { FloatingInput, FloatingSelect } from "./floating-field";
import type { Dictionary } from "@repo/core/lib/i18n";

export type AddressDraft = {
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
};

export const EMPTY_ADDRESS: AddressDraft = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
};

type AddressFieldsetProps = {
  // Used for ids and for matching errors like "shipping_address.city".
  prefix: "shipping_address" | "billing_address";
  value: AddressDraft;
  onChange: (value: AddressDraft) => void;
  errors: Record<string, string | undefined>;
  countries: { value: string; label: string }[];
  dictionary: Dictionary["checkout"];
  phone_label: string;
  phone_hint?: string;
};

export function AddressFieldset({
  prefix,
  value,
  onChange,
  errors,
  countries,
  dictionary,
  phone_label,
  phone_hint,
}: AddressFieldsetProps) {
  const set = (field: keyof AddressDraft) => (event: { target: { value: string } }) =>
    onChange({ ...value, [field]: event.target.value });
  const error = (field: keyof AddressDraft) => errors[`${prefix}.${field}`];
  const id = (field: keyof AddressDraft) => `${prefix}-${field}`;
  const section = prefix === "shipping_address" ? "shipping" : "billing";

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-6">
        <FloatingSelect
          id={id("country")}
          label={dictionary.country}
          value={value.country}
          onChange={set("country")}
          autoComplete={`${section} country`}
          error={error("country")}
        >
          <option value="" disabled>
            —
          </option>
          {countries.map((country) => (
            <option key={country.value} value={country.value}>
              {country.label}
            </option>
          ))}
        </FloatingSelect>
      </div>
      <div className="sm:col-span-6">
        <FloatingInput
          id={id("full_name")}
          label={dictionary.full_name}
          value={value.full_name}
          onChange={set("full_name")}
          autoComplete={`${section} name`}
          error={error("full_name")}
        />
      </div>
      <div className="sm:col-span-6">
        <FloatingInput
          id={id("line1")}
          label={dictionary.line1}
          value={value.line1}
          onChange={set("line1")}
          autoComplete={`${section} address-line1`}
          error={error("line1")}
        />
      </div>
      <div className="sm:col-span-6">
        <FloatingInput
          id={id("line2")}
          label={dictionary.line2}
          value={value.line2}
          onChange={set("line2")}
          autoComplete={`${section} address-line2`}
          error={error("line2")}
        />
      </div>
      <div className="sm:col-span-2">
        <FloatingInput
          id={id("postal_code")}
          label={dictionary.postal_code}
          value={value.postal_code}
          onChange={set("postal_code")}
          autoComplete={`${section} postal-code`}
          error={error("postal_code")}
        />
      </div>
      <div className="sm:col-span-2">
        <FloatingInput
          id={id("city")}
          label={dictionary.city}
          value={value.city}
          onChange={set("city")}
          autoComplete={`${section} address-level2`}
          error={error("city")}
        />
      </div>
      <div className="sm:col-span-2">
        <FloatingInput
          id={id("region")}
          label={dictionary.region}
          value={value.region}
          onChange={set("region")}
          autoComplete={`${section} address-level1`}
          error={error("region")}
        />
      </div>
      <div className="sm:col-span-6">
        <FloatingInput
          id={id("phone")}
          type="tel"
          label={phone_label}
          hint={phone_hint}
          value={value.phone}
          onChange={set("phone")}
          autoComplete={`${section} tel`}
          error={error("phone")}
        />
      </div>
    </div>
  );
}
