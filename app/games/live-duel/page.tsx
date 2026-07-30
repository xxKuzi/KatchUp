"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GamePage from "../_components/GamePage";
import { LANG_LABELS, type CefrLevel } from "@/app/_lib/languages";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevel } from "@/app/_lib/useLearningLevel";
import { hasAnonPlaysRemaining } from "../_lib/anonPlayGate";
import { getPlayerProfile, PlayerProfile } from "./_lib/playerProfile";
import { useAuthState } from "@/app/_lib/auth";
import { useSession } from "@/lib/auth-client";
import { pusherClient } from "@/lib/realtime/pusher-client";
import { useDuelAvatar, useDuelNickname } from "./_lib/useDuelNickname";
import { useEnergyBlocked } from "../_lib/energyGate";
import OutOfEnergy from "../_components/OutOfEnergy";

const DEFAULT_OPPONENTS = [
  { name: "Luna87", avatar: "https://i.pravatar.cc/100?img=34" },
  { name: "MikaSprint", avatar: "https://i.pravatar.cc/100?img=47" },
  { name: "WordWizard", avatar: "https://i.pravatar.cc/100?img=15" },
  { name: "LexiDash", avatar: "https://i.pravatar.cc/100?img=49" },
  { name: "PabloPulse", avatar: "https://i.pravatar.cc/100?img=66" },
];

const MATCH_HISTORY_KEY = "katchup-live-duel-history-v1";
// How long a found duel waits for both players to accept before it is dropped
// and the players are put back in the lobby.
const ACCEPT_WINDOW_S = 20;
const MATCH_SETTINGS_KEY = "katchup-live-duel-settings-v1";

type MatchSettings = "fair" | "personal";

// "found" waits for this player to accept, "accepted" waits for the opponent.
type MatchState = "idle" | "searching" | "found" | "accepted";
type MatchMode = "live" | "bot";

interface OpponentPreview {
  name: string;
  avatar: string;
}

interface MatchHistoryEntry {
  createdAt: number;
  mode: MatchMode;
  score: number;
  opponentName?: string;
  winner: "player" | "opponent" | "draw" | null;
}

const isImageUrl = (url?: string) => {
  return url ? url.startsWith("http") || url.startsWith("/") || url.startsWith("data:") : false;
};

const LiveDuelPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  // `session.user.id` isn't exposed to the client, so authentication has to be
  // read off the status the way the rest of the app does it.
  const { isSignedIn, isReady: isAuthReady } = useAuthState();
  const { speak, learning } = useLanguagePair();

  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [matchSettings, setMatchSettings] = useState<MatchSettings>("personal");
  // The stored choice only arrives after mount, so anything that joins a queue
  // has to wait for it or it would queue as "fair" on a personalized replay.
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [searchPulse, setSearchPulse] = useState(0);
  const [opponent, setOpponent] = useState<OpponentPreview>(
    DEFAULT_OPPONENTS[0],
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const getNickname = useDuelNickname(profile?.name ?? "You");
  const getAvatar = useDuelAvatar(
    profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
  );
  const [matchId, setMatchId] = useState<string | null>(null);
  const startedMatchId = useRef<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptSecondsLeft, setAcceptSecondsLeft] = useState(ACCEPT_WINDOW_S);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const learningLevel = useLearningLevel(learning);
  // The player sees a level number; the word pool still needs a difficulty.
  const level: CefrLevel = learningLevel?.wordDifficulty ?? "A1";
  const isHydrated = learningLevel !== null;

  useEffect(() => {
    setProfile(getPlayerProfile());

    try {
      const stored = window.localStorage.getItem(MATCH_HISTORY_KEY);
      const parsed = stored ? (JSON.parse(stored) as MatchHistoryEntry[]) : [];
      // Newest first, so the duel you just played is the one on the left.
      setRecentMatches(
        [...parsed]
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(0, 4),
      );
    } catch {
      setRecentMatches([]);
    }

    // A duel coming back for a rematch says which mode it was played in; the
    // stored value covers plain returns to the lobby.
    const fromUrl = searchParams.get("settingsMode");
    const stored = window.localStorage.getItem(MATCH_SETTINGS_KEY);
    const restored = fromUrl ?? stored;

    if (restored === "personal" || restored === "fair") {
      setMatchSettings(restored);
    }
    setSettingsHydrated(true);
    // Only the first load matters here - later changes are the player's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const paramMatchId = searchParams.get("matchId");
    if (!paramMatchId || !profile || !isSignedIn || !isAuthReady) {
      return;
    }

    const loadMatchFromUrl = async () => {
      try {
        const response = await fetch(`/api/flip-cards/match/${paramMatchId}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setMatchId(paramMatchId);

        if (data.opponent) {
          setOpponent({
            name: data.opponent.name,
            avatar: data.opponent.avatar,
          });
        }

        if (data.me.accepted) {
          setMatchState("accepted");
        } else {
          setMatchState("found");
        }

        if (data.match.mode === "personal" || data.match.mode === "fair") {
          setMatchSettings(data.match.mode);
        }

        if (data.match.status === "active") {
          goToMatch(paramMatchId, data.match.startAt);
        }
      } catch (err) {
        console.error("Failed to load match from query param:", err);
      }
    };

    void loadMatchFromUrl();
  }, [searchParams, profile, isSignedIn, isAuthReady]);

  const chooseMatchSettings = (next: MatchSettings) => {
    setMatchSettings(next);
    try {
      window.localStorage.setItem(MATCH_SETTINGS_KEY, next);
    } catch {
      // A blocked localStorage just means the choice isn't remembered.
    }
  };

  const applyMatchFound = (found: {
    matchId: string;
    opponent?: OpponentPreview;
  }) => {
    setMatchId((previous) => {
      // The push and the poll both report the same match; only the first one
      // through should reset the acceptance window.
      if (previous === found.matchId) {
        return previous;
      }
      setAcceptSecondsLeft(ACCEPT_WINDOW_S);
      setAcceptError(null);
      setMatchState("found");
      return found.matchId;
    });

    if (found.opponent) {
      setOpponent(found.opponent);
    }
  };

  // Instant push: the server notifies the opponent the moment a match is
  // created, so the waiting player doesn't have to wait on the ~1s poll below.
  useEffect(() => {
    const userId = session?.user?.id;
    const client = pusherClient;
    if (matchState !== "searching" || !userId || !client) {
      return;
    }

    const channel = client.subscribe(`user-${userId}`);
    const handler = (data: {
      matchId: string;
      opponent?: { userId: string; name: string; avatar: string };
    }) => {
      applyMatchFound({
        matchId: data.matchId,
        opponent: data.opponent,
      });
    };
    channel.bind("match-found", handler);

    return () => {
      channel.unbind("match-found", handler);
      client.unsubscribe(`user-${userId}`);
    };
  }, [matchState, session?.user?.id]);

  useEffect(() => {
    if (matchState !== "searching" || !profile) {
      return;
    }

    const pulseInterval = window.setInterval(() => {
      setSearchPulse((previous) => (previous + 1) % 4);
    }, 420);

    // Polling fallback in case the Pusher push above is missed/delayed.
    const pollInterval = window.setInterval(async () => {
      try {
        // The pair, level and mode all have to match: they pick out the queue
        // this player is actually sitting in, and they keep an unrelated
        // match from being reported as this search's result.
        const response = await fetch(
          `/api/flip-cards/matchmaking/status?playerId=${profile.id}&language=${learning}&nativeLang=${speak}&level=${level}&mode=${matchSettings}&nickname=${encodeURIComponent(getNickname())}`,
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          status: "matched" | "waiting" | "idle";
          matchId?: string;
          opponent?: OpponentPreview;
        };

        if (data.status === "matched" && data.matchId) {
          applyMatchFound({
            matchId: data.matchId,
            opponent: data.opponent,
          });
        }
      } catch {
        // Keep polling to recover from transient errors.
      }
    }, 850);

    return () => {
      window.clearInterval(pulseInterval);
      window.clearInterval(pollInterval);
    };
  }, [learning, speak, level, matchSettings, matchState, getNickname, profile]);

  const leaveQueue = (useBeacon = false) => {
    const url = "/api/flip-cards/matchmaking/leave";
    const payload = JSON.stringify({
      language: learning,
      nativeLang: speak,
      level,
      mode: matchSettings,
    });

    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Nothing to recover here - a leftover entry ages out server-side.
    });
  };

  // Closing the tab mid-search would otherwise leave an entry in the queue
  // that the next player gets paired with and then waits on forever.
  const searchingRef = useRef(false);
  useEffect(() => {
    searchingRef.current = matchState === "searching";
  }, [matchState]);

  useEffect(() => {
    const handlePageHide = () => {
      if (searchingRef.current) {
        leaveQueue(true);
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learning, speak, level, matchSettings]);

  const cancelMatchmaking = () => {
    setMatchState("idle");
    setMatchId(null);
    leaveQueue();
  };

  const startFindingOpponent = async () => {
    if (matchState === "searching" || !profile) {
      return;
    }

    // Matchmaking is account-bound, so send the player to sign in rather than
    // letting the join call fail as a generic "unavailable".
    if (isAuthReady && !isSignedIn) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent("/games/live-duel")}`,
      );
      return;
    }

    setSearchError(null);
    setSearchPulse(0);
    // A previous result must not leak into this search - it is what kept
    // showing the last opponent and sending players into a spent match.
    setMatchId(null);
    setAcceptError(null);
    startedMatchId.current = null;
    setMatchState("searching");

    try {
      const response = await fetch("/api/flip-cards/matchmaking/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: profile.id,
          name: getNickname(),
          nickname: getNickname(),
          avatar: getAvatar(),
          language: learning,
          nativeLang: speak,
          level,
          mode: matchSettings,
        }),
      });

      if (response.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent("/games/live-duel")}`,
        );
        setMatchState("idle");
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Join failed");
      }

      const data = (await response.json()) as {
        status: "waiting" | "matched";
        matchId?: string;
        opponent?: OpponentPreview;
      };

      if (data.status === "matched" && data.matchId) {
        applyMatchFound({
          matchId: data.matchId,
          opponent: data.opponent,
        });
      }
    } catch (error) {
      setSearchError(
        error instanceof Error && error.message !== "Join failed"
          ? error.message
          : "Matchmaking is unavailable right now. Try again.",
      );
      setMatchState("idle");
    }
  };

  const startLiveMatch = (id: string, startAt: number | null) => {
    const params = new URLSearchParams({
      speak,
      learning,
      level,
      mode: "live",
      settingsMode: matchSettings,
      matchId: id,
      playerId: profile?.id ?? "player-local",
      playerName: getNickname(),
      playerAvatar: getAvatar(),
      opponent: opponent.name,
      opponentAvatar: opponent.avatar,
    });

    if (startAt) {
      params.set("startAt", String(startAt));
    }

    router.push(`/games/live-duel/play?${params.toString()}`);
  };

  // Both players have to say yes before either is sent to the play screen, and
  // the countdown only starts once the second acceptance lands.
  const goToMatch = (id: string, startAt: number | null) => {
    if (startedMatchId.current === id) {
      return;
    }
    startedMatchId.current = id;
    startLiveMatch(id, startAt);
  };

  const declineMatch = () => {
    const id = matchId;
    setMatchState("idle");
    setMatchId(null);
    setAcceptError(null);
    leaveQueue();

    if (id) {
      void fetch(`/api/flip-cards/match/${id}/leave`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {
        // The match ages out server-side even if this never lands.
      });
    }
  };

  const acceptMatch = async () => {
    if (!matchId) {
      return;
    }

    setMatchState("accepted");
    setAcceptError(null);

    try {
      const response = await fetch(`/api/flip-cards/match/${matchId}/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Accept failed");
      }

      const data = (await response.json()) as {
        status: "pending" | "active";
        startAt: number | null;
      };

      // Only the second player to accept gets a start time back; the first
      // waits for the push (or the poll) below.
      if (data.status === "active" && data.startAt) {
        goToMatch(matchId, data.startAt);
      }
    } catch {
      setAcceptError("Could not accept the duel. It may have been cancelled.");
      setMatchState("found");
    }
  };

  // Watch the match itself while it waits on acceptance: the opponent saying
  // yes starts the duel, and them backing out sends this player back to idle.
  useEffect(() => {
    if ((matchState !== "found" && matchState !== "accepted") || !matchId) {
      return;
    }

    const checkMatch = async () => {
      try {
        const response = await fetch(`/api/flip-cards/match/${matchId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          match: { status: string; startAt: number | null };
        };

        if (payload.match.status === "active" && payload.match.startAt) {
          goToMatch(matchId, payload.match.startAt);
          return;
        }

        if (payload.match.status === "finished") {
          setMatchState("idle");
          setMatchId(null);
          setAcceptError(
            "Your opponent left. Search again to find someone new.",
          );
        }
      } catch {
        // Keep polling; a transient failure shouldn't drop the duel.
      }
    };

    const channel = pusherClient?.subscribe(`match-${matchId}`);
    channel?.bind("match-ready", (data: { startAt?: number }) => {
      goToMatch(matchId, data?.startAt ?? null);
    });
    channel?.bind("match-finished", () => {
      void checkMatch();
    });

    void checkMatch();
    const pollInterval = window.setInterval(() => void checkMatch(), 1000);

    // Neither player should be stuck staring at an invite nobody answers.
    const countdownInterval = window.setInterval(() => {
      setAcceptSecondsLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => {
      window.clearInterval(pollInterval);
      window.clearInterval(countdownInterval);
      channel?.unbind_all();
      pusherClient?.unsubscribe(`match-${matchId}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState, matchId]);

  useEffect(() => {
    if (
      (matchState === "found" || matchState === "accepted") &&
      acceptSecondsLeft === 0
    ) {
      declineMatch();
      setAcceptError("The duel expired before both players accepted.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptSecondsLeft, matchState]);

  const energyBlocked = useEnergyBlocked();

  // Locking the button before auth resolves would flash "sign in" at players
  // who are in fact signed in.
  const isBotDuelLocked =
    isAuthReady && !isSignedIn && !hasAnonPlaysRemaining();

  const startBotDuel = () => {
    if (matchState === "searching") {
      leaveQueue();
    }

    if (isBotDuelLocked) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/")}`);
      return;
    }

    const params = new URLSearchParams({
      speak,
      learning,
      level,
      mode: "bot",
      playerId: profile?.id ?? "player-local",
      playerName: getNickname(),
      playerAvatar: profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
    });

    router.push(`/games/live-duel/play?${params.toString()}`);
  };

  // "Play again" on a live duel comes back here with ?autostart=1, because a
  // rematch needs a new opponent rather than a replay of the old match.
  const autoStartHandled = useRef(false);
  useEffect(() => {
    if (
      autoStartHandled.current ||
      searchParams.get("autostart") !== "1" ||
      !profile ||
      !isAuthReady ||
      !settingsHydrated ||
      // A rematch with nothing left to spend must not put a real opponent into
      // a queue for a duel this player cannot enter.
      energyBlocked
    ) {
      return;
    }

    autoStartHandled.current = true;
    router.replace("/games/live-duel");
    void startFindingOpponent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, profile, searchParams, settingsHydrated, energyBlocked]);

  // Held before matchmaking rather than on the play screen, so no one is left
  // waiting on an opponent who was never going to arrive.
  if (energyBlocked) {
    return (
      <OutOfEnergy
        name="Live Duel"
        description="Race another player live. First to 10 correct answers wins."
        bgImage="live_duel.webp"
      />
    );
  }

  return (
    <GamePage
      name="Live Duel"
      description="Race another player live with shared questions in Fair Mode or questions tailored to each player's language and level in Personalized Mode. First to 10 correct answers wins."
      bgImage="live_duel.webp"
      heroFirst
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Duel Setup
          </h2>
          <span
            title="Language pair and the level picked from your progress"
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {LANG_LABELS[speak]} → {LANG_LABELS[learning]}
            {/* Spacing via margin rather than literal spaces, which HTML
                collapses down to one however many you write. */}
            <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
            {isHydrated ? level : "..."}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Compete live against another player, or race a bot. Either way, the
          first to 10 correct answers wins.
        </p>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-2">
            Matchmaking Mode (live duels)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => chooseMatchSettings("personal")}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                matchSettings === "personal"
                  ? "border-blue-800 bg-blue-100 text-blue-950 shadow-sm ring-2 ring-blue-700/40 dark:border-blue-500 dark:bg-blue-400/20 dark:text-white dark:ring-blue-500/50"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 dark:border-white/70 dark:bg-zinc-900 dark:text-white dark:hover:border-white"
              }`}
            >
              <span className="text-sm font-bold">Personalized Mode</span>
              <span className="text-xxs mt-0.5 opacity-75">
                Your level of language &amp; vocabulary
              </span>
            </button>
            <button
              onClick={() => chooseMatchSettings("fair")}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                matchSettings === "fair"
                  ? "border-blue-800 bg-blue-100 text-blue-950 shadow-sm ring-2 ring-blue-700/40 dark:border-blue-500 dark:bg-blue-400/20 dark:text-white dark:ring-blue-500/50"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 dark:border-white/70 dark:bg-zinc-900 dark:text-white dark:hover:border-white"
              }`}
            >
              <span className="text-sm font-bold">Fair Mode</span>
              <span className="text-xxs mt-0.5 opacity-75">
                Same words for both players
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full max-w-3xl flex-col items-center gap-4 sm:mt-8">
        {matchState === "idle" && (
          <div className="flex w-full max-w-md mt-6 flex-col items-center gap-3">
            <button
              onClick={() => void startFindingOpponent()}
              className="w-full cursor-pointer rounded-xl border-2 border-solid border-transparent bg-blue-500 px-8 py-4 text-lg font-bold text-white shadow-sm transition hover:border-dashed hover:border-white hover:bg-blue-400"
            >
              Start Live Duel
            </button>
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              Match with a live opponent and race to 10 correct answers.
            </p>

            <button
              onClick={startBotDuel}
              className="mt-2 w-full rounded-xl border border-zinc-300 px-8 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {isBotDuelLocked ? "Sign in to duel the bot" : "Start Bot Duel"}
            </button>
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              {isBotDuelLocked
                ? "You've used your free bot duel. Sign in to keep duelling."
                : "No waiting - race a bot instead."}
            </p>
          </div>
        )}

        {matchState === "searching" && (
          <div className="w-full max-w-md text-center py-4">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Searching opponent{".".repeat(searchPulse)}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-blue-400 transition-all duration-500"
                style={{ width: `${25 + searchPulse * 25}%` }}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={cancelMatchmaking}
                className="rounded-xl border border-zinc-200 bg-white px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Cancel Matchmaking
              </button>
              <button
                onClick={startBotDuel}
                className="rounded-xl border border-zinc-200 bg-white px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Duel the bot instead
              </button>
            </div>
          </div>
        )}

        {(matchState === "found" || matchState === "accepted") && (
          <div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-6 text-center dark:border-zinc-700 dark:bg-zinc-800/40">
            <button
              type="button"
              onClick={declineMatch}
              aria-label="Decline duel"
              title="Decline duel"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            >
              &times;
            </button>

            <div className="relative">
              {isImageUrl(opponent.avatar) ? (
                <img
                  src={opponent.avatar}
                  alt={opponent.name}
                  className="h-16 w-16 rounded-full border-2 border-blue-400 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-blue-400 bg-sky-100 text-3xl dark:bg-sky-500/10">
                  {opponent.avatar || "👤"}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Opponent found: {opponent.name}
            </p>

            {matchState === "found" ? (
              <>
                <button
                  className="w-full rounded-xl bg-blue-500 px-8 py-3 text-base font-semibold text-white transition hover:bg-blue-400"
                  onClick={() => void acceptMatch()}
                >
                  Accept duel
                </button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Expires in {acceptSecondsLeft}s
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Waiting for {opponent.name} to accept...
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all duration-1000"
                    style={{
                      width: `${(acceptSecondsLeft / ACCEPT_WINDOW_S) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Cancelling in {acceptSecondsLeft}s
                </p>
              </>
            )}
          </div>
        )}

        {searchError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {searchError}
          </p>
        )}

        {acceptError && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {acceptError}
          </p>
        )}
      </div>

      {recentMatches.length > 0 && (
        <div className="mt-8 flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-nowrap">
          <p className="shrink-0 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Recent duels:
          </p>
          {/* One line on desktop: anything that would wrap is clipped rather
              than pushed onto a second row. */}
          <div className="flex flex-wrap items-center gap-2 sm:min-w-0 sm:flex-nowrap sm:overflow-hidden">
            {recentMatches.map((entry, index) => {
              const result =
                entry.winner === "player"
                  ? "Win"
                  : entry.winner === "draw"
                    ? "Draw"
                    : entry.winner === "opponent"
                      ? "Loss"
                      : "Unfinished";

              return (
                <span
                  key={`${entry.createdAt}-${index}`}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    entry.winner === "player"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                      : entry.winner === "opponent"
                        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300"
                  }`}
                >
                  <span className="font-semibold">{result}</span>
                  {" - "}
                  {entry.mode === "live"
                    ? (entry.opponentName ?? "opponent")
                    : "Bot"}
                  {" - "}
                  {entry.score} pts
                </span>
              );
            })}
          </div>
        </div>
      )}
    </GamePage>
  );
};

export default LiveDuelPage;
