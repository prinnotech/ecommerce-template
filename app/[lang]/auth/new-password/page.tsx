import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "../components/auth-card";
import { NewPasswordForm } from "../components/new-password-form";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/new-password">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/auth/new-password",
    title: dictionary.auth.new_password.meta_title,
    is_private: true,
  });
}

// Landing page for the reset link in PocketBase's email: /auth/new-password?token=…
export default async function NewPasswordPage({ params, searchParams }: PageProps<"/[lang]/auth/new-password">) {
  const { lang } = await params;
  const { token } = await searchParams;
  const dictionary = await getDictionary(lang);

  if (typeof token !== "string" || token.length === 0) {
    return (
      <AuthCard title={dictionary.auth.new_password.title} subtitle={dictionary.auth.new_password.invalid_link}>
        <Link href={`/${lang}/auth/reset-password`} className="text-sm font-medium underline-offset-4 hover:underline">
          {dictionary.auth.new_password.request_new}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={dictionary.auth.new_password.title} subtitle={dictionary.auth.new_password.subtitle}>
      <NewPasswordForm
        lang={lang}
        token={token}
        dictionary={dictionary.auth}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
