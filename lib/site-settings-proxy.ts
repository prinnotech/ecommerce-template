import { POCKETBASE_URL } from "@/lib/site-config";
import { parseSetting, SITE_SETTINGS, type SettingKey, type SettingValue } from "@/lib/site-settings";

// Proxy-only reader for PUBLIC settings: anonymous REST read, cached in memory for 60 s,
// falls back to the default on any error. Must not import "server-only".
const CACHE_MS = 60_000;
const cache = new Map<SettingKey, { value: unknown; expires_at: number }>();

export async function getProxySetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  if (!SITE_SETTINGS[key].is_public) return SITE_SETTINGS[key].default_value as SettingValue<K>;

  const cached = cache.get(key);
  if (cached && cached.expires_at > Date.now()) return cached.value as SettingValue<K>;

  let value: SettingValue<K> = SITE_SETTINGS[key].default_value as SettingValue<K>;
  try {
    const filter = encodeURIComponent(`key = "${key}"`);
    const response = await fetch(
      `${POCKETBASE_URL}/api/collections/site_settings/records?filter=${filter}&fields=value&perPage=1&skipTotal=1`,
      { signal: AbortSignal.timeout(2000) },
    );
    if (response.ok) {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "items" in body && Array.isArray(body.items) && body.items[0]) {
        const item: unknown = body.items[0];
        if (typeof item === "object" && item !== null && "value" in item) value = parseSetting(key, item.value);
      }
    }
  } catch {
    // PocketBase unreachable: use the default and retry after the cache window.
  }

  cache.set(key, { value, expires_at: Date.now() + CACHE_MS });
  return value;
}
