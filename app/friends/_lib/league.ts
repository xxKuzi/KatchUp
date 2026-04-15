export const LEAGUE_TIERS = [
  { name: "Bronze", minXp: 0, accent: "from-amber-400 to-orange-500" },
  { name: "Silver", minXp: 300, accent: "from-slate-300 to-slate-500" },
  { name: "Gold", minXp: 700, accent: "from-yellow-400 to-amber-500" },
  { name: "Platinum", minXp: 1200, accent: "from-cyan-400 to-blue-500" },
  { name: "Diamond", minXp: 1800, accent: "from-fuchsia-400 to-violet-500" },
] as const;

export const RIVAL_NAMES = [
  "Nova",
  "Atlas",
  "Mika",
  "Orion",
  "Lyra",
  "Jett",
  "Sage",
  "Zara",
  "Kian",
  "Vera",
  "Nico",
  "Elsa",
];

export interface FriendPlayer {
  id: string;
  name: string;
  xp: number;
  joinedAt: string;
  profileCode?: string;
  avatarIndex?: number;
}

export interface LeagueMatchRecord {
  id: string;
  result: "win" | "loss";
  yourTeamXp: number;
  rivalTeamXp: number;
  xpAwarded: number;
  playedAt: string;
}

export interface FriendsLeagueState {
  userName: string;
  userXp: number;
  friends: FriendPlayer[];
  matchHistory: LeagueMatchRecord[];
}

export interface TeamMember {
  id: string;
  name: string;
  xp: number;
  role: "you" | "friend" | "bot" | "rival";
}

export interface TeamSnapshot {
  yourTeam: TeamMember[];
  rivalTeam: TeamMember[];
}

export interface LeagueRoundResult {
  nextState: FriendsLeagueState;
  result: "win" | "loss";
  yourTeamXp: number;
  rivalTeamXp: number;
  xpAwarded: number;
  message: string;
}

export interface FriendSeed {
  name: string;
  xp: number;
  profileCode?: string;
  avatarIndex?: number;
}

const BOT_NAMES = ["Milo", "Tara", "Pax", "Luna", "Noa", "Rin", "Ona", "Ivo"];

function clampXp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createBotName(index: number): string {
  return BOT_NAMES[index % BOT_NAMES.length];
}

export function getLeagueIndex(xp: number): number {
  for (let index = LEAGUE_TIERS.length - 1; index >= 0; index -= 1) {
    if (xp >= LEAGUE_TIERS[index].minXp) {
      return index;
    }
  }

  return 0;
}

export function getLeagueTier(xp: number) {
  return LEAGUE_TIERS[getLeagueIndex(xp)];
}

export function getNextLeagueTier(xp: number) {
  const currentIndex = getLeagueIndex(xp);
  return LEAGUE_TIERS[currentIndex + 1] ?? null;
}

export function getLeagueProgress(xp: number): {
  current: number;
  next: number;
  progress: number;
} {
  const currentIndex = getLeagueIndex(xp);
  const current = LEAGUE_TIERS[currentIndex];
  const next = LEAGUE_TIERS[currentIndex + 1];

  if (!next) {
    return { current: current.minXp, next: current.minXp, progress: 1 };
  }

  const progress = (xp - current.minXp) / (next.minXp - current.minXp);

  return {
    current: current.minXp,
    next: next.minXp,
    progress: Math.min(1, Math.max(0, progress)),
  };
}

export function createInitialFriendsLeagueState(
  userName: string,
): FriendsLeagueState {
  return {
    userName: userName.trim() || "You",
    userXp: 220,
    friends: [],
    matchHistory: [],
  };
}

export function parseFriendsLeagueState(
  rawState: string | null,
  fallbackUserName: string,
): FriendsLeagueState | null {
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as Partial<FriendsLeagueState>;

    if (
      typeof parsed.userName !== "string" ||
      typeof parsed.userXp !== "number" ||
      !Array.isArray(parsed.friends) ||
      !Array.isArray(parsed.matchHistory)
    ) {
      return null;
    }

    const friends = parsed.friends
      .filter(
        (friend): friend is FriendPlayer =>
          Boolean(friend) &&
          typeof friend.id === "string" &&
          typeof friend.name === "string" &&
          typeof friend.xp === "number" &&
          typeof friend.joinedAt === "string",
      )
      .map((friend) => ({
        id: friend.id,
        name: friend.name,
        xp: clampXp(friend.xp),
        joinedAt: friend.joinedAt,
        profileCode:
          typeof friend.profileCode === "string"
            ? friend.profileCode
            : undefined,
        avatarIndex:
          typeof friend.avatarIndex === "number"
            ? friend.avatarIndex
            : undefined,
      }));

    const matchHistory = parsed.matchHistory
      .filter(
        (record): record is LeagueMatchRecord =>
          Boolean(record) &&
          typeof record.id === "string" &&
          (record.result === "win" || record.result === "loss") &&
          typeof record.yourTeamXp === "number" &&
          typeof record.rivalTeamXp === "number" &&
          typeof record.xpAwarded === "number" &&
          typeof record.playedAt === "string",
      )
      .map((record) => ({
        id: record.id,
        result: record.result,
        yourTeamXp: clampXp(record.yourTeamXp),
        rivalTeamXp: clampXp(record.rivalTeamXp),
        xpAwarded: clampXp(record.xpAwarded),
        playedAt: record.playedAt,
      }));

    return {
      userName: parsed.userName.trim() || fallbackUserName,
      userXp: clampXp(parsed.userXp),
      friends,
      matchHistory,
    };
  } catch {
    return null;
  }
}

export function addFriendToState(
  state: FriendsLeagueState,
  friend: FriendSeed,
): FriendsLeagueState {
  const normalizedName = friend.name.trim();

  if (!normalizedName) {
    return state;
  }

  const exists = state.friends.some(
    (existing) =>
      (friend.profileCode && existing.profileCode === friend.profileCode) ||
      existing.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );

  if (exists) {
    return state;
  }

  return {
    ...state,
    friends: [
      {
        id: createId("friend"),
        name: normalizedName,
        xp: clampXp(friend.xp),
        joinedAt: new Date().toISOString(),
        profileCode: friend.profileCode,
        avatarIndex: friend.avatarIndex,
      },
      ...state.friends,
    ],
  };
}

export function awardXpToState(
  state: FriendsLeagueState,
  amount: number,
): FriendsLeagueState {
  return {
    ...state,
    userXp: clampXp(state.userXp + amount),
  };
}

export function buildTeamSnapshot(state: FriendsLeagueState): TeamSnapshot {
  const rankedFriends = [...state.friends].sort(
    (left, right) => right.xp - left.xp,
  );
  const yourTeam: TeamMember[] = [
    { id: "you", name: state.userName, xp: state.userXp, role: "you" },
    ...rankedFriends.slice(0, 3).map((friend) => ({
      id: friend.id,
      name: friend.name,
      xp: friend.xp,
      role: "friend" as const,
    })),
  ];

  while (yourTeam.length < 4) {
    const index = yourTeam.length - 1;
    yourTeam.push({
      id: createId(`bot-${index}`),
      name: createBotName(index),
      xp: 80 + state.userXp / 5 + index * 25,
      role: "bot",
    });
  }

  const leagueIndex = getLeagueIndex(state.userXp);
  const league = LEAGUE_TIERS[leagueIndex];
  const rivalTotal = Math.max(
    240,
    Math.round(league.minXp + 180 + state.friends.length * 28),
  );
  const rivalWeights = [0.28, 0.26, 0.24, 0.22];
  const rivalNames = RIVAL_NAMES.slice(leagueIndex, leagueIndex + 4);

  const rivalTeam: TeamMember[] = rivalNames.map((name, index) => ({
    id: createId(`rival-${index}`),
    name,
    xp: clampXp(Math.round(rivalTotal * rivalWeights[index]) + index * 14),
    role: "rival",
  }));

  return {
    yourTeam,
    rivalTeam,
  };
}

function sumTeamXp(team: TeamMember[]): number {
  return team.reduce((total, member) => total + member.xp, 0);
}

export function resolveLeagueRound(
  state: FriendsLeagueState,
): LeagueRoundResult {
  const snapshot = buildTeamSnapshot(state);
  const yourTeamXp = sumTeamXp(snapshot.yourTeam);
  const rivalTeamXp = sumTeamXp(snapshot.rivalTeam);
  const diff = yourTeamXp - rivalTeamXp;
  const result = diff >= 0 ? "win" : "loss";
  const xpAwarded =
    result === "win"
      ? 85 + Math.max(15, Math.round(diff / 4))
      : 25 + Math.max(0, Math.round((state.userXp % 70) / 10));

  const nextState: FriendsLeagueState = {
    ...state,
    userXp: clampXp(state.userXp + xpAwarded),
    matchHistory: [
      {
        id: createId("match"),
        result,
        yourTeamXp,
        rivalTeamXp,
        xpAwarded,
        playedAt: new Date().toISOString(),
      },
      ...state.matchHistory,
    ].slice(0, 8),
  };

  return {
    nextState,
    result,
    yourTeamXp,
    rivalTeamXp,
    xpAwarded,
    message:
      result === "win"
        ? `Win confirmed. Your squad beat the rivals by ${diff} XP and earned ${xpAwarded} XP.`
        : `Close loss. Train a little more, then come back stronger for ${xpAwarded} XP.`,
  };
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleString();
}
