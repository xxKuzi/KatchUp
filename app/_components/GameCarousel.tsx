import React, { useEffect, useState } from "react";
import GameCard from "./GameCard";

function GameCarousel() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0); //last seenable card on left (card index)
  const cards = [
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "flip_cards.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "flip_cards.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "flip_cards.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "guess_match.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "guess_match.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "guess_match.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "Flip Cards",
      url: "flip-cards",
      img: "guess_match.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
  ];

  useEffect(() => {
    setCurrentCardIndex(0);
    console.log(cards.length);
  }, []);

  return (
    <div className="relative mt-16 h-[500px] w-full">
      {currentCardIndex > 0 && (
        <button
          className="absolute bottom-0 left-10 z-10 text-4xl"
          onClick={() => setCurrentCardIndex((prev) => prev - 1)}
        >
          {"<<<"}
        </button>
      )}
      {cards.length > currentCardIndex + 4 && (
        <button
          className="absolute bottom-0 right-10 z-10 text-4xl"
          onClick={() => setCurrentCardIndex((prev) => prev + 1)}
        >
          {">>>"}
        </button>
      )}

      <div
        style={{
          transform: `translateX(${(cards.length - 4) * 160 + -currentCardIndex * 320}px)`,
          transition: "transform 0.5s ease",
        }}
        className="flex items-center justify-center gap-10"
      >
        {cards.map((card, index) => {
          return (
            <GameCard
              key={index}
              name={card.name}
              url={card.url}
              img={card.img}
              color={card.color}
              description={card.description}
              feature={card.feature}
              featureColor={card.featureColor}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-10"></div>
      <button>{"asdfasd>"}</button>
    </div>
  );
}

export default GameCarousel;
