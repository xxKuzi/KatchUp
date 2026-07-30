/**
 * KatchUp service worker.
 *
 * Bump CACHE_VERSION whenever the shell or this file's strategies change: the
 * caches are named after it, so a new version installs into fresh caches and
 * `activate` deletes every cache that isn't the current one. The version also
 * changes the bytes of this file, which is what makes the browser notice an
 * update at all.
 */

const CACHE_VERSION = "v5";
const SHELL_CACHE = `katchup-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `katchup-assets-${CACHE_VERSION}`;
const PAGE_CACHE = `katchup-pages-${CACHE_VERSION}`;
const DATA_CACHE = `katchup-data-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, PAGE_CACHE, DATA_CACHE];

const OFFLINE_URL = "/offline";

/**
 * The routes that have to survive with no network, because everything they
 * need is already on the device: the deck list, the deck's practice menu and
 * the four games that can run from a downloaded deck.
 *
 * They are warmed by the page (see WARM_PAGES below) rather than precached at
 * install, because a signed-in page is rendered with the session in it — a copy
 * fetched at install time would be the signed-out one, and the whole point is
 * that My Decks opens offline with your decks in it.
 */
const OFFLINE_ROUTES = [
  "/my-decks",
  "/my-decks/practice",
  "/games/flip-cards",
  "/games/one-of-three",
  "/games/word-pairing",
  "/games/speed-spelling",
];

/**
 * The minimum needed to render *something* without a network: the offline page
 * and the icons the install prompt and the offline page itself reference.
 * Deliberately short — a precache that lists application routes goes stale on
 * every deploy and is exactly what the runtime caches below are for.
 */
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/katchup_mascot.webp",
  // The navbar's logo, which every page draws above the fold. Precached rather
  // than left to the runtime cache so it is on the device from install and never
  // costs a round trip on a slow connection.
  "/katchup_logo_navbar.webp",
];

/** How long a cached page may be served before the network is preferred. */
const PAGE_CACHE_LIMIT = 60;

/**
 * The offline page's own build output, read out of its HTML at install time.
 *
 * The chunk filenames are content-hashed and change every deploy, so they can't
 * be listed here. Without them the page still paints, but React has nothing to
 * hydrate with — which showed up as a retry button that rendered and then did
 * nothing at all. Parsing the markup keeps the list correct by construction.
 */
async function precacheOfflinePageAssets(cache) {
  const page = await cache.match(OFFLINE_URL);
  if (!page) {
    return;
  }

  await precacheDocumentAssets(page.clone(), cache);
}

/** Caches the /_next/static chunks an HTML document references. */
async function precacheDocumentAssets(response, cache) {
  const html = await response.text();
  const urls = new Set();
  const pattern = /(?:src|href)="(\/_next\/static\/[^"]+)"/g;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    urls.add(match[1].replace(/&amp;/g, "&"));
  }

  await Promise.all(
    [...urls].map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch {
        // One missing chunk shouldn't fail the install.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One at a time and forgiving: a single 404 in the list must not stop the
      // worker installing, or one renamed image disables offline entirely.
      await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            // Asset unavailable at install time; runtime caching may still get it.
          }
        }),
      );

      await precacheOfflinePageAssets(cache);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload stays off, and an earlier version's setting is
      // undone here. The browser fires the preload for *every* in-scope
      // navigation, including the ones a worker declines to answer — and a
      // declined navigation then goes to the network a second time. On
      // /api/auth/callback/* that is fatal: the first request spends the
      // one-time code and sets the session cookie, the second finds the code
      // already used and lands the player on Auth.js's "server configuration"
      // page while actually being signed in.
      //
      // Turning it off here is not enough on its own, because it only takes
      // effect once *this* worker activates — a device still controlled by the
      // version that enabled preload keeps failing until it updates. So every
      // navigation below is answered, and answered with the preloaded response
      // when there is one, which makes a second request impossible either way.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }

      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("katchup-") && !CURRENT_CACHES.includes(name),
          )
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

/**
 * The page tells us to take over when the user accepts the update prompt. The
 * worker never calls `skipWaiting` on its own: swapping the worker out from
 * under a round in progress would reload the tab mid-answer.
 */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "WARM_PAGES") {
    event.waitUntil(warmPages(event.data.urls ?? OFFLINE_ROUTES));
  }
});

/**
 * Fetches the offline-capable routes while there *is* a network and keeps them,
 * with the chunks they need to hydrate.
 *
 * Inside an installed PWA almost every route change is a client-side one, so
 * the browser never issues a navigation request for it and the network-first
 * handler below never sees it. That is why opening My Decks offline used to
 * land on the offline page: the deck list had simply never been cached, only
 * whichever page the app happened to start on. Warming closes that gap, and
 * runs with the session cookie so the cached copy is the signed-in one.
 */
async function warmPages(urls) {
  const pages = await caches.open(PAGE_CACHE);
  const assets = await caches.open(ASSET_CACHE);

  await Promise.all(
    urls.map(async (url) => {
      try {
        const request = new Request(new URL(url, self.location.origin).href, {
          credentials: "same-origin",
        });
        const response = await fetch(request);
        if (!response.ok) {
          return;
        }

        await pages.put(request, response.clone());
        await precacheDocumentAssets(response.clone(), assets);
      } catch {
        // Warming is best effort: a route that fails now is retried next launch.
      }
    }),
  );
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

/**
 * Requests that must never be served from a cache.
 *
 * Everything under /api is either account data or a write; auth routes doubly
 * so. A cached 200 from one account served to the next is the failure mode this
 * exists to prevent.
 */
function isNeverCached(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/_next/webpack-hmr")
  );
}

/** Immutable build output — safe to serve from cache forever. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

/** Public files: icons, images, fonts. Content can change on deploy. */
function isStaticAsset(url, request) {
  if (request.destination === "image" || request.destination === "font") {
    return true;
  }
  return /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|json)$/i.test(url.pathname);
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) {
    return;
  }
  await Promise.all(
    keys.slice(0, keys.length - limit).map((key) => cache.delete(key)),
  );
}

/**
 * Looks in every cache, not only the one this request writes to.
 *
 * The shell assets are precached into SHELL_CACHE but requested by the page as
 * ordinary images, which the runtime strategies below would otherwise look for
 * in ASSET_CACHE alone — so the offline page's own mascot came back broken on
 * the one page whose whole job is to work offline.
 */
async function matchAnyCache(request) {
  return caches.match(request);
}

/** Cache-first: hashed build assets, where a hit is always correct. */
async function cacheFirst(request, cacheName) {
  const hit = await matchAnyCache(request);
  if (hit) {
    return hit;
  }

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/** Stale-while-revalidate: images and icons, where a slightly old copy is fine. */
async function staleWhileRevalidate(request, cacheName) {
  const hit = await matchAnyCache(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (hit) {
    return hit;
  }

  const response = await network;
  if (response) {
    return response;
  }
  throw new Error("Asset unavailable offline");
}

/**
 * Navigations that must reach the server untouched: one request, no cache, no
 * offline fallback. The preloaded response is used when the browser made one,
 * because the alternative is asking for the same URL twice — which signs a
 * player in and then shows them an error, since the second request replays an
 * OAuth code the first one already spent.
 */
async function passThroughNavigation(event) {
  const preloaded = await event.preloadResponse.catch(() => null);
  return preloaded || fetch(event.request);
}

/**
 * Navigations: network first so a signed-in page is never a stale one, falling
 * back to the last copy of this exact page, then to the offline page.
 */
async function handleNavigation(event) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response =
      (await event.preloadResponse) || (await fetch(event.request));
    if (response && response.ok) {
      cache.put(event.request, response.clone());
      void trimCache(PAGE_CACHE, PAGE_CACHE_LIMIT);
    }
    return response;
  } catch {
    // ignoreVary because Next varies its HTML on the router headers, which a
    // warmed copy does not carry: without it a perfectly good cached page is
    // treated as a miss and the user is bounced to the offline page.
    const hit = await cache.match(event.request, {
      ignoreSearch: true,
      ignoreVary: true,
    });
    if (hit) {
      return hit;
    }

    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    if (offline) {
      // Already on the offline page: hand over the body. Redirecting here would
      // redirect to itself forever.
      if (new URL(event.request.url).pathname === OFFLINE_URL) {
        return offline;
      }

      // Otherwise redirect rather than serve the offline body under the failed
      // URL. Serving it directly leaves the address bar on /whatever, and React
      // then hydrates *that* route against this markup — so the offline page's
      // own retry button was dead HTML that never wired itself up. The redirect
      // costs one more navigation, which this same handler answers from the
      // cache, and the page arrives as itself.
      const target = new URL(OFFLINE_URL, self.location.origin);
      target.searchParams.set("from", new URL(event.request.url).pathname);
      return Response.redirect(target.href, 302);
    }

    return new Response(
      "<!doctype html><title>Offline</title><h1>You're offline</h1>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

/**
 * The payload the app router fetches when you tap a link instead of reloading.
 * Same content as the page, different wrapper.
 */
function isPageData(request, url) {
  return url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
}

/**
 * Router payloads: network first, and kept under a key without the `_rsc`
 * cache-buster so one copy per route answers every later request for it.
 *
 * When nothing is cached this deliberately fails rather than inventing a
 * response — the app router answers a failed payload fetch with a full page
 * navigation, which `handleNavigation` can serve from the page cache.
 */
async function handlePageData(request) {
  const key = new URL(request.url);
  key.searchParams.delete("_rsc");
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(key.href, response.clone());
    }
    return response;
  } catch (error) {
    const hit = await cache.match(key.href, { ignoreVary: true });
    if (hit) {
      return hit;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    return;
  }

  if (request.mode === "navigate") {
    // Never-cached navigations — /api/auth/callback/* above all — are still
    // answered here rather than declined, so a navigation preload that some
    // older registration turned on is consumed instead of thrown away and
    // repeated. See the note in `activate`.
    event.respondWith(
      isNeverCached(url)
        ? passThroughNavigation(event)
        : handleNavigation(event),
    );
    return;
  }

  if (isNeverCached(url)) {
    return;
  }

  if (isPageData(request, url)) {
    event.respondWith(handlePageData(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (isStaticAsset(url, request)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});
