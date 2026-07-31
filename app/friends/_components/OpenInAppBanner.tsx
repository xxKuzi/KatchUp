"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

function isIos(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ identifies as "MacIntel" but still has touch support.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/**
 * iOS never hands scanned/shared links to an installed home-screen app — it
 * always opens Safari, even when KatchUp is already installed. There's no fix
 * for that on iOS, so this just nudges people who landed here from a QR scan
 * to reopen the link from their Home Screen icon instead.
 */
export default function OpenInAppBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isIos() && !isStandalone());
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="mx-auto mb-4 flex w-full max-w-5xl items-start gap-3 rounded-3xl border border-sky-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-linear-to-r from-sky-400 to-cyan-500 text-white">
        <Smartphone className="h-4.5 w-4.5" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Have KatchUp installed?
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          iOS always opens scanned links in Safari, even with the app on your
          Home Screen. Open KatchUp from its Home Screen icon instead to stay
          in the app.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsVisible(false)}
        className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
