import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-config";

// Private areas stay out of search results; everything else is crawlable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*/dashboard", "/*/account", "/*/auth", "/*/cart", "/*/checkout"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
