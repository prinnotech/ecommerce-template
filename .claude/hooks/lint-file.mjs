// PostToolUse hook: lints the file Claude just edited and reports errors back immediately.
import { spawnSync } from "node:child_process";
import { relative } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

let file_path = "";
try {
  file_path = JSON.parse(input)?.tool_input?.file_path ?? "";
} catch {
  // Not a JSON payload: nothing to lint.
  process.exit(0);
}

if (!/\.(ts|tsx|mjs|js)$/.test(file_path)) process.exit(0);
const relative_path = relative(process.cwd(), file_path);
if (/^(pb_migrations|pb_hooks|pb_data|node_modules|\.next)[\\/]/.test(relative_path)) process.exit(0);

const result = spawnSync("npx", ["eslint", "--no-warn-ignored", relative_path], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.stderr.write(`ESLint errors in ${relative_path}:\n${result.stdout}${result.stderr}`);
  process.exit(2);
}
