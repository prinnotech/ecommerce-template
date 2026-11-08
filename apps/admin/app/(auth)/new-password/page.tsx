import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "../components/auth-card";
import { NewPasswordForm } from "../components/new-password-form";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { getAdminDictionary } from "@repo/core/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.auth.new_password.meta_title);
}

// Landing page for a password-reset link: /new-password?token=…
export default async function NewPasswordPage({ searchParams }: PageProps<"/new-password">) {
  const lang = await getAdminLocale();
  const { token } = await searchParams;
  const dictionary = await getAdminDictionary(lang);

  if (typeof token !== "string" || token.length === 0) {
    return (
      <AuthCard title={dictionary.auth.new_password.title} subtitle={dictionary.auth.new_password.invalid_link}>
        <Link href="/reset-password" className="text-sm font-medium underline-offset-4 hover:underline">
          {dictionary.auth.new_password.request_new}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={dictionary.auth.new_password.title} subtitle={dictionary.auth.new_password.subtitle}>
      <NewPasswordForm
        token={token}
        dictionary={dictionary.auth}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
