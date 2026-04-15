"use client";

import FeatureGate from "@/app/_components/FeatureGate";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import {
  LEAGUE_TIERS,
  addFriendToState,
  awardXpToState,
  buildTeamSnapshot,
  createInitialFriendsLeagueState,
  formatTimestamp,
  getLeagueIndex,
  getLeagueProgress,
  getLeagueTier,
  getNextLeagueTier,
  parseFriendsLeagueState,
  resolveLeagueRound,
  type FriendsLeagueState,
  type TeamMember,
} from "./_lib/league";
import {
  buildProfileUrl,
  createInitialFriendProfileIdentity,
  createPublicFriendProfile,
  getNextProfileAvatarIndex,
  getProfileAvatar,
  profileStorageKey,
  parseStoredFriendProfileIdentity,
  type FriendProfileIdentity,
} from "./_lib/profile";

const STORAGE_KEY_PREFIX = "katchup-friends-league-v1";

const TRAINING_TASKS = [
  { label: "Complete a vocab sprint", xp: 40 },
  { label: "Win a live match", xp: 70 },
  { label: "Finish a deck review", xp: 55 },
  { label: "Invite a friend", xp: 30 },
] as const;

function storageKey(userKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${userKey}`;
}

function formatXp(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatLeagueLabel(index: number): string {
  return `League ${index + 1}`;
}

function formatRoleLabel(role: TeamMember["role"]): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const AVATAR_CHOICES = Array.from({ length: 8 }, (_, index) => ({
  index,
  ...getProfileAvatar(index),
}));

function TeamCard({
  title,
  subtitle,
  members,
  accent,
}: {
  title: string;
  subtitle: string;
  members: TeamMember[];
  accent: string;
}) {
  const totalXp = members.reduce((sum, member) => sum + member.xp, 0);

  return (
    <article className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-black/5 dark:border-slate-800 dark:bg-slate-950/80">
      <div className={`mb-4 h-1.5 rounded-full bg-linear-to-r ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Total XP
          </p>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100">
            {formatXp(totalXp)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {member.name}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {formatRoleLabel(member.role)}
              </p>
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {formatXp(member.xp)} XP
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function FriendsPage() {
  const { isSignedIn, isReady, session } = useAuthState();
  const { t } = useLanguage();
  const userKey = session?.user?.email ?? session?.user?.name ?? "player";
  const displayName = session?.user?.name ?? "You";
  const [state, setState] = useState<FriendsLeagueState>(() =>
    createInitialFriendsLeagueState(displayName),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendXp, setFriendXp] = useState("180");
  const [statusMessage, setStatusMessage] = useState(
    "Recruit three friends, build a 4-player squad, and beat the rival team.",
  );
  const [profileIdentity, setProfileIdentity] = useState<FriendProfileIdentity>(
    () => createInitialFriendProfileIdentity(displayName),
  );
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileUrl, setProfileUrl] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [profileSyncStatus, setProfileSyncStatus] = useState(
    "Profile will sync after sign in.",
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
    if (!profileHydrated || !profileIdentity.profileCode) {
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
        width: 320,
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

  const leagueIndex = getLeagueIndex(state.userXp);
  const currentLeague = getLeagueTier(state.userXp);
  const nextLeague = getNextLeagueTier(state.userXp);
  const leagueProgress = getLeagueProgress(state.userXp);
  const snapshot = useMemo(() => buildTeamSnapshot(state), [state]);
  const currentPublicProfile = useMemo(
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
        try {
          const response = await fetch(
            `/api/friends/profile/${profileIdentity.profileCode}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(currentPublicProfile),
            },
          );

          if (response.ok) {
            setProfileSyncStatus("Profile synced and ready to share.");
            return;
          }

          setProfileSyncStatus("Profile saved locally. Sync will retry later.");
        } catch {
          setProfileSyncStatus("Profile saved locally. Sync will retry later.");
        }
      };

      void syncProfile();
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [
    currentPublicProfile,
    isSignedIn,
    profileHydrated,
    profileIdentity.profileCode,
  ]);

  const yourTeamXp = snapshot.yourTeam.reduce(
    (sum, member) => sum + member.xp,
    0,
  );
  const rivalTeamXp = snapshot.rivalTeam.reduce(
    (sum, member) => sum + member.xp,
    0,
  );
  const xpGap = yourTeamXp - rivalTeamXp;
  const leaderboardEntries = useMemo(
    () =>
      [
        { id: "you", name: state.userName, xp: state.userXp, badge: "You" },
        ...state.friends.map((friend) => ({
          id: friend.id,
          name: friend.name,
          xp: friend.xp,
          badge: "Friend",
        })),
      ].sort((left, right) => right.xp - left.xp),
    [state.friends, state.userName, state.userXp],
  );

  const handleSelectAvatar = (avatarIndex: number) => {
    setProfileIdentity((previous) => ({
      ...previous,
      avatarIndex,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRandomizeAvatar = () => {
    setProfileIdentity((previous) => ({
      ...previous,
      avatarIndex: Math.floor(Math.random() * AVATAR_CHOICES.length),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleAddFriend = () => {
    const parsedXp = Number(friendXp);

    setState((previous) =>
      addFriendToState(previous, {
        name: friendName,
        xp: Number.isFinite(parsedXp) ? parsedXp : 0,
      }),
    );
    setFriendName("");
    setFriendXp("180");
    setStatusMessage("Friend added. The squad list updated immediately.");
  };

  const handleTrainingTask = (xp: number, label: string) => {
    setState((previous) => awardXpToState(previous, xp));
    setStatusMessage(`${label} completed. +${xp} XP for your profile.`);
  };

  const handlePlayRound = () => {
    const round = resolveLeagueRound(state);
    setState(round.nextState);
    setStatusMessage(round.message);
  };

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Me
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                  Your profile, code, and scan link
                </h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {profileSyncStatus}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-r ${getProfileAvatar(profileIdentity.avatarIndex).accent} text-3xl font-black text-white shadow-lg`}
                  >
                    {getProfileAvatar(profileIdentity.avatarIndex).glyph}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Nickname
                      </p>
                      <input
                        value={profileIdentity.nickname}
                        onChange={(event) =>
                          setProfileIdentity((previous) => ({
                            ...previous,
                            nickname: event.target.value,
                            updatedAt: new Date().toISOString(),
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        placeholder={displayName}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRandomizeAvatar}
                        className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      >
                        Random avatar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectAvatar(
                            getNextProfileAvatarIndex(
                              profileIdentity.avatarIndex,
                            ),
                          )
                        }
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Next combo
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {AVATAR_CHOICES.map((avatarChoice) => {
                    const isActive =
                      avatarChoice.index === profileIdentity.avatarIndex;

                    return (
                      <button
                        key={avatarChoice.index}
                        type="button"
                        onClick={() => handleSelectAvatar(avatarChoice.index)}
                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                          isActive
                            ? "border-sky-300 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-sky-950/70"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-slate-700"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-r ${avatarChoice.accent} text-sm font-black text-white`}
                        >
                          {avatarChoice.glyph}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {avatarChoice.label}
                          </p>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            {isActive ? "Selected" : "Choose"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Profile code
                    </p>
                    <p className="mt-2 text-xl font-black tracking-[0.18em] text-slate-900 dark:text-slate-100">
                      {profileIdentity.profileCode}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Mascot
                    </p>
                    <p className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">
                      {getProfileAvatar(profileIdentity.avatarIndex).label}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Shared link
                    </p>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {profileUrl || "Generating..."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      QR code
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                      Scan to open your profile
                    </h3>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-950">
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="Profile QR code"
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Generating QR code...
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      XP
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      {formatXp(currentPublicProfile.currentXp)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      League
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      {currentPublicProfile.leagueName}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Friends
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      {currentPublicProfile.friendsCount}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Matches
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      {currentPublicProfile.matchesPlayed}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="first-section-static-glow overflow-hidden rounded-4xl border border-white/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
            <div className="grid gap-0 lg:grid-cols-[1.25fr_0.85fr]">
              <div className="p-7 sm:p-10">
                <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-bold uppercase tracking-[0.22em] text-sky-700 dark:border-sky-900 dark:bg-sky-950/70 dark:text-sky-300">
                  Friends League
                </p>
                <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-6xl">
                  Recruit a squad of four, win the XP race, and climb all five
                  leagues.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                  Add friends, build your 4-player team, and keep beating the
                  rival squad. Each win pushes your XP higher and promotes you
                  into the next league tier.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Current league
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      {currentLeague.name}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Your XP
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                      {formatXp(state.userXp)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Team gap
                    </p>
                    <p
                      className={`mt-2 text-2xl font-black ${
                        xpGap >= 0
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {xpGap >= 0 ? "+" : ""}
                      {formatXp(xpGap)}
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Promotion progress
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                        {currentLeague.name}
                        {nextLeague
                          ? ` -> ${nextLeague.name}`
                          : " - Max league"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePlayRound}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                    >
                      Run league round
                    </button>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full bg-linear-to-r ${currentLeague.accent} transition-all duration-500`}
                      style={{
                        width: `${Math.round(leagueProgress.progress * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{formatXp(leagueProgress.current)} XP</span>
                    <span>
                      {nextLeague
                        ? `${formatXp(leagueProgress.next)} XP to ${nextLeague.name}`
                        : "League capped"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/80 p-7 dark:border-slate-800 dark:bg-slate-900/80 sm:p-10 lg:border-l lg:border-t-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  League ladder
                </p>
                <div className="mt-4 space-y-3">
                  {LEAGUE_TIERS.map((tier, index) => {
                    const isActive = index === leagueIndex;
                    const isDone = index < leagueIndex;

                    return (
                      <div
                        key={tier.name}
                        className={`rounded-3xl border p-4 transition ${
                          isActive
                            ? "border-sky-300 bg-sky-50 shadow-md dark:border-sky-700 dark:bg-sky-950/70"
                            : isDone
                              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/60"
                              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {formatLeagueLabel(index)}
                            </p>
                            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                              {tier.name}
                            </h3>
                          </div>
                          <div
                            className={`h-3 w-20 rounded-full bg-linear-to-r ${tier.accent}`}
                          />
                        </div>
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          {isActive
                            ? "This is your current division. Beat the opposing team to move up."
                            : isDone
                              ? "League cleared."
                              : `Reach ${formatXp(tier.minXp)} XP to unlock this league.`}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                  4 players per team. Your squad uses your highest-XP friends
                  first, then fills any empty slots with league bots.
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-6 shadow-lg shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Add friends
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                    Build your squad
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {state.friends.length} friends
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                <input
                  value={friendName}
                  onChange={(event) => setFriendName(event.target.value)}
                  placeholder="Friend name"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  value={friendXp}
                  onChange={(event) => setFriendXp(event.target.value)}
                  inputMode="numeric"
                  placeholder="Starting XP"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={handleAddFriend}
                className="mt-3 inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                Add friend
              </button>

              <div className="mt-6 space-y-3">
                {state.friends.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No friends yet. Add a few names and fill the first squad.
                  </div>
                ) : (
                  state.friends.map((friend, index) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
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

            <section className="rounded-4xl border border-slate-200/80 bg-white/90 p-6 shadow-lg shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Squad showdown
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                    Your 4-player team versus the rival team
                  </h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {statusMessage}
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <TeamCard
                  title="Your team"
                  subtitle="Your XP plus your top friends"
                  members={snapshot.yourTeam}
                  accent="from-sky-400 to-cyan-500"
                />
                <TeamCard
                  title="Rival team"
                  subtitle="Opponents scale with your current league"
                  members={snapshot.rivalTeam}
                  accent="from-rose-400 to-orange-500"
                />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TRAINING_TASKS.map((task) => (
                  <button
                    key={task.label}
                    type="button"
                    onClick={() => handleTrainingTask(task.xp, task.label)}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      XP task
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                      {task.label}
                    </p>
                    <p className="mt-2 text-sm font-bold text-emerald-600 dark:text-emerald-300">
                      +{task.xp} XP
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    League leaderboard
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Top XP across your circle
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {leaderboardEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-950"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {index + 1}. {entry.name}
                        </p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {entry.badge}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatXp(entry.xp)} XP
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                Winning a round adds XP to your profile. Once your total crosses
                the next league threshold, you automatically move up to the next
                tier.
              </div>
            </section>
          </div>
        </div>
      </FeatureGate>
    </div>
  );
}
