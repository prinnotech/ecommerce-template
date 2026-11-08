// Creates (or promotes) the store owner: a users record plus an admin team_members row.
// Usage: npm run create-admin -- <email> <password> [name]
import { getSeedBackend } from "./seed-backend.mjs";

process.loadEnvFile(".env.local");

const [email, password, name = "Store admin"] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("Usage: npm run create-admin -- <email> <password (min 8 chars)> [name]");
  process.exit(1);
}

const backend = await getSeedBackend();
const { id: user_id, is_new } = await backend.createUser({ email, password, name });
if (!is_new) console.warn(`User ${email} already exists; promoting to admin (password unchanged).`);
await backend.setTeamMember({ user_id, roles: ["admin"], is_admin: true, is_active: true });
await backend.close();

console.warn(`Admin ready: ${email}`);
