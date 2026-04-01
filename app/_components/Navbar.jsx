"use client";
import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { useTheme } from "next-themes";

function Navbar() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const activeTheme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div className="relative mb-32 flex w-full items-center justify-center px-3">
      <div className="fixed top-3 z-20 flex w-full max-w-5xl items-center justify-between rounded-xl border border-slate-300/70 bg-white/85 p-2 text-slate-700 shadow-md backdrop-blur transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-200 sm:top-2 sm:px-3">
        <div className="flex items-center justify-center gap-0.5 sm:gap-1">
          <button
            className="mr-1 cursor-pointer rounded-md p-1 text-slate-700 transition dark:text-slate-200 "
            onClick={() => router.push("/")}
            aria-label="Go home"
          >
            <Image
              src={
                activeTheme === "light"
                  ? "/katch_up_logo_light.png"
                  : "/katch_up_logo.jpeg"
              }
              alt="KatchUp logo"
              width={2101}
              height={758}
              className="h-9 w-auto rounded-md object-cover"
            />
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/games")}
          >
            Games
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/my-decks")}
          >
            My Decks
          </button>
          <button
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white sm:px-4"
            onClick={() => router.push("/leaderboard")}
          >
            Friends {";)"}
          </button>
        </div>
        <div className="flex items-center gap-2 pr-1 sm:gap-3 sm:pr-2">
          <p className="hidden text-xs text-slate-600 dark:text-slate-300 md:block">
            Health Bar{" "}
            <span className="text-green-600 dark:text-green-300">OOOO</span>
          </p>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

export default Navbar;
