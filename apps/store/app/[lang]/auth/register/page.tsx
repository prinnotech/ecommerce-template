import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "../components/auth-card";
import { RegisterForm } from "../components/register-form";
import { getCurrentUser } from "@repo/core/lib/auth";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { safeNextPath } from "@repo/core/lib/safe-next-path";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/register">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/auth/register",
    title: dictionary.auth.register.meta_title,
    is_private: true,
  });
}

export default async function RegisterPage({ params, searchParams }: PageProps<"/[lang]/auth/register">) {
  const { lang } = await params;
  const { next } = await searchParams;
  const next_path = safeNextPath(next, `/${lang}/account`);

  if (await getCurrentUser()) redirect(next_path);

  const dictionary = await getDictionary(lang);
  const login_href = `/${lang}/auth/login${typeof next === "string" ? `?next=${encodeURIComponent(next_path)}` : ""}`;

  return (
    <AuthCard
      title={dictionary.auth.register.title}
      subtitle={dictionary.auth.register.subtitle}
      footer={
        <>
          {dictionary.auth.register.have_account}{" "}
          <Link href={login_href} className="text-foreground font-medium underline-offset-4 hover:underline">
            {dictionary.auth.register.sign_in}
          </Link>
        </>
      }
    >
      <RegisterForm
        next_path={next_path}
        dictionary={dictionary.auth}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
