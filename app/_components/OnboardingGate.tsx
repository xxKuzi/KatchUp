"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { isGatedPath } from "../_lib/onboardingGate";

// Signed-out visitors are funneled through the landing page, so a hand-typed
// URL for a locked route lands them back on "/" instead of rendering a page
// the navbar keeps blurred out.
export default function OnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const blocked = status === "unauthenticated" && isGatedPath(pathname);

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
