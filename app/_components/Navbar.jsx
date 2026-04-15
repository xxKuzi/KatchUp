"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "../_lib/languageContext";
import { signIn, signOut, useSession } from "@/lib/auth-client";

function Navbar() {
  const router = useRouter();
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isSignedIn = status === "authenticated";

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  return (
    <div className="relative mb-32 flex w-full items-center justify-center px-3">
      <div className="fixed top-3 z-20 flex w-full max-w-5xl items-center justify-between rounded-xl border border-slate-300/70 bg-white/85 p-2 text-slate-700 shadow-md backdrop-blur transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-200 sm:top-2 sm:px-3">
        <div className="flex items-center justify-center gap-0.5 sm:gap-1">
          <button
            className="mr-1 cursor-pointer rounded-md p-1 text-slate-700 transition dark:text-slate-200"
            onClick={() => router.push("/")}
            aria-label="Go home"
            type="button"
          >
            <Image
              src={"/katch_up_logo_light.png"}
              alt="KatchUp logo"
              width={2101}
              height={758}
              className="h-9 w-auto rounded-md object-cover block dark:hidden"
            />
            <Image
              src={"/katch_up_logo.jpeg"}
              alt="KatchUp logo"
              width={2101}
              height={758}
              className="h-9 w-auto rounded-md object-cover hidden dark:block"
            />
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/games")}
            type="button"
          >
            {t("navbar.games")}
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/topics")}
            type="button"
          >
            {t("navbar.topics", "Topics")}
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/my-decks")}
            type="button"
          >
            {t("navbar.myDecks")}
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/leaderboard")}
            type="button"
          >
            {t("navbar.friends")} {";)"}
          </button>
        </div>

        <div className="relative" role="presentation" ref={menuRef}>
          <button
            type="button"
            aria-label="Open utility menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300/80 bg-white/80 p-2 text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {menuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-3 w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {t("navbar.healthBar")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                    OOOO
                  </p>
                </div>

                <LanguageToggle />

                <button
                  type="button"
                  onClick={() => (isSignedIn ? signOut() : signIn())}
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {isSignedIn
                    ? t("auth.signOut", "Sign out")
                    : t("auth.signIn", "Sign in")}
                </button>

                {session?.user?.name ? (
                  <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                    Signed in as {session.user.name}
                  </p>
                ) : null}

                <ThemeToggle />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;
