// Values fixed per deploy. Business values an admin can change live in site settings (lib/site-settings.ts).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const POCKETBASE_URL = (process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");
