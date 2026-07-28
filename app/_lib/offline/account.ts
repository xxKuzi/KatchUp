"use client";

import type { Session } from "next-auth";

/**
 * Which account the data on this device belongs to.
 *
 * Prefers the user id and falls back to the email, because a device is shared
 * far more often than a browser profile is: every read is checked against this,
 * and everything stored is wiped the moment it stops matching.
 */
export function accountKeyFromSession(
  session: Session | null | undefined,
): string | null {
  const user = session?.user as { id?: string; email?: string | null } | undefined;
  if (!user) {
    return null;
  }
  if (typeof user.id === "string" && user.id.length > 0) {
    return user.id;
  }
  if (typeof user.email === "string" && user.email.length > 0) {
    return `email:${user.email.toLowerCase()}`;
  }
  return null;
}
