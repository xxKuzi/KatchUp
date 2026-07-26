"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Menu,
  X,
  Home,
  Gamepad2,
  BookOpen,
  Layers,
  Users,
  Zap,
  Newspaper,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import LevelBadge from "./LevelBadge";
import { useLanguage } from "../_lib/languageContext";
import { useEnergy, useResetCountdown, MAX_ENERGY, ENERGY_PRACTICE_REWARD } from "../_lib/energy";
import { signOut, useSession } from "@/lib/auth-client";
import { useStartPlayingModal } from "./StartPlayingModalProvider";

function getInitials(value) {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, learningLanguage } = useLanguage();
  const energy = useEnergy();
  const reset = useResetCountdown();
  const { data: session, status } = useSession();
  const { openModal } = useStartPlayingModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [energyPopoverOpen, setEnergyPopoverOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const menuRef = useRef(null);
  const energyRef = useRef(null);
  const isSignedIn = status === "authenticated";
  const isHomePage = pathname === "/";
  const isLoginPage = pathname === "/login";
  // First-time-visitor onboarding: on the landing page, while signed out, the
  // navbar is locked down to just Home/Games so new visitors get funneled
  // into a free Score Rush round before browsing the rest of the app. Stays
  // locked through the login page too, so it doesn't unblur the instant you
  // click "sign in" — only once you're actually authenticated.
  const gateActive = (isHomePage || isLoginPage) && !isSignedIn;
  const gatedItemClass = gateActive
    ? " pointer-events-none blur-[3px] opacity-50 select-none"
    : "";

  const bottomNavItems = [
    { href: "/", label: t("navbar.home", "Home"), Icon: Home },
    { href: "/games", label: t("navbar.games"), Icon: Gamepad2 },
    { href: "/topics", label: t("navbar.topics", "Topics"), Icon: BookOpen },
    { href: "/my-decks", label: t("navbar.myDecks"), Icon: Layers },
    { href: "/friends", label: t("navbar.friends"), Icon: Users },
  ];

  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleNavigate = (href) => {
    if (gateActive && href === "/games") {
      openModal();
      return;
    }
    router.push(href);
  };

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
      if (!energyRef.current?.contains(event.target)) {
        setEnergyPopoverOpen(false);
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
      <div className="relative mb-20 lg:mb-32 flex w-full items-center justify-center px-3">
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

            <div className={gatedItemClass}>
              <LanguageSwitcher
                open={langModalOpen}
                onOpenChange={setLangModalOpen}
                isHomePage={isHomePage}
              />
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center justify-center gap-1.5">
            <button
              className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-4 ${
                isHomePage
                  ? "text-slate-100 hover:bg-slate-800/80 hover:text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
              onClick={() => handleNavigate("/games")}
              type="button"
            >
              {t("navbar.games")}
            </button>
            <button
              className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-4 ${
                isHomePage
                  ? "text-slate-100 hover:bg-slate-800/80 hover:text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              }${gatedItemClass}`}
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
              }${gatedItemClass}`}
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
              }${gatedItemClass}`}
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
                  className={`inline-flex cursor-pointer items-center justify-center rounded-lg border border-blue-500 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400${gatedItemClass}`}
                >
                  {t("auth.loginRegister", "Login / Register")}
                </button>
              ) : null}
            </div>

            {/* Blog — small icon link next to energy */}
            <button
              type="button"
              onClick={() => router.push("/blog")}
              aria-label={t("navbar.blog", "Blog")}
              title={t("navbar.blog", "Blog")}
              className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border shadow-sm transition hover:scale-105 ${
                isHomePage
                  ? "border-slate-700/80 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
                  : "border-slate-300/80 bg-white/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              }${gatedItemClass}`}
            >
              <Newspaper className="h-3.5 w-3.5" />
            </button>

            {/* CEFR level for the language being learned — hides itself when signed out */}
            <div className={gatedItemClass}>
              <LevelBadge
                learningLanguage={learningLanguage}
                isHomePage={isHomePage}
              />
            </div>

            {/* Always-visible daily energy — locked to a single pip until signed in */}
            <div className="relative" ref={energyRef}>
              <button
                type="button"
                onClick={() => {
                  if (!isSignedIn) {
                    return;
                  }
                  setMenuOpen(false);
                  setEnergyPopoverOpen((prev) => !prev);
                }}
                aria-label={
                  isSignedIn
                    ? `${t("navbar.energy")}: ${energy}/${MAX_ENERGY}`
                    : "Sign in to track energy"
                }
                aria-expanded={isSignedIn ? energyPopoverOpen : undefined}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-sm font-bold shadow-sm transition ${
                  !isSignedIn
                    ? "cursor-default border-slate-400/40 bg-slate-400/10 text-slate-400 dark:border-slate-600/60 dark:text-slate-500"
                    : `cursor-pointer hover:scale-105 ${
                        energy <= 0
                          ? "border-rose-400/60 bg-rose-500/10 text-rose-500 dark:border-rose-500/50 dark:text-rose-400"
                          : isHomePage
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-amber-400/60 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
                      }`
                }`}
              >
                <Zap className="h-4 w-4 fill-current" />
                <span className="tabular-nums leading-none">
                  {isSignedIn ? energy : 1}
                </span>
              </button>

              {isSignedIn && energyPopoverOpen && (
                <div className="absolute right-0 top-[120%] mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-4 text-sm text-slate-700 shadow-2xl backdrop-blur-xl transition-all sm:left-1/2 sm:right-auto sm:-translate-x-1/2 dark:border-slate-700 dark:bg-slate-950/95 dark:text-slate-200">
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

                  <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {t("navbar.earnEnergy")}
                    </p>
                    <div className="flex flex-col gap-2">
                      {/* Repetition drill over your known words — always available. */}
                      <button
                        type="button"
                        disabled={energy >= MAX_ENERGY}
                        onClick={() => {
                          setEnergyPopoverOpen(false);
                          router.push("/games/quick-guess?energyReview=1");
                        }}
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-amber-400"
                      >
                        {t("navbar.speedSpellingDrill")}
                        <span className="inline-flex items-center gap-0.5">
                          <Zap className="h-3.5 w-3.5 fill-current" />+
                          {ENERGY_PRACTICE_REWARD}
                        </span>
                      </button>

                      {energy >= MAX_ENERGY && (
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {t("navbar.energyFull")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex" role="presentation" ref={menuRef}>
              <button
                type="button"
                aria-label={
                  isSignedIn
                    ? `Account: ${session?.user?.name || session?.user?.email || "Signed in"}`
                    : "Open menu"
                }
                title={
                  isSignedIn
                    ? session?.user?.name || session?.user?.email || "Signed in"
                    : undefined
                }
                aria-expanded={menuOpen}
                onClick={() => {
                  setEnergyPopoverOpen(false);
                  setMenuOpen((value) => !value);
                }}
                className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border shadow-sm transition hover:scale-105 ${
                  isHomePage
                    ? "border-slate-700/80 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
                    : "border-slate-300/80 bg-white/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {menuOpen ? (
                  <X className="h-4 w-4" />
                ) : isSignedIn ? (
                  session?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold">
                      {getInitials(session?.user?.name || session?.user?.email)}
                    </span>
                  )
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-[120%] mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl transition-all dark:border-slate-700 dark:bg-slate-950/95 sm:w-80">
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/learned-words");
                      }}
                      className={`rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800${gatedItemClass}`}
                    >
                      {t("navbar.learnedWords", "Learned Words")}
                    </button>

                    {/* Mobile Links - Only visible on small screens */}
                    <div className="flex flex-col space-y-1 lg:hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          handleNavigate("/games");
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
                        className={`rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800${gatedItemClass}`}
                      >
                        {t("navbar.topics", "Topics")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/my-decks");
                        }}
                        className={`rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800${gatedItemClass}`}
                      >
                        {t("navbar.myDecks")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/friends");
                        }}
                        className={`rounded-xl px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800${gatedItemClass}`}
                      >
                        {t("navbar.friends")}
                      </button>
                      <div className="my-2 h-px w-full bg-slate-200 dark:bg-slate-800" />
                    </div>

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
                      <div className={`pt-2 lg:hidden${gatedItemClass}`}>
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
            const isGatedItem =
              gateActive && href !== "/" && href !== "/games";
            return (
              <button
                key={href}
                type="button"
                onClick={() => handleNavigate(href)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[0.65rem] font-semibold transition ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                }${isGatedItem ? gatedItemClass : ""}`}
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
