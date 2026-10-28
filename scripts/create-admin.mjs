// Creates (or promotes) the store owner: a users record plus an admin team_members row.
// Usage: npm run create-admin -- <email> <password> [name]
import PocketBase from "pocketbase";

process.loadEnvFile(".env.local");

const [email, password, name = "Store admin"] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error("Usage: npm run create-admin -- <email> <password (min 8 chars)> [name]");
  process.exit(1);
}

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090");
await pb
  .collection("_superusers")
  .authWithPassword(process.env.POCKETBASE_SUPERUSER_EMAIL ?? "", process.env.POCKETBASE_SUPERUSER_PASSWORD ?? "");

let user = await pb
  .collection("users")
  .getFirstListItem(pb.filter("email = {:email}", { email }))
  .catch(() => null);

if (user) {
  console.warn(`User ${email} already exists; promoting to admin (password unchanged).`);
} else {
  user = await pb.collection("users").create({ email, password, passwordConfirm: password, name, verified: true });
}

const member = await pb
  .collection("team_members")
  .getFirstListItem(pb.filter("user = {:user}", { user: user.id }))
  .catch(() => null);

const access = { roles: ["admin"], is_admin: true, is_active: true };
if (member) await pb.collection("team_members").update(member.id, access);
else await pb.collection("team_members").create({ user: user.id, ...access });

console.warn(`Admin ready: ${email}`);
