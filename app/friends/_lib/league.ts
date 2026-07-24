export const LEAGUE_TIERS = [
  { name: "Bronze", accent: "from-amber-400 to-orange-500" },
  { name: "Silver", accent: "from-slate-300 to-slate-500" },
  { name: "Gold", accent: "from-yellow-400 to-amber-500" },
  { name: "Platinum", accent: "from-cyan-400 to-blue-500" },
  { name: "Diamond", accent: "from-fuchsia-400 to-violet-500" },
] as const;

export const WEEKLY_DUO_XP = 2000;

const DUO_TASK_POOL = [
  "Complete 3 practice sessions each",
  "Score 500+ XP together in Flip Cards",
  "Study on the same day at least twice",
  "Beat your previous week's best score",
  "Review 50 flashcards each",
  "Keep a shared 3-day streak",
  "Finish a full deck without a mistake",
  "Try a brand new subject together",
  "Send each other one hard question",
  "Practice for 20 minutes back to back",
] as const;

const DUO_TASKS_PER_WEEK = 4;

export interface FriendPlayer {
  id: string;
  name: string;
  xp: number;
  joinedAt: string;
  profileCode?: string;
  avatarIndex?: number;
}

export interface FriendTask {
  id: string;
  label: string;
  done: boolean;
}

export interface FriendTaskState {
  weekKey: string;
  partnerId: string | null;
  partnerName: string | null;
  tasks: FriendTask[];
  claimed: boolean;
}

export interface FriendsLeagueState {
  userName: string;
  userXp: number;
  friends: FriendPlayer[];
  currentLeagueIndex: number;
  taskXp: number;
  completedWeeks: number;
  friendTasks: FriendTaskState;
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

function clampCount(value: number): number {
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

function formatDateLabel(value: Date): string {
  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const WEEK_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

function getWeekStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const daysSinceMonday = (day + 6) % 7;
  value.setDate(value.getDate() - daysSinceMonday);
  return value;
}

function getWeekEnd(date: Date): Date {
  return new Date(getWeekStart(date).getTime() + WEEK_LENGTH_MS);
}

export function getWeekKey(date = new Date()): string {
  return getWeekStart(date).toISOString().slice(0, 10);
}

export function getWeekLabel(date = new Date()): string {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart.getTime() + WEEK_LENGTH_MS - 1);
  return `${formatDateLabel(weekStart)} - ${formatDateLabel(weekEnd)}`;
}

export function getWeeklyTimeRemaining(date = new Date()): {
  days: number;
  hours: number;
  totalMs: number;
} {
  const weekEnd = getWeekEnd(date).getTime();
  const remainingMs = Math.max(0, weekEnd - date.getTime());
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

export function getCurrentLeague(state: FriendsLeagueState) {
  return LEAGUE_TIERS[clampLeagueIndex(state.currentLeagueIndex)];
}

function buildDuoTasks(weekKey: string, partnerId: string): FriendTask[] {
  const random = seededRandom(`${weekKey}:${partnerId}`);
  const available = [...DUO_TASK_POOL];
  const tasks: FriendTask[] = [];

  while (tasks.length < DUO_TASKS_PER_WEEK && available.length > 0) {
    const pickIndex = Math.floor(random() * available.length);
    const [label] = available.splice(pickIndex, 1);
    tasks.push({
      id: `task-${tasks.length}-${weekKey}`,
      label,
      done: false,
    });
  }

  return tasks;
}

export function createEmptyFriendTaskState(weekKey: string): FriendTaskState {
  return {
    weekKey,
    partnerId: null,
    partnerName: null,
    tasks: [],
    claimed: false,
  };
}

export function createInitialFriendsLeagueState(
  userName: string,
): FriendsLeagueState {
  return {
    userName: userName.trim() || "You",
    userXp: 0,
    friends: [],
    currentLeagueIndex: 1,
    taskXp: 0,
    completedWeeks: 0,
    friendTasks: createEmptyFriendTaskState(getWeekKey()),
  };
}

function parseFriendTaskState(
  raw: unknown,
  fallbackWeekKey: string,
): FriendTaskState {
  if (!raw || typeof raw !== "object") {
    return createEmptyFriendTaskState(fallbackWeekKey);
  }

  const value = raw as Partial<FriendTaskState>;
  const tasks = Array.isArray(value.tasks)
    ? value.tasks
        .filter(
          (task): task is FriendTask =>
            Boolean(task) &&
            typeof task.id === "string" &&
            typeof task.label === "string" &&
            typeof task.done === "boolean",
        )
        .map((task) => ({ id: task.id, label: task.label, done: task.done }))
    : [];

  return {
    weekKey:
      typeof value.weekKey === "string" ? value.weekKey : fallbackWeekKey,
    partnerId: typeof value.partnerId === "string" ? value.partnerId : null,
    partnerName:
      typeof value.partnerName === "string" ? value.partnerName : null,
    tasks,
    claimed: value.claimed === true,
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
      !Array.isArray(parsed.friends)
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

    return {
      userName: parsed.userName.trim() || fallbackUserName,
      userXp: clampXp(parsed.userXp),
      friends,
      currentLeagueIndex: clampLeagueIndex(
        typeof parsed.currentLeagueIndex === "number"
          ? parsed.currentLeagueIndex
          : 1,
      ),
      taskXp: clampXp(
        typeof parsed.taskXp === "number" ? parsed.taskXp : 0,
      ),
      completedWeeks: clampCount(
        typeof parsed.completedWeeks === "number" ? parsed.completedWeeks : 0,
      ),
      friendTasks: parseFriendTaskState(parsed.friendTasks, getWeekKey()),
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

/**
 * Keeps the weekly duo challenge aligned with the current week. When a new week
 * starts the chosen partner is kept (if still a friend) but fresh tasks are
 * generated and the reward becomes claimable again.
 */
export function syncWeeklyDuoTasks(
  state: FriendsLeagueState,
  weekKey: string,
): FriendsLeagueState {
  const current = state.friendTasks;

  if (current.weekKey === weekKey) {
    return state;
  }

  const partnerStillFriend =
    current.partnerId !== null &&
    state.friends.some((friend) => friend.id === current.partnerId);

  if (!partnerStillFriend || current.partnerId === null) {
    return {
      ...state,
      friendTasks: createEmptyFriendTaskState(weekKey),
    };
  }

  return {
    ...state,
    friendTasks: {
      weekKey,
      partnerId: current.partnerId,
      partnerName: current.partnerName,
      tasks: buildDuoTasks(weekKey, current.partnerId),
      claimed: false,
    },
  };
}

export function selectDuoPartner(
  state: FriendsLeagueState,
  friend: FriendPlayer,
  weekKey: string,
): FriendsLeagueState {
  return {
    ...state,
    friendTasks: {
      weekKey,
      partnerId: friend.id,
      partnerName: friend.name,
      tasks: buildDuoTasks(weekKey, friend.id),
      claimed: false,
    },
  };
}

export function clearDuoPartner(
  state: FriendsLeagueState,
  weekKey: string,
): FriendsLeagueState {
  return {
    ...state,
    friendTasks: createEmptyFriendTaskState(weekKey),
  };
}

export function toggleDuoTask(
  state: FriendsLeagueState,
  taskId: string,
): FriendsLeagueState {
  if (state.friendTasks.claimed) {
    return state;
  }

  return {
    ...state,
    friendTasks: {
      ...state.friendTasks,
      tasks: state.friendTasks.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    },
  };
}

export function areAllDuoTasksDone(taskState: FriendTaskState): boolean {
  return taskState.tasks.length > 0 && taskState.tasks.every((task) => task.done);
}

export function claimDuoReward(state: FriendsLeagueState): FriendsLeagueState {
  const taskState = state.friendTasks;

  if (taskState.claimed || !areAllDuoTasksDone(taskState)) {
    return state;
  }

  return {
    ...state,
    taskXp: clampXp(state.taskXp + WEEKLY_DUO_XP),
    completedWeeks: state.completedWeeks + 1,
    friendTasks: {
      ...taskState,
      claimed: true,
    },
  };
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleString();
}
