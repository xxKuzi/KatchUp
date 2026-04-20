"use client";

import FeatureGate from "@/app/_components/FeatureGate";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import QRCode from "qrcode";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addFriendToState,
  buildWeeklyTeamSnapshot,
  createInitialFriendsLeagueState,
  formatTimestamp,
  getCycleTimeRemaining,
  getFourDayCycleKey,
  getCurrentLeague,
  parseFriendsLeagueState,
  resolveWeeklyLeagueFight,
  type FriendsLeagueState,
  type TeamMember,
} from "./_lib/league";
import {
  AVATAR_BACKGROUNDS,
  CUTE_ICONS,
  buildProfileUrl,
  createInitialFriendProfileIdentity,
  createPublicFriendProfile,
  createReadableProfileCode,
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

function TeamCard({
  title,
  members,
}: {
  title: string;
  members: TeamMember[];
}) {
  const totalXp = members.reduce((sum, member) => sum + member.xp, 0);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {formatXp(totalXp)} XP
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/70"
          >
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {member.name}
            </p>
            <p className="text-slate-500 dark:text-slate-300">
              {formatXp(member.xp)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const { isSignedIn, isReady, session } = useAuthState();
  const { t } = useLanguage();
  const userKey = session?.user?.email ?? session?.user?.name ?? "player";
  const displayName = session?.user?.name ?? "You";
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
    "4-day cycles decide promotion.",
  );
  const [profileIdentity, setProfileIdentity] = useState<FriendProfileIdentity>(
    () => createInitialFriendProfileIdentity(displayName),
  );
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileUrl, setProfileUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

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
  const cycleKey = getFourDayCycleKey(now);
  const cycleRemaining = getCycleTimeRemaining(now);
  const snapshot = useMemo(
    () => buildWeeklyTeamSnapshot(state, cycleKey, profileIdentity.profileCode),
    [cycleKey, profileIdentity.profileCode, state],
  );
  const yourTeamXp = snapshot.yourTeam.reduce(
    (sum, member) => sum + member.xp,
    0,
  );
  const rivalTeamXp = snapshot.rivalTeam.reduce(
    (sum, member) => sum + member.xp,
    0,
  );
  const cyclePlayed = state.matchHistory.some(
    (match) => match.weekKey === cycleKey,
  );
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
        matchesPlayed: state.matchHistory.length,
      }),
    [
      currentLeague.name,
      profileIdentity,
      state.friends.length,
      state.matchHistory.length,
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
    if (!isHydrated || !profileHydrated) {
      return;
    }

    if (state.matchHistory.some((match) => match.weekKey === cycleKey)) {
      return;
    }

    const result = resolveWeeklyLeagueFight(
      state,
      profileIdentity.profileCode,
      now,
    );
    setState(result.nextState);
    setStatusMessage(result.message);
  }, [
    cycleKey,
    isHydrated,
    now,
    profileHydrated,
    profileIdentity.profileCode,
    state,
  ]);

  const handleAddFriendFromProfile = (profile: PublicFriendProfile) => {
    setState((previous) =>
      addFriendToState(previous, friendFromPublicProfile(profile)),
    );
    setStatusMessage(`${profile.nickname} was added to your friends.`);
  };

  const isAlreadyFriend = (profileCode: string) =>
    state.friends.some(
      (friend) =>
        normalizeStoredProfileCode(friend.profileCode ?? "") ===
        normalizeStoredProfileCode(profileCode),
    );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(to_bottom,rgba(248,250,252,1),rgba(241,245,249,1))] px-4 py-8 text-foreground sm:px-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_26%),linear-gradient(to_bottom,rgba(15,23,42,1),rgba(2,6,23,1))]">
      <FeatureGate
        isAllowed={isReady && isSignedIn}
        message={t(
          "authGate.friends",
          "Let your friends see your progress and challenge your streak. Sign in to open Friends.",
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <section className="rounded-4xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-950/10 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-black/30 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-r ${avatarBackground.accent} text-base font-bold text-white shadow-lg`}
                >
                  {profileIdentity.avatarIcon}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Me
                  </p>
                  <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
                    {profileIdentity.nickname || displayName}
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Edit profile picture
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  XP from practice
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {formatXp(state.userXp)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Current league
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {currentLeague.name}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Friends
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {state.friends.length}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Weekly fights
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {state.matchHistory.length}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Add me
              </p>
              <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_220px]">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Unique code
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {profileIdentity.profileCode}
                  </p>
                  <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
                    {profileUrl}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-950">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Add me QR code"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Generating QR...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-4xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-950/10 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-black/30 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                Add friends
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {state.friends.length} total
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={friendSearchTag}
                onChange={(event) => setFriendSearchTag(event.target.value)}
                placeholder="Search by tag (example: kuba19, kubafox44)"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setFriendSearchTag("")}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {isSearchingFriends ? "Searching..." : searchMessage}
            </p>

            <div className="mt-4 space-y-2">
              {friendSearchResults.map((profile) => {
                const alreadyAdded = isAlreadyFriend(profile.profileCode);

                return (
                  <div
                    key={profile.profileCode}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {profile.nickname}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        tag: {profile.profileCode}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/friends/${profile.profileCode}`)
                        }
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Open profile
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddFriendFromProfile(profile)}
                        disabled={alreadyAdded}
                        className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                      >
                        {alreadyAdded ? "Added" : "Add friend"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2">
              {state.friends.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No friends yet.
                </div>
              ) : (
                state.friends.map((friend, index) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {index + 1}. {friend.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Joined {formatTimestamp(friend.joinedAt)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {formatXp(friend.xp)} XP
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-4xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-950/10 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-black/30 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                  Team battle
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  You get 3 random teammates from your current league. Results
                  are auto-completed every 4 days.
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Next cycle in {cycleRemaining.days}d {cycleRemaining.hours}h
                </p>
              </div>
              <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                {cyclePlayed ? "Cycle completed" : "Cycle in progress"}
              </span>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <TeamCard title="Your team" members={snapshot.yourTeam} />
              <TeamCard title="Opponent team" members={snapshot.rivalTeam} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              <p>
                Team score: {formatXp(yourTeamXp)} vs {formatXp(rivalTeamXp)}
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                {statusMessage}
              </p>
            </div>
          </section>
        </div>
      </FeatureGate>

      {isProfileEditorOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-4xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl font-black text-slate-950 dark:text-white">
                Edit profile picture
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(false)}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Background
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                        className={`rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/60"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
                        }`}
                      >
                        <div
                          className={`h-10 rounded-xl bg-linear-to-r ${background.accent}`}
                        />
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
                  value={profileIdentity.profileCode}
                  onChange={(event) =>
                    setProfileIdentity((previous) => ({
                      ...previous,
                      profileCode:
                        normalizeStoredProfileCode(event.target.value) ||
                        createReadableProfileCode(previous.nickname),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  placeholder="yourtag19"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() =>
                    setProfileIdentity((previous) => ({
                      ...previous,
                      profileCode: createReadableProfileCode(previous.nickname),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Refresh code
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
