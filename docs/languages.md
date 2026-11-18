# Languages and translation

The store ships with English, Spanish and Italian. **Settings → Languages** adds any other language and translates the store into it, by hand or with AI.

## Languages

**The language list:** for each language you can:
- see how much of the store text is translated;
- publish or hide it;
- make it the default;
- remove it.

**Adding a language:** pick one from the list or type a code (`fr`, `de`, `pt-BR`). A new language starts **hidden**:
- Customers don't see it and it isn't in the language switcher or the sitemap.
- You can still preview it at `/{code}` (for example `/fr/shop`).
- Publish it when it's ready.

**Default language:** customers whose language isn't available see the default. It must be published.

**Removing a language:** this hides it from the store. Its translations are kept, so adding it again brings them back.

## Translating

**Translate** opens one language with five tabs:

| Tab | What you translate |
|---|---|
| Store text | Buttons, labels, messages and emails: every text of the store pages |
| Products | Titles, descriptions and search-engine texts (20 per page, with search) |
| Categories / Collections | Names, descriptions and search-engine texts |
| Pages | Your own pages (Online store → Pages): title, every text in their sections, search-engine texts |

**Editing:**
- Each row shows the original next to the translation.
- **Missing only** and the search box help find what's left.
- Changes are kept until you **Save** in the bar at the top.

**Translate missing with AI:**
- Fills every empty field on the tab, in batches, with progress and a **Stop** button.
- AI translations are marked **AI draft** until you save, so you can review them first.
- A translation that loses or adds a `{placeholder}` (for example `{amount}`) is skipped.

**Export JSON / Import JSON:**
- The Store text tab can be exported, translated elsewhere (or by a translator), and imported again.
- Both flat (`{ "store.header.cart": "…" }`) and nested files work.

**English:** English is the source language for the store text. Editing a text in English changes the store's own wording, and what the other languages are translated from.

**The theme's own texts** (hero, banners, footer…) are translated in the theme editor: every text field there has a tab for each store language.

## AI

**Settings → AI** chooses the service the AI buttons use: Anthropic (Claude), OpenAI (ChatGPT) or Google (Gemini).

**Setting it up:**
1. Type the API key. It is stored encrypted and never shown again.
2. Optionally, type a model name. Empty uses `claude-opus-5-5` for Anthropic; for OpenAI and Google, type the model name shown in your provider's dashboard.
3. Click **Test**, which translates one sentence into Italian.

**Using environment variables instead:** set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` on the admin. The environment variable wins over a key typed in Settings.

Each translation is a call to your provider, billed to your account with them.

## For developers

**Where things are stored:**
- **`LANGUAGES` setting (public):** `[{ code, is_published }]`. The store proxy routes every store language and sends visitors only to published ones.
- **`UI_TRANSLATIONS` setting:** edits per language, as `{ code: { "dotted.key": text } }`. `getDictionary()` applies them over the shipped dictionary (English for languages without one).
- **Content:** catalog, page and theme texts are `{ [code]: text }`, so a new language is just a new key. No database migration is needed.
- **The admin's own text** stays in English, Spanish and Italian (`dictionaries/admin`).

**Where the code is:**
- **Translation:** `lib/ai/translate.ts`, built on the Vercel AI SDK (`generateText` with `Output.object`).
- **Content:** `lib/content-translation.ts` walks a record for its per-language texts.
- **Actions:**
  - `actions/languages.ts`: languages, store text, AI settings.
  - `actions/content-translations.ts`: products, categories, collections, pages.
