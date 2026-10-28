import type { NextRequest } from "next/server";

import { LOCALES, type Locale } from "@/i18nConfig";

// Picks the language for a first visit (no locale in the URL, no saved choice):
// visitor's country → browser language → the DEFAULT_LOCALE setting.
// Runs in the proxy, so it must not import "server-only".

// Countries whose main language is one we ship. Others (e.g. Switzerland, Germany) fall
// through to the browser language.
const COUNTRY_LOCALES: Record<string, Locale> = {
  IT: "it",
  SM: "it",
  VA: "it",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  BO: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",
  PR: "es",
  GQ: "es",
  US: "en",
  GB: "en",
  IE: "en",
  CA: "en",
  AU: "en",
  NZ: "en",
  ZA: "en",
  SG: "en",
  MT: "en",
};

// Headers set by hosts that geolocate for free (Vercel, Cloudflare, Netlify-style proxies).
const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"];

// Railway and plain Node hosts send no country header: look the IP up instead.
// country.is is free, keyless and HTTPS. Results are cached so each IP is looked up once.
const IP_LOOKUP_URL = "https://api.country.is/";
const IP_LOOKUP_TIMEOUT_MS = 1500;
const IP_CACHE_MAX = 5000;
const ip_country_cache = new Map<string, string>();

export async function detectLocale(request: NextRequest, fallback: Locale): Promise<Locale> {
  const country = await visitorCountry(request);
  const country_locale = country ? COUNTRY_LOCALES[country] : undefined;
  if (country_locale) return country_locale;
  return browserLocale(request.headers.get("accept-language")) ?? fallback;
}

async function visitorCountry(request: NextRequest): Promise<string> {
  for (const name of COUNTRY_HEADERS) {
    const value = request.headers.get(name)?.trim().toUpperCase();
    // "XX" / "T1" are Cloudflare's unknown / Tor values.
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") return value;
  }
  const ip = clientIp(request);
  return ip ? lookupCountry(ip) : "";
}

function clientIp(request: NextRequest): string {
  // The first x-forwarded-for entry is the visitor; later ones are proxies.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "";
  return isPublicIp(ip) ? ip : "";
}

function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return !(lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80"));
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts as [number, number, number, number];
  return !(
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

async function lookupCountry(ip: string): Promise<string> {
  const cached = ip_country_cache.get(ip);
  if (cached !== undefined) return cached;

  let country = "";
  try {
    const response = await fetch(`${IP_LOOKUP_URL}${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(IP_LOOKUP_TIMEOUT_MS),
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "country" in body && typeof body.country === "string") {
        country = body.country.toUpperCase();
      }
    }
  } catch {
    // Lookup down or slow: fall back to the browser language, and retry for the next new IP.
    return "";
  }

  if (ip_country_cache.size >= IP_CACHE_MAX) {
    // Maps keep insertion order: drop the oldest entry.
    const oldest = ip_country_cache.keys().next().value;
    if (oldest !== undefined) ip_country_cache.delete(oldest);
  }
  ip_country_cache.set(ip, country);
  return country;
}

// "it-IT,it;q=0.9,en;q=0.8" → "it". Highest-weighted language we ship, or null.
function browserLocale(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return { language: tag.split("-")[0]?.toLowerCase() ?? "", weight: quality ? Number(quality.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.language && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const match = ranked.find((entry) => (LOCALES as readonly string[]).includes(entry.language));
  return match ? (match.language as Locale) : null;
}
