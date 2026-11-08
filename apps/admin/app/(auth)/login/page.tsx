import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "../components/auth-card";
import { LoginForm } from "../components/login-form";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { getCurrentUser } from "@repo/core/lib/auth";
import { getAdminDictionary } from "@repo/core/lib/i18n";
import { safeNextPath } from "@repo/core/lib/safe-next-path";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.auth.login.meta_title);
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const lang = await getAdminLocale();
  const { next, reset } = await searchParams;
  const next_path = safeNextPath(next, "/");

  if (await getCurrentUser()) redirect(next_path);

  const dictionary = await getAdminDictionary(lang);
  const demo_mode = process.env.DEMO_MODE === "true";
  const demo_password = process.env.DEMO_ADMIN_PASSWORD ?? "jkdvPfuPrpetttcS";

  return (
    <AuthCard title={dictionary.auth.login.title} subtitle={dictionary.admin_shell.login_subtitle}>
      {reset === "1" && (
        <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm">
          {dictionary.auth.login.password_reset_done}
        </p>
      )}
      {demo_mode && (
        <p className="bg-muted rounded-lg px-3 py-2 text-sm">
          {dictionary.auth.login.demo_hint.replace("{email}", "demo@admin.com").replace("{password}", demo_password)}
        </p>
      )}
      <LoginForm
        next_path={next_path}
        dictionary={dictionary.auth}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
