"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import GameCard from "./_components/GameCard";
import Carousel from "./_components/GameCarousel";

export default function Home() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Hello, welcome to KatchUp
        </h1>
        <h2 className="text-2xl text-center mt-16 mb-4 w-full">Choose game</h2>
        <div className="flex items-center justify-center gap-10">
          <GameCard
            name="Flip Cards"
            url="flip-cards"
            img="flip_cards.png"
            color="yellow"
            description="hello"
            feature="favorite"
            featureColor="green"
          />
          <GameCard
            name="One of Three"
            url="one-of-three"
            img="one_of_three.png"
            color="red"
            description="hello"
            feature="popular"
            featureColor="blue"
          />
          <GameCard
            name="Flip Cards"
            url="one-of-three"
            img="flip_cards.png"
            description="hello"
          />
          <GameCard
            name="Flip Cards"
            url="one-of-three"
            img="flip_cards.png"
            description="hello"
          />
        </div>
        <Carousel />
      </main>
    </div>
  );
}
