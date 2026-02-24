"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import GameCard from "./_components/GameCard";
import Carousel from "./_components/GameCarousel";

export default function Home() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          Hello, welcome to KatchUp
        </h1>
        <h2 className="text-2xl text-center ">Choose game</h2>

        <Carousel />
      </main>
    </div>
  );
}
