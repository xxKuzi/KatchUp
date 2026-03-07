"use client";
import { useState } from "react";
import FlipCard from "../../_components/FlipCard";
import GamePage from "../_components/GamePage";

const FlipCardsPage = () => {
  let foreign = "Hello";
  let native = "Ahoj";
  let [isForeign, setIsForeign] = useState(true);

  const flipCard = () => {
    setIsForeign(!isForeign);
  };

  return (
    <GamePage
      name="Flip Cards"
      description="Flip each card to practice translation pairs and remember words faster."
      bgImage="flip_cards.png"
    >
      <FlipCard
        foreign={foreign}
        native={native}
        isForeign={isForeign}
        flipCard={flipCard}
      />
      <button onClick={flipCard}>Show</button>
    </GamePage>
  );
};

export default FlipCardsPage;
