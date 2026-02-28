"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import GameCard from "./_components/GameCard";
import Carousel from "./_components/GameCarousel";
import { TrendingUpDown, Star } from "lucide-react";
import Navbar from "./_components/Navbar";

export default function Home() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Navbar />
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <h1 className="text-3xl tracking-tight text-left w-full text-gray-900 dark:text-white sm:text-5xl">
          <span className="font-bold text-7xl">Hello</span>, welcome to{" "}
          <span className="font-bold text-7xxl">KatchUp</span>...
        </h1>
        <h2 className="mb-12 text-5xl text-center mt-16 w-full">
          <span className="font-bold">Top</span> picks
          <Star className="inline ml-2" />
        </h2>
        <div className="flex items-center w-full justify-center gap-20">
          <GameCard
            name="Flip Cards"
            url="games/flip-cards"
            img="flip_cards.png"
            color="yellow"
            description="hello"
            feature="favorite"
            featureColor="green"
          />
          <GameCard
            name="One of Three"
            url="games/one-of-three"
            img="one_of_three.png"
            color="red"
            description="hello"
            feature="popular"
            featureColor="blue"
          />
        </div>
        <div className="xl:w-[70%] border mt-20 border-white/[40%]" />
        <h2 className="mb-6 text-5xl mt-40 text-center mr-[70%] w-full">
          <span className="font-bold ">Explore</span> more
          <TrendingUpDown className="inline ml-2" />
        </h2>
        <Carousel />
      </main>
    </div>
  );
}
