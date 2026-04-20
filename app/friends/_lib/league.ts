export const LEAGUE_TIERS = [
  { name: "Bronze", accent: "from-amber-400 to-orange-500" },
  { name: "Silver", accent: "from-slate-300 to-slate-500" },
  { name: "Gold", accent: "from-yellow-400 to-amber-500" },
  { name: "Platinum", accent: "from-cyan-400 to-blue-500" },
  { name: "Diamond", accent: "from-fuchsia-400 to-violet-500" },
] as const;

const LEAGUE_PLAYERS = [
  ["Milo", "Nia", "Rex", "Lena", "Zed", "Nora", "Ivo", "Sia"],
  ["Kian", "Luca", "Mira", "Vera", "Noa", "Tara", "Jett", "Lyra"],
  ["Atlas", "Rina", "Nico", "Elio", "Sage", "Cora", "Timo", "Nell"],
  ["Orion", "Aria", "Pax", "Mika", "Zara", "Ona", "Rin", "Vito"],
  ["Nova", "Kora", "Ezra", "Sera", "Nash", "Elsa", "Kobe", "Yara"],
] as const;

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
  weekKey: string;
  leagueName: string;
  promoted: boolean;
  playedAt: string;
}

export interface FriendsLeagueState {
  userName: string;
  userXp: number;
  friends: FriendPlayer[];
  currentLeagueIndex: number;
  matchHistory: LeagueMatchRecord[];
}

export interface TeamMember {
  id: string;
  name: string;
  xp: number;
  role: "you" | "ally" | "opponent";
}

export interface TeamSnapshot {
  yourTeam: TeamMember[];
  rivalTeam: TeamMember[];
}

export interface LeagueRoundResult {
  nextState: FriendsLeagueState;
  weekKey: string;
  weekLabel: string;
  result: "win" | "loss";
  alreadyPlayed: boolean;
  promoted: boolean;
  yourTeamXp: number;
  rivalTeamXp: number;
  message: string;
  snapshot: TeamSnapshot;
}

export interface FriendSeed {
  name: string;
  xp: number;
  profileCode?: string;
  avatarIndex?: number;
}

function clampXp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clampLeagueIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(LEAGUE_TIERS.length - 1, Math.max(0, Math.round(value)));
}

function hashSeed(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let value = hashSeed(seed) % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function pickUniqueNames(
  source: string[],
  count: number,
  random: () => number,
): string[] {
  const available = [...new Set(source)];
  const selected: string[] = [];

  while (selected.length < count && available.length > 0) {
    const pickIndex = Math.floor(random() * available.length);
    const [name] = available.splice(pickIndex, 1);
    selected.push(name);
  }

  return selected;
}

function getWeekStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const daysSinceWednesday = (day + 7 - 3) % 7;
  value.setDate(value.getDate() - daysSinceWednesday);
  return value;
}

function formatDateLabel(value: Date): string {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const CYCLE_LENGTH_DAYS = 4;
const CYCLE_LENGTH_MS = CYCLE_LENGTH_DAYS * 24 * 60 * 60 * 1000;
const CYCLE_ANCHOR_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

function getCycleStart(date: Date): Date {
  const nowMs = date.getTime();
  const offsetMs = nowMs - CYCLE_ANCHOR_UTC_MS;
  const cycleIndex = Math.floor(offsetMs / CYCLE_LENGTH_MS);
  return new Date(CYCLE_ANCHOR_UTC_MS + cycleIndex * CYCLE_LENGTH_MS);
}

function getCycleEnd(date: Date): Date {
  const cycleStart = getCycleStart(date);
  return new Date(cycleStart.getTime() + CYCLE_LENGTH_MS);
}

export function getFourDayCycleKey(date = new Date()): string {
  const cycleStart = getCycleStart(date);
  return cycleStart.toISOString().slice(0, 10);
}

export function getFourDayCycleLabel(date = new Date()): string {
  const cycleStart = getCycleStart(date);
  const cycleEnd = getCycleEnd(date);
  return `${formatDateLabel(cycleStart)} - ${formatDateLabel(cycleEnd)}`;
}

export function getCycleTimeRemaining(date = new Date()): {
  days: number;
  hours: number;
  totalMs: number;
} {
  const cycleEnd = getCycleEnd(date).getTime();
  const remainingMs = Math.max(0, cycleEnd - date.getTime());
  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor(
    (remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
  );

  return {
    days,
    hours,
    totalMs: remainingMs,
  };
}

export function getWeekKey(date = new Date()): string {
  return getFourDayCycleKey(date);
}

export function getWeekLabel(date = new Date()): string {
  return getFourDayCycleLabel(date);
}

export function getCurrentLeague(state: FriendsLeagueState) {
  return LEAGUE_TIERS[clampLeagueIndex(state.currentLeagueIndex)];
}

export function createInitialFriendsLeagueState(
  userName: string,
): FriendsLeagueState {
  return {
    userName: userName.trim() || "You",
    userXp: 0,
    friends: [],
    currentLeagueIndex: 1,
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
          typeof record.weekKey === "string" &&
          typeof record.leagueName === "string" &&
          typeof record.promoted === "boolean" &&
          typeof record.playedAt === "string",
      )
      .map((record) => ({
        id: record.id,
        result: record.result,
        yourTeamXp: clampXp(record.yourTeamXp),
        rivalTeamXp: clampXp(record.rivalTeamXp),
        weekKey: record.weekKey,
        leagueName: record.leagueName,
        promoted: record.promoted,
        playedAt: record.playedAt,
      }));

    return {
      userName: parsed.userName.trim() || fallbackUserName,
      userXp: clampXp(parsed.userXp),
      friends,
      currentLeagueIndex: clampLeagueIndex(
        typeof parsed.currentLeagueIndex === "number"
          ? parsed.currentLeagueIndex
          : 1,
      ),
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

export function buildWeeklyTeamSnapshot(
  state: FriendsLeagueState,
  weekKey: string,
  profileCode: string,
): TeamSnapshot {
  const leagueIndex = clampLeagueIndex(state.currentLeagueIndex);
  const leaguePool = LEAGUE_PLAYERS[leagueIndex];
  const friendPool = state.friends.map((friend) => friend.name);
  const pool = [...friendPool, ...leaguePool].filter(
    (name) => name.trim().toLowerCase() !== state.userName.trim().toLowerCase(),
  );
  const random = seededRandom(`${profileCode}:${weekKey}:${leagueIndex}`);

  const allyNames = pickUniqueNames(pool, 3, random);
  while (allyNames.length < 3) {
    allyNames.push(`Ally ${allyNames.length + 1}`);
  }

  const opponentSource = [...leaguePool, ...RIVAL_FALLBACK].filter(
    (name) => !allyNames.includes(name),
  );
  const opponentNames = pickUniqueNames(opponentSource, 4, random);
  while (opponentNames.length < 4) {
    opponentNames.push(`Rival ${opponentNames.length + 1}`);
  }

  const yourTeam: TeamMember[] = [
    {
      id: "you",
      name: state.userName,
      xp: Math.max(50, state.userXp),
      role: "you",
    },
    ...allyNames.map((name, index) => ({
      id: `ally-${index}-${name}`,
      name,
      xp: clampXp(120 + random() * 220 + state.userXp * 0.08),
      role: "ally" as const,
    })),
  ];

  const rivalTeam: TeamMember[] = opponentNames.map((name, index) => ({
    id: `opponent-${index}-${name}`,
    name,
    xp: clampXp(130 + random() * 240 + state.userXp * 0.08),
    role: "opponent",
  }));

  return { yourTeam, rivalTeam };
}

const RIVAL_FALLBACK = [
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
];

function sumTeamXp(team: TeamMember[]): number {
  return team.reduce((total, member) => total + member.xp, 0);
}

export function resolveWeeklyLeagueFight(
  state: FriendsLeagueState,
  profileCode: string,
  now = new Date(),
): LeagueRoundResult {
  const weekKey = getFourDayCycleKey(now);
  const weekLabel = getFourDayCycleLabel(now);
  const alreadyPlayed = state.matchHistory.some(
    (record) => record.weekKey === weekKey,
  );
  const snapshot = buildWeeklyTeamSnapshot(state, weekKey, profileCode);
  const yourTeamXp = sumTeamXp(snapshot.yourTeam);
  const rivalTeamXp = sumTeamXp(snapshot.rivalTeam);
  const result = yourTeamXp >= rivalTeamXp ? "win" : "loss";
  const canPromote = result === "win";
  const currentLeague =
    LEAGUE_TIERS[clampLeagueIndex(state.currentLeagueIndex)];
  const promotedLeagueIndex = canPromote
    ? Math.min(
        clampLeagueIndex(state.currentLeagueIndex) + 1,
        LEAGUE_TIERS.length - 1,
      )
    : clampLeagueIndex(state.currentLeagueIndex);
  const promoted =
    promotedLeagueIndex > clampLeagueIndex(state.currentLeagueIndex);

  if (alreadyPlayed) {
    return {
      nextState: state,
      weekKey,
      weekLabel,
      result,
      alreadyPlayed: true,
      promoted: false,
      yourTeamXp,
      rivalTeamXp,
      message: `Cycle fight already completed for ${weekLabel}. Next reset starts in 4 days.`,
      snapshot,
    };
  }

  const nextState: FriendsLeagueState = {
    ...state,
    currentLeagueIndex: promotedLeagueIndex,
    matchHistory: [
      {
        id: createId("match"),
        result,
        yourTeamXp,
        rivalTeamXp,
        weekKey,
        leagueName: currentLeague.name,
        promoted,
        playedAt: new Date().toISOString(),
      },
      ...state.matchHistory,
    ].slice(0, 8),
  };

  return {
    nextState,
    weekKey,
    weekLabel,
    result,
    alreadyPlayed: false,
    promoted,
    yourTeamXp,
    rivalTeamXp,
    message:
      result === "win"
        ? promoted
          ? `Win in ${weekLabel}. Promotion unlocked! You move to ${LEAGUE_TIERS[promotedLeagueIndex].name} league.`
          : `Win in ${weekLabel}. You are already in the highest league.`
        : `Loss in ${weekLabel}. Stay sharp and try again next 4-day cycle.`,
    snapshot,
  };
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleString();
}
