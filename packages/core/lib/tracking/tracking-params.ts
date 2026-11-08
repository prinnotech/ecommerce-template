// What the store's proxy captures from ad links (no server-only imports: the proxy loads this).

export const TRACKING_COOKIE = "utm";
export const CONSENT_COOKIE = "cookie_consent";
// Meta's own cookies: _fbp is set by the Pixel, _fbc from the fbclid of an ad click.
export const FBP_COOKIE = "_fbp";
export const FBC_COOKIE = "_fbc";

export const TRACKING_COOKIE_DAYS = 90;
export const CONSENT_COOKIE_DAYS = 180;

export const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id"] as const;

// Campaign extras some networks add.
export const CAMPAIGN_PARAMS = ["campaign_id", "adset_id", "ad_id", "placement", "utm_source_platform"] as const;

// Click ids: Google, Meta, TikTok, Microsoft, LinkedIn, Pinterest, X, Snapchat, Reddit, Yahoo.
export const CLICK_ID_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ttclid",
  "msclkid",
  "li_fat_id",
  "epik",
  "twclid",
  "sccid",
  "rdt_cid",
  "yclid",
] as const;

export const TRACKING_PARAMS = [...UTM_PARAMS, ...CAMPAIGN_PARAMS, ...CLICK_ID_PARAMS] as const;
export type TrackingParam = (typeof TRACKING_PARAMS)[number];
