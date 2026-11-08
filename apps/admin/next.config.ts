import path from "node:path";

import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

// Images come from the backend's file storage: PocketBase files or Supabase Storage.
function imageHosts(): RemotePattern[] {
  const patterns: RemotePattern[] = [];
  const pocketbase = new URL(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090");
  // Object form (not new URL()) so any ?thumb= query string is allowed.
  patterns.push({
    protocol: pocketbase.protocol === "https:" ? "https" : "http",
    hostname: pocketbase.hostname,
    port: pocketbase.port,
    pathname: "/api/files/**",
  });
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    patterns.push({ protocol: "https", hostname: supabase.hostname, pathname: "/storage/v1/**" });
  }
  return patterns;
}

const next_config: NextConfig = {
  // cacheComponents stays off: auth guards in layouts read cookies before any Suspense
  // boundary (style guide §5, hard rule 16), which Cache Components rejects.
  reactCompiler: true,
  experimental: {
    // Product images (max 10 MB each) are uploaded one per action call.
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
  images: {
    remotePatterns: imageHosts(),
    // Local PocketBase runs on 127.0.0.1, which next/image blocks by default.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  turbopack: {
    // Monorepo root: the app imports shared code from packages/.
    root: path.join(import.meta.dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default next_config;
