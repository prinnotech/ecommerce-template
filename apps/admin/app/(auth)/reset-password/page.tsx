import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "../components/auth-card";
import { ResetPasswordForm } from "../components/reset-password-form";
import { buildAdminMetadata, getAdminLocale } from "@repo/core/lib/admin-locale";
import { getAdminDictionary } from "@repo/core/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getAdminDictionary(await getAdminLocale());
  return buildAdminMetadata(dictionary.auth.reset_password.meta_title);
}

export default async function ResetPasswordPage() {
  const lang = await getAdminLocale();
  const dictionary = await getAdminDictionary(lang);

  return (
    <AuthCard
      title={dictionary.auth.reset_password.title}
      subtitle={dictionary.auth.reset_password.subtitle}
      footer={
        <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
          {dictionary.auth.reset_password.back_to_login}
        </Link>
      }
    >
      <ResetPasswordForm
        dictionary={dictionary.auth.reset_password}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
