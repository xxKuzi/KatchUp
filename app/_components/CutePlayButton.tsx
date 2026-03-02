import React from "react";
import { useRouter } from "next/navigation";

export default function CutePlayButton() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center">
      {/* Button Wrapper */}
      <button
        onClick={() => router.push("/games")}
        className="relative group outline-none focus:outline-none"
      >
        {/* 1. 3D Base/Shadow Layer (The physical 'bottom' of the arcade button) */}
        <div className="absolute inset-0 bg-fuchsia-900 rounded-full translate-y-2 group-active:translate-y-1 transition-transform duration-200 ease-out"></div>

        {/* 2. Main Button Surface */}
        <div className="relative flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-cyan-400 via-amber-400 via-pink-500 to-violet-500 rounded-full transform group-hover:-translate-y-1 group-active:translate-y-1 transition-all duration-200 ease-out overflow-hidden shadow-lg group-hover:shadow-pink-500/50">
          {/* Glossy Top Highlight (Gives it that shiny, plastic bubble look) */}
          <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-white/50 to-transparent rounded-t-full"></div>

          {/* Sweeping Animated Glare */}
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] group-hover:animate-shine"></div>

          {/* 3. Gamepad Icon */}
          <svg
            className="w-7 h-7 text-white drop-shadow-md group-hover:animate-wiggle"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M21.58 7.19c-.23-.86-.97-1.49-1.85-1.61L12 5.25 4.27 5.58c-.88.12-1.62.75-1.85 1.61L1 15.5c-.17.65.04 1.34.54 1.8.46.42 1.13.56 1.74.37l3.66-1.12c.38-.12.79-.11 1.16.03l2.4 1.2c.94.47 2.06.47 3 0l2.4-1.2c.37-.14.78-.15 1.16-.03l3.66 1.12c.61.19 1.28.05 1.74-.37.5-.46.71-1.15.54-1.8l-1.42-8.31zM9 11.5H7.5V13h-1v-1.5H5v-1h1.5V9h1v1.5H9v1zm8.5 1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2-2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
          </svg>

          {/* 4. Playful Typography */}
          <span className="relative text-white font-black text-2xl tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)] z-10">
            LET'S PLAY
          </span>

          {/* 5. Decorative Sparkles */}
          <div className="absolute top-3 right-5 w-2 h-2 bg-yellow-200 rounded-full animate-ping opacity-75"></div>
          <div className="absolute bottom-3 left-6 w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
        </div>
      </button>
    </div>
  );
}
