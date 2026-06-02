"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "../_lib/languageContext";
import { signOut, useSession } from "@/lib/auth-client";

function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isSignedIn = status === "authenticated";
  const isHomePage = pathname === "/";

  const handleOpenLogin = () => {
    setMenuOpen(false);
    router.push("/login");
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

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
      <div
        className={`fixed top-3 z-50 flex w-full max-w-5xl items-center justify-between rounded-xl p-2 backdrop-blur-md transition-all duration-300 sm:top-2 sm:px-3 ${
          isHomePage
            ? "border border-blue-300/20 bg-slate-950/60 text-slate-100 shadow-lg shadow-blue-900/20 hover:border-blue-300/35"
            : "border border-slate-300/70 bg-white/85 text-slate-700 shadow-md hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950/85 dark:text-slate-200"
        }`}
      >
        <div className="flex items-center justify-center gap-0.5 sm:gap-1">
          <button
            className={`mr-1 cursor-pointer rounded-md p-1 transition-transform hover:scale-105 ${
              isHomePage
                ? "text-slate-100"
                : "text-slate-700 dark:text-slate-200"
            }`}
            onClick={() => router.push("/")}
            aria-label="Go home"
            type="button"
          >
            <Image
              src={"/katch_up_logo_light.png"}
              alt="KatchUp logo"
              width={2101}
              height={758}
              className="h-8 w-auto rounded-md object-cover block dark:hidden sm:h-9"
            />
            <Image
              src={"/katch_up_logo.jpeg"}
              alt="KatchUp logo"
              width={2101}
              height={758}
              className="h-8 w-auto rounded-md object-cover hidden dark:block sm:h-9"
            />
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden lg:flex items-center justify-center gap-1.5">
          <button
            className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-4 ${
              isHomePage
                ? "text-slate-100 hover:bg-slate-800/80 hover:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
            onClick={() => router.push("/games")}
            type="button"
          >
            {t("navbar.games")}
          </button>
          <button
            className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-4 ${
              isHomePage
                ? "text-slate-100 hover:bg-slate-800/80 hover:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
            onClick={() => router.push("/topics")}
            type="button"
          >
            {t("navbar.topics", "Topics")}
          </button>
          <button
            className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-4 ${
              isHomePage
                ? "text-slate-100 hover:bg-slate-800/80 hover:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
            onClick={() => router.push("/my-decks")}
            type="button"
          >
            {t("navbar.myDecks")}
          </button>
          <button
            className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-4 ${
              isHomePage
                ? "text-slate-100 hover:bg-slate-800/80 hover:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
            onClick={() => router.push("/friends")}
            type="button"
          >
            {t("navbar.friends")}
          </button>
        </div>

        {/* Desktop Actions & Hamburger */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            {!isSignedIn ? (
              <button
                type="button"
                onClick={handleOpenLogin}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                {t("auth.loginRegister", "Login / Register")}
              </button>
            ) : null}
          </div>

          <div className="relative flex" role="presentation" ref={menuRef}>
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className={`inline-flex cursor-pointer items-center justify-center rounded-lg border p-2 shadow-sm transition ${
                isHomePage
                  ? "border-slate-700/80 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
                  : "border-slate-300/80 bg-white/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {menuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[120%] mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl transition-all dark:border-slate-700 dark:bg-slate-950/95 sm:w-80">
                <div className="flex flex-col gap-4">
                  {/* Mobile Links - Only visible on small screens */}
                  <div className="flex flex-col space-y-1 lg:hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/games");
                      }}
                      className="rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {t("navbar.games")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/topics");
                      }}
                      className="rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {t("navbar.topics", "Topics")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/my-decks");
                      }}
                      className="rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {t("navbar.myDecks")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/friends");
                      }}
                      className="rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {t("navbar.friends")}
                    </button>
                    <div className="my-2 h-px w-full bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {/* Utilities */}
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-200">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {t("navbar.healthBar")}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                    </div>
                  </div>

                  <LanguageToggle />
                  <ThemeToggle />

                  {/* Auth specific items */}
                  {isSignedIn ? (
                    <div className="space-y-3 pt-2">
                      <p className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        Signed in as{" "}
                        <span className="font-bold text-slate-700 dark:text-slate-200">
                          {session?.user?.name ||
                            session?.user?.email ||
                            "User"}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-left text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t("auth.signOut", "Sign out")}
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 lg:hidden">
                      <button
                        type="button"
                        onClick={handleOpenLogin}
                        className="w-full rounded-2xl border border-blue-500 bg-blue-600 px-4 py-3.5 text-center text-sm font-bold text-white shadow-md transition hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
                      >
                        {t("auth.loginRegister", "Login / Register")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
