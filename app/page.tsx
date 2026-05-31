"use client";
import { useRouter } from "next/navigation";
import { BookPlus, Swords, Trophy } from "lucide-react";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function Home() {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(".hero-item", {
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.15,
      ease: "power4.out",
      clearProps: "opacity,transform",
    });
    
    gsap.from(".feature-card", {
      y: 40,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      ease: "power3.out",
      clearProps: "opacity,transform",
      scrollTrigger: {
        trigger: ".feature-container",
        start: "top 90%", // Trigger slightly earlier on mobile
      }
    });
  }, { scope: container });

  const highlights = [
    {
      title: "Compete with Friends",
      description:
        "Jump into fast language battles, track wins, and keep the rivalry alive with live score pressure.",
      icon: Swords,
      accent: "from-cyan-500 to-blue-500",
    },
    {
      title: "Add Your Own Words",
      description:
        "Build personal decks from school, work, or travel vocabulary and train exactly what matters to you.",
      icon: BookPlus,
      accent: "from-blue-500 to-indigo-600",
    },
    {
      title: "See Real Progress",
      description:
        "Follow streaks, speed, and leaderboard rank so your improvement feels measurable every day.",
      icon: Trophy,
      accent: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="relative -mt-32 min-h-screen overflow-hidden bg-[#020617] pt-32 text-slate-100" ref={container}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.16),transparent_42%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.18),transparent_38%),radial-gradient(circle_at_50%_92%,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#020617_0%,#0b1128_55%,#030712_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20px_30px,rgba(255,255,255,0.95),transparent),radial-gradient(1px_1px_at_140px_90px,rgba(191,219,254,0.9),transparent),radial-gradient(1.5px_1.5px_at_260px_170px,rgba(255,255,255,0.9),transparent),radial-gradient(1px_1px_at_380px_260px,rgba(186,230,253,0.85),transparent),radial-gradient(1.5px_1.5px_at_520px_120px,rgba(255,255,255,0.95),transparent)] bg-size-[560px_320px] opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_60px_80px,rgba(255,255,255,0.7),transparent),radial-gradient(1.5px_1.5px_at_240px_140px,rgba(224,242,254,0.8),transparent),radial-gradient(1px_1px_at_420px_40px,rgba(255,255,255,0.75),transparent),radial-gradient(1px_1px_at_500px_230px,rgba(191,219,254,0.75),transparent)] bg-size-[620px_360px] opacity-45" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-8 sm:px-10 lg:px-16">
        <section className="page-surface rounded-3xl p-8 md:p-12">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <p className="hero-item mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-300">
              Language Learning Arena
            </p>

            <h1 className="hero-item text-6xl font-black tracking-tight text-slate-900 sm:text-7xl dark:text-slate-100">
              Ready?
            </h1>

            <p className="hero-item mt-4 max-w-2xl text-lg leading-relaxed text-slate-700 dark:text-slate-300 sm:text-xl">
              Train vocabulary in a modern way with{" "}
              <span className="font-bold">KatchUp</span>. Compete, customize,
              and improve with game-like energy.
            </p>

            <div className="hero-item mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-blue-500 bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Login / Register
              </button>
              <button
                type="button"
                onClick={() => router.push("/games")}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Start Playing
              </button>
            </div>
          </div>
        </section>

        <section className="feature-container grid grid-cols-1 gap-6 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="feature-card group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-black hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] dark:border-slate-700 dark:bg-slate-800/85 dark:hover:border-white/90 dark:hover:shadow-[0_0_30px_rgba(148,163,184,0.3)]"
              >
                <div
                  className={`mb-5 inline-flex rounded-2xl bg-linear-to-r ${item.accent} p-3 text-white shadow-lg`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-linear-to-r mt-32 from-slate-900 to-blue-950 p-8 text-white shadow-xl md:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
                Your Next Session
              </p>
              <h3 className="mt-2 text-3xl font-black tracking-tight">
                Turn 10 spare minutes into real vocabulary progress.
              </h3>
            </div>

            <button
              type="button"
              onClick={() => router.push("/games")}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-100"
            >
              Open Games
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
