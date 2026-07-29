import React, { useRef } from "react";
import GameCard from "./GameCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

function GameCarousel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cards = [
    {
      name: "One of Three",
      url: "/games/one-of-three",
      img: "one_of_three.webp",
      color: "blue",
      description: "Quick choice rounds",

      featureColor: "blue",
    },

    {
      name: "Flip Cards",
      url: "/games/flip-cards",
      img: "flip_cards.webp",
      color: "red",
      description: "Self-paced flashcards",
      feature: "popular",
      featureColor: "blue",
    },
    {
      name: "Speed Spelling",
      url: "/games/quick-guess",
      img: "speed_spelling.webp",
      color: "yellow",
      description: "Type it before time runs out",

      featureColor: "yellow",
    },

    {
      name: "Word Pairing",
      url: "/games/guess-match",
      img: "word_pairing.webp",
      color: "green",
      description: "Connect the synonyms",
      feature: "classic",
      featureColor: "red",
    },
    {
      name: "Score Rush",
      url: "/games/score-rush",
      img: "score_rush.webp",
      color: "red",
      description: "30 seconds, as many words as you can",

      featureColor: "blue",
    },
    {
      name: "Live Duel",
      url: "/games/live-duel",
      img: "live_duel_2.webp",
      color: "blue",
      description: "Duel an online opponent or the bot",

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
        className="absolute left-0 top-1/2 z-20 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white/90 p-0 text-slate-700 shadow-md backdrop-blur transition-all disabled:opacity-0 md:flex lg:-left-12 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => scroll("left")}
        aria-label="Scroll left"
      >
        <ChevronLeft className="block h-6 w-6 shrink-0" />
      </button>

      <button
        type="button"
        className="absolute right-0 top-1/2 z-20 hidden h-12 w-12 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white/90 p-0 text-slate-700 shadow-md backdrop-blur transition-all disabled:opacity-0 md:flex lg:-right-12 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-700"
        onClick={() => scroll("right")}
        aria-label="Scroll right"
      >
        <ChevronRight className="block h-6 w-6 shrink-0" />
      </button>

      {/* Keep the panel spacing inside the scroll track so the arrows can be
          centered on the carousel's actual outer edges. */}
      <div
        ref={scrollContainerRef}
        className="flex w-full snap-x snap-mandatory gap-6 overflow-x-auto p-6 scrollbar-hide sm:p-8"
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
