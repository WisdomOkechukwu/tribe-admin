import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // "Find customer" was merged into /customers; keep old links working.
  async redirects() {
    return [
      { source: "/customers/find", has: [{ type: "query", key: "email", value: "(?<email>.+)" }], destination: "/customers?q=:email", permanent: false },
      { source: "/customers/find", destination: "/customers", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    // This app lives inside the landing site's folder; pin the root here.
    root: path.resolve("."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
