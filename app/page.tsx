"use client";
import { useRouter } from "next/navigation";
import { BookPlus, Swords, Trophy } from "lucide-react";

export default function Home() {
  const router = useRouter();

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
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-cyan-300/40 blur-3xl dark:bg-cyan-700/20" />
        <div className="absolute top-20 right-0 h-80 w-80 rounded-full bg-blue-300/50 blur-3xl dark:bg-blue-800/20" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-700/10" />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-20 pt-8 sm:px-10 lg:px-16">
        <section className="rounded-3xl border border-white/70 bg-white/75 p-8 shadow-xl backdrop-blur md:p-12 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-300">
              Language Learning Arena
            </p>

            <h1 className="text-6xl font-black tracking-tight sm:text-7xl">Ready?</h1>

            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-700 dark:text-slate-300 sm:text-xl">
              Train vocabulary in a modern way with <span className="font-bold">KatchUp</span>.
              Compete, customize, and improve with game-like energy.
            </p>

            <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="inline-flex items-center justify-center rounded-xl border border-blue-500 bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Login / Register
              </button>
              <button
                type="button"
                onClick={() => router.push("/games")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Start Playing
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  className={`mb-5 inline-flex rounded-2xl bg-gradient-to-r ${item.accent} p-3 text-white shadow-lg`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h2 className="text-2xl font-bold tracking-tight">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 to-blue-950 p-8 text-white shadow-xl md:p-10">
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
