import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PasswordForm } from "./components/password-form";
import { ProfileForm } from "./components/profile-form";
import { getMyProfile } from "@/app/actions/account";
import { unwrap } from "@/lib/action-result";
import { buildPageMetadata } from "@/lib/build-page-metadata";
import { getDictionary } from "@/lib/i18n";
import { query_keys } from "@/lib/query-keys";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/profile">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/account/profile",
    title: dictionary.account.profile.title,
    is_private: true,
  });
}

export default async function AccountProfilePage({ params }: PageProps<"/[lang]/account/profile">) {
  const { lang } = await params;
  const query_client = new QueryClient();
  const [dictionary] = await Promise.all([
    getDictionary(lang),
    query_client.prefetchQuery({ queryKey: query_keys.my_profile, queryFn: async () => unwrap(await getMyProfile()) }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(query_client)}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm
          dictionary={dictionary.account.profile}
          common={dictionary.common}
          errors={dictionary.errors}
          validation={dictionary.validation}
        />
        <PasswordForm
          dictionary={dictionary.account.profile}
          password_input={dictionary.auth.password_input}
          new_password_hint={dictionary.auth.register.password_hint}
          common={dictionary.common}
          errors={dictionary.errors}
          validation={dictionary.validation}
        />
      </div>
    </HydrationBoundary>
  );
}
