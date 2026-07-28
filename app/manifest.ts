import type { MetadataRoute } from "next";

/**
 * The install manifest. Served from /manifest.webmanifest by the App Router,
 * which also links it from every page, so nothing has to be added to <head>.
 *
 * `display: standalone` is what makes an installed KatchUp lose the browser
 * chrome; the safe-area padding that then becomes necessary lives in
 * globals.css behind a `display-mode: standalone` query.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KatchUp — learn words that stick",
    short_name: "KatchUp",
    description:
      "Practice vocabulary in short rounds, race friends, and keep your streak — offline too.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f8",
    theme_color: "#dc2626",
    categories: ["education", "games"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable icons are cropped to the platform's shape, so these are the
      // padded ones: the mascot sits inside the inner 80% safe zone.
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Play a game",
        short_name: "Games",
        url: "/games",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My decks",
        short_name: "Decks",
        url: "/my-decks",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Topics",
        short_name: "Topics",
        url: "/topics",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
