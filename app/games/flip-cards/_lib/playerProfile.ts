"use client";

export interface PlayerProfile {
  id: string;
  name: string;
  avatar: string;
}

const PROFILE_KEY = "katchup-player-profile-v1";

const NAME_SEEDS = [
  "SwiftFox",
  "WordRunner",
  "EchoBloom",
  "NeonLearner",
  "VerbVoyager",
  "QuickLex",
  "LinguaStar",
  "DriftPhrase",
];

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomId(): string {
  return `player-${Math.random().toString(36).slice(2, 10)}`;
}

function buildNewProfile(): PlayerProfile {
  const avatarIndex = Math.floor(Math.random() * 70) + 1;
  return {
    id: randomId(),
    name: `${randomFrom(NAME_SEEDS)}${Math.floor(Math.random() * 99)}`,
    avatar: `https://i.pravatar.cc/100?img=${avatarIndex}`,
  };
}

export function getPlayerProfile(): PlayerProfile {
  if (typeof window === "undefined") {
    return {
      id: "player-ssr",
      name: "LocalPlayer",
      avatar: "https://i.pravatar.cc/100?img=12",
    };
  }

  const stored = window.localStorage.getItem(PROFILE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PlayerProfile;
      if (parsed.id && parsed.name && parsed.avatar) {
        return parsed;
      }
    } catch {
      // Ignore parse errors and generate a fresh profile.
    }
  }

  const next = buildNewProfile();
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}
