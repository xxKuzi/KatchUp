"use client";

import FeatureGate from "@/app/_components/FeatureGate";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";

export default function LeaderboardPage() {
  const { isSignedIn, isReady } = useAuthState();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <FeatureGate
        isAllowed={isReady && isSignedIn}
        message={t(
          "authGate.friends",
          "Let your friends see your progress and challenge your streak. Sign in to open Friends.",
        )}
      >
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t("leaderboard.title", "Friends Leaderboard")}
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            {t(
              "leaderboard.subtitle",
              "Coming next: friend invites, weekly races, and shared milestones.",
            )}
          </p>
        </div>
      </FeatureGate>
    </div>
  );
}
