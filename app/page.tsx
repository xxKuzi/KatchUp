"use client";
import Section from "./_components/Section";
import RollingImages from "./_components/RollingImages";
import CutePlayButton from "./_components/CutePlayButton";
import WelcomeSection from "./_components/WelcomeSection";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 pb-32 sm:px-16">
        <h1 className="mb-16 mt-8 w-full text-left text-3xl tracking-tight text-foreground sm:text-5xl">
          <span className="font-bold text-7xl">Hello</span>, welcome to{" "}
          <span className="font-bold text-7xxl">KatchUp</span>...
        </h1>
        <div>
          <WelcomeSection />
          <RollingImages />
          <Section>
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
