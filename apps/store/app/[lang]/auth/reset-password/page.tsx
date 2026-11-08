import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "../components/auth-card";
import { ResetPasswordForm } from "../components/reset-password-form";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/reset-password">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/auth/reset-password",
    title: dictionary.auth.reset_password.meta_title,
    is_private: true,
  });
}

export default async function ResetPasswordPage({ params }: PageProps<"/[lang]/auth/reset-password">) {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  return (
    <AuthCard
      title={dictionary.auth.reset_password.title}
      subtitle={dictionary.auth.reset_password.subtitle}
      footer={
        <Link href={`/${lang}/auth/login`} className="text-foreground font-medium underline-offset-4 hover:underline">
          {dictionary.auth.reset_password.back_to_login}
        </Link>
      }
    >
      <ResetPasswordForm
        lang={lang}
        dictionary={dictionary.auth.reset_password}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
