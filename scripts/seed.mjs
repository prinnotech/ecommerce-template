// Loads sample categories, products and variants for LOCAL testing only. Safe to re-run:
// existing slugs are skipped. Migrations never insert catalog data, so deploys start empty.
import { getSeedBackend } from "./seed-backend.mjs";
import { CATEGORIES, seedCatalog } from "./seed-catalog.mjs";

process.loadEnvFile(".env.local");

const backend = await getSeedBackend();
const { created } = await seedCatalog(backend);
await backend.close();

console.warn(`Seed done: ${CATEGORIES.length} categories checked, ${created} products created.`);
