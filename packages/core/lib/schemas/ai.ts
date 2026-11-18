import { z } from "zod";

// Settings → AI: which provider the "Translate with AI" buttons use. The API keys are encrypted
// secrets (lib/secrets.ts), one per provider, so switching provider keeps the others.

export const AI_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

// The secret that holds each provider's key (an env variable with the same name wins).
export const AI_KEY_SECRET = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
} as const satisfies Record<AiProvider, string>;

// Used when the owner leaves the model empty. Only Anthropic has a default here; OpenAI and Google
// model names change often, so the owner types the one from their provider's dashboard.
export const DEFAULT_AI_MODEL: Partial<Record<AiProvider, string>> = { anthropic: "claude-opus-5-5" };

export const ai_settings_schema = z.object({
  provider: z.enum(AI_PROVIDERS),
  // Empty = DEFAULT_AI_MODEL for the provider.
  model: z.string().trim().max(100),
});
export type AiSettings = z.infer<typeof ai_settings_schema>;

export const DEFAULT_AI_SETTINGS: AiSettings = { provider: "anthropic", model: "" };

export function aiModelFor(settings: AiSettings): string {
  return settings.model || DEFAULT_AI_MODEL[settings.provider] || "";
}

export const save_ai_settings_schema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(100),
  // "" keeps the stored key; undefined too. To remove a key, clear_key.
  api_key: z.string().trim().max(500).optional(),
  clear_key: z.boolean().optional(),
});
export type SaveAiSettingsInput = z.infer<typeof save_ai_settings_schema>;
