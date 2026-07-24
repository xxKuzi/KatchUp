"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

interface GameBannerProps {
  name: string;
  url: string;
  img: string;
  tagline: string;
  description: string;
  gradient: string;
}

function GameBanner({ name, url, img, tagline, description, gradient }: GameBannerProps) {
  const router = useRouter();

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/90 shadow-lg shadow-black/15 ring-1 ring-white/70 dark:border-slate-600 dark:shadow-slate-950/25 dark:ring-white/10">
      <div className="relative h-[340px] w-full sm:h-[380px] md:h-[420px]">
        <div
          style={{ backgroundImage: `url('/${img}')` }}
          className="absolute inset-0 bg-cover bg-center scale-105"
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t ${gradient} to-transparent`}
        />
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end p-8 sm:p-12 md:p-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            {tagline}
          </span>
          <h3 className="mt-4 max-w-2xl text-3xl font-black tracking-tight text-white drop-shadow-md sm:text-4xl md:text-5xl">
            {name}
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/90 drop-shadow-sm sm:text-base">
            {description}
          </p>
          <button
            type="button"
            onClick={() => router.push(url)}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl sm:text-base"
          >
            <Play className="h-4 w-4 fill-slate-900" />
            Play now
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameBanner;
