// Values fixed per deploy. Business values an admin can change live in site settings (lib/site-settings.ts).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
// Public URL of the admin app: staff invite links land on its /new-password page.
export const ADMIN_URL = (process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001").replace(/\/$/, "");
