// Where PocketBase runs. Public (NEXT_PUBLIC_) because file URLs point straight at it.
export const POCKETBASE_URL = (process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");
