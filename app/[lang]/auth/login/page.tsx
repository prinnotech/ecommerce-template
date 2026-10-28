import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "../components/auth-card";
import { LoginForm } from "../components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { safeNextPath } from "@/lib/safe-next-path";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/login">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({ lang, path: "/auth/login", title: dictionary.auth.login.meta_title, is_private: true });
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/auth/login">) {
  const { lang } = await params;
  const { next, reset } = await searchParams;
  const next_path = safeNextPath(next, `/${lang}/account`);

  if (await getCurrentUser()) redirect(next_path);

  const dictionary = await getDictionary(lang);
  const register_href = `/${lang}/auth/register${typeof next === "string" ? `?next=${encodeURIComponent(next_path)}` : ""}`;

  return (
    <AuthCard
      title={dictionary.auth.login.title}
      subtitle={dictionary.auth.login.subtitle}
      footer={
        <>
          {dictionary.auth.login.no_account}{" "}
          <Link href={register_href} className="text-foreground font-medium underline-offset-4 hover:underline">
            {dictionary.auth.login.create_account}
          </Link>
        </>
      }
    >
      {reset === "1" && (
        <p role="status" className="bg-muted rounded-lg px-3 py-2 text-sm">
          {dictionary.auth.login.password_reset_done}
        </p>
      )}
      <LoginForm
        lang={lang}
        next_path={next_path}
        dictionary={dictionary.auth}
        errors={dictionary.errors}
        validation={dictionary.validation}
        loading_label={dictionary.common.loading}
      />
    </AuthCard>
  );
}
