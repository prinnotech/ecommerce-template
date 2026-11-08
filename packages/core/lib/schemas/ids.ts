import { z } from "zod";

// Record ids from any backend: PocketBase (15 chars, a-z0-9) or a UUID (Supabase, SQLite).
export const ID_PATTERN = /^(?:[a-z0-9]{15}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export const id_schema = z.string().regex(ID_PATTERN);
