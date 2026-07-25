"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../_lib/languageContext";
import { useAuthState } from "../../_lib/auth";
import { LANGUAGES, Language } from "../../_lib/translations";
import {
  DeckMeta,
  DeckWithWords,
  DeckWordRecord,
  createDeck,
  deleteDeck,
  getDeck,
  listDecks,
  updateDeck,
} from "../../games/_lib/deckSessionClient";

function tempId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `new-${crypto.randomUUID()}`;
  }
  return `new-${Math.random().toString(16).slice(2)}`;
}

function DeckEditorPage() {
  const { language, learningLanguage } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();
  const searchParams = useSearchParams();

  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [draft, setDraft] = useState<DeckWithWords | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [creatingDeck, setCreatingDeck] = useState(false);
  const [quickDeckName, setQuickDeckName] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [deckPendingDelete, setDeckPendingDelete] = useState<DeckMeta | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [newNativeWord, setNewNativeWord] = useState("");
  const [newForeignWord, setNewForeignWord] = useState("");

  // AI deck generation state.
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);

  const refreshDecks = useCallback(async (): Promise<DeckMeta[]> => {
    const data = await listDecks();
    setDecks(data.decks);
    return data.decks;
  }, []);

  // Initial load: list the user's decks and pick the requested / first one.
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    let cancelled = false;
    refreshDecks()
      .then((all) => {
        if (cancelled) return;
        const pairDecks = all.filter(
          (deck) =>
            deck.nativeLang.trim().toLowerCase() === language &&
            deck.foreignLang.trim().toLowerCase() === learningLanguage,
        );
        const requested = searchParams.get("deck");
        if (requested && all.some((deck) => deck.id === requested)) {
          setSelectedDeckId(requested);
        } else if (pairDecks.length > 0) {
          setSelectedDeckId(pairDecks[0].id);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, refreshDecks, searchParams, language, learningLanguage]);

  // Load the selected deck's words into an editable draft.
  useEffect(() => {
    if (!selectedDeckId) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    getDeck(selectedDeckId)
      .then((data) => {
        if (!cancelled) {
          setDraft(data.deck);
          setDirty(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDraft(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDeckId]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    let cancelled = false;
    fetch("/api/decks/generate")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.remaining === "number") {
          setAiRemaining(data.remaining);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const filteredDecks = useMemo(
    () =>
      decks.filter(
        (deck) =>
          deck.nativeLang.trim().toLowerCase() === language &&
          deck.foreignLang.trim().toLowerCase() === learningLanguage,
      ),
    [decks, language, learningLanguage],
  );

  const groupEntries = useMemo(() => {
    const groups = filteredDecks.reduce<Record<string, DeckMeta[]>>(
      (acc, deck) => {
        const key = `${deck.nativeLang} -> ${deck.foreignLang}`;
        (acc[key] ??= []).push(deck);
        return acc;
      },
      {},
    );
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDecks]);

  const mutateDraft = (updater: (deck: DeckWithWords) => DeckWithWords) => {
    setDraft((current) => (current ? updater(current) : current));
    setDirty(true);
  };

  const handleCreateDeck = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = quickDeckName.trim();
    if (!name) return;
    const { deck } = await createDeck({
      name,
      nativeLang: language,
      foreignLang: learningLanguage,
    });
    await refreshDecks();
    setSelectedDeckId(deck.id);
    setQuickDeckName("");
    setCreatingDeck(false);
  };

  const handleGenerateDeck = async (event: React.FormEvent) => {
    event.preventDefault();
    setAiError("");
    const topic = aiTopic.trim();
    if (!topic) {
      setAiError("Enter a topic first.");
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          nativeLang: language,
          foreignLang: learningLanguage,
          count: aiCount,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAiError(data?.error ?? "Failed to generate deck.");
        if (typeof data?.remaining === "number") setAiRemaining(data.remaining);
        return;
      }

      const words = Array.isArray(data?.words)
        ? data.words
            .map((word: { native?: string; foreign?: string }) => ({
              native: (word.native ?? "").trim(),
              foreign: (word.foreign ?? "").trim(),
            }))
            .filter(
              (word: { native: string; foreign: string }) =>
                word.native && word.foreign,
            )
        : [];

      const { deck } = await createDeck({
        name: topic,
        nativeLang: language,
        foreignLang: learningLanguage,
        words,
      });
      await refreshDecks();
      setSelectedDeckId(deck.id);
      setAiTopic("");
      if (typeof data?.remaining === "number") setAiRemaining(data.remaining);
    } catch {
      setAiError("Something went wrong. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateDeck(draft.id, {
        name: draft.name,
        nativeLang: draft.nativeLang,
        foreignLang: draft.foreignLang,
        words: draft.words.map((word) => ({
          id: word.id,
          native: word.native,
          foreign: word.foreign,
        })),
      });
      const refreshed = await getDeck(draft.id);
      setDraft(refreshed.deck);
      setDirty(false);
      await refreshDecks();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteDeck = async () => {
    if (!deckPendingDelete) return;
    if (deleteConfirmText.trim() !== deckPendingDelete.name.trim()) return;
    setDeletingDeck(true);
    try {
      await deleteDeck(deckPendingDelete.id);
      const remaining = await refreshDecks();
      if (selectedDeckId === deckPendingDelete.id) {
        const nextPair = remaining.filter(
          (deck) =>
            deck.nativeLang.trim().toLowerCase() === language &&
            deck.foreignLang.trim().toLowerCase() === learningLanguage,
        );
        setSelectedDeckId(nextPair[0]?.id ?? "");
        setDraft(null);
      }
      setDeckPendingDelete(null);
      setDeleteConfirmText("");
    } finally {
      setDeletingDeck(false);
    }
  };

  const handleAddWord = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !newNativeWord.trim() || !newForeignWord.trim()) {
      return;
    }
    const word: DeckWordRecord = {
      id: tempId(),
      native: newNativeWord.trim(),
      foreign: newForeignWord.trim(),
      orderIndex: draft.words.length,
    };
    mutateDraft((deck) => ({ ...deck, words: [...deck.words, word] }));
    setNewNativeWord("");
    setNewForeignWord("");
  };

  const updateWord = (
    wordId: string,
    updater: (word: DeckWordRecord) => DeckWordRecord,
  ) => {
    mutateDraft((deck) => ({
      ...deck,
      words: deck.words.map((word) =>
        word.id === wordId ? updater(word) : word,
      ),
    }));
  };

  const deleteWord = (wordId: string) => {
    mutateDraft((deck) => ({
      ...deck,
      words: deck.words.filter((word) => word.id !== wordId),
    }));
  };

  if (isReady && !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Sign in to edit decks
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your decks are synced to your account.
          </p>
          <button
            type="button"
            onClick={signIn}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

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

          <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm dark:border-violet-900/60 dark:from-violet-950/40 dark:to-slate-950">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                ✨ Generate with AI
              </h2>
              {isSignedIn && aiRemaining !== null && (
                <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
                  {aiRemaining}/2 left today
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Describe a topic and let AI build a deck for{" "}
              {LANGUAGES[language as Language]} →{" "}
              {LANGUAGES[learningLanguage as Language]}.
            </p>

            {!isReady ? null : !isSignedIn ? (
              <p className="mt-4 rounded-lg border border-dashed border-violet-300 bg-white/60 px-3 py-3 text-sm text-slate-600 dark:border-violet-800 dark:bg-slate-900/60 dark:text-slate-300">
                Sign in to generate decks with AI.
              </p>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={handleGenerateDeck}>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(event) => setAiTopic(event.target.value)}
                  placeholder="e.g. Ordering food at a café"
                  maxLength={100}
                  disabled={aiLoading}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Words
                  <select
                    value={aiCount}
                    onChange={(event) => setAiCount(Number(event.target.value))}
                    disabled={aiLoading}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {[20, 35, 50].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                {aiError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    {aiError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={aiLoading || aiRemaining === 0}
                  className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-400"
                >
                  {aiLoading
                    ? "Generating…"
                    : aiRemaining === 0
                      ? "Daily limit reached"
                      : "Generate Deck"}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Decks
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteMode(false);
                    setCreatingDeck((current) => !current);
                  }}
                  aria-label="New deck"
                  title="New deck"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-lg font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  +
                </button>
                {groupEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingDeck(false);
                      setDeleteMode((current) => !current);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      deleteMode
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
                        : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                    }`}
                  >
                    {deleteMode ? "Done" : "Delete"}
                  </button>
                )}
              </div>
            </div>

            {creatingDeck && (
              <form
                className="mt-4 flex items-center gap-2"
                onSubmit={handleCreateDeck}
              >
                <input
                  type="text"
                  autoFocus
                  value={quickDeckName}
                  onChange={(event) => setQuickDeckName(event.target.value)}
                  placeholder={`Deck name (${LANGUAGES[language as Language]} → ${LANGUAGES[learningLanguage as Language]})`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={!quickDeckName.trim()}
                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingDeck(false);
                    setQuickDeckName("");
                  }}
                  aria-label="Cancel"
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </form>
            )}

            <div className="mt-4 space-y-3">
              {groupEntries.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No decks yet — tap + to create one.
                </p>
              )}
              {groupEntries.map(([groupName, groupDecks]) => (
                <div key={groupName} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {groupName}
                  </p>
                  {groupDecks.map((deck, index) => (
                    <button
                      key={deck.id}
                      type="button"
                      onClick={() =>
                        deleteMode
                          ? setDeckPendingDelete(deck)
                          : setSelectedDeckId(deck.id)
                      }
                      className={`relative w-full rounded-lg border px-3 py-2 text-left transition ${
                        selectedDeckId === deck.id && !deleteMode
                          ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                      } ${
                        deleteMode
                          ? index % 2 === 0
                            ? "animate-deck-jiggle"
                            : "animate-deck-jiggle-alt"
                          : ""
                      }`}
                    >
                      {deleteMode && (
                        <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold leading-none text-white shadow">
                          −
                        </span>
                      )}
                      <p className="text-sm font-semibold">{deck.name}</p>
                      <p className="text-xs opacity-80">
                        {deck.wordCount} words
                      </p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          {!draft ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Choose a deck to start editing.
            </p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {dirty ? "Unsaved changes" : "All changes saved"}
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deck Name
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) =>
                      mutateDraft((deck) => ({
                        ...deck,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Native
                    <input
                      type="text"
                      value={draft.nativeLang}
                      onChange={(event) =>
                        mutateDraft((deck) => ({
                          ...deck,
                          nativeLang: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Foreign
                    <input
                      type="text"
                      value={draft.foreignLang}
                      onChange={(event) =>
                        mutateDraft((deck) => ({
                          ...deck,
                          foreignLang: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                </div>
              </div>

              <form
                onSubmit={handleAddWord}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  type="text"
                  value={newNativeWord}
                  onChange={(event) => setNewNativeWord(event.target.value)}
                  placeholder={`Native (${draft.nativeLang})`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={newForeignWord}
                  onChange={(event) => setNewForeignWord(event.target.value)}
                  placeholder={`Foreign (${draft.foreignLang})`}
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
                      <th className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {draft.words.map((word) => (
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

      {deckPendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
          onClick={() => {
            setDeckPendingDelete(null);
            setDeleteConfirmText("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Delete deck?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This will permanently delete{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {deckPendingDelete.name}
              </span>{" "}
              and all its words. Type its name to confirm.
            </p>
            <input
              type="text"
              autoFocus
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={deckPendingDelete.name}
              className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeckPendingDelete(null);
                  setDeleteConfirmText("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDeck}
                disabled={
                  deleteConfirmText.trim() !== deckPendingDelete.name.trim() ||
                  deletingDeck
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-400"
              >
                {deletingDeck ? "Deleting…" : "Delete Deck"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeckEditorPage;
