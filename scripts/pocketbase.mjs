// Runs the local PocketBase binary from the project root on any OS: `npm run pb`.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Passes PB_APP_URL (and the rest of .env.local) to PocketBase.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Absolute path: spawn on Windows searches PATH, not the current folder.
const binary = resolve(process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
if (!existsSync(binary)) {
  console.error(`Missing ${binary}. Download PocketBase from https://pocketbase.io/docs/ into the project root.`);
  process.exit(1);
}

const args = process.argv.length > 2 ? process.argv.slice(2) : ["serve", "--http", "127.0.0.1:8090"];
const result = spawnSync(binary, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
