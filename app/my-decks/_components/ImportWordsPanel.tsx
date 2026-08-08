"use client";

import { useState } from "react";
import { hasArticles, withArticle } from "@/app/_lib/articles";
import { LANG_ENGLISH_NAMES, type Lang } from "@/app/_lib/languages";
import {
  MAX_IMPORT_WORDS,
  buildImportPrompt,
  parseWordsJson,
  type ParsedImport,
} from "../_lib/importWords";

/**
 * Bulk-adds words to the open deck from a JSON file or a paste.
 *
 * Deliberately a two-step: parse and show what was found, then add. A file
 * arrives from somewhere the user cannot see inside — another app's export, a
 * chatbot's answer — so the count of what was skipped is the only chance they
 * get to notice it read the file differently than they meant.
 *
 * Adds to the *draft*, not the server. Pressing Save is still what commits, so a
 * bad import is undone by reloading the page.
 */
export default function ImportWordsPanel({
  nativeLang,
  foreignLang,
  nativeLabel,
  foreignLabel,
  disabled,
  onImport,
}: {
  nativeLang: Lang | null;
  foreignLang: Lang | null;
  /** Deck's own language text, which may be free text `normalizeLang` failed on. */
  nativeLabel: string;
  foreignLabel: string;
  disabled: boolean;
  onImport: (words: ParsedImport["words"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedImport | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = buildImportPrompt(
    nativeLang ? LANG_ENGLISH_NAMES[nativeLang] : nativeLabel,
    foreignLang ? LANG_ENGLISH_NAMES[foreignLang] : foreignLabel,
    hasArticles(foreignLang),
  );

  const runParse = (raw: string) => {
    setText(raw);
    try {
      setPreview(parseWordsJson(raw, foreignLang));
      setError("");
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      runParse(await file.text());
    } catch {
      setPreview(null);
      setError("Could not read that file.");
    }
  };

  const handleAdd = () => {
    if (!preview) return;
    onImport(preview.words);
    setText("");
    setPreview(null);
    setError("");
    setOpen(false);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission — the prompt is on screen to select by hand.
    }
  };

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Import words from JSON
          </h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Adds to this deck as {nativeLabel} → {foreignLabel}. Nothing is kept
            until you save.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={disabled}
          className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-sky-950"
        >
          {open ? "Close" : "Import"}
        </button>
      </div>

      {open && !disabled && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Choose a .json file
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                // Clears the input so re-picking the same file fires again.
                event.target.value = "";
              }}
              className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-sky-700 dark:text-slate-400"
            />
          </label>

          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            …or paste it here
            <textarea
              value={text}
              onChange={(event) => runParse(event.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={'[{"native":"dog","foreign":"Hund","article":"der"}]'}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </p>
          )}

          {preview && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {preview.words.length}{" "}
                {preview.words.length === 1 ? "word" : "words"} ready
                {preview.skipped > 0 && ` · ${preview.skipped} skipped`}
                {preview.duplicates > 0 && ` · ${preview.duplicates} duplicate`}
                {preview.truncated > 0 &&
                  ` · ${preview.truncated} over the ${MAX_IMPORT_WORDS}-word limit`}
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                {preview.words.slice(0, 5).map((word, index) => (
                  <li key={`${word.native}-${index}`}>
                    {word.native} → {withArticle(word.foreign, word.article)}
                  </li>
                ))}
                {preview.words.length > 5 && (
                  <li className="text-slate-500">
                    …and {preview.words.length - 5} more
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={handleAdd}
                className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                Add {preview.words.length} to deck
              </button>
            </div>
          )}

          <details className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              What should the JSON look like?
            </summary>
            <div className="mt-2 space-y-3 text-slate-600 dark:text-slate-400">
              <p>A list of words. This is the shape to aim for:</p>
              <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
{`[
  { "native": "dog",  "foreign": "Hund",  "article": "der" },
  { "native": "cat",  "foreign": "Katze", "article": "die" },
  { "native": "book", "foreign": "Buch" }
]`}
              </pre>
              <p>These also work:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Wrapped in an object:{" "}
                  <code className="font-mono">{`{ "words": [ … ] }`}</code>
                </li>
                <li>
                  A plain map:{" "}
                  <code className="font-mono">{`{ "dog": "Hund", "cat": "Katze" }`}</code>
                </li>
                <li>
                  Other key names: <code className="font-mono">source</code>/
                  <code className="font-mono">front</code>/
                  <code className="font-mono">term</code> for native,{" "}
                  <code className="font-mono">target</code>/
                  <code className="font-mono">back</code>/
                  <code className="font-mono">translation</code> for foreign
                </li>
              </ul>
              <p>
                <code className="font-mono">article</code> is optional. Write
                &quot;der Hund&quot; in the foreign field and the article is
                pulled out for you. Rows missing a side are skipped, and up to{" "}
                {MAX_IMPORT_WORDS} words come in at once.
              </p>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    No list yet? Paste this into any AI chat
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {copied ? "Copied" : "Copy prompt"}
                  </button>
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                  {prompt}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
