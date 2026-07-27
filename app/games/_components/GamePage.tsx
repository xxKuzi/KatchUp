"use client";

import React from "react";

interface GamePageProps {
  name: string;
  description: string;
  bgImage: string;
  children: React.ReactNode;
  heroFirst?: boolean;
}

export default function GamePage(props: GamePageProps) {
  const { name, description, bgImage, children, heroFirst = false } = props;
  const normalizedBgImage = bgImage.startsWith("/") ? bgImage : `/${bgImage}`;
  const hero = (
    <section
      style={{ backgroundImage: `url('${normalizedBgImage}')` }}
      className="relative overflow-hidden rounded-2xl border border-white/20 bg-cover bg-center px-6 py-10 text-white shadow-lg"
    >
      <div className="absolute inset-0 bg-linear-to-r from-black/75 to-black/30" />
      <div className="relative z-10 max-w-2xl">
        <h1 className="text-3xl font-bold sm:text-5xl">{name}</h1>
        <p className="mt-3 text-sm text-zinc-100 sm:text-base">{description}</p>
      </div>
    </section>
  );

  return (
    // The root layout already renders the Navbar (and the spacer that clears
    // the fixed bar), so this only lays out the page below it.
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-10 sm:px-8">
        {heroFirst && hero}

        <section className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {children}
        </section>

        {!heroFirst && hero}
      </div>
    </div>
  );
}
