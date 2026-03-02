"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import GameCard from "./_components/GameCard";
import Carousel from "./_components/GameCarousel";
import { TrendingUpDown, Star } from "lucide-react";
import Navbar from "./_components/Navbar";
import Section from "./_components/Section";
import RollingImages from "./_components/RollingImages";
import CutePlayButton from "./_components/CutePlayButton";

export default function Home() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <Navbar />
      <main className="flex min-h-screen w-full flex-col items-center justify-center pb-32 px-16 bg-white dark:bg-black">
        <div>
          <Section>
            <h2 className="text-4xl font-bold text-blue-500">Learn fast</h2>
            <p className="text-blue-500 text-xl">
              learn from our big database of actually{" "}
              <span className="font-bold">useful</span> words
            </p>
          </Section>
          <RollingImages />
          <Section>
            <h2 className="text-4xl font-bold ">Lets make it!</h2>
            <p className="text-xl">One click and here we go!</p>

            <CutePlayButton />
          </Section>
        </div>
      </main>
    </div>
  );
}
