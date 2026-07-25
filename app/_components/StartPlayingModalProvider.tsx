"use client";

import { createContext, useContext, useState } from "react";
import StartPlayingModal from "./StartPlayingModal";

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
  const [open, setOpen] = useState(false);

  return (
    <StartPlayingModalContext.Provider
      value={{ openModal: () => setOpen(true) }}
    >
      {children}
      <StartPlayingModal open={open} onOpenChange={setOpen} />
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
