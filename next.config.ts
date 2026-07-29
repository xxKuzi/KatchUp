import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The worker is the one file that must never be served stale: hosting
        // caches it like any other public asset, so a fix shipped in it can sit
        // unseen on a device for hours while the broken copy keeps running.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
