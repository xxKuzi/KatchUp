import { FriendPlayer } from "./league";

export type ProfileMascot = "fox" | "owl" | "panda" | "tiger";
export type ProfileStyle = "boy" | "girl";

export interface ProfileAvatar {
  mascot: ProfileMascot;
  style: ProfileStyle;
  label: string;
  accent: string;
  glyph: string;
}

export interface FriendProfileIdentity {
  profileCode: string;
  nickname: string;
  avatarIndex: number;
  updatedAt: string;
}

export interface PublicFriendProfile {
  profileCode: string;
  nickname: string;
  avatarIndex: number;
  currentXp: number;
  leagueName: string;
  friendsCount: number;
  matchesPlayed: number;
  updatedAt: string;
}

export const PROFILE_AVATARS: ProfileAvatar[] = [
  {
    mascot: "fox",
    style: "boy",
    label: "Fox Boy",
    accent: "from-orange-400 to-rose-500",
    glyph: "F",
  },
  {
    mascot: "fox",
    style: "girl",
    label: "Fox Girl",
    accent: "from-rose-400 to-pink-500",
    glyph: "F",
  },
  {
    mascot: "owl",
    style: "boy",
    label: "Owl Boy",
    accent: "from-sky-400 to-cyan-500",
    glyph: "O",
  },
  {
    mascot: "owl",
    style: "girl",
    label: "Owl Girl",
    accent: "from-indigo-400 to-sky-500",
    glyph: "O",
  },
  {
    mascot: "panda",
    style: "boy",
    label: "Panda Boy",
    accent: "from-slate-300 to-slate-500",
    glyph: "P",
  },
  {
    mascot: "panda",
    style: "girl",
    label: "Panda Girl",
    accent: "from-emerald-400 to-teal-500",
    glyph: "P",
  },
  {
    mascot: "tiger",
    style: "boy",
    label: "Tiger Boy",
    accent: "from-amber-400 to-orange-500",
    glyph: "T",
  },
  {
    mascot: "tiger",
    style: "girl",
    label: "Tiger Girl",
    accent: "from-yellow-400 to-amber-500",
    glyph: "T",
  },
];

export function getProfileAvatar(index: number): ProfileAvatar {
  const safeIndex =
    ((Math.trunc(index) % PROFILE_AVATARS.length) + PROFILE_AVATARS.length) %
    PROFILE_AVATARS.length;
  return PROFILE_AVATARS[safeIndex];
}

export function getNextProfileAvatarIndex(index: number): number {
  return (index + 1) % PROFILE_AVATARS.length;
}

export function getRandomProfileAvatarIndex(): number {
  return Math.floor(Math.random() * PROFILE_AVATARS.length);
}

export function createProfileCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function normalizeProfileCode(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 16);
}

export function normalizeAvatarIndex(value: number): number {
  return (
    ((Math.trunc(value) % PROFILE_AVATARS.length) + PROFILE_AVATARS.length) %
    PROFILE_AVATARS.length
  );
}

export function createInitialFriendProfileIdentity(
  nickname: string,
): FriendProfileIdentity {
  return {
    profileCode: createProfileCode(),
    nickname: nickname.trim() || "Me",
    avatarIndex: getRandomProfileAvatarIndex(),
    updatedAt: new Date().toISOString(),
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
      typeof parsed.avatarIndex !== "number" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    return {
      profileCode: normalizeProfileCode(parsed.profileCode),
      nickname: parsed.nickname.trim() || fallbackNickname,
      avatarIndex: normalizeAvatarIndex(parsed.avatarIndex),
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
    avatarIndex: normalizeAvatarIndex(options.identity.avatarIndex),
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
    avatarIndex: profile.avatarIndex,
  };
}

export function normalizeStoredProfileCode(profileCode: string): string {
  return normalizeProfileCode(profileCode);
}
