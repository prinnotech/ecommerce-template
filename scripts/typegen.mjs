// Regenerates packages/backend-pocketbase/pocketbase-types.ts from the running local PocketBase.
// Reads the superuser credentials from .env.local so they never appear in package.json.
import { spawnSync } from "node:child_process";

process.loadEnvFile(".env.local");

const result = spawnSync(
  "npx",
  [
    "pocketbase-typegen",
    "--url",
    process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090",
    "--email",
    process.env.POCKETBASE_SUPERUSER_EMAIL ?? "",
    "--password",
    process.env.POCKETBASE_SUPERUSER_PASSWORD ?? "",
    "--out",
    "packages/backend-pocketbase/pocketbase-types.ts",
  ],
  { stdio: "inherit", shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
