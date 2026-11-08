import { z } from "zod";

// The cookie banner's choice (store app). Analytics = Google tag / GTM; marketing = Meta Pixel and
// Google Ads conversions. Nothing loads until the visitor chooses (EU rule).

export const consent_schema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  // ISO date of the choice.
  at: z.string().max(40),
});
export type Consent = z.infer<typeof consent_schema>;

export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  try {
    const parsed = consent_schema.safeParse(JSON.parse(decodeURIComponent(value)));
    return parsed.success ? parsed.data : null;
  } catch {
    // A broken cookie counts as "not chosen yet": the banner asks again.
    return null;
  }
}
