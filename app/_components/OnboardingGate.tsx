"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isGatedPath } from "../_lib/onboardingGate";
import { useSignedIn } from "../_lib/useSignedIn";

// Signed-out visitors are funneled through the landing page, so a hand-typed
// URL for a locked route lands them back on "/" instead of rendering a page
// the navbar keeps blurred out.
//
// Only a session that is actually known to be absent counts. A signed-in player
// coming back to a backgrounded tab can have the session refetch fail under
// them, and throwing them off the page they were on for a network blip is not
// gating, it is losing their place.
export default function OnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signedIn, resolving } = useSignedIn();
  const blocked = !signedIn && !resolving && isGatedPath(pathname);

  useEffect(() => {
    if (blocked) {
      router.replace("/");
    }
  }, [blocked, router]);

  if (blocked) {
    return null;
  }

  return <>{children}</>;
}
