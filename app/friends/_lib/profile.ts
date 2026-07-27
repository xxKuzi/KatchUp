import { FriendPlayer } from "./league";

export interface AvatarBackground {
  id: string;
  label: string;
  accent: string;
}

export interface FriendProfileIdentity {
  profileCode: string;
  nickname: string;
  avatarBackgroundId: string;
  avatarIcon: string;
  updatedAt: string;
}

export interface PublicFriendProfile {
  profileCode: string;
  nickname: string;
  avatarBackgroundId: string;
  avatarIcon: string;
  currentXp: number;
  leagueName: string;
  friendsCount: number;
  matchesPlayed: number;
  updatedAt: string;
}

export const AVATAR_BACKGROUNDS: AvatarBackground[] = [
  { id: "sky", label: "Sky", accent: "from-sky-400 to-cyan-500" },
  { id: "sunset", label: "Sunset", accent: "from-orange-400 to-rose-500" },
  { id: "forest", label: "Forest", accent: "from-emerald-400 to-teal-500" },
  { id: "berry", label: "Berry", accent: "from-fuchsia-400 to-violet-500" },
  { id: "steel", label: "Steel", accent: "from-slate-300 to-slate-500" },
  { id: "gold", label: "Gold", accent: "from-yellow-400 to-amber-500" },
];

export const CUTE_ICONS = [
  "(^_^)",
  "(o_o)",
  "(>_<)",
  "(^o^)",
  "(._.)",
  "(=.=)",
  "(^-^)",
  "(x_x)",
];
const TAG_ANIMALS = [
  "fox",
  "owl",
  "panda",
  "tiger",
  "otter",
  "koala",
  "dolphin",
  "wolf",
];

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function sanitizeName(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return slug || "player";
}

export function createReadableProfileCode(nickname: string): string {
  const base = sanitizeName(nickname).slice(0, 7);
  const includeAnimal = randomInt(2) === 1;
  const animal = TAG_ANIMALS[randomInt(TAG_ANIMALS.length)];
  const suffix = String(10 + randomInt(90));
  const mixed = includeAnimal
    ? `${base}${animal}${suffix}`
    : `${base}${suffix}`;
  return normalizeProfileCode(mixed);
}

export function randomCuteIcon(): string {
  return CUTE_ICONS[randomInt(CUTE_ICONS.length)];
}

export function getAvatarBackground(backgroundId: string): AvatarBackground {
  return (
    AVATAR_BACKGROUNDS.find((background) => background.id === backgroundId) ??
    AVATAR_BACKGROUNDS[0]
  );
}

const AVATAR_GRADIENT_COLORS: Record<string, [string, string]> = {
  sky: ["#38bdf8", "#06b6d4"],
  sunset: ["#fb923c", "#f43f5e"],
  forest: ["#34d399", "#14b8a6"],
  berry: ["#e879f9", "#8b5cf6"],
  steel: ["#cbd5e1", "#64748b"],
  gold: ["#facc15", "#f59e0b"],
};

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Render the saved friends-profile icon as an image usable by duel tracks. */
export function friendProfileAvatarDataUrl(
  identity: Pick<FriendProfileIdentity, "avatarBackgroundId" | "avatarIcon">,
): string {
  const [from, to] =
    AVATAR_GRADIENT_COLORS[getAvatarBackground(identity.avatarBackgroundId).id] ??
    AVATAR_GRADIENT_COLORS.sky;
  const icon = escapeSvgText(identity.avatarIcon.trim() || CUTE_ICONS[0]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100" height="100" rx="28" fill="url(#g)"/><text x="50" y="54" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial,sans-serif" font-size="22" font-weight="700">${icon}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeProfileCode(value: string): string {
  return value
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 16);
}

export function createInitialFriendProfileIdentity(
  nickname: string,
): FriendProfileIdentity {
  return {
    profileCode: createReadableProfileCode(nickname),
    nickname: nickname.trim() || "Me",
    avatarBackgroundId:
      AVATAR_BACKGROUNDS[randomInt(AVATAR_BACKGROUNDS.length)].id,
    avatarIcon: randomCuteIcon(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The identity to render before the real one is read from localStorage.
 *
 * `createInitialFriendProfileIdentity` picks a random icon, colour and code, so
 * using it as initial React state produced a different avatar on the server
 * than on the client and broke hydration. This is deterministic: the server and
 * the client always agree on it, and the effect that loads (or mints) the real
 * identity replaces it right after mount.
 */
export function createPlaceholderFriendProfileIdentity(
  nickname: string,
): FriendProfileIdentity {
  return {
    profileCode: "",
    nickname: nickname.trim() || "Me",
    avatarBackgroundId: AVATAR_BACKGROUNDS[0].id,
    avatarIcon: CUTE_ICONS[0],
    updatedAt: "",
  };
}

export function parseStoredFriendProfileIdentity(
  rawValue: string | null,
  fallbackNickname: string,
): FriendProfileIdentity | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<FriendProfileIdentity>;

    if (
      typeof parsed.profileCode !== "string" ||
      typeof parsed.nickname !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    const legacyAvatarIndex =
      typeof (parsed as { avatarIndex?: number }).avatarIndex === "number"
        ? (parsed as { avatarIndex: number }).avatarIndex
        : 0;

    const legacyBackground =
      AVATAR_BACKGROUNDS[legacyAvatarIndex % AVATAR_BACKGROUNDS.length].id;

    return {
      profileCode: normalizeProfileCode(parsed.profileCode),
      nickname: parsed.nickname.trim() || fallbackNickname,
      avatarBackgroundId:
        typeof parsed.avatarBackgroundId === "string"
          ? getAvatarBackground(parsed.avatarBackgroundId).id
          : legacyBackground,
      avatarIcon:
        typeof parsed.avatarIcon === "string" &&
        parsed.avatarIcon.trim().length > 0
          ? parsed.avatarIcon
          : randomCuteIcon(),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function createPublicFriendProfile(options: {
  identity: FriendProfileIdentity;
  currentXp: number;
  leagueName: string;
  friendsCount: number;
  matchesPlayed: number;
}): PublicFriendProfile {
  return {
    profileCode: normalizeProfileCode(options.identity.profileCode),
    nickname: options.identity.nickname.trim() || "Me",
    avatarBackgroundId: getAvatarBackground(options.identity.avatarBackgroundId)
      .id,
    avatarIcon:
      options.identity.avatarIcon.trim().length > 0
        ? options.identity.avatarIcon
        : randomCuteIcon(),
    currentXp: Math.max(0, Math.round(options.currentXp)),
    leagueName: options.leagueName,
    friendsCount: Math.max(0, Math.round(options.friendsCount)),
    matchesPlayed: Math.max(0, Math.round(options.matchesPlayed)),
    updatedAt: options.identity.updatedAt,
  };
}

export function buildProfileUrl(origin: string, profileCode: string): string {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `${normalizedOrigin}/friends/${encodeURIComponent(normalizeProfileCode(profileCode))}`;
}

export function profileStorageKey(userKey: string): string {
  return `katchup-friends-profile-v1:${userKey}`;
}

export function friendFromPublicProfile(
  profile: PublicFriendProfile,
): FriendPlayer {
  return {
    id: profile.profileCode,
    name: profile.nickname,
    xp: profile.currentXp,
    joinedAt: profile.updatedAt,
    profileCode: profile.profileCode,
  };
}

export function normalizeStoredProfileCode(profileCode: string): string {
  return normalizeProfileCode(profileCode);
}
