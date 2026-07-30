"use client";

import FeatureGate from "@/app/_components/FeatureGate";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import { useLearningLevelState } from "@/app/_lib/useLearningLevel";
import QRCode from "qrcode";
import { Pencil, UserMinus, Swords } from "lucide-react";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevel } from "@/app/_lib/useLearningLevel";
import { LANGS, LANG_LABELS, LANG_FLAGS, CEFR_LEVELS, type Lang, type CefrLevel } from "@/app/_lib/languages";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { pusherClient } from "@/lib/realtime/pusher-client";
import { useRouter } from "next/navigation";
import {
  addFriendToState,
  areAllDuoTasksDone,
  claimDuoReward,
  clearDuoPartner,
  createEmptyFriendTaskState,
  createInitialFriendsLeagueState,
  formatTimestamp,
  getWeeklyTimeRemaining,
  getWeekKey,
  getCurrentLeague,
  parseFriendsLeagueState,
  selectDuoPartner,
  syncWeeklyDuoTasks,
  toggleDuoTask,
  WEEKLY_DUO_XP,
  type FriendPlayer,
  type FriendsLeagueState,
} from "./_lib/league";
import {
  AVATAR_BACKGROUNDS,
  CUTE_ICONS,
  buildProfileUrl,
  createInitialFriendProfileIdentity,
  createPlaceholderFriendProfileIdentity,
  createPublicFriendProfile,
  friendFromPublicProfile,
  getAvatarBackground,
  normalizeStoredProfileCode,
  type PublicFriendProfile,
  profileStorageKey,
  randomCuteIcon,
  parseStoredFriendProfileIdentity,
  type FriendProfileIdentity,
} from "./_lib/profile";

const STORAGE_KEY_PREFIX = "katchup-friends-league-v1";
const FLIP_CARDS_HISTORY_KEY = "katchup-flip-cards-history-v1";

interface FlipCardsHistoryEntry {
  score?: number;
}

function storageKey(userKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${userKey}`;
}

function formatXp(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(value)));
}

function readPracticeXp(): number {
  try {
    const rawValue = window.localStorage.getItem(FLIP_CARDS_HISTORY_KEY);

    if (!rawValue) {
      return 0;
    }

    const parsed = JSON.parse(rawValue) as FlipCardsHistoryEntry[];
    if (!Array.isArray(parsed)) {
      return 0;
    }

    const totalScore = parsed.reduce((sum, entry) => {
      const score = typeof entry?.score === "number" ? entry.score : 0;
      return sum + Math.max(0, Math.round(score));
    }, 0);

    return totalScore;
  } catch {
    return 0;
  }
}

export default function FriendsPage() {
  const router = useRouter();
  const { isSignedIn, isReady, session } = useAuthState();
  const { t, learningLanguage } = useLanguage();
  const { speak, learning } = useLanguagePair();
  const learningLevelDetail = useLearningLevel(learning);
  const level = learningLevelDetail?.wordDifficulty ?? "A1";
  const {
    level: learningLevel,
    knownWords: learningKnownWords,
    status: levelStatus,
  } = useLearningLevelState(learningLanguage);
  const userKey = session?.user?.email ?? session?.user?.name ?? "player";
  const fullName = session?.user?.name ?? "You";
  const displayName = fullName.trim().split(/\s+/)[0] || "You";
  const [state, setState] = useState<FriendsLeagueState>(() =>
    createInitialFriendsLeagueState(displayName),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [friendSearchTag, setFriendSearchTag] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<
    PublicFriendProfile[]
  >([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [searchMessage, setSearchMessage] = useState(
    "Type at least 2 letters of a tag to search.",
  );
  const [statusMessage, setStatusMessage] = useState(
    "Pick a friend and tackle this week's tasks together.",
  );
  // Deliberately deterministic: the real identity (random avatar, colour and
  // code) is minted or read from localStorage in an effect, because generating
  // it during render makes the server and client disagree.
  const [profileIdentity, setProfileIdentity] = useState<FriendProfileIdentity>(
    () => createPlaceholderFriendProfileIdentity(displayName),
  );
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileUrl, setProfileUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<FriendPlayer | null>(null);
  const [friendToChallenge, setFriendToChallenge] = useState<FriendPlayer | null>(null);
  const [selectedChallengeMode, setSelectedChallengeMode] = useState<"fair" | "personal">("personal");
  const [challengeLearning, setChallengeLearning] = useState<Lang>("de");
  const [challengeSpeak, setChallengeSpeak] = useState<Lang>("en");
  const [challengeLevel, setChallengeLevel] = useState<CefrLevel>("A1");
  const [incomingRequests, setIncomingRequests] = useState<FriendPlayer[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendPlayer[]>([]);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeCheckStatus, setCodeCheckStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "too-short" | "error"
  >("idle");
  const [now, setNow] = useState(() => new Date());
  // False during SSR and the first client render, true afterwards — the
  // subscribe-to-nothing form of useSyncExternalStore, which is the hydration-
  // safe way to say "client only" without a setState-in-effect.
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!isReady || !isSignedIn) {
      return;
    }

    const storedState = window.localStorage.getItem(storageKey(userKey));
    const parsedState = parseFriendsLeagueState(storedState, displayName);

    setState(parsedState ?? createInitialFriendsLeagueState(displayName));
    setIsHydrated(true);
  }, [displayName, isReady, isSignedIn, userKey]);

  useEffect(() => {
    if (!isReady || !isSignedIn) {
      return;
    }

    const storedIdentity = window.localStorage.getItem(
      profileStorageKey(userKey),
    );
    const parsedIdentity = parseStoredFriendProfileIdentity(
      storedIdentity,
      displayName,
    );

    setProfileIdentity(
      parsedIdentity ?? createInitialFriendProfileIdentity(displayName),
    );
    setProfileHydrated(true);
  }, [displayName, isReady, isSignedIn, userKey]);

  useEffect(() => {
    if (!isHydrated || !isSignedIn) {
      return;
    }

    window.localStorage.setItem(storageKey(userKey), JSON.stringify(state));
  }, [isHydrated, isSignedIn, state, userKey]);

  useEffect(() => {
    if (!profileHydrated || !isSignedIn) {
      return;
    }

    window.localStorage.setItem(
      profileStorageKey(userKey),
      JSON.stringify(profileIdentity),
    );
  }, [isSignedIn, profileHydrated, profileIdentity, userKey]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const refreshPracticeXp = () => {
      const practiceXp = readPracticeXp();
      setState((previous) =>
        previous.userXp === practiceXp
          ? previous
          : {
              ...previous,
              userXp: practiceXp,
            },
      );
    };

    refreshPracticeXp();
    window.addEventListener("focus", refreshPracticeXp);

    return () => window.removeEventListener("focus", refreshPracticeXp);
  }, [isHydrated]);

  useEffect(() => {
    if (!profileHydrated) {
      return;
    }

    setProfileUrl(
      buildProfileUrl(window.location.origin, profileIdentity.profileCode),
    );
  }, [profileHydrated, profileIdentity.profileCode]);

  useEffect(() => {
    if (!profileUrl) {
      setQrCodeDataUrl("");
      return;
    }

    let active = true;

    const buildQrCode = async () => {
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: "M",
      });

      if (active) {
        setQrCodeDataUrl(dataUrl);
      }
    };

    void buildQrCode();

    return () => {
      active = false;
    };
  }, [profileUrl]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const currentLeague = getCurrentLeague(state);
  const weekKey = getWeekKey(now);
  const weeklyRemaining = getWeeklyTimeRemaining(now);
  const duoTasks = state.friendTasks;
  const duoPartner = duoTasks.partnerId
    ? (state.friends.find((friend) => friend.id === duoTasks.partnerId) ?? null)
    : null;
  const wordTask = duoTasks.tasks.find((t) => t.id === "words-task") as any;
  const currentWords = wordTask?.current ?? 0;
  const targetWords = wordTask?.target ?? 1;
  const wordPercentage = Math.min(100, Math.round((currentWords / targetWords) * 100));
  const isQuestDone = currentWords >= targetWords;
  const avatarBackground = getAvatarBackground(
    profileIdentity.avatarBackgroundId,
  );

  const publicProfile = useMemo(
    () =>
      createPublicFriendProfile({
        identity: profileIdentity,
        currentXp: state.userXp,
        leagueName: currentLeague.name,
        friendsCount: state.friends.length,
        matchesPlayed: state.completedWeeks,
      }),
    [
      currentLeague.name,
      profileIdentity,
      state.friends.length,
      state.completedWeeks,
      state.userXp,
    ],
  );

  useEffect(() => {
    if (!profileHydrated || !isSignedIn) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const syncProfile = async () => {
        await fetch(`/api/friends/profile/${profileIdentity.profileCode}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(publicProfile),
        }).catch(() => undefined);
      };

      void syncProfile();
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [isSignedIn, profileHydrated, profileIdentity.profileCode, publicProfile]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const normalizedTag = normalizeStoredProfileCode(friendSearchTag);

    if (normalizedTag.length < 2) {
      setFriendSearchResults([]);
      setSearchMessage("Type at least 2 letters of a tag to search.");
      return;
    }

    let active = true;
    setIsSearchingFriends(true);

    const timeoutId = window.setTimeout(() => {
      const fetchResults = async () => {
        const response = await fetch(
          `/api/friends/profile/search?query=${encodeURIComponent(normalizedTag)}`,
        ).catch(() => null);

        if (!active) {
          return;
        }

        if (!response?.ok) {
          setFriendSearchResults([]);
          setSearchMessage("Search failed. Try again.");
          setIsSearchingFriends(false);
          return;
        }

        const data = (await response.json()) as {
          results?: PublicFriendProfile[];
        };

        const results = Array.isArray(data.results) ? data.results : [];
        const withoutSelf = results.filter(
          (profile) =>
            normalizeStoredProfileCode(profile.profileCode) !==
            normalizeStoredProfileCode(profileIdentity.profileCode),
        );

        setFriendSearchResults(withoutSelf);
        setSearchMessage(
          withoutSelf.length === 0
            ? "No players found for this tag yet."
            : `Found ${withoutSelf.length} players.`,
        );
        setIsSearchingFriends(false);
      };

      void fetchResults();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      setIsSearchingFriends(false);
    };
  }, [friendSearchTag, isSignedIn, profileIdentity.profileCode]);

  useEffect(() => {
    if (!isProfileEditorOpen) {
      return;
    }

    const normalizedDraft = normalizeStoredProfileCode(codeDraft);
    const normalizedCurrent = normalizeStoredProfileCode(
      profileIdentity.profileCode,
    );

    if (normalizedDraft === normalizedCurrent) {
      setCodeCheckStatus("idle");
      return;
    }

    if (normalizedDraft.length < 3) {
      setCodeCheckStatus("too-short");
      return;
    }

    let active = true;
    setCodeCheckStatus("checking");

    const timeoutId = window.setTimeout(() => {
      const checkAvailability = async () => {
        const response = await fetch(
          `/api/friends/profile/${encodeURIComponent(normalizedDraft)}`,
        ).catch(() => null);

        if (!active) {
          return;
        }

        if (!response) {
          setCodeCheckStatus("error");
          return;
        }

        setCodeCheckStatus(response.status === 404 ? "available" : "taken");
      };

      void checkAvailability();
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [codeDraft, isProfileEditorOpen, profileIdentity.profileCode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setState((previous) => syncWeeklyDuoTasks(previous, weekKey));
  }, [isHydrated, weekKey]);

  const fetchFriends = useCallback(async () => {
    if (!isHydrated || !isSignedIn) {
      return;
    }
    const response = await fetch("/api/friends").catch(() => null);
    if (response && response.ok) {
      const data = await response.json();
      setState((previous) => ({
        ...previous,
        friends: data.friends || [],
        friendTasks: data.duoQuest || createEmptyFriendTaskState(weekKey),
      }));
      setIncomingRequests(data.incomingRequests || []);
      setOutgoingRequests(data.outgoingRequests || []);
    }
  }, [isHydrated, isSignedIn, weekKey]);

  useEffect(() => {
    void fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    if (!profileIdentity.profileCode || !pusherClient) {
      return;
    }

    const channelName = `user-profile-${profileIdentity.profileCode}`;
    const channel = pusherClient.subscribe(channelName);
    
    channel.bind("friend-updated", () => {
      void fetchFriends();
    });

    return () => {
      pusherClient?.unsubscribe(channelName);
    };
  }, [profileIdentity.profileCode, fetchFriends]);

  const handleAddFriendFromProfile = async (profile: PublicFriendProfile) => {
    setStatusMessage(`Sending friend request to ${profile.nickname}...`);
    const response = await fetch("/api/friends", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileCode: profile.profileCode }),
    }).catch(() => null);

    if (response && response.ok) {
      const data = (await response.json()) as { status: "pending" | "accepted"; friend: FriendPlayer };
      if (data.status === "accepted") {
        setState((previous) => addFriendToState(previous, data.friend));
        setIncomingRequests((previous) => previous.filter((r) => r.profileCode !== profile.profileCode));
        setStatusMessage(`You are now friends with ${profile.nickname}!`);
      } else {
        setOutgoingRequests((previous) => [...previous, data.friend]);
        setStatusMessage(`Friend request sent to ${profile.nickname}.`);
      }
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to send request.");
    }
  };

  const handleAcceptRequest = async (req: FriendPlayer) => {
    setStatusMessage(`Accepting ${req.name}'s friend request...`);
    const response = await fetch("/api/friends/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileCode: req.profileCode }),
    }).catch(() => null);

    if (response && response.ok) {
      const friendData = (await response.json()) as FriendPlayer;
      setState((previous) => addFriendToState(previous, friendData));
      setIncomingRequests((previous) => previous.filter((r) => r.profileCode !== req.profileCode));
      setStatusMessage(`You are now friends with ${req.name}!`);
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to accept friend request.");
    }
  };

  const handleDeclineRequest = async (req: FriendPlayer) => {
    setStatusMessage(`Declining ${req.name}'s friend request...`);
    const response = await fetch("/api/friends", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileCode: req.profileCode }),
    }).catch(() => null);

    if (response && response.ok) {
      setIncomingRequests((previous) => previous.filter((r) => r.profileCode !== req.profileCode));
      setStatusMessage(`Friend request from ${req.name} was declined.`);
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to decline friend request.");
    }
  };

  const handleRemoveFriend = (friend: FriendPlayer) => {
    setFriendToRemove(friend);
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) {
      return;
    }
    const friend = friendToRemove;
    setFriendToRemove(null);

    setStatusMessage(`Removing ${friend.name} from your friends...`);
    const response = await fetch("/api/friends", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileCode: friend.profileCode }),
    }).catch(() => null);

    if (response && response.ok) {
      setState((previous) => ({
        ...previous,
        friends: previous.friends.filter((f) => f.profileCode !== friend.profileCode),
      }));
      setStatusMessage(`${friend.name} was removed from your friends.`);
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to remove friend.");
    }
  };

  const handleChallengeFriend = (friend: FriendPlayer) => {
    setFriendToChallenge(friend);
    setSelectedChallengeMode("personal");
    setChallengeLearning(learning);
    setChallengeSpeak(speak);
    setChallengeLevel(level as CefrLevel);
  };

  const confirmChallengeFriend = async () => {
    if (!friendToChallenge) {
      return;
    }
    const friend = friendToChallenge;
    setFriendToChallenge(null);

    const speakVal = selectedChallengeMode === "fair" ? challengeSpeak : speak;
    const learningVal = selectedChallengeMode === "fair" ? challengeLearning : learning;
    const levelVal = selectedChallengeMode === "fair" ? challengeLevel : level;

    setStatusMessage(`Challenging ${friend.name} to a Live Duel (${selectedChallengeMode} mode)...`);
    const response = await fetch("/api/friends/duel/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        partnerProfileCode: friend.profileCode,
        language: learningVal,
        nativeLang: speakVal,
        level: levelVal,
        mode: selectedChallengeMode,
      }),
    }).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      router.push(`/games/live-duel?matchId=${data.matchId}`);
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to send duel invite.");
    }
  };

  const handleSelectPartner = async (friend: FriendPlayer) => {
    setStatusMessage(`Teaming up with ${friend.name}...`);
    const response = await fetch("/api/friends/duo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ partnerProfileCode: friend.profileCode }),
    }).catch(() => null);

    if (response && response.ok) {
      setStatusMessage(`You teamed up with ${friend.name} for this week.`);
      void fetchFriends();
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to start duo quest.");
    }
  };

  const handleClearPartner = async () => {
    if (!window.confirm("Are you sure you want to cancel your weekly partnership?")) {
      return;
    }
    setStatusMessage("Clearing partner...");
    const response = await fetch("/api/friends/duo", {
      method: "DELETE",
    }).catch(() => null);

    if (response && response.ok) {
      setStatusMessage("Duo partner cleared. Pick a friend to start again.");
      void fetchFriends();
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to clear partner.");
    }
  };

  const handleToggleTask = async (taskId: string) => {
    if (taskId === "words-task") {
      return;
    }

    const response = await fetch("/api/friends/duo", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ taskId }),
    }).catch(() => null);

    if (response && response.ok) {
      void fetchFriends();
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to toggle task.");
    }
  };

  const handleClaimReward = async () => {
    setStatusMessage("Claiming reward...");
    const response = await fetch("/api/friends/duo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "claim" }),
    }).catch(() => null);

    if (response && response.ok) {
      setStatusMessage(`Nice teamwork! You both earned ${formatXp(WEEKLY_DUO_XP)} XP.`);
      void fetchFriends();
    } else {
      const errData = await response?.json().catch(() => null);
      setStatusMessage(errData?.error ?? "Failed to claim reward.");
    }
  };

  const handleOpenProfileEditor = () => {
    setCodeDraft(profileIdentity.profileCode);
    setCodeCheckStatus("idle");
    setIsProfileEditorOpen(true);
  };

  const handleSaveProfileCode = () => {
    if (codeCheckStatus !== "available") {
      return;
    }

    const normalizedDraft = normalizeStoredProfileCode(codeDraft);
    const previousCode = profileIdentity.profileCode;

    setProfileIdentity((previous) => ({
      ...previous,
      profileCode: normalizedDraft,
      updatedAt: new Date().toISOString(),
    }));
    setCodeCheckStatus("idle");

    if (previousCode && previousCode !== normalizedDraft) {
      void fetch(`/api/friends/profile/${encodeURIComponent(previousCode)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
  };

  const isAlreadyFriend = (profileCode: string) =>
    state.friends.some(
      (friend) =>
        normalizeStoredProfileCode(friend.profileCode ?? "") ===
        normalizeStoredProfileCode(profileCode),
    );

  const isPendingOutgoing = (profileCode: string) =>
    outgoingRequests.some(
      (req) =>
        normalizeStoredProfileCode(req.profileCode ?? "") ===
        normalizeStoredProfileCode(profileCode),
    );

  const isPendingIncoming = (profileCode: string) =>
    incomingRequests.some(
      (req) =>
        normalizeStoredProfileCode(req.profileCode ?? "") ===
        normalizeStoredProfileCode(profileCode),
    );

  return (
    <div className="relative min-h-screen px-4 py-6 text-foreground sm:px-6">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(251,146,120,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.14),transparent_30%),radial-gradient(circle_at_bottom,rgba(253,224,71,0.12),transparent_40%),linear-gradient(to_bottom,rgba(255,248,243,1),rgba(255,241,238,1))] dark:bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.07),transparent_45%),linear-gradient(to_bottom,rgba(11,12,16,1),rgba(8,9,12,1))]" />
      <FeatureGate
        isAllowed={isReady && isSignedIn}
        message={t(
          "authGate.friends",
          "Let your friends see your progress and challenge your streak. Sign in to open Friends.",
        )}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          {/* LEFT: my cozy room */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
            <section className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/80 shadow-[0_24px_60px_-24px_rgba(244,114,182,0.4)] backdrop-blur-xl dark:border-white/[0.14] dark:bg-white/[0.03]">
              <div className="flex flex-col items-center bg-linear-to-b from-rose-100/70 via-amber-50/40 to-transparent px-6 pt-8 pb-6 text-center dark:from-white/[0.05] dark:via-white/[0.02]">
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-[2rem] bg-linear-to-br ${avatarBackground.accent} text-4xl shadow-lg shadow-rose-500/20 ring-4 ring-white/70 dark:ring-white/10`}
                >
                  {profileIdentity.avatarIcon}
                </div>
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-rose-500 dark:bg-white/10 dark:text-rose-300">
                  🏡 my little home
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {profileIdentity.nickname || displayName}
                </h1>
                <button
                  type="button"
                  onClick={handleOpenProfileEditor}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/70 px-4 py-1.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-rose-500/20 dark:bg-white/5 dark:text-rose-300 dark:hover:bg-rose-500/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit look & code
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 px-5 pt-2">
                <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-[0.7rem] font-bold text-rose-400/90 dark:text-rose-300/80">
                    ✏️ Practice XP
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">
                    {formatXp(state.userXp)}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-[0.7rem] font-bold text-amber-500/90 dark:text-amber-300/80">
                    🏆 League
                  </p>
                  <p className="mt-1 truncate text-xl font-black text-slate-800 dark:text-slate-100">
                    {currentLeague.name}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-[0.7rem] font-bold text-sky-500/90 dark:text-sky-300/80">
                    🫶 Friends
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">
                    {state.friends.length}
                  </p>
                </div>
                {/* The learner's level in the language being learned, not a
                    points total — it's the number people actually care about. */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-[0.7rem] font-bold text-emerald-500/90 dark:text-emerald-300/80">
                    🎓 Level
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800 dark:text-slate-100">
                    {learningLevel
                      ? `${learningLevel.level} (${learningLevel.band.band})`
                      : "—"}
                  </p>
                  <p className="truncate text-[0.65rem] font-semibold text-slate-500 dark:text-slate-400">
                    {learningLevel
                      ? `${learningKnownWords ?? learningLevel.masteredCount} words mastered`
                      : levelStatus === "signedOut"
                        ? "Sign in to see it"
                        : levelStatus === "error"
                          ? "Couldn't load it"
                          : "Loading..."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/learned-words")}
                className="mx-5 mt-3 flex w-[calc(100%-2.5rem)] items-center justify-center gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm font-bold text-emerald-600 transition hover:bg-emerald-100/70 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                📚 {t("navbar.learnedWords", "Learned Words")}
              </button>

              <div className="m-5 mt-4 rounded-[1.5rem] border border-white/70 bg-linear-to-br from-rose-50/80 to-amber-50/50 p-4 dark:border-white/10 dark:from-white/[0.04] dark:to-white/[0.02]">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                  👋 Add me
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Unique code
                </p>
                <p className="mt-1 inline-block rounded-xl bg-white/70 px-3 py-1 text-xl font-black tracking-wide text-rose-500 dark:bg-white/5 dark:text-rose-300">
                  {profileIdentity.profileCode || "..."}
                </p>
                <div className="mt-3 rounded-2xl bg-white p-2.5 shadow-sm shadow-rose-500/10 dark:bg-white/5">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Add me QR code"
                      className="w-full rounded-xl border border-rose-100 dark:border-white/10"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-rose-200 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
                      Generating QR...
                    </div>
                  )}
                </div>
                <p className="mt-2 break-all text-[0.7rem] text-slate-400 dark:text-slate-500">
                  {profileUrl}
                </p>
              </div>
            </section>

          </aside>

          {/* RIGHT: quest + friends */}
          <div className="relative flex flex-col gap-8">
            {/* Mascot duo peeking in from above, bottom half tucked behind the cards below */}
            <div className="pointer-events-none absolute -top-12 left-1/2 z-0 flex -translate-x-1/2 items-end justify-center gap-3 sm:-top-16 sm:gap-6">
              <img
                src="/katchup_maskot_original.webp"
                alt="KatchUp Mascot"
                className="h-32 w-32 select-none object-contain sm:h-48 sm:w-48 md:h-56 md:w-56"
              />
              <img
                src="/katchup_mascot.webp"
                alt="Ketchup buddy"
                className="h-32 w-32 select-none object-contain sm:h-44 sm:w-44 md:h-52 md:w-52"
              />
            </div>

            {incomingRequests.length > 0 && (
              <section className="relative z-10 mt-24 rounded-[2.25rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_50px_-24px_rgba(251,146,120,0.4)] backdrop-blur-xl dark:border-white/[0.14] dark:bg-white/[0.03] sm:p-8 sm:mt-34 mb-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    🔔 Friend Requests ({incomingRequests.length})
                  </h3>
                </div>
                <div className="mt-4 space-y-2">
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {req.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          wants to be friends
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeclineRequest(req)}
                          className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/20 hover:text-rose-500 transition"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptRequest(req)}
                          className="rounded-full bg-linear-to-r from-emerald-500 to-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:from-emerald-600 hover:to-teal-700 shadow-md transition"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className={`relative z-10 rounded-[2.25rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_50px_-24px_rgba(56,189,248,0.35)] backdrop-blur-xl dark:border-white/[0.14] dark:bg-white/[0.03] sm:p-8 ${incomingRequests.length > 0 ? "mt-6" : "mt-24 sm:mt-34"}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-4xl font-bold text-slate-900 dark:text-white">
                  My friends
                </h3>
                <span className="rounded-full bg-sky-100/70 px-3 py-1 text-xs font-bold text-sky-500 dark:bg-sky-500/10 dark:text-sky-300">
                  {state.friends.length} total
                </span>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto]">
                <input
                  value={friendSearchTag}
                  onChange={(event) => setFriendSearchTag(event.target.value)}
                  placeholder="Search by tag (example: kuba19, kubafox44)"
                  className="rounded-full border border-sky-100 bg-sky-50/60 px-5 py-3 text-slate-800 outline-none transition focus:border-sky-300 focus:bg-white dark:border-white/[0.14] dark:bg-white/[0.03] dark:text-slate-100 dark:focus:border-sky-500/40 dark:focus:bg-white/6"
                />
                <button
                  type="button"
                  onClick={() => setFriendSearchTag("")}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Clear
                </button>
              </div>

              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {isSearchingFriends ? "Searching..." : searchMessage}
              </p>

              <div className="mt-4 space-y-2">
                {friendSearchResults.map((profile) => {
                  const alreadyAdded = isAlreadyFriend(profile.profileCode);
                  const pendingOutgoing = isPendingOutgoing(profile.profileCode);
                  const pendingIncoming = isPendingIncoming(profile.profileCode);

                  return (
                    <div
                      key={profile.profileCode}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {profile.nickname}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          tag: {profile.profileCode}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/friends/${profile.profileCode}`)
                          }
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          Open profile
                        </button>
                        <button
                          type="button"
                          disabled={alreadyAdded || pendingOutgoing}
                          onClick={() => {
                            if (pendingIncoming) {
                              const req = incomingRequests.find(r => normalizeStoredProfileCode(r.profileCode ?? "") === normalizeStoredProfileCode(profile.profileCode));
                              if (req) handleAcceptRequest(req);
                            } else {
                              handleAddFriendFromProfile(profile);
                            }
                          }}
                          className={`rounded-full px-4 py-1.5 text-xs font-bold transition shadow-sm ${
                            alreadyAdded
                              ? "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500"
                              : pendingOutgoing
                                ? "bg-amber-50 text-amber-500 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
                                : pendingIncoming
                                  ? "bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                                  : "bg-linear-to-r from-sky-400 to-cyan-500 text-white hover:from-sky-500 hover:to-cyan-600"
                          }`}
                        >
                          {alreadyAdded
                            ? "Friends ✓"
                            : pendingOutgoing
                              ? "Requested"
                              : pendingIncoming
                                ? "Accept Request"
                                : "Add friend"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2">
                {state.friends.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    🌱 No friends yet — search a tag above to add your first
                    one.
                  </div>
                ) : (
                  state.friends.map((friend, index) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-black text-sky-500 dark:bg-sky-500/10 dark:text-sky-300">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {friend.name}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Joined {formatTimestamp(friend.joinedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="rounded-full bg-amber-100/70 px-3 py-1 text-sm font-bold text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                          {formatXp(friend.xp)} XP
                        </p>
                        <button
                          onClick={() => handleChallengeFriend(friend)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 transition duration-150"
                          title="Challenge to Duel"
                        >
                          <Swords className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveFriend(friend)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition duration-150"
                          title="Remove Friend"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </section>
            <section className="rounded-[2.25rem] border border-white/70 bg-white/80 p-6 shadow-[0_20px_50px_-24px_rgba(251,146,120,0.4)] backdrop-blur-xl dark:border-white/[0.14] dark:bg-white/[0.03] sm:p-8">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:text-left">
                <div className="max-w-md">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    Friend Quest
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Team up with one friend, tick off this week&apos;s tasks,
                    and you both cozy up{" "}
                    <span className="font-bold text-rose-500 dark:text-rose-300">
                      {formatXp(WEEKLY_DUO_XP)} XP
                    </span>
                    .
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="rounded-full bg-rose-100/70 px-4 py-1.5 text-sm font-bold text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
                    {duoTasks.claimed
                      ? `🎉 ${formatXp(WEEKLY_DUO_XP)} XP earned`
                      : duoPartner
                        ? `${currentWords}/${targetWords} words`
                        : "Pick a partner"}
                  </span>
                  {/* Clock-derived, and the week boundary is computed in the
                      local timezone — so it only renders once mounted, or the
                      server's UTC answer would disagree with the browser's. */}
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {isMounted
                      ? `resets in ${weeklyRemaining.days}d ${weeklyRemaining.hours}h`
                      : "resets soon"}
                  </span>
                </div>
              </div>

              {!duoPartner ? (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Who&apos;s your buddy this week?
                  </p>
                  {state.friends.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 p-6 text-center text-sm text-slate-500 dark:border-rose-500/20 dark:bg-rose-500/[0.04] dark:text-slate-400">
                      Add a friend below first, then pick them here to start
                      your weekly duo.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {state.friends.map((friend) => (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => handleSelectPartner(friend)}
                          className="group flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-rose-500/30 dark:hover:bg-rose-500/[0.08]"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {friend.name}
                          </span>
                          <span className="rounded-full bg-linear-to-r from-rose-400 to-amber-400 px-3 py-1 text-xs font-bold text-white shadow-sm">
                            Choose
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-linear-to-r from-rose-50/80 to-amber-50/50 px-4 py-3 dark:border-white/10 dark:from-white/[0.05] dark:to-white/[0.02]">
                    <div>
                      <p className="text-xs font-bold text-rose-400 dark:text-rose-300/80">
                        🤝 Buddy this week
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-800 dark:text-slate-100">
                        {duoTasks.partnerName ?? duoPartner.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPartner}
                      className="rounded-full border border-rose-200 bg-white/60 px-3 py-1.5 text-xs font-semibold text-rose-500 transition hover:bg-white dark:border-rose-500/20 dark:bg-white/5 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      Change buddy
                    </button>
                  </div>

                  <div className="rounded-3xl border border-rose-100 bg-white/60 p-5 shadow-xs dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                          Learn {targetWords} words together
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Weekly progress: {currentWords} of {targetWords} words learned
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 w-fit px-3 py-1 items-center justify-center rounded-full text-xs font-bold transition ${
                          isQuestDone
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                        }`}
                      >
                        {isQuestDone ? "Completed! 🎉" : "In Progress"}
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-1.5">
                        <span>Progress</span>
                        <span>{wordPercentage}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-rose-100 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-rose-400 via-amber-400 to-emerald-400 transition-all"
                          style={{ width: `${wordPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClaimReward}
                    disabled={!isQuestDone || duoTasks.claimed}
                    className="w-full rounded-2xl bg-linear-to-r from-rose-400 to-amber-400 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-white/10 dark:disabled:to-white/10 dark:disabled:text-slate-500"
                  >
                    {duoTasks.claimed
                      ? `🎉 Claimed ${formatXp(WEEKLY_DUO_XP)} XP`
                      : isQuestDone
                        ? `Claim ${formatXp(WEEKLY_DUO_XP)} XP together 💞`
                        : `Learn ${targetWords} words to claim ${formatXp(WEEKLY_DUO_XP)} XP`}
                  </button>
                </div>
              )}

              {state.friends.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                  {statusMessage}
                </div>
              ) : (
                <div></div>
              )}
            </section>
          </div>
        </div>
      </FeatureGate>

      {friendToRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[2.25rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1c141a] sm:p-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white text-center">
              Are you sure?
            </h3>
            <p className="mt-3 text-center text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Removing <span className="font-bold text-slate-800 dark:text-slate-100">{friendToRemove.name}</span> will dissolve your mutual friendship. You won&apos;t see each other on your leaderboards or be able to start duo quests until you add each other back.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setFriendToRemove(null)}
                className="w-full sm:w-auto rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveFriend}
                className="w-full sm:w-auto rounded-full bg-linear-to-r from-rose-500 to-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:from-rose-600 hover:to-red-700 shadow-md transition"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {friendToChallenge ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[2.25rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1c141a] sm:p-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white text-center">
              Challenge {friendToChallenge.name}
            </h3>
            <p className="mt-3 text-center text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              Select the mode for this Friendly Battle:
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setSelectedChallengeMode("personal")}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  selectedChallengeMode === "personal"
                    ? "border-sky-500 bg-sky-50/50 dark:border-sky-500/50 dark:bg-sky-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                }`}
              >
                <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedChallengeMode === "personal" ? "border-sky-500" : "border-slate-300 dark:border-slate-700"
                }`}>
                  {selectedChallengeMode === "personal" && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Personalized Mode</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Each player answers customized words based on their own learning history.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChallengeMode("fair")}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  selectedChallengeMode === "fair"
                    ? "border-sky-500 bg-sky-50/50 dark:border-sky-500/50 dark:bg-sky-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                }`}
              >
                <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedChallengeMode === "fair" ? "border-sky-500" : "border-slate-300 dark:border-slate-700"
                }`}>
                  {selectedChallengeMode === "fair" && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Fair Mode</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Both players answer the exact same words from a generic pool ({LANG_LABELS[challengeSpeak] || challengeSpeak} to {LANG_LABELS[challengeLearning] || challengeLearning}).</p>
                </div>
              </button>

              {selectedChallengeMode === "fair" && (
                <div className="p-4 rounded-2xl border border-slate-150 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                        I Speak
                      </label>
                      <select
                        value={challengeSpeak}
                        onChange={(e) => setChallengeSpeak(e.target.value as Lang)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {LANGS.map((lang) => (
                          <option key={lang} value={lang}>
                            {LANG_FLAGS[lang]} {LANG_LABELS[lang]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                        Learning
                      </label>
                      <select
                        value={challengeLearning}
                        onChange={(e) => setChallengeLearning(e.target.value as Lang)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {LANGS.map((lang) => (
                          <option key={lang} value={lang}>
                            {LANG_FLAGS[lang]} {LANG_LABELS[lang]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                        Difficulty Level
                      </label>
                      <select
                        value={challengeLevel}
                        onChange={(e) => setChallengeLevel(e.target.value as CefrLevel)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {CEFR_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {challengeSpeak === challengeLearning && (
                    <p className="text-[11px] font-semibold text-rose-500">
                      ⚠️ Speak and learning languages must be different!
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setFriendToChallenge(null)}
                className="w-full sm:w-auto rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmChallengeFriend}
                disabled={selectedChallengeMode === "fair" && challengeSpeak === challengeLearning}
                className="w-full sm:w-auto rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 shadow-md transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                Challenge ⚔️
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isProfileEditorOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-4 pt-24 pb-8 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-8rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-[2.25rem] border border-white/70 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1c141a] sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white">
                🎨 Make it yours
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(false)}
                className="rounded-full border border-rose-200 px-4 py-1.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Display name
              </label>
              <input
                value={profileIdentity.nickname}
                onChange={(event) =>
                  setProfileIdentity((previous) => ({
                    ...previous,
                    nickname: event.target.value,
                    updatedAt: new Date().toISOString(),
                  }))
                }
                placeholder={displayName}
                maxLength={24}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                This is the name your friends see. It defaults to your first
                name — change it to whatever you like.
              </p>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Background
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AVATAR_BACKGROUNDS.map((background) => {
                    const active =
                      background.id === profileIdentity.avatarBackgroundId;

                    return (
                      <button
                        key={background.id}
                        type="button"
                        onClick={() =>
                          setProfileIdentity((previous) => ({
                            ...previous,
                            avatarBackgroundId: background.id,
                            updatedAt: new Date().toISOString(),
                          }))
                        }
                        className={`rounded-xl border p-2 text-left transition ${
                          active
                            ? "border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10"
                            : "border-slate-200 bg-white hover:border-rose-200 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
                        }`}
                      >
                        <div
                          className={`h-6 rounded-lg bg-linear-to-r ${background.accent}`}
                        />
                        <p className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {background.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Cute icon
                </p>
                <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-r ${avatarBackground.accent} text-base font-bold text-white shadow-lg`}
                  >
                    {profileIdentity.avatarIcon}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setProfileIdentity((previous) => ({
                        ...previous,
                        avatarIcon: randomCuteIcon(),
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                    className="mt-4 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    Generate cute icon
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CUTE_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() =>
                          setProfileIdentity((previous) => ({
                            ...previous,
                            avatarIcon: icon,
                            updatedAt: new Date().toISOString(),
                          }))
                        }
                        className="rounded-xl border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Profile code
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  value={codeDraft}
                  onChange={(event) =>
                    setCodeDraft(normalizeStoredProfileCode(event.target.value))
                  }
                  placeholder="yourtag19"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={codeCheckStatus !== "available"}
                  onClick={handleSaveProfileCode}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Save code
                </button>
              </div>
              {codeCheckStatus !== "idle" && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    codeCheckStatus === "available"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : codeCheckStatus === "checking"
                        ? "text-slate-500 dark:text-slate-400"
                        : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {codeCheckStatus === "checking" && "Checking availability..."}
                  {codeCheckStatus === "available" && "Available - you can save it."}
                  {codeCheckStatus === "taken" &&
                    "Someone already has this code."}
                  {codeCheckStatus === "too-short" &&
                    "Use at least 3 characters."}
                  {codeCheckStatus === "error" &&
                    "Couldn't check right now - try again."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
