// Meta event names, shared by the browser helpers and the server (meta-capi.ts).

export const META_EVENTS = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "Contact",
  "CompleteRegistration",
  "Search",
] as const;
export type MetaEventName = (typeof META_EVENTS)[number];
