"use client";
import Section from "./_components/Section";
import RollingImages from "./_components/RollingImages";
import CutePlayButton from "./_components/CutePlayButton";
import WelcomeSection from "./_components/WelcomeSection";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 pb-32 sm:px-16">
        <div className="flex flex-col items-center justify-center">
          <h1 className="mb-4 mt-8 w-full text-center text-3xl tracking-tight text-foreground sm:text-5xl">
            <span className="font-bold text-7xl">Ready?</span>
          </h1>
          <h2 className="text-3xl">
            for new way of learning with&nbsp;
            <span className="font-bold text-7xxl">KatchUp</span>
          </h2>
          <button
            type="button"
            // onClick={handleOpenLogin}
            className="inline-flex mt-12 items-center justify-center rounded-xl border border-blue-500 bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {"Register here :)"}
          </button>
        </div>

        <div>
          <WelcomeSection />
          <RollingImages />
          <Section color="yellow">
            <h2 className="text-4xl font-bold text-foreground">
              Lets make it!
            </h2>
            <p className="text-xl text-slate-700 dark:text-slate-300">
              One click and here we go!
            </p>

            <CutePlayButton />
          </Section>
        </div>
      </main>
    </div>
  );
}
