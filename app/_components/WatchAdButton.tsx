"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Zap } from "lucide-react";
import { useLanguage } from "@/app/_lib/languageContext";
import { preloadAds } from "@/app/_lib/adPlacement";
import {
  adsConfigured,
  watchAdForEnergy,
  ENERGY_AD_REWARD,
  type AdEnergyResult,
} from "@/app/_lib/energy";

interface WatchAdButtonProps {
  /** Hidden while the bar is already full — there is nothing to earn. */
  disabled?: boolean;
  /** Called once energy has actually landed, e.g. to close a popover. */
  onRewarded?: () => void;
  className?: string;
}

/**
 * "Watch an ad, get energy." The second way back from an empty meter, next to
 * the practice round.
 *
 * It renders nothing when no publisher id is configured, so a local dev build
 * or a deploy without ads simply doesn't offer it rather than showing a button
 * that can only fail.
 *
 * Two presses, not one: the first asks Google for an ad, the second plays it.
 * That is Google's rule — the ad must start from a real user gesture — and it
 * reads honestly, since the player learns an ad is actually there before
 * committing to watch one.
 */
export default function WatchAdButton({
  disabled = false,
  onRewarded,
  className = "",
}: WatchAdButtonProps) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<AdEnergyResult | null>(null);

  // The function Google hands us to start the ad. A ref, not state: pressing
  // the button must call the very latest one, and it never needs to re-render.
  const playAd = useRef<(() => void) | null>(null);

  // Start fetching an ad as soon as the button is on screen. Google preloads at
  // config time, so a player who presses the instant this mounts would
  // otherwise be told there are no ads when there simply hasn't been time.
  useEffect(() => {
    preloadAds();
  }, []);

  if (!adsConfigured()) return null;

  const request = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);

    const outcome = await watchAdForEnergy((play) => {
      playAd.current = play;
      setReady(true);
    });

    playAd.current = null;
    setReady(false);
    setBusy(false);
    setResult(outcome);
    if (outcome === "rewarded") onRewarded?.();
  };

  const start = () => {
    // Straight through from the click, with nothing awaited in between — that
    // is what makes this a user gesture as far as Google is concerned.
    playAd.current?.();
  };

  // Only the outcomes a player can do something about get a line of copy;
  // "skipped" is self-explanatory — they closed the video themselves.
  const message =
    result === "limit"
      ? t("energyAd.limitReached")
      : result === "unavailable"
        ? t("energyAd.unavailable")
        : result === "error"
          ? t("energyAd.error")
          : null;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={ready ? start : request}
        disabled={disabled || (busy && !ready) || result === "limit"}
        className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          ready
            ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 dark:hover:bg-amber-400"
            : "border-amber-400/60 bg-white text-amber-600 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-400 dark:hover:bg-amber-500/10"
        } ${className}`}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        {ready
          ? t("energyAd.playNow")
          : busy
            ? t("energyAd.loading")
            : t("energyAd.watchAd")}
        <span className="inline-flex items-center gap-0.5">
          <Zap className="h-3.5 w-3.5 fill-current" />+{ENERGY_AD_REWARD}
        </span>
      </button>

      {message && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
