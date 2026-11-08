import { readPublicSetting } from "@repo/core/backend/proxy";
import { parseSetting, SITE_SETTINGS, type SettingKey, type SettingValue } from "@repo/core/lib/site-settings";

// Proxy-only reader for PUBLIC settings: anonymous read, cached in memory for 60 s,
// falls back to the default on any error. Must not import "server-only".
const CACHE_MS = 60_000;
const cache = new Map<SettingKey, { value: unknown; expires_at: number }>();

export async function getProxySetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  if (!SITE_SETTINGS[key].is_public) return SITE_SETTINGS[key].default_value as SettingValue<K>;

  const cached = cache.get(key);
  if (cached && cached.expires_at > Date.now()) return cached.value as SettingValue<K>;

  let value: SettingValue<K> = SITE_SETTINGS[key].default_value as SettingValue<K>;
  try {
    const stored = await readPublicSetting(key);
    if (stored !== undefined) value = parseSetting(key, stored);
  } catch {
    // Backend unreachable: use the default and retry after the cache window.
  }

  cache.set(key, { value, expires_at: Date.now() + CACHE_MS });
  return value;
}
