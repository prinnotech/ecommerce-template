"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { failFrom } from "@repo/core/backend/fail-from";
import { getBackend } from "@repo/core/backend/index";
import { FALLBACK_LOCALE, isBuiltInLocale, type Locale } from "@repo/core/i18nConfig";
import { fail, ok, type ActionResult } from "@repo/core/lib/action-result";
import { logActivity } from "@repo/core/lib/activity-log";
import { translateTexts, TranslateError } from "@repo/core/lib/ai/translate";
import { authorize } from "@repo/core/lib/auth";
import { getBaseDictionary } from "@repo/core/lib/i18n";
import { languages_schema, publishedLocales, storeLocales, type StoreLanguage } from "@repo/core/lib/languages";
import { locale_code_schema } from "@repo/core/lib/localized";
import {
  AI_KEY_SECRET,
  AI_PROVIDERS,
  aiModelFor,
  save_ai_settings_schema,
  type AiProvider,
} from "@repo/core/lib/schemas/ai";
import { canStoreSecrets, saveSecret, secretStatus, type SecretStatus } from "@repo/core/lib/secrets";
import { SITE_SETTINGS, type SettingKey } from "@repo/core/lib/site-settings";
import { getSiteSettings } from "@repo/core/lib/site-settings-server";
import { revalidateStore } from "@repo/core/lib/store-revalidate";
import { flattenText, type FlatText } from "@repo/core/lib/translations";

// Settings → Languages (the store's languages and their text) and Settings → AI (the provider the
// "Translate with AI" buttons use).

async function saveSetting(key: SettingKey, value: unknown, user_id: string) {
  const definition = SITE_SETTINGS[key];
  await getBackend().settings.save({
    key,
    category: definition.category,
    value,
    is_public: definition.is_public,
    updated_by: user_id,
  });
}

async function afterChange() {
  revalidatePath("/", "layout");
  await revalidateStore();
}

// ---------- Settings → AI ----------

export type AiOverview = {
  provider: AiProvider;
  model: string;
  // The model used when `model` is empty ("" when the provider has no default).
  default_model: string;
  keys: Record<AiProvider, SecretStatus>;
  can_store_secrets: boolean;
};

export async function getAiSettings(): Promise<ActionResult<AiOverview>> {
  const auth = await authorize("settings.view", "view AI settings");
  if (!auth.ok) return auth;
  try {
    const [settings, secrets] = await Promise.all([getSiteSettings(), secretStatus()]);
    return ok({
      provider: settings.AI.provider,
      model: settings.AI.model,
      default_model: aiModelFor({ ...settings.AI, model: "" }),
      keys: Object.fromEntries(AI_PROVIDERS.map((provider) => [provider, secrets[AI_KEY_SECRET[provider]]])) as Record<
        AiProvider,
        SecretStatus
      >,
      can_store_secrets: canStoreSecrets(),
    });
  } catch (error) {
    return failFrom(error, "languages", "getAiSettings");
  }
}

export async function saveAiSettings(input: unknown): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "change the AI settings");
  if (!auth.ok) return auth;
  const parsed = save_ai_settings_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { provider, model, api_key, clear_key } = parsed.data;
  if (api_key && !canStoreSecrets()) return fail("secrets_unavailable");
  try {
    await saveSetting("AI", { provider, model }, auth.caller.user_id);
    if (api_key) await saveSecret(AI_KEY_SECRET[provider], api_key, auth.caller.user_id);
    else if (clear_key) await saveSecret(AI_KEY_SECRET[provider], "", auth.caller.user_id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the AI settings",
      target_type: "settings",
      details: { provider, model, key_changed: Boolean(api_key || clear_key) },
    });
    return ok(null);
  } catch (error) {
    return failFrom(error, "languages", "saveAiSettings");
  }
}

// A one-line translation, so the owner knows the key and model work.
export async function testAi(): Promise<ActionResult<{ text: string }>> {
  const auth = await authorize("settings.edit", "test the AI connection");
  if (!auth.ok) return auth;
  try {
    const result = await translateTexts({ test: "Free shipping on orders over {amount}" }, "en", "it", "A test.");
    return result.test ? ok({ text: result.test }) : fail("ai_failed");
  } catch (error) {
    if (error instanceof TranslateError) return fail(error.code);
    return failFrom(error, "languages", "testAi");
  }
}

// ---------- Settings → Languages ----------

export type LanguageRow = StoreLanguage & {
  is_default: boolean;
  // Store text: keys translated (edited, or shipped with the template) out of all keys.
  translated: number;
  total: number;
};

export type LanguagesOverview = { languages: LanguageRow[]; default_locale: Locale };

// The text a language ships with: the repo dictionary for en/es/it, nothing for other languages
// (their store pages show English until translated).
async function shippedText(code: Locale): Promise<FlatText> {
  return isBuiltInLocale(code) ? flattenText(await getBaseDictionary(code)) : {};
}

// How many store texts a language has, shipped or translated, out of all of them.
async function progress(code: Locale, edits: FlatText): Promise<{ translated: number; total: number }> {
  const english = flattenText(await getBaseDictionary(FALLBACK_LOCALE));
  const shipped = await shippedText(code);
  const keys = Object.keys(english);
  return { translated: keys.filter((key) => edits[key] || shipped[key]).length, total: keys.length };
}

export async function getLanguages(): Promise<ActionResult<LanguagesOverview>> {
  const auth = await authorize("settings.view", "view the store languages");
  if (!auth.ok) return auth;
  try {
    const settings = await getSiteSettings();
    const published = publishedLocales(settings.LANGUAGES);
    const default_locale = published.includes(settings.DEFAULT_LOCALE)
      ? settings.DEFAULT_LOCALE
      : (published[0] ?? FALLBACK_LOCALE);
    const languages = await Promise.all(
      settings.LANGUAGES.map(async (language) => ({
        ...language,
        is_default: language.code === default_locale,
        ...(await progress(language.code, settings.UI_TRANSLATIONS[language.code] ?? {})),
      })),
    );
    return ok({ languages, default_locale });
  } catch (error) {
    return failFrom(error, "languages", "getLanguages");
  }
}

const save_languages_schema = z.object({ languages: languages_schema, default_locale: locale_code_schema });

export async function saveLanguages(input: unknown): Promise<ActionResult<null>> {
  const auth = await authorize("settings.edit", "change the store languages");
  if (!auth.ok) return auth;
  const parsed = save_languages_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { languages, default_locale } = parsed.data;
  // The default must be a published language.
  if (!publishedLocales(languages).includes(default_locale)) return fail("invalid_input");
  try {
    const before = (await getSiteSettings()).LANGUAGES;
    await saveSetting("LANGUAGES", languages, auth.caller.user_id);
    await saveSetting("DEFAULT_LOCALE", default_locale, auth.caller.user_id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "change the store languages",
      target_type: "settings",
      details: { before: storeLocales(before), after: storeLocales(languages), default_locale },
    });
    await afterChange();
    return ok(null);
  } catch (error) {
    return failFrom(error, "languages", "saveLanguages");
  }
}

// ---------- Store text of one language ----------

export type TextEntry = {
  key: string;
  // The English text (what to translate from).
  source: string;
  // What the store shows now: the edit, else the shipped text for en/es/it, else "".
  value: string;
  is_edited: boolean;
};

export async function getLanguageTexts(input: { locale: string }): Promise<ActionResult<TextEntry[]>> {
  const auth = await authorize("settings.view", "view store translations");
  if (!auth.ok) return auth;
  const locale = locale_code_schema.safeParse(input.locale);
  if (!locale.success) return fail("invalid_input");
  try {
    const settings = await getSiteSettings();
    if (!storeLocales(settings.LANGUAGES).includes(locale.data)) return fail("not_found");
    const english = flattenText(await getBaseDictionary(FALLBACK_LOCALE));
    const shipped = await shippedText(locale.data);
    const edits = settings.UI_TRANSLATIONS[locale.data] ?? {};
    return ok(
      Object.entries(english).map(([key, source]) => ({
        key,
        source,
        value: edits[key] ?? shipped[key] ?? "",
        is_edited: key in edits,
      })),
    );
  } catch (error) {
    return failFrom(error, "languages", "getLanguageTexts");
  }
}

const save_texts_schema = z.object({
  locale: locale_code_schema,
  // key → text; "" removes the edit (back to the shipped text, or empty).
  texts: z.record(z.string().max(200), z.string().max(5000)),
});

export async function saveLanguageTexts(input: unknown): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("settings.edit", "edit store translations");
  if (!auth.ok) return auth;
  const parsed = save_texts_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { locale, texts } = parsed.data;
  try {
    const settings = await getSiteSettings();
    if (!storeLocales(settings.LANGUAGES).includes(locale)) return fail("not_found");
    const known = flattenText(await getBaseDictionary(FALLBACK_LOCALE));
    const shipped = await shippedText(locale);
    const next: FlatText = { ...(settings.UI_TRANSLATIONS[locale] ?? {}) };
    let count = 0;
    for (const [key, text] of Object.entries(texts)) {
      if (!(key in known)) continue;
      // An edit equal to the shipped text isn't kept, so template updates still reach it.
      if (!text.trim() || text === shipped[key]) delete next[key];
      else next[key] = text;
      count++;
    }
    await saveSetting("UI_TRANSLATIONS", { ...settings.UI_TRANSLATIONS, [locale]: next }, auth.caller.user_id);
    await logActivity({
      actor_id: auth.caller.user_id,
      action: "edit store translations",
      target_type: "settings",
      details: { locale, count },
    });
    await afterChange();
    return ok({ count });
  } catch (error) {
    return failFrom(error, "languages", "saveLanguageTexts");
  }
}

const translate_texts_schema = z.object({
  locale: locale_code_schema,
  // At most one batch per call, so the screen can show progress and stop.
  keys: z.array(z.string().max(200)).min(1).max(120),
});

// AI drafts for some store texts (not saved: the screen shows them to review, then saves).
export async function translateLanguageTexts(input: unknown): Promise<ActionResult<FlatText>> {
  const auth = await authorize("settings.edit", "translate store text with AI");
  if (!auth.ok) return auth;
  const parsed = translate_texts_schema.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { locale, keys } = parsed.data;
  if (locale === FALLBACK_LOCALE) return fail("invalid_input");
  try {
    const english = flattenText(await getBaseDictionary(FALLBACK_LOCALE));
    const texts = Object.fromEntries(keys.filter((key) => key in english).map((key) => [key, english[key] ?? ""]));
    return ok(
      await translateTexts(
        texts,
        FALLBACK_LOCALE,
        locale,
        "Buttons, labels, messages and emails of the store's pages.",
      ),
    );
  } catch (error) {
    if (error instanceof TranslateError) return fail(error.code);
    return failFrom(error, "languages", "translateLanguageTexts");
  }
}
