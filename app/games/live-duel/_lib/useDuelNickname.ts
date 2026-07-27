"use client";

import { useCallback } from "react";
import { useAuthState } from "@/app/_lib/auth";
import {
  friendProfileAvatarDataUrl,
  parseStoredFriendProfileIdentity,
  profileStorageKey,
} from "@/app/friends/_lib/profile";

/**
 * Reads the name a player duels under: their friends-profile nickname, falling
 * back to the local game handle. Deliberately never the account name - that is
 * the real name people signed up with.
 *
 * Returned as a getter rather than state because it is only ever needed at the
 * moment a request is sent, and reading it lazily keeps it correct if the
 * player edits their profile in another tab.
 */
export function useDuelNickname(fallback: string): () => string {
  const { session } = useAuthState();
  const userKey = session?.user?.email ?? session?.user?.name ?? "player";

  return useCallback(() => {
    if (typeof window === "undefined") {
      return fallback;
    }

    const identity = parseStoredFriendProfileIdentity(
      window.localStorage.getItem(profileStorageKey(userKey)),
      fallback,
    );

    return identity?.nickname.trim() || fallback;
  }, [userKey, fallback]);
}

/** Reads the icon and colour saved in the player's friends profile. */
export function useDuelAvatar(fallback: string): () => string {
  const { session } = useAuthState();
  const userKey = session?.user?.email ?? session?.user?.name ?? "player";

  return useCallback(() => {
    if (typeof window === "undefined") {
      return fallback;
    }

    const identity = parseStoredFriendProfileIdentity(
      window.localStorage.getItem(profileStorageKey(userKey)),
      "Player",
    );

    return identity ? friendProfileAvatarDataUrl(identity) : fallback;
  }, [userKey, fallback]);
}
