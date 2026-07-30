"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { pusherClient } from "@/lib/realtime/pusher-client";
import { useLanguage } from "@/app/_lib/languageContext";
import type { Lang } from "@/app/_lib/languages";

interface DuelInvite {
  matchId: string;
  challengerName: string;
  challengerAvatar: string;
  language: string;
  nativeLang: string;
  level: string;
  mode?: string;
}

export default function DuelInviteListener() {
  const router = useRouter();
  const { data: session } = useSession();
  const { language, learningLanguage, setLanguage, setLearningLanguage } = useLanguage();
  const [invite, setInvite] = useState<DuelInvite | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    const client = pusherClient;
    if (!userId || !client) {
      return;
    }

    const channel = client.subscribe(`user-${userId}`);
    
    const handler = (data: DuelInvite) => {
      setInvite(data);
    };

    channel.bind("duel-invite", handler);

    return () => {
      channel.unbind("duel-invite", handler);
      client.unsubscribe(`user-${userId}`);
    };
  }, [session?.user?.id]);

  if (!invite) {
    return null;
  }

  const handleAccept = () => {
    const matchId = invite.matchId;
    setInvite(null);

    // Switch receiver's languages to match challenger's languages if Fair Mode
    if (invite.mode === "fair") {
      const inviteNative = invite.nativeLang as Lang;
      const inviteLearning = invite.language as Lang;
      if (inviteNative !== language) {
        setLanguage(inviteNative);
      }
      if (inviteLearning !== learningLanguage) {
        setLearningLanguage(inviteLearning);
      }
    }

    router.push(`/games/live-duel?matchId=${matchId}`);
  };

  const handleDecline = () => {
    const matchId = invite.matchId;
    setInvite(null);
    void fetch(`/api/flip-cards/match/${matchId}/leave`, {
      method: "POST",
    }).catch(() => null);
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] w-full max-w-sm px-4 transform transition-all duration-300 ease-out translate-y-0">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-rose-400 to-amber-400 text-2xl">
              ⚔️
            </span>
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              Friendly Battle!
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {invite.challengerName} challenged you to a live duel ({invite.mode === "personal" ? "Personalized" : "Fair"} mode)
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 justify-end mt-1">
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 transition"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 transition shadow-md shadow-sky-600/10"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
