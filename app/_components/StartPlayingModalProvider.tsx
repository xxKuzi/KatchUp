"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import StartPlayingModal from "./StartPlayingModal";
import {
  isSetupExemptPath,
  isVisitorPublicPath,
} from "../_lib/onboardingGate";
import { useLanguage } from "../_lib/languageContext";
import { useOnboardingStatus } from "../_lib/useOnboardingStatus";
import { usePlacementClaim } from "../_lib/usePlacementClaim";
import type { Lang } from "../_lib/languages";

interface StartPlayingModalContextValue {
  openModal: () => void;
}

const StartPlayingModalContext = createContext<
  StartPlayingModalContextValue | undefined
>(undefined);

export function StartPlayingModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useOnboardingStatus();
  const { language, learningLanguage } = useLanguage();
  const [requested, setRequested] = useState(false);
  // A pair the player has taken through this dialog on a language the server
  // itself says is already placed. Not a dismissal — it is the answer to the
  // only question the dialog had, kept so that a status which somehow still
  // reads "owed" cannot put the same answered dialog straight back up and leave
  // the button doing nothing. It lasts only as long as the pair does.
  const [answered, setAnswered] = useState<{
    speak: Lang;
    learning: Lang;
  } | null>(null);

  // A test sat before signing up is spent here, wherever in the app the sign-in
  // happens to land — it is the only thing a visitor's test left behind.
  usePlacementClaim();

  const owed = status.state === "needsSetup" || status.state === "needsPlacement";

  // Where the prompt puts itself up unasked. For a player it is everywhere the
  // app actually is: they signed in to study, and there is no level to study at
  // yet. For a visitor it is everywhere except the pages they are allowed to
  // read first — until they press Start playing, which is what `requested` is.
  //
  // There is no dismissal either way. Once it is up the only route past it is
  // through it, and leaving the page only means being asked again on the way
  // back, since nothing was answered.
  const forced = status.signedIn
    ? !isSetupExemptPath(pathname)
    : !isVisitorPublicPath(pathname);

  const settled =
    answered?.speak === language && answered?.learning === learningLanguage;

  const open =
    owed && !settled && (forced || (requested && !isSetupExemptPath(pathname)));

  // Called when the dialog has nothing left to ask: the pair is set and this
  // language is placed on the server already.
  const handleResolved = useCallback((pair: { speak: Lang; learning: Lang }) => {
    setRequested(false);
    setAnswered(pair);
  }, []);

  const openModal = useCallback(() => {
    if (status.state === "loading") {
      return;
    }

    if (owed) {
      // On the two pages the prompt is not allowed to cover, the button's job is
      // to take them somewhere it is — pressing it there and having nothing
      // happen would read as a broken button.
      if (isSetupExemptPath(pathname)) {
        router.push("/");
        return;
      }

      setRequested(true);
      return;
    }

    // Nothing owed and no account: the test has been sat and the result is
    // sitting in a browser with nowhere to go. Every game is behind sign-in, so
    // that is where this leads rather than into a round that would bounce them
    // straight back here.
    if (!status.signedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/games")}`);
      return;
    }

    // Set up and placed: this has nothing left to ask, so it gets out of the
    // way and hands over to the games index. Picking a game out of that list is
    // the player's to make — dropping them into one because they pressed a
    // button that said "play" is answering a question nobody put to them.
    router.push("/games");
  }, [owed, pathname, router, status.signedIn, status.state]);

  return (
    <StartPlayingModalContext.Provider value={{ openModal }}>
      {children}
      <StartPlayingModal open={open} onResolved={handleResolved} />
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
