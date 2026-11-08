import { z } from "zod";

import { id_schema } from "@repo/core/lib/schemas/ids";

export const DOMAIN_TARGETS = ["store", "admin"] as const;
export type DomainTarget = (typeof DOMAIN_TARGETS)[number];

export const DOMAIN_STATUSES = ["pending", "verifying", "active", "error"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

// A public hostname: lower-case labels of letters, digits and hyphens, at least one dot, no
// scheme, port, path, IP address or local name. "https://Shop.Example.com/" is cleaned first.
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export const hostname_schema = z
  .string("required")
  .trim()
  .toLowerCase()
  .transform((value) =>
    value
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\.$/, ""),
  )
  .refine((value) => value.length > 0, "required")
  .refine((value) => value.length <= 253, "too_long")
  .refine((value) => {
    const labels = value.split(".");
    return (
      labels.length >= 2 &&
      labels.every((label) => LABEL.test(label)) &&
      // The last label is a real TLD: letters only (rules out IP addresses).
      /^[a-z]{2,63}$/.test(labels.at(-1) ?? "") &&
      !value.endsWith(".localhost") &&
      !value.endsWith(".local")
    );
  }, "invalid_domain");

export const add_domain_schema = z.object({ hostname: hostname_schema, target: z.enum(DOMAIN_TARGETS) });
export type AddDomainInput = z.infer<typeof add_domain_schema>;

export const domain_id_schema = z.object({ id: id_schema });
export type DomainIdInput = z.infer<typeof domain_id_schema>;
