"use client";

import { useMemo } from "react";
import { signIn, signOut, useSession } from "@/lib/auth-client";

export function useAuthState() {
  const { data: session, status } = useSession();

  return useMemo(
    () => ({
      isSignedIn: status === "authenticated",
      isReady: status !== "loading",
      session,
      signIn: () => signIn(),
      signOut: () => signOut(),
    }),
    [session, status],
  );
}
