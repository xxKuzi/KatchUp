"use client";
import GameCard from "./../_components/GameCard";
import Carousel from "./../_components/GameCarousel";
import { TrendingUpDown, Star } from "lucide-react";

export default function Games() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-foreground">
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 pb-32 sm:px-16">
        <h1 className="w-full text-left text-3xl tracking-tight text-foreground sm:text-5xl">
          <span className="font-bold text-7xl">Hello</span>, welcome to{" "}
          <span className="font-bold text-7xxl">KatchUp</span>...
        </h1>
        <h2 className="mb-12 mt-16 w-full text-center text-5xl text-foreground">
          <span className="font-bold">Top</span> picks
          <Star className="inline ml-2" />
        </h2>
        <div className="flex w-full items-center justify-center gap-6 lg:gap-20">
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
        <div className="mt-20 border border-slate-300/70 dark:border-slate-700 xl:w-[70%]" />
        <h2 className="mb-6 mt-40 mr-[70%] w-full text-center text-5xl text-foreground">
          <span className="font-bold ">Explore</span> more
          <TrendingUpDown className="inline ml-2" />
        </h2>
        <Carousel />
      </main>
    </div>
  );
}
