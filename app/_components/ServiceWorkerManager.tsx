"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Registers the service worker and surfaces the one thing a user has to decide
 * about it: a new version is ready, do they want it now.
 *
 * The worker never calls `skipWaiting` itself, so a deploy landing mid-round
 * cannot reload the tab under the player. It waits here until they say yes.
 */
export default function ServiceWorkerManager() {
  const { status: sessionStatus } = useSession();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // A controller swap means a worker took over. That happens on the very first
  // install too — `clients.claim()` fires it — and reloading there would give
  // every new visitor an unexplained page refresh. So the reload is armed only
  // by the user accepting an update, and disarmed after firing once.
  const updateRequested = useRef(false);
  const reloading = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Dev builds change on every edit and a cached shell only gets in the way.
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;

    const trackInstalling = (worker: ServiceWorker) => {
      worker.addEventListener("statechange", () => {
        // Installed with a controller already present = an update, not a first
        // install. A first install has nothing to interrupt, so it says nothing.
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaiting(worker);
          setDismissed(false);
        }
      });
    };

    const onControllerChange = () => {
      if (!updateRequested.current || reloading.current) {
        return;
      }
      reloading.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    // After load, so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          registration = reg;

          if (reg.waiting && navigator.serviceWorker.controller) {
            setWaiting(reg.waiting);
          }
          if (reg.installing) {
            trackInstalling(reg.installing);
          }

          reg.addEventListener("updatefound", () => {
            if (reg.installing) {
              trackInstalling(reg.installing);
            }
          });
        })
        .catch(() => {
          // No service worker means no offline shell. Everything else still works.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    // Coming back to the tab is the cheapest honest moment to look for a deploy.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  // Ask the worker to keep the offline-capable pages fresh. Tied to the session
  // because the cached copy carries it: warming again after a sign-in replaces
  // the signed-out markup that would otherwise greet you offline.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      sessionStatus === "loading" ||
      !navigator.onLine
    ) {
      return;
    }

    let cancelled = false;
    const warm = () => {
      navigator.serviceWorker.ready
        .then((registration) => {
          if (!cancelled) {
            registration.active?.postMessage({ type: "WARM_PAGES" });
          }
        })
        .catch(() => {
          // No worker, no offline pages to warm.
        });
    };

    // After the first paint has had its turn at the network.
    const timer = window.setTimeout(warm, 3000);
    window.addEventListener("online", warm);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", warm);
    };
  }, [sessionStatus]);

  const applyUpdate = useCallback(() => {
    updateRequested.current = true;
    waiting?.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  }, [waiting]);

  if (!waiting || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pwa-update-toast fixed inset-x-0 bottom-0 z-60 flex justify-center px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
          A new version of KatchUp is ready.
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Later
        </button>
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
