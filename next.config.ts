import type { NextConfig } from "next";

const pocketbase_url = new URL(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090");

const next_config: NextConfig = {
  // cacheComponents stays off: auth guards in layouts read cookies before any Suspense
  // boundary (style guide §5, hard rule 16), which Cache Components rejects.
  reactCompiler: true,
  experimental: {
    // Product images (max 10 MB each in PocketBase) are uploaded one per action call.
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
  images: {
    // Product and category images are served by PocketBase.
    // Object form (not new URL()) so any ?thumb= query string is allowed.
    remotePatterns: [
      {
        protocol: pocketbase_url.protocol === "https:" ? "https" : "http",
        hostname: pocketbase_url.hostname,
        port: pocketbase_url.port,
        pathname: "/api/files/**",
      },
    ],
    // Local PocketBase runs on 127.0.0.1, which next/image blocks by default.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default next_config;
