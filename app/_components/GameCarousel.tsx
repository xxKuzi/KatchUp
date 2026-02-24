import React from "react";
import GameCard from "./GameCard";

function GameCarousel() {
  return (
    <div>
      <button className="absolute bottom-[50%] right-10 z-10 text-4xl">
        {"<<<"}
      </button>
      <div className="flex items-center justify-center gap-10">
        <GameCard
          name="Flip Cards"
          url="flip-cards"
          img="flip_cards.png"
          color="yellow"
          description="hello"
        />
        <GameCard
          name="One of Three"
          url="one-of-three"
          img="flip_cards.png"
          color="red"
          description="hello"
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
        <GameCard
          name="Flip Cards"
          url="one-of-three"
          img="flip_cards.png"
          description="hello"
        />
      </div>
      <button>{"asdfasd>"}</button>
    </div>
  );
}

export default GameCarousel;
