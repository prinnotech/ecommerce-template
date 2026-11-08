import type { Metadata } from "next";
import Link from "next/link";

import { WishlistGrid } from "./components/wishlist-grid";
import { getMyWishlistIds, getWishlistProducts } from "@repo/core/actions/wishlist";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { buildPageMetadata } from "@repo/core/lib/build-page-metadata";
import { getDictionary } from "@repo/core/lib/i18n";
import { getSiteSetting } from "@repo/core/lib/site-settings-server";

export async function generateMetadata({ params }: PageProps<"/[lang]/account/wishlist">): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(lang);
  return buildPageMetadata({
    lang,
    path: "/account/wishlist",
    title: dictionary.account.wishlist.meta_title,
    is_private: true,
  });
}

export default async function AccountWishlistPage({ params }: PageProps<"/[lang]/account/wishlist">) {
  const { lang } = await params;
  const [dictionary, ids, currency] = await Promise.all([
    getDictionary(lang),
    getMyWishlistIds(),
    getSiteSetting("CURRENCY"),
  ]);
  const products =
    ids.ok && ids.data && ids.data.length > 0 ? await getWishlistProducts({ product_ids: ids.data }) : null;
  const text = dictionary.account.wishlist;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!ids.ok ? (
          <p className="text-destructive text-sm">{dictionary.errors[ids.error]}</p>
        ) : products && !products.ok ? (
          <p className="text-destructive text-sm">{dictionary.errors[products.error]}</p>
        ) : (
          <WishlistGrid
            lang={lang}
            currency={currency}
            products={products?.data ?? []}
            dictionary={dictionary.store.card}
            empty={
              <div className="flex flex-col items-start gap-3">
                <p className="text-muted-foreground text-sm">{text.empty}</p>
                <Button asChild variant="outline">
                  <Link href={`/${lang}/shop`}>{text.start_shopping}</Link>
                </Button>
              </div>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
