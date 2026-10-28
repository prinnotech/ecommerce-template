import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const NO_AUTH_STORE_IS_VALID = {
  selector: "MemberExpression[object.property.name='authStore'][property.name='isValid']",
  message: "authStore.isValid only checks expiry locally. Use getCurrentUser() / getCaller() from lib/auth.ts.",
};

const NO_USE_CLIENT = {
  selector: "Program > ExpressionStatement[directive='use client']",
  message: 'Never put "use client" on a page or layout. Move the interactive part into a leaf component.',
};

// Enforces the style guide: naming, PocketBase client boundaries, no `any`,
// no console.log, no "use client" on pages/layouts.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated.
    "types/pocketbase-types.ts",
    // PocketBase runtime (JSVM globals, not part of the Next.js app).
    "pb_data/**",
    "pb_migrations/**",
    "pb_hooks/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "pocketbase", message: "Use the helpers in lib/pocketbase/ instead." }] },
      ],
    },
  },
  {
    files: ["lib/pocketbase/**", "scripts/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // console.warn/error only inside logging helpers and CLI scripts.
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/server-log.ts"],
    rules: { "no-console": "error" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/pocketbase/**"],
    rules: { "no-restricted-syntax": ["error", NO_AUTH_STORE_IS_VALID] },
  },
  {
    files: ["app/**/page.tsx", "app/**/layout.tsx"],
    rules: { "no-restricted-syntax": ["error", NO_AUTH_STORE_IS_VALID, NO_USE_CLIENT] },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/ui/**"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        // Values are snake_case; module constants UPPER_CASE; components PascalCase.
        { selector: "variable", format: ["snake_case", "UPPER_CASE"], leadingUnderscore: "allow" },
        { selector: "variable", types: ["function"], format: ["camelCase", "PascalCase", "UPPER_CASE"] },
        { selector: "variable", modifiers: ["destructured"], format: null },
        { selector: "parameter", format: ["snake_case"], leadingUnderscore: "allow" },
        { selector: "parameter", modifiers: ["destructured"], format: null },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        // Object keys mix our snake_case with library-owned names (className, queryKey, …).
        { selector: ["objectLiteralProperty", "typeProperty", "objectLiteralMethod", "typeMethod"], format: null },
        { selector: ["classProperty", "classMethod", "accessor"], format: ["camelCase", "snake_case"] },
        { selector: "import", format: null },
      ],
    },
  },
]);

export default eslintConfig;
