// Packages (fulfillments): which order lines went out in each one, and tracking links per carrier.
// Pure, shared by the actions, the admin and the customer's order page.

// Tracking pages that take the number in the URL. "{number}" is replaced (URL-encoded). The list
// is a convenience: any other carrier can be typed by name with its own link.
export const CARRIERS = [
  { id: "ups", name: "UPS", url: "https://www.ups.com/track?tracknum={number}" },
  { id: "fedex", name: "FedEx", url: "https://www.fedex.com/fedextrack/?trknbr={number}" },
  {
    id: "dhl_express",
    name: "DHL Express",
    url: "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={number}",
  },
  {
    id: "dhl_paket",
    name: "DHL Paket",
    url: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={number}",
  },
  { id: "usps", name: "USPS", url: "https://tools.usps.com/go/TrackConfirmAction?tLabels={number}" },
  { id: "royal_mail", name: "Royal Mail", url: "https://www.royalmail.com/track-your-item#/tracking-results/{number}" },
  {
    id: "canada_post",
    name: "Canada Post",
    url: "https://www.canadapost-postescanada.ca/track-reperage/en#/details/{number}",
  },
  { id: "australia_post", name: "Australia Post", url: "https://auspost.com.au/mypost/track/details/{number}" },
  {
    id: "poste_italiane",
    name: "Poste Italiane",
    url: "https://www.poste.it/cerca/index.html#/risultati-spedizioni/{number}",
  },
  {
    id: "correos",
    name: "Correos",
    url: "https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number={number}",
  },
  {
    id: "la_poste",
    name: "La Poste / Colissimo",
    url: "https://www.laposte.fr/outils/suivre-vos-envois?code={number}",
  },
  { id: "dpd", name: "DPD", url: "https://tracking.dpd.de/status/en_US/parcel/{number}" },
] as const;
export type CarrierId = (typeof CARRIERS)[number]["id"];

// The carrier with this display name (as stored on packages), if it's one we know.
export function findCarrier(name: string) {
  const wanted = name.trim().toLowerCase();
  return CARRIERS.find((carrier) => carrier.name.toLowerCase() === wanted) ?? null;
}

// The tracking link for a known carrier ("" when the carrier is unknown or there's no number).
export function trackingUrlFor(carrier_name: string, tracking_number: string): string {
  const carrier = findCarrier(carrier_name);
  const number = tracking_number.trim();
  if (!carrier || !number) return "";
  return carrier.url.replace("{number}", encodeURIComponent(number));
}

export type FulfillmentLine = { item_id: string; quantity: number };

// How many of each order line are still to ship, given the packages that weren't cancelled.
export function unfulfilledQuantities(
  items: { id: string; quantity: number }[],
  fulfillments: { status: string; lines: FulfillmentLine[] }[],
): Map<string, number> {
  const shipped = new Map<string, number>();
  for (const fulfillment of fulfillments) {
    if (fulfillment.status === "cancelled") continue;
    for (const line of fulfillment.lines) {
      shipped.set(line.item_id, (shipped.get(line.item_id) ?? 0) + line.quantity);
    }
  }
  return new Map(items.map((item) => [item.id, Math.max(0, item.quantity - (shipped.get(item.id) ?? 0))]));
}

export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled";

export function fulfillmentStatus(
  items: { id: string; quantity: number }[],
  fulfillments: { status: string; lines: FulfillmentLine[] }[],
): FulfillmentStatus {
  const left = [...unfulfilledQuantities(items, fulfillments).values()].reduce((sum, quantity) => sum + quantity, 0);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  if (left === 0 && total > 0) return "fulfilled";
  return left < total ? "partial" : "unfulfilled";
}
