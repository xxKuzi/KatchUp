"use client";

import { useState } from "react";
import WordsInput from "./_components/WordsInput";
import TranslationDisplay from "./_components/TranslationDisplay";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background py-8 text-foreground">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-foreground">
          Manage Your{" "}
          <span className="text-blue-600 dark:text-blue-400">Word Decks</span>
        </h1>
        <WordsInput onUploadSuccess={handleUploadSuccess} />
        <TranslationDisplay key={refreshKey} />
      </div>
    </div>
  );
}
