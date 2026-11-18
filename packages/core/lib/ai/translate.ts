import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import type { Locale } from "@repo/core/i18nConfig";
import { languageName } from "@repo/core/lib/languages";
import { AI_KEY_SECRET, aiModelFor, type AiSettings } from "@repo/core/lib/schemas/ai";
import { getSecret } from "@repo/core/lib/secrets";
import { reportError } from "@repo/core/lib/server-log";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";
import { samePlaceholders, type FlatText } from "@repo/core/lib/translations";

// "Translate with AI" (Settings → Languages, product and page translations): the provider and model
// from Settings → AI (the Vercel AI SDK, so Claude, ChatGPT or Gemini), the key from its encrypted
// secret. Text goes in batches; a translation that loses or adds a {placeholder} is dropped.

export type TranslateFailure = "ai_not_configured" | "ai_failed";

export class TranslateError extends Error {
  constructor(readonly code: TranslateFailure) {
    super(code);
  }
}

const BATCH_SIZE = 60;

async function languageModel(settings: AiSettings): Promise<LanguageModel> {
  const api_key = await getSecret(AI_KEY_SECRET[settings.provider]);
  const model_id = aiModelFor(settings);
  if (!api_key || !model_id) throw new TranslateError("ai_not_configured");
  switch (settings.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: api_key })(model_id);
    case "openai":
      return createOpenAI({ apiKey: api_key })(model_id);
    case "google":
      return createGoogle({ apiKey: api_key })(model_id);
  }
}

const result_schema = z.object({
  translations: z.array(z.object({ key: z.string(), text: z.string() })),
});

function instructions(source: Locale, target: Locale, context: string): string {
  return [
    `You translate the text of an online clothing store from ${languageName(source, "en")} (${source}) into ${languageName(target, "en")} (${target}).`,
    "Write natural, friendly shop copy a native speaker would expect: buttons and labels short, sentences complete.",
    "Keep every {placeholder} in curly braces exactly as it is (same name, not translated), and keep line breaks, list markers and HTML tags.",
    "Don't translate brand names, sizes (XS, M, 42) or codes.",
    "Keys ending in .one / .other are the singular and plural forms of the same text.",
    `Context: ${context}`,
    "Return one entry per key you were given, with the same key.",
  ].join("\n");
}

// Translates the given texts (key → source text). Returns the translations that passed the
// placeholder check; the caller shows them as drafts.
export async function translateTexts(
  texts: FlatText,
  source: Locale,
  target: Locale,
  context: string,
): Promise<FlatText> {
  const settings = await getSiteSetting("AI");
  const model = await languageModel(settings);
  const entries = Object.entries(texts).filter(([, text]) => text.trim());
  const translated: FlatText = {};

  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = entries.slice(start, start + BATCH_SIZE);
    try {
      const { output } = await generateText({
        model,
        system: instructions(source, target, context),
        prompt: JSON.stringify(batch.map(([key, text]) => ({ key, text }))),
        output: Output.object({ schema: result_schema }),
        maxRetries: 2,
      });
      const sources = new Map(batch);
      for (const { key, text } of output.translations) {
        const source_text = sources.get(key);
        if (source_text !== undefined && text.trim() && samePlaceholders(source_text, text)) translated[key] = text;
      }
    } catch (error) {
      await reportError("ai", `translateTexts ${settings.provider}`, error);
      throw new TranslateError("ai_failed");
    }
  }
  return translated;
}
