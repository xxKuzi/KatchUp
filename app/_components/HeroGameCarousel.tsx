"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Play } from "lucide-react";

interface Slide {
  name: string;
  url: string;
  img: string;
  tagline: string;
  description: string;
  gradient: string;
}

const slides: Slide[] = [
  {
    name: "Live Online Duel",
    url: "/games/choose-one-multiplayer?mode=live",
    img: "flip_cards.png",
    tagline: "Live 1v1 · Race to 10",
    description:
      "Go head-to-head with another player in real time. Same ten prompts, pick the right translation faster than your rival. First to finish wins.",
    gradient: "from-emerald-900/90 via-emerald-900/40",
  },
  {
    name: "Score Rush (Async)",
    url: "/games/choose-one-multiplayer?mode=async",
    img: "one_of_three.png",
    tagline: "Leaderboard Climb · Speed & Accuracy",
    description:
      "Compete asynchronously against other players' ghost records. Answer quickly and accurately to climb the high score ladder.",
    gradient: "from-blue-900/90 via-blue-900/40",
  },
  {
    name: "Flip Cards",
    url: "/games/flip-cards",
    img: "flip_cards.png",
    tagline: "Self-paced flashcards",
    description:
      "A calm, no-timer deck for real study. Tap to flip between your language and the translation, swipe right when you know it or left to keep practicing.",
    gradient: "from-violet-900/90 via-violet-900/40",
  },
  {
    name: "One of Three",
    url: "/games/one-of-three",
    img: "one_of_three.png",
    tagline: "Quick choice rounds",
    description:
      "Pick the right translation out of three options before time runs out. Simple to learn, tough to master, and built for quick daily reps.",
    gradient: "from-rose-900/90 via-rose-900/40",
  },
];

function HeroGameCarousel() {
  const [index, setIndex] = useState(0);
  const router = useRouter();

  const goTo = (i: number) => {
    setIndex((i + slides.length) % slides.length);
  };

  const slide = slides[index];

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/90 shadow-lg shadow-black/15 ring-1 ring-white/70 dark:border-slate-600 dark:shadow-slate-950/25 dark:ring-white/10">
      <div className="relative h-[420px] w-full sm:h-[480px] md:h-[520px]">
        {slides.map((s, i) => (
          <div
            key={s.name}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              i === index ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <div
              style={{ backgroundImage: `url('/${s.img}')` }}
              className="absolute inset-0 bg-cover bg-center scale-105"
            />
            <div
              className={`absolute inset-0 bg-gradient-to-t ${s.gradient} to-transparent`}
            />
            <div className="relative z-10 flex h-full w-full flex-col items-start justify-end p-8 sm:p-12 md:p-16">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                {s.tagline}
              </span>
              <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-tight text-white drop-shadow-md sm:text-5xl md:text-6xl">
                {s.name}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 drop-shadow-sm sm:text-base md:text-lg">
                {s.description}
              </p>
              <button
                type="button"
                onClick={() => router.push(s.url)}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl sm:text-base"
              >
                <Play className="h-4 w-4 fill-slate-900" />
                Play now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Arrow */}
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur transition-all hover:scale-105 hover:bg-black/40"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 right-8 z-20 flex items-center gap-2 sm:right-12">
        {slides.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to ${s.name}`}
            className={`h-2.5 rounded-full transition-all ${
              i === index
                ? "w-8 bg-white"
                : "w-2.5 bg-white/50 hover:bg-white/75"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default HeroGameCarousel;
