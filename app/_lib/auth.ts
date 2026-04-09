"use client";

import { useState } from "react";

const AUTH_STORAGE_KEY = "katchup-authenticated-v1";

function readAuthState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "1";
}

export function useAuthState() {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(readAuthState);
  const isReady = typeof window !== "undefined";

  const setSignedIn = (value: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_STORAGE_KEY, value ? "1" : "0");
    }

    setIsSignedIn(value);
  };

  return {
    isSignedIn,
    isReady,
    signIn: () => setSignedIn(true),
    signOut: () => setSignedIn(false),
  };
}
