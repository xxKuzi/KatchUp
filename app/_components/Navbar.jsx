"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { Menu, X, Home, Gamepad2, BookOpen, Layers, Users, Zap } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "../_lib/languageContext";
import { useEnergy, useResetCountdown, MAX_ENERGY } from "../_lib/energy";
import { signOut, useSession } from "@/lib/auth-client";

function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const energy = useEnergy();
  const reset = useResetCountdown();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isSignedIn = status === "authenticated";
  const isHomePage = pathname === "/";

  const bottomNavItems = [
    { href: "/", label: t("navbar.home", "Home"), Icon: Home },
    { href: "/games", label: t("navbar.games"), Icon: Gamepad2 },
    { href: "/topics", label: t("navbar.topics", "Topics"), Icon: BookOpen },
    { href: "/my-decks", label: t("navbar.myDecks"), Icon: Layers },
    { href: "/friends", label: t("navbar.friends"), Icon: Users },
  ];

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
    <>
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
              src={"/katchup_logo_2_transparent.png"}
              alt="KatchUp logo"
              width={2101}
              height={758}
              className="h-8 w-auto rounded-md object-cover block dark:hidden sm:h-9"
            />
            <Image
              src={"/katchup_logo_2_transparent.png"}
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

          {/* Always-visible daily energy */}
          <div
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm font-bold shadow-sm ${
              energy <= 0
                ? "border-rose-400/60 bg-rose-500/10 text-rose-500 dark:border-rose-500/50 dark:text-rose-400"
                : isHomePage
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                  : "border-amber-400/60 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
            }`}
            title={t("navbar.energy")}
            aria-label={`${t("navbar.energy")}: ${energy}/${MAX_ENERGY}`}
          >
            <Zap className="h-4 w-4 fill-current" />
            <span className="tabular-nums leading-none">{energy}</span>
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {t("navbar.energy")}
                      </p>
                      <span className="flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                        <Zap className="h-4 w-4 fill-current" />
                        <span className="tabular-nums">
                          {energy}/{MAX_ENERGY}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300 dark:bg-amber-400"
                        style={{
                          width: `${(Math.max(0, Math.min(energy, MAX_ENERGY)) / MAX_ENERGY) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t("navbar.resetsIn")} {reset.hours}h {reset.minutes}m
                    </p>
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

    {/* Mobile & tablet bottom navigation */}
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-950/90"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {bottomNavItems.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[0.65rem] font-semibold transition ${
                active
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-transform ${
                  active ? "scale-110" : ""
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}

export default Navbar;
