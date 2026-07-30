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
  async redirects() {
    return [
      {
        // The game is called Speed Spelling now. Bookmarks, a home-screen
        // shortcut and any already-installed service worker still point at the
        // old path, so it keeps working rather than 404ing.
        source: "/games/quick-guess",
        destination: "/games/speed-spelling",
        permanent: true,
      },
      {
        // Same story for Word Pairing, which used to live at /games/guess-match.
        source: "/games/guess-match",
        destination: "/games/word-pairing",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
