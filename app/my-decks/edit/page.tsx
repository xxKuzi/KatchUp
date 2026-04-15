"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../_lib/languageContext";
import { LANGUAGES, Language } from "../../_lib/translations";
import {
  CustomDeck,
  createDeck,
  createWord,
  DeckWord,
  groupDecksByLanguages,
  loadCustomDecks,
  saveCustomDecks,
} from "../_lib/customDecks";

function DeckEditorPage() {
  const { nativeLanguage, learningLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const [decks, setDecks] = useState<CustomDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [newDeckName, setNewDeckName] = useState("New Custom Deck");
  const [newDeckNativeLang, setNewDeckNativeLang] = useState(nativeLanguage);
  const [newDeckForeignLang, setNewDeckForeignLang] =
    useState(learningLanguage);
  const [newNativeWord, setNewNativeWord] = useState("");
  const [newForeignWord, setNewForeignWord] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedDecks = loadCustomDecks();
      setDecks(storedDecks);

      const pairDecks = storedDecks.filter(
        (deck) =>
          deck.nativeLang.trim().toLowerCase() === nativeLanguage &&
          deck.foreignLang.trim().toLowerCase() === learningLanguage,
      );

      const requestedDeckId = searchParams.get("deck");
      if (
        requestedDeckId &&
        pairDecks.some((deck) => deck.id === requestedDeckId)
      ) {
        setSelectedDeckId(requestedDeckId);
        return;
      }

      if (pairDecks.length > 0) {
        setSelectedDeckId(pairDecks[0].id);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams, nativeLanguage, learningLanguage]);

  useEffect(() => {
    setNewDeckNativeLang(nativeLanguage);
    setNewDeckForeignLang(learningLanguage);
  }, [nativeLanguage, learningLanguage]);

  const filteredDecks = useMemo(
    () =>
      decks.filter(
        (deck) =>
          deck.nativeLang.trim().toLowerCase() === nativeLanguage &&
          deck.foreignLang.trim().toLowerCase() === learningLanguage,
      ),
    [decks, nativeLanguage, learningLanguage],
  );

  const selectedDeck = useMemo(
    () => filteredDecks.find((deck) => deck.id === selectedDeckId) ?? null,
    [filteredDecks, selectedDeckId],
  );

  const groupedDecks = useMemo(
    () => groupDecksByLanguages(filteredDecks),
    [filteredDecks],
  );
  const groupEntries = useMemo(
    () => Object.entries(groupedDecks).sort((a, b) => a[0].localeCompare(b[0])),
    [groupedDecks],
  );

  const persistDecks = (nextDecks: CustomDeck[]) => {
    setDecks(nextDecks);
    saveCustomDecks(nextDecks);
  };

  const handleCreateDeck = (event: React.FormEvent) => {
    event.preventDefault();

    const deck = createDeck({
      name: newDeckName.trim() || "New Custom Deck",
      nativeLang: newDeckNativeLang.trim() || nativeLanguage,
      foreignLang: newDeckForeignLang.trim() || learningLanguage,
    });

    const nextDecks = [deck, ...decks];
    persistDecks(nextDecks);
    setSelectedDeckId(deck.id);
  };

  const updateSelectedDeck = (updater: (deck: CustomDeck) => CustomDeck) => {
    if (!selectedDeck) {
      return;
    }

    const nextDecks = decks.map((deck) =>
      deck.id === selectedDeck.id ? updater(deck) : deck,
    );

    persistDecks(nextDecks);
  };

  const handleRenameDeck = (name: string) => {
    updateSelectedDeck((deck) => ({ ...deck, name }));
  };

  const handleLanguageChange = (
    field: "nativeLang" | "foreignLang",
    value: string,
  ) => {
    updateSelectedDeck((deck) => ({ ...deck, [field]: value }));
  };

  const handleDeleteDeck = () => {
    if (!selectedDeck) {
      return;
    }

    const nextDecks = decks.filter((deck) => deck.id !== selectedDeck.id);
    persistDecks(nextDecks);
    setSelectedDeckId(
      nextDecks.filter(
        (deck) =>
          deck.nativeLang.trim().toLowerCase() === nativeLanguage &&
          deck.foreignLang.trim().toLowerCase() === learningLanguage,
      )[0]?.id ?? "",
    );
  };

  const handleAddWord = (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedDeck) {
      return;
    }

    if (!newNativeWord.trim() || !newForeignWord.trim()) {
      return;
    }

    const word = createWord(newNativeWord.trim(), newForeignWord.trim());

    updateSelectedDeck((deck) => ({
      ...deck,
      words: [...deck.words, word],
    }));

    setNewNativeWord("");
    setNewForeignWord("");
  };

  const updateWord = (
    wordId: string,
    updater: (word: DeckWord) => DeckWord,
  ) => {
    updateSelectedDeck((deck) => ({
      ...deck,
      words: deck.words.map((word) =>
        word.id === wordId ? updater(word) : word,
      ),
    }));
  };

  const deleteWord = (wordId: string) => {
    updateSelectedDeck((deck) => ({
      ...deck,
      words: deck.words.filter((word) => word.id !== wordId),
    }));
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <section className="first-section-static-glow rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Deck Editor
              </h1>
              <Link
                href="/my-decks"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Back
              </Link>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Create custom decks by language pair and edit words in each deck.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              New Deck
            </h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreateDeck}>
              <input
                type="text"
                value={newDeckName}
                onChange={(event) => setNewDeckName(event.target.value)}
                placeholder="Deck name"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <select
                value={newDeckNativeLang}
                onChange={(event) =>
                  setNewDeckNativeLang(event.target.value as Language)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {Object.entries(LANGUAGES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={newDeckForeignLang}
                onChange={(event) =>
                  setNewDeckForeignLang(event.target.value as Language)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {Object.entries(LANGUAGES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Create Deck (crypto.randomUUID)
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Decks
            </h2>
            <div className="mt-4 space-y-3">
              {groupEntries.map(([groupName, groupDecks]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {groupName}
                  </p>
                  {groupDecks.map((deck) => (
                    <button
                      key={deck.id}
                      type="button"
                      onClick={() => setSelectedDeckId(deck.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        selectedDeckId === deck.id
                          ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      <p className="text-sm font-semibold">{deck.name}</p>
                      <p className="text-xs opacity-80">
                        {deck.words.length} words
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          {!selectedDeck ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Choose a deck to start editing.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deck Name
                  <input
                    type="text"
                    value={selectedDeck.name}
                    onChange={(event) => handleRenameDeck(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Native
                    <input
                      type="text"
                      value={selectedDeck.nativeLang}
                      onChange={(event) =>
                        handleLanguageChange("nativeLang", event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Foreign
                    <input
                      type="text"
                      value={selectedDeck.foreignLang}
                      onChange={(event) =>
                        handleLanguageChange("foreignLang", event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <span>Deck id: {selectedDeck.id}</span>
                <button
                  type="button"
                  onClick={handleDeleteDeck}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                >
                  Delete Deck
                </button>
              </div>

              <form
                onSubmit={handleAddWord}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  type="text"
                  value={newNativeWord}
                  onChange={(event) => setNewNativeWord(event.target.value)}
                  placeholder={`Native (${selectedDeck.nativeLang})`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={newForeignWord}
                  onChange={(event) => setNewForeignWord(event.target.value)}
                  placeholder={`Foreign (${selectedDeck.foreignLang})`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  Add Word
                </button>
              </form>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        Native
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        Foreign
                      </th>
                      <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        Word id
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {selectedDeck.words.map((word) => (
                      <tr key={word.id} className="bg-white dark:bg-slate-950">
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={word.native}
                            onChange={(event) =>
                              updateWord(word.id, (currentWord) => ({
                                ...currentWord,
                                native: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={word.foreign}
                            onChange={(event) =>
                              updateWord(word.id, (currentWord) => ({
                                ...currentWord,
                                foreign: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {word.id}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteWord(word.id)}
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default DeckEditorPage;
