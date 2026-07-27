"use client";
import { useRouter } from "next/navigation";
import { BookPlus, Swords, Trophy } from "lucide-react";
import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSession } from "@/lib/auth-client";
import { useStartPlayingModal } from "./_components/StartPlayingModalProvider";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Float Animation Badges Type
interface LanguageBubble {
  text: string;
  size: string;
  color: string;
  border: string;
  top: string;
  left: string;
  animation: string;
}

const floatingLanguages: LanguageBubble[] = [
  {
    text: "hallo",
    size: "text-sm",
    color: "text-cyan-600/30 dark:text-cyan-400/25",
    border: "border-cyan-500/10",
    top: "15%",
    left: "8%",
    animation: "animate-float-slow",
  },
  {
    text: "hola",
    size: "text-base font-bold",
    color: "text-blue-600/40 dark:text-blue-400/30",
    border: "border-blue-500/20",
    top: "22%",
    left: "82%",
    animation: "animate-float-medium",
  },
  {
    text: "bonjour",
    size: "text-xs",
    color: "text-indigo-600/35 dark:text-indigo-400/25",
    border: "border-indigo-500/10",
    top: "58%",
    left: "10%",
    animation: "animate-float-fast",
  },
  {
    text: "ciao",
    size: "text-sm font-semibold",
    color: "text-amber-600/35 dark:text-amber-400/25",
    border: "border-amber-500/15",
    top: "48%",
    left: "90%",
    animation: "animate-float-slow",
  },
  {
    text: "ready?",
    size: "text-xs tracking-wider uppercase font-black",
    color: "text-emerald-600/40 dark:text-emerald-400/30",
    border: "border-emerald-500/10",
    top: "74%",
    left: "16%",
    animation: "animate-float-medium",
  },
  {
    text: "sprichst du...",
    size: "text-xs italic",
    color: "text-slate-600/30 dark:text-slate-400/25",
    border: "border-slate-500/10",
    top: "82%",
    left: "74%",
    animation: "animate-float-fast",
  },
];

function CompeteWidget() {
  return (
    <div className="relative mt-6 flex h-32 w-full items-center justify-between rounded-2xl bg-slate-500/5 p-4 border border-slate-500/10 overflow-hidden group-hover:border-cyan-500/20 transition-all duration-300">
      {/* Glow highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Player 1 (You) */}
      <div className="pvp-avatar-left flex flex-col items-center gap-1.5 z-10 transition-transform duration-500 group-hover:translate-x-1.5">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-cyan-500 bg-cyan-950/40 p-0.5 shadow-lg shadow-cyan-500/10">
            <img
              src="https://i.pravatar.cc/100?img=12"
              alt="You"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950">
            You
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 transition-colors duration-300">
          Score: 9
        </span>
      </div>

      {/* VS Badge */}
      <div className="vs-badge relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 font-black text-xs text-slate-600 dark:text-slate-300 group-hover:scale-110 group-hover:border-cyan-500 group-hover:text-cyan-500 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all duration-500">
        VS
      </div>

      {/* Player 2 (Opponent) */}
      <div className="pvp-avatar-right flex flex-col items-center gap-1.5 z-10 transition-transform duration-500 group-hover:-translate-x-1.5">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-amber-500 bg-amber-950/40 p-0.5 shadow-lg shadow-amber-500/10">
            <img
              src="https://i.pravatar.cc/100?img=47"
              alt="Opponent"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-slate-950">
            AI
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-amber-500 transition-colors duration-300">
          Score: 8
        </span>
      </div>

      {/* Progress Bars */}
      <div className="absolute bottom-2 left-4 right-4 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
        <div
          className="pvp-bar-left h-full bg-cyan-500"
          style={{ width: "55%", transformOrigin: "left" }}
        />
        <div
          className="h-full bg-slate-200 dark:bg-slate-800"
          style={{ width: "5%" }}
        />
        <div
          className="pvp-bar-right h-full bg-amber-500"
          style={{ width: "40%", transformOrigin: "right" }}
        />
      </div>
    </div>
  );
}

function VocabDeckWidget() {
  return (
    <div className="relative mt-6 flex h-32 w-full items-center justify-center rounded-2xl bg-slate-500/5 p-4 border border-slate-500/10 overflow-hidden group-hover:border-blue-500/20 transition-all duration-300">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative h-20 w-36">
        {/* Card 1: Bottom left */}
        <div
          className="vocab-card-1 absolute inset-0 flex flex-col justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-850 dark:bg-slate-950 p-2 shadow-md transition-all duration-500 ease-out origin-bottom-left translate-x-[-8px] translate-y-[-4px] rotate-[-5deg]
          group-hover:translate-x-[-18px] group-hover:translate-y-[-10px] group-hover:rotate-[-12deg] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400">
              DECK: TRAVEL
            </span>
            <span className="text-[9px]">✈️</span>
          </div>
          <p className="text-center font-bold text-[11px] text-blue-500 dark:text-blue-400">
            der Koffer
          </p>
          <p className="text-right text-[8px] text-slate-400">suitcase</p>
        </div>

        {/* Card 2: Bottom right */}
        <div
          className="vocab-card-2 absolute inset-0 flex flex-col justify-between rounded-xl border border-slate-200 bg-white dark:border-slate-850 dark:bg-slate-950 p-2 shadow-md transition-all duration-500 ease-out origin-bottom-right translate-x-[8px] translate-y-[-4px] rotate-[5deg]
          group-hover:translate-x-[18px] group-hover:translate-y-[-10px] group-hover:rotate-[12deg] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400">
              DECK: FOOD
            </span>
            <span className="text-[9px]">🍎</span>
          </div>
          <p className="text-center font-bold text-[11px] text-indigo-500 dark:text-indigo-400">
            la manzana
          </p>
          <p className="text-right text-[8px] text-slate-400">apple</p>
        </div>

        {/* Card 3: Top/Middle */}
        <div
          className="vocab-card-3 absolute inset-0 flex flex-col justify-between rounded-xl border border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 p-2 shadow-lg transition-all duration-500 ease-out translate-y-[-8px] scale-[1.02]
          group-hover:translate-y-[-16px] group-hover:scale-105 group-hover:border-blue-500 group-hover:shadow-[0_8px_16px_rgba(59,130,246,0.15)] dark:group-hover:shadow-[0_8px_16px_rgba(59,130,246,0.3)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
              DECK: LIFE
            </span>
            <span className="text-[9px]">✨</span>
          </div>
          <p className="text-center font-black text-xs text-slate-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-300">
            KatchUp
          </p>
          <p className="text-right text-[8px] text-slate-500 dark:text-slate-400">
            vocabulary
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressChartWidget({ isCardHovered }: { isCardHovered?: boolean }) {
  const [isSelfHovered, setIsSelfHovered] = useState(false);
  const isHovered = isCardHovered || isSelfHovered;

  return (
    <div
      onMouseEnter={() => setIsSelfHovered(true)}
      onMouseLeave={() => setIsSelfHovered(false)}
      className="relative mt-6 flex h-32 w-full items-center justify-center rounded-2xl bg-slate-500/5 p-4 border border-slate-500/10 overflow-hidden group-hover:border-amber-500/20 transition-all duration-300"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* SVG Sparkline */}
      <svg className="h-full w-full overflow-visible z-10" viewBox="0 0 200 80">
        <defs>
          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line
          x1="0"
          y1="20"
          x2="200"
          y2="20"
          stroke="rgba(148,163,184,0.08)"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="40"
          x2="200"
          y2="40"
          stroke="rgba(148,163,184,0.08)"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="60"
          x2="200"
          y2="60"
          stroke="rgba(148,163,184,0.08)"
          strokeWidth="1"
        />

        {/* Filled area */}
        <path
          d="M 0 70 L 30 65 L 60 45 L 90 55 L 120 30 L 150 35 L 200 10 L 200 80 L 0 80 Z"
          fill="url(#chartGlow)"
          className="transition-opacity duration-700"
          style={{ opacity: isHovered ? 1 : 0.4 }}
        />

        {/* Main path */}
        <path
          d="M 0 70 L 30 65 L 60 45 L 90 55 L 120 30 L 150 35 L 200 10"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`sparkline-path ${isHovered ? "animate-sparkline" : "transition-all duration-700 ease-out"}`}
          style={{
            strokeDasharray: 300,
            strokeDashoffset: isHovered ? undefined : 80,
          }}
        />

        {/* Glowing dot tracking end */}
        <circle
          cx="200"
          cy="10"
          r="4.5"
          fill="#f59e0b"
          className="transition-all duration-1000 ease-out sparkline-dot"
          style={{
            transformOrigin: "200px 10px",
            transform: isHovered ? "scale(1.4)" : "scale(1)",
            opacity: isHovered ? 1 : 0,
            transitionDelay: isHovered ? "0.9s" : "0s",
            filter: "drop-shadow(0 0 6px #f59e0b)",
          }}
        />
      </svg>

      {/* Streak Counter Overlay */}
      <div className="absolute top-2 right-3 z-20 flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 border border-amber-500/20 text-[9px] font-black text-amber-600 dark:text-amber-400 group-hover:scale-105 group-hover:bg-amber-500/20 transition-all duration-300">
        🔥 5 DAY STREAK
      </div>
    </div>
  );
}

function SpotlightCard({
  children,
  className = "",
  accent = "cyan",
  onHoverChange,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "cyan" | "blue" | "amber";
  onHoverChange?: (hovered: boolean) => void;
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onHoverChange) {
      onHoverChange(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onHoverChange) {
      onHoverChange(false);
    }
  };

  const glowColor = {
    cyan: "rgba(6, 182, 212, 0.15)",
    blue: "rgba(59, 130, 246, 0.15)",
    amber: "rgba(245, 158, 11, 0.15)",
  }[accent];

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-xs transition duration-300 dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-md hover:-translate-y-1 hover:border-slate-350 dark:hover:border-slate-700 ${className}`}
      style={{
        boxShadow: isHovered
          ? `0 20px 40px -15px ${glowColor}, 0 0 30px 1px ${glowColor}`
          : undefined,
      }}
    >
      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, ${glowColor}, transparent 80%)`,
        }}
      />
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[linear-gradient(to_right,rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.4)_1px,transparent_1px)] bg-[size:16px_16px]" />

      {/* Content wrapper */}
      <div className="relative z-10 flex h-full flex-col justify-between">
        {children}
      </div>
    </div>
  );
}

/**
 * One of the two buttons under the hero headline.
 *
 * The look is a slot rather than a fixed property of either action: the blue
 * one is whatever the visitor is most likely here to do, which is signing up
 * while signed out and playing once signed in. Both keep their position either
 * way, so the pair never rearranges itself under someone who just logged in.
 */
function HeroButton({
  look,
  onClick,
  children,
}: {
  look: "blue" | "dark";
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (look === "blue") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative overflow-hidden group inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 dark:from-blue-500 dark:to-indigo-500"
      >
        {/* Shimmer line */}
        <div
          className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-[-25deg] -translate-x-full group-hover:animate-[shimmer_0.75s_ease-out]"
          style={{ content: '""' }}
        />
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-7 py-3.5 font-bold text-slate-100 border border-slate-800 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-slate-950 dark:text-white dark:border-slate-850 dark:hover:border-slate-700"
    >
      {/* Glow border on hover */}
      <div className="absolute -inset-px rounded-xl bg-linear-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-30 blur-xs transition-opacity duration-300 pointer-events-none" />
      <span className="relative z-10 flex items-center gap-1.5">{children}</span>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const { data: session } = useSession();
  const { openModal } = useStartPlayingModal();

  useGSAP(
    () => {
      // 1. Hero card dealt from below (flicks up and settles)
      const heroTl = gsap.timeline();

      heroTl.fromTo(
        ".hero-card",
        { y: 220, scale: 0.88, rotate: -3, opacity: 0 },
        {
          y: 0,
          scale: 1,
          rotate: 0,
          opacity: 1,
          duration: 1.2,
          ease: "back.out(1.15)",
          clearProps: "transform",
        },
      );

      // Hero items stagger in right after card lands
      heroTl.fromTo(
        ".hero-item",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.15,
          ease: "power3.out",
          clearProps: "opacity,transform",
        },
        "-=0.6",
      );

      // 2. Feature cards dealing timeline (flows like cards dealt from a wrist deck)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".feature-container",
          start: "top 88%",
          once: true,
        },
      });

      const cards = gsap.utils.toArray<HTMLElement>(".feature-card");
      if (cards.length >= 3) {
        const isMobile =
          typeof window !== "undefined" && window.innerWidth < 768;
        const xOffset = isMobile ? 0 : 340;
        const yOffset = isMobile ? 180 : 250;

        // Deal Card 1 (Flicks to the left column)
        tl.fromTo(
          cards[0],
          {
            x: xOffset,
            y: yOffset,
            scale: 0.5,
            rotate: isMobile ? -10 : -40,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            opacity: 1,
            duration: 0.9,
            ease: "back.out(1.2)",
          },
        );
        // Activate PvP inside Card 1 (with dynamic avatars clash, VS spin-pop & scores animation)
        tl.fromTo(
          ".pvp-avatar-left",
          { x: -60, opacity: 0 },
          { x: 12, opacity: 1, duration: 0.5, ease: "power2.out" },
          "-=0.4",
        )
          .fromTo(
            ".pvp-avatar-right",
            { x: 60, opacity: 0 },
            { x: -12, opacity: 1, duration: 0.5, ease: "power2.out" },
            "<",
          )
          .to(".pvp-avatar-left", {
            x: 0,
            duration: 0.35,
            ease: "back.out(2)",
            clearProps: "transform",
          })
          .to(
            ".pvp-avatar-right",
            {
              x: 0,
              duration: 0.35,
              ease: "back.out(2)",
              clearProps: "transform",
            },
            "<",
          )
          .fromTo(
            ".vs-badge",
            { scale: 0.4, opacity: 0, rotate: -180 },
            {
              scale: 1,
              opacity: 1,
              rotate: 0,
              duration: 0.5,
              ease: "back.out(2.2)",
              clearProps: "all",
            },
            "-=0.3",
          )
          .fromTo(
            ".pvp-bar-left",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.8, ease: "power3.out" },
            "-=0.2",
          )
          .fromTo(
            ".pvp-bar-right",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.8, ease: "power3.out" },
            "<",
          );

        // Deal Card 2 (Flicks straight down-center)
        tl.fromTo(
          cards[1],
          {
            x: 0,
            y: yOffset,
            scale: 0.5,
            rotate: isMobile ? 5 : -10,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            opacity: 1,
            duration: 0.9,
            ease: "back.out(1.2)",
          },
          "-=1.22",
        );
        // Activate Vocab Deck inside Card 2
        tl.fromTo(
          ".vocab-card-1",
          { x: -45, y: -20, rotate: -25, opacity: 0 },
          {
            x: -8,
            y: -4,
            rotate: -5,
            opacity: 1,
            duration: 0.6,
            ease: "power3.out",
            clearProps: "transform",
          },
          "-=0.8",
        )
          .fromTo(
            ".vocab-card-2",
            { x: 45, y: -20, rotate: 25, opacity: 0 },
            {
              x: 8,
              y: -4,
              rotate: 5,
              opacity: 1,
              duration: 0.6,
              ease: "power3.out",
              clearProps: "transform",
            },
            "<",
          )
          .fromTo(
            ".vocab-card-3",
            { y: -28, scale: 1.15, opacity: 0 },
            {
              y: -8,
              scale: 1.02,
              opacity: 1,
              duration: 0.6,
              ease: "power3.out",
              clearProps: "transform,scale",
            },
            "<",
          );

        // Deal Card 3 (Flicks to the right column)
        tl.fromTo(
          cards[2],
          {
            x: -xOffset,
            y: yOffset,
            scale: 0.5,
            rotate: isMobile ? -5 : 40,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            opacity: 1,
            duration: 0.9,
            ease: "back.out(1.2)",
          },
          "-=1.02",
        );
        // Activate Sparkline inside Card 3 (starts 1s after Card 3 lands)
        tl.fromTo(
          ".sparkline-path",
          { strokeDashoffset: 300 },
          { strokeDashoffset: 80, duration: 1.2, ease: "power2.out" },
          "+=0.6",
        ).fromTo(
          ".sparkline-dot",
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: "power2.out" },
          "-=0.4",
        );

        // 3. CTA Banner deal (appended to play sequentially after feature card 3 lands & activates)
        tl.fromTo(
          ".cta-card",
          { y: 150, scale: 0.9, rotate: -2, opacity: 0 },
          {
            y: 0,
            scale: 1,
            rotate: 0,
            opacity: 1,
            duration: 1.1,
            ease: "back.out(1.1)",
            clearProps: "transform",
          },
          "-=0.50",
        );

        tl.fromTo(
          ".cta-item",
          { y: 25, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out",
            clearProps: "transform",
          },
          "-=1.0",
        );
      }
    },
    { scope: container },
  );

  const highlights = [
    {
      title: "Compete with Friends",
      description:
        "Jump into fast language battles, track wins, and keep the rivalry alive with live score pressure.",
      icon: Swords,
      accent: "from-cyan-500 to-blue-500",
      accentName: "cyan" as const,
      widget: <CompeteWidget />,
    },
    {
      title: "Add Your Own Words",
      description:
        "Build personal decks from school, work, or travel vocabulary and train exactly what matters to you.",
      icon: BookPlus,
      accent: "from-blue-500 to-indigo-600",
      accentName: "blue" as const,
      widget: <VocabDeckWidget />,
    },
    {
      title: "See Real Progress",
      description:
        "Follow streaks, speed, and leaderboard rank so your improvement feels measurable every day.",
      icon: Trophy,
      accent: "from-amber-500 to-orange-500",
      accentName: "amber" as const,
      widget: <ProgressChartWidget />,
    },
  ];

  return (
    <div
      className="relative -mt-32 min-h-screen overflow-hidden bg-[#020617] pt-32 text-slate-100"
      ref={container}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.16),transparent_42%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_50%_92%,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#020617_0%,#0b1128_55%,#030712_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20px_30px,rgba(255,255,255,0.95),transparent),radial-gradient(1px_1px_at_140px_90px,rgba(191,219,254,0.9),transparent),radial-gradient(1.5px_1.5px_at_260px_170px,rgba(255,255,255,0.9),transparent),radial-gradient(1px_1px_at_380px_260px,rgba(186,230,253,0.85),transparent),radial-gradient(1.5px_1.5px_at_520px_120px,rgba(255,255,255,0.95),transparent)] bg-size-[560px_320px] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_60px_80px,rgba(255,255,255,0.7),transparent),radial-gradient(1.5px_1.5px_at_240px_140px,rgba(224,242,254,0.8),transparent),radial-gradient(1px_1px_at_420px_40px,rgba(255,255,255,0.75),transparent),radial-gradient(1px_1px_at_500px_230px,rgba(191,219,254,0.75),transparent)] bg-size-[620px_360px] opacity-45" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-8 sm:px-10 lg:px-16">
        {/* Floating background elements */}
        <div className="absolute inset-x-0 top-0 h-[500px] pointer-events-none select-none z-0 overflow-hidden">
          {floatingLanguages.map((bubble, i) => (
            <div
              key={bubble.text + i}
              style={{ top: bubble.top, left: bubble.left }}
              className={`absolute flex items-center gap-1.5 rounded-full border border-slate-500/10 bg-slate-900/10 px-3 py-1 backdrop-blur-xs ${bubble.color} ${bubble.size} ${bubble.animation}`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-60" />
              {bubble.text}
            </div>
          ))}
        </div>

        <section className="hero-card opacity-0 page-surface rounded-3xl p-8 md:p-12 z-10 relative">
          {/* Subtle decoration inside the surface */}
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-500/5 blur-2xl pointer-events-none" />

          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <p className="hero-item mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Language Learning Arena
            </p>

            <h1 className="hero-item text-7xl font-black tracking-tight text-slate-900 sm:text-8xl dark:text-slate-100 mt-2 leading-none">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-cyan-400 via-blue-500 to-indigo-500 dark:from-cyan-300 dark:via-blue-400 dark:to-indigo-400 drop-shadow-[0_2px_15px_rgba(59,130,246,0.2)]">
                Ready?
              </span>
            </h1>

            <p className="hero-item mt-6 max-w-2xl text-lg leading-relaxed text-slate-700 dark:text-slate-300 sm:text-xl font-medium">
              Train vocabulary in a modern way with{" "}
              <span className="bg-clip-text text-transparent bg-linear-to-r from-blue-500 to-cyan-500 dark:from-blue-400 dark:to-cyan-400 font-bold">
                KatchUp
              </span>
              . Compete, customize, and improve with game-like energy.
            </p>

            <div className="hero-item mt-10 flex w-full max-w-md flex-col gap-4 sm:flex-row sm:justify-center">
              {session ? (
                <HeroButton
                  look="dark"
                  onClick={() => router.push("/my-decks")}
                >
                  Go to Decks
                </HeroButton>
              ) : (
                <HeroButton look="blue" onClick={() => router.push("/login")}>
                  Login / Register
                </HeroButton>
              )}

              {/* One entry point for everyone. Being signed in is not evidence
                  the setup happened — an account can be brand new, or have just
                  switched to a language it has never been placed in — so the
                  button asks what is still owed rather than assuming, and goes
                  straight into a round when the answer is nothing. */}
              <HeroButton look={session ? "blue" : "dark"} onClick={openModal}>
                Start Playing
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </HeroButton>
            </div>
          </div>
        </section>

        <section className="feature-container grid grid-cols-1 gap-6 md:grid-cols-3 z-10 relative">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            const isCardHovered = hoveredCard === index;

            return (
              <SpotlightCard
                key={item.title}
                accent={item.accentName}
                className="feature-card opacity-0 group flex flex-col justify-between"
                onHoverChange={(hovered) =>
                  setHoveredCard(hovered ? index : null)
                }
              >
                <div>
                  <div
                    className={`mb-5 inline-flex rounded-2xl bg-linear-to-r ${item.accent} p-3.5 text-white shadow-md shadow-black/10`}
                  >
                    <Icon className="h-5.5 w-5.5" />
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-355 font-medium">
                    {item.description}
                  </p>
                </div>

                {/* Sub-widget matching the card action */}
                {index === 2 ? (
                  <ProgressChartWidget isCardHovered={isCardHovered} />
                ) : (
                  item.widget
                )}
              </SpotlightCard>
            );
          })}
        </section>

        <section className="cta-card opacity-0 relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-slate-100 via-slate-50 to-blue-50/35 p-8 text-slate-900 shadow-xl md:p-12 mt-32 dark:border-slate-850 dark:bg-slate-950 dark:text-white dark:animate-mesh dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/80">
          {/* Glowing spots */}
          <div className="absolute -left-16 -top-16 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 h-32 w-32 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <p className="cta-item opacity-0 inline-flex rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                Your Next Session
              </p>
              <h3 className="cta-item opacity-0 mt-4 text-3xl font-black tracking-tight leading-tight sm:text-4xl text-slate-900 dark:text-slate-100">
                Turn 10 spare minutes into real vocabulary progress.
              </h3>
            </div>

            <button
              type="button"
              onClick={() => router.push("/games")}
              className="cta-item opacity-0 group relative overflow-hidden inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-900 px-7 py-3.5 text-sm font-bold transition duration-300 hover:scale-[1.03] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] shadow-lg"
            >
              <span className="flex items-center gap-1.5">
                Open Games
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
