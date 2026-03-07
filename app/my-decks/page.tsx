"use client";

import Navbar from "../_components/Navbar";
import WordsInput from "./_components/WordsInput";
import TranslationDisplay from "./_components/TranslationDisplay";

export default function Home() {
  return (
    <div className="">
      <Navbar />
      <p>My decks page</p>
      <WordsInput />
      <TranslationDisplay />
    </div>
  );
}
