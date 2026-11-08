// Second-level labels under which a registrar sells names (example.co.uk, shop.com.au), so the
// registrable domain is three labels there. A short list instead of the full Public Suffix List:
// it only decides how record names are shown ("@" vs "shop").
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu", "ne", "or"]);

// The registrable domain the DNS zone belongs to: "shop.example.com" → "example.com".
export function zoneOf(hostname: string): string {
  const labels = hostname.split(".");
  const take =
    labels.length >= 3 && SECOND_LEVEL.has(labels.at(-2) ?? "") && (labels.at(-1)?.length ?? 0) === 2 ? 3 : 2;
  return labels.slice(-take).join(".");
}

export function isApex(hostname: string): boolean {
  return zoneOf(hostname) === hostname;
}

// The record name as registrars ask for it: relative to the zone, "@" for the zone itself.
export function relativeName(fqdn: string, zone: string): string {
  const name = fqdn.replace(/\.$/, "");
  if (name === zone) return "@";
  return name.endsWith(`.${zone}`) ? name.slice(0, -(zone.length + 1)) : name;
}
