"use client";
import React, { Component, useState } from "react";
import FlipCard from "../../_components/FlipCard";
import Navbar from "@/app/_components/Navbar";

const GamePage: React.FC = () => {
  let foreign = "Hello";
  let native = "Ahoj";
  let [isForeign, setIsForeign] = useState(true);

  const flipCard = () => {
    setIsForeign(!isForeign);
  };

  return (
    <div className="flex-col flex gap-4 items-center">
      <Navbar />
      <FlipCard
        foreign={foreign}
        native={native}
        isForeign={isForeign}
        flipCard={flipCard}
      />
      <button onClick={flipCard}>Show</button>
    </div>
  );
};

export default GamePage;
