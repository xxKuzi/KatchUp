import React, { useRef } from "react";
import GameCard from "./GameCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

function GameCarousel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cards = [
    {
      name: "One of Three",
      url: "/games/one-of-three",
      img: "one_of_three.png",
      color: "blue",
      description: "Quick choice rounds",

      featureColor: "blue",
    },

    {
      name: "Flip Cards",
      url: "/games/flip-cards",
      img: "flip_cards.png",
      color: "red",
      description: "Self-paced flashcards",
      feature: "popular",
      featureColor: "blue",
    },
    {
      name: "Speed Spelling",
      url: "/games/quick-guess",
      img: "flip_cards.png",
      color: "yellow",
      description: "Type it before time runs out",

      featureColor: "yellow",
    },

    {
      name: "Word Pairing",
      url: "/games/guess-match",
      img: "guess_match.png",
      color: "green",
      description: "Connect the synonyms",
      feature: "classic",
      featureColor: "red",
    },
    {
      name: "Score Rush",
      url: "/games/choose-one-multiplayer?mode=async",
      img: "one_of_three.png",
      color: "red",
      description: "Climb rankings in speed trials",

      featureColor: "blue",
    },
    {
      name: "Live Online Duel",
      url: "/games/choose-one-multiplayer?mode=live",
      img: "flip_cards.png",
      color: "blue",
      description: "Match with an online opponent live",

      featureColor: "emerald",
    },
  ];

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 380; // approximate card width + gap
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="group relative w-full">
      {/* Scroll Buttons - Hidden on very small screens, visible on hover for desktop */}
      <button
        type="button"
        className="absolute -left-4 top-1/2 z-20 hidden md:flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md backdrop-blur transition-all disabled:opacity-0 sm:-left-6 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => scroll("left")}
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        type="button"
        className="absolute -right-4 top-1/2 z-20 hidden md:flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-slate-700 shadow-md backdrop-blur transition-all disabled:opacity-0 sm:-right-6 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => scroll("right")}
        aria-label="Scroll right"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Overflow Container */}
      <div
        ref={scrollContainerRef}
        className="flex w-full snap-x snap-mandatory gap-6 overflow-x-auto pb-8 pt-4 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cards.map((card, index) => (
          <div key={index} className="snap-center xl:snap-start shrink-0">
            <GameCard
              name={card.name}
              url={card.url}
              img={card.img}
              color={card.color}
              description={card.description}
              feature={card.feature}
              featureColor={card.featureColor}
              wide
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameCarousel;
