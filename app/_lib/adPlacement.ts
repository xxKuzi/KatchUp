"use client";

/**
 * Google's Ad Placement API (AdSense H5 Games Ads), wrapped in a promise.
 *
 * The API is callback-shaped and deliberately inverted: you don't ask whether
 * an ad exists, you declare a placement and Google decides. Everything here
 * turns that into one settled answer per request, so the energy code can read
 * like `if (await requestRewardedAd(...) === "watched")`.
 *
 * The publisher id is public by design — it identifies the site to AdSense, not
 * the player — which is why nothing about the reward is decided here. The
 * browser only reports what it saw; /api/energy/ad/claim decides what it's
 * worth.
 */

const SDK_ORIGIN = "https://pagead2.googlesyndication.com";
const SDK_PATH = "/pagead/js/adsbygoogle.js";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/**
 * Testing mode renders mock ads entirely in the browser, without an ad request
 * ever reaching Google, and cycles between "ad loaded" and "nothing to show" so
 * both paths can be exercised locally. It is how this works before the AdSense
 * and H5 allowlisting reviews come back.
 */
const TEST_MODE = process.env.NEXT_PUBLIC_ADSENSE_TEST === "on";

export type AdOutcome =
  /** Watched to the end — the only outcome that earns anything. */
  | "watched"
  /** Closed early, or Google declined to fill this placement. */
  | "skipped"
  /** No publisher id, a blocker, or the script never answered. */
  | "unavailable";

/**
 * Why `breakStatus` is read at all: `adBreakDone` is the one callback that
 * always fires, so a placement that never became an ad is only explicable from
 * here. The split is what the player gets told — "no ad available, check your
 * blocker" versus letting a dismissal pass quietly.
 */
const UNAVAILABLE_STATUSES = new Set([
  "notReady",
  "timeout",
  "invalid",
  "error",
  "noAdPreloaded",
  "other",
]);

type PlacementInfo = { breakStatus?: string };

type AdBreakConfig = {
  type: "preroll" | "start" | "pause" | "next" | "browse" | "reward";
  name?: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (info: PlacementInfo) => void;
};

type AdConfig = {
  preloadAdBreaks?: "on" | "auto";
  sound?: "on" | "off";
  onReady?: () => void;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function adsConfigured(): boolean {
  return Boolean(CLIENT);
}

/**
 * Both `adBreak` and `adConfig` are the same thing underneath: a push onto the
 * `adsbygoogle` queue. Pushing before the script has loaded is fine and
 * expected — that queue is what the script drains on arrival.
 */
function push(command: AdBreakConfig | AdConfig) {
  if (typeof window === "undefined") return;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.push(command);
}

/** Dev-only tracing. The ad path is all callbacks, so silence is unreadable. */
const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.info("[ads]", ...args);
  }
};

let scriptLoaded = false;
let scriptFailed = false;

/**
 * What the page can see of Google's script, for when a request times out.
 *
 * The two ways this fails look identical from the outside — no callback ever
 * runs — but they are opposite problems. A script that never arrived is a
 * blocker. A script that arrived and still never answered is the API declining
 * to initialise, which for a placeholder publisher id is what you'd expect.
 */
function sdkState() {
  const queue =
    typeof window !== "undefined"
      ? (window.adsbygoogle as (unknown[] & { loaded?: boolean }) | undefined)
      : undefined;

  return {
    scriptTagInPage:
      typeof document !== "undefined" &&
      Boolean(document.querySelector('script[src*="adsbygoogle.js"]')),
    scriptLoaded,
    scriptFailed,
    // AdSense sets this once it has taken over the queue.
    apiTookOverQueue: queue?.loaded === true,
    queuedCommands: Array.isArray(queue) ? queue.length : null,
    client: CLIENT,
    testMode: TEST_MODE,
  };
}

let loaded = false;

/**
 * Inject the script and configure it, once per page.
 *
 * Call this well before anyone presses anything. `preloadAdBreaks: "on"` means
 * Google fetches an ad at config time, and a placement requested in the same
 * breath as the config has nothing preloaded to show — it comes back
 * `noAdPreloaded` and the player is told there are no ads. Mounting the button
 * is the signal to start warming up.
 */
export function preloadAds() {
  if (loaded || typeof window === "undefined" || !CLIENT) return;
  loaded = true;

  const script = document.createElement("script");
  script.src = `${SDK_ORIGIN}${SDK_PATH}?client=${encodeURIComponent(CLIENT)}`;
  script.async = true;
  script.crossOrigin = "anonymous";
  if (TEST_MODE) script.dataset.adbreakTest = "on";
  script.addEventListener("load", () => {
    scriptLoaded = true;
    debug("sdk loaded", { TEST_MODE });
  });
  script.addEventListener("error", () => {
    scriptFailed = true;
    debug("sdk blocked or failed to load");
  });
  document.head.appendChild(script);

  push({
    // Ads are asked for the moment a player presses the button, so the fetching
    // has to have happened already — otherwise the reward costs them a wait.
    preloadAdBreaks: "on",
    // KatchUp rounds are quiet. An ad that opens at full volume is worse than
    // no ad, especially on the phone of someone practising on a tram.
    sound: "off",
    onReady: () => debug("api ready"),
  });
}

/**
 * How long to wait for Google to say anything at all. An ad blocker doesn't
 * fail loudly — the script simply never drains the queue and no callback ever
 * fires — so silence has to time out into an honest "unavailable".
 */
const RESPONSE_TIMEOUT_MS = 15000;

let adInFlight = false;

export type RewardedAdRequest = {
  /**
   * Called when Google has an ad ready, with the function that plays it.
   *
   * That function must be invoked from a real user gesture — Google requires
   * it, and it is also the honest shape for a rewarded ad: the player presses
   * once to ask, sees that an ad is ready, and presses again to watch it. If
   * the player never presses, the promise settles "skipped" when the placement
   * closes.
   */
  onReady: (playAd: () => void) => void;
};

/**
 * Request one rewarded ad and resolve with what happened.
 *
 * Never rejects: a missing publisher id, a blocked script and a closed ad are
 * all ordinary outcomes for a button that only ever offers a bonus.
 */
export async function requestRewardedAd({
  onReady,
}: RewardedAdRequest): Promise<AdOutcome> {
  if (!adsConfigured()) return "unavailable";

  // Two placements at once is a broken page, not a double reward.
  if (adInFlight) return "skipped";

  // Normally a no-op by now — the button warms this up on mount — but a caller
  // that skipped that still gets an ad, just a slower one.
  preloadAds();
  adInFlight = true;
  debug("requesting rewarded placement");

  return new Promise<AdOutcome>((resolve) => {
    let settled = false;
    let offered = false;

    const finish = (outcome: AdOutcome, why: string) => {
      if (settled) return;
      settled = true;
      adInFlight = false;
      window.clearTimeout(timer);
      debug("settled", outcome, `(${why})`);
      resolve(outcome);
    };

    // Cleared as soon as Google speaks: once an ad is on screen the player may
    // take as long as they like, and a timer must not settle the promise out
    // from under a reward they are about to earn.
    let timer = window.setTimeout(() => {
      debug("timed out — sdk state:", sdkState());
      finish("unavailable", "no response from the API");
    }, RESPONSE_TIMEOUT_MS);

    push({
      type: "reward",
      name: "energy-refill",
      beforeReward: (showAdFn) => {
        debug("ad ready");
        offered = true;
        window.clearTimeout(timer);
        timer = 0;
        onReady(showAdFn);
      },
      adViewed: () => finish("watched", "adViewed"),
      adDismissed: () => finish("skipped", "adDismissed"),
      adBreakDone: (info) => {
        // Reached without an ad ever being offered: Google declined the
        // placement, and breakStatus is the only account of why.
        const status = info?.breakStatus ?? "other";
        finish(
          offered
            ? "skipped"
            : UNAVAILABLE_STATUSES.has(status)
              ? "unavailable"
              : "skipped",
          `breakStatus: ${status}`,
        );
      },
    });
  });
}
