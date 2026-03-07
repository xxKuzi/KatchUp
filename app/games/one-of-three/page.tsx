"use client";
import { useState } from "react";
import FlipCard from "../../_components/FlipCard";
import GamePage from "../_components/GamePage";

const OneOfThreePage = () => {
  let foreign = "Hello";
  let native = "Ahoj";
  let [isForeign, setIsForeign] = useState(true);

  const flipCard = () => {
    setIsForeign(!isForeign);
  };

  return (
    <GamePage
      name="One of Three"
      description="Choose the correct translation from three options and build quick recall."
      bgImage="one_of_three.png"
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

export default OneOfThreePage;
