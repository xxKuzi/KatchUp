import React, { useEffect, useState } from "react";
import GameCard from "./GameCard";

function GameCarousel() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0); //last seenable card on left (card index)
  const cards = [
    {
      name: "Flip Cards",
      url: "games/flip-cards",
      img: "flip_cards.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "One of Three",
      url: "games/one-of-three",
      img: "one_of_three.png",
      color: "red",
      description: "hello",
      feature: "popular",
      featureColor: "blue",
    },
    {
      name: "Flip Cards",
      url: "games/flip-cards",
      img: "flip_cards.png",
      color: "yellow",
      description: "hello",
      feature: "favorite",
      featureColor: "green",
    },
    {
      name: "One of Three",
      url: "games/one-of-three",
      img: "one_of_three.png",
      color: "red",
      description: "hello",
      feature: "popular",
      featureColor: "blue",
    },
    {
      name: "Flip Cards",
      url: "games/flip-cards",
      img: "flip_cards.png",
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
    <div className="relative h-[450px] w-full">
      <button
        className="absolute bottom-[194px] px-4 py-4  hover:bg-blue-600/90 bg-blue-600/70 border border-gray-400 transition duration-200 text-white hover:border-white disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:border-gray-700 dark:hover:disabled:border-gray-700 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed disabled:hover:border-gray-300 rounded-full  left-10 z-10 text-xl"
        onClick={() => setCurrentCardIndex((prev) => prev - 1)}
        disabled={currentCardIndex === 0}
      >
        {"<"}
      </button>

      <button
        className="absolute bottom-[194px] px-4 py-4 hover:bg-blue-600/90 bg-blue-600/70  border border-gray-400 transition duration-200 text-white hover:border-white disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:border-gray-700 dark:hover:disabled:border-gray-700 disabled:text-gray-500 disabled:border-gray-300 disabled:cursor-not-allowed disabled:hover:border-gray-300 rounded-full right-10 z-10 text-xl"
        onClick={() => setCurrentCardIndex((prev) => prev + 1)}
        disabled={cards.length <= currentCardIndex + 4}
      >
        {">"}
      </button>
      <div className="relative width-[320*4+160*3-200] overflow-hidden">
        <div
          style={{
            transform: `translateX(${(cards.length - 4) * 160 + -currentCardIndex * 320}px)`,
            transition: "transform 0.5s ease",
          }}
          className="relative flex items-center justify-center gap-10"
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
      </div>
      <div className="flex items-center justify-center gap-10"></div>
    </div>
  );
}

export default GameCarousel;
