"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import StartPlayingModal from "./StartPlayingModal";
import { readChosenLanguagePair } from "../_lib/languageContext";
import { levelProgressFromMasteredCount } from "../_lib/level";
import { scoreRushHref } from "../games/_lib/scoreRushStart";
import { hasAnonPlaysRemaining } from "../games/_lib/anonPlayGate";
import { ONBOARDING_SIGN_UP_HREF } from "../games/_lib/onboardingRound";

interface StartPlayingModalContextValue {
  openModal: () => void;
}

const StartPlayingModalContext = createContext<
  StartPlayingModalContextValue | undefined
>(undefined);

/**
 * The difficulty the player's account has earned, as the vocabulary's own tag.
 * Falls back to the easiest words if the level cannot be read — a returning
 * player briefly getting words below their level beats being asked to set
 * themselves up again.
 */
async function fetchWordDifficulty(learning: string) {
  try {
    const res = await fetch(
      `/api/decks/level?language=${encodeURIComponent(learning)}`,
    );
    if (!res.ok) {
      throw new Error(`Level request failed (${res.status})`);
    }
    const data = (await res.json()) as { masteredCount?: number };
    return levelProgressFromMasteredCount(data.masteredCount ?? 0)
      .wordDifficulty;
  } catch {
    return "A1" as const;
  }
}

export function StartPlayingModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [openedByPlayer, setOpenedByPlayer] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const starting = useRef(false);
  const signedIn = Boolean(session?.user?.id);

  // Both triggers for these questions are on the signed-out path, so anyone who
  // signed up straight from /login was never asked them — and languageContext
  // quietly defaults an unanswered pair to English into German, so they have
  // been studying a language nobody chose. Being signed in is not evidence the
  // setup happened; a stored learning language is the only evidence there is.
  //
  // Derived rather than opened from an effect, which also closes it: the moment
  // the modal writes the pair, this goes false on the next render.
  const setupMissing =
    signedIn &&
    typeof window !== "undefined" &&
    readChosenLanguagePair() === null;

  const open = openedByPlayer || (setupMissing && !dismissed);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpenedByPlayer(next);
    // Closing an unanswered prompt puts it away for this page rather than for
    // good: the pair is still unset, so it is due to be asked again on the next
    // load rather than silently defaulted forever.
    if (!next) {
      setDismissed(true);
    }
  }, []);

  // The modal exists to ask three questions: the two languages and how much of
  // the learned one you already have. A signed-in player who has picked a pair
  // before has answered all three — the pair is stored, and the difficulty is
  // whatever their account level says — so being asked again is just a form
  // standing between them and the round. They go straight into it instead.
  const openModal = useCallback(() => {
    // Once the free round is spent there is nothing behind these questions to
    // let anyone into, so asking them again would only be a form to fill in on
    // the way to the same sign-up ask.
    if (!signedIn && !hasAnonPlaysRemaining()) {
      router.push(ONBOARDING_SIGN_UP_HREF);
      return;
    }

    const pair = signedIn ? readChosenLanguagePair() : null;

    if (!pair) {
      setOpenedByPlayer(true);
      return;
    }

    // The level lookup is a round trip, so the button would otherwise sit there
    // looking unpressed and collect a second click.
    if (starting.current) {
      return;
    }
    starting.current = true;

    void fetchWordDifficulty(pair.learning).then((level) => {
      starting.current = false;
      router.push(scoreRushHref({ ...pair, level }));
    });
  }, [router, signedIn]);

  return (
    <StartPlayingModalContext.Provider value={{ openModal }}>
      {children}
      <StartPlayingModal open={open} onOpenChange={handleOpenChange} />
    </StartPlayingModalContext.Provider>
  );
}

export function useStartPlayingModal(): StartPlayingModalContextValue {
  const context = useContext(StartPlayingModalContext);

  if (!context) {
    throw new Error(
      "useStartPlayingModal must be used within StartPlayingModalProvider",
    );
  }

  return context;
}
