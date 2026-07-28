"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { setEnergyIdentity } from "../_lib/energy";

/**
 * Connects the energy store to the session.
 *
 * The store has to know whether to read this browser's storage or the server
 * before it can answer anything, and the game pages that spend energy have no
 * business knowing who is signed in. So one component in the layout tells it,
 * once the session has settled and again on every sign-in or sign-out.
 *
 * Renders nothing.
 */
export default function EnergySync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (status === "loading") return;
    setEnergyIdentity(status === "authenticated" ? userId : null);
  }, [status, userId]);

  return null;
}
