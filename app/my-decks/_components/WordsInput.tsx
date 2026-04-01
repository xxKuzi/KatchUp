import React, { useRef, useState } from "react";

interface WordsInputProps {
  onUploadSuccess?: () => void;
}

interface WordEntry {
  id: number;
  native: string;
  foreign: string;
  foreignLanguage: string;
}

type ImportedWordEntry = Partial<WordEntry> & {
  english?: string;
  czech?: string;
  language?: string;
};

function WordsInput({ onUploadSuccess }: WordsInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    native: "",
    foreign: "",
    foreignLanguage: "",
  });

  const uploadFile = () => {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      alert("Please select a JSON file first.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const json = JSON.parse(result);

        // Get existing data or start fresh
        const existingData = localStorage.getItem("wordDatabase");
        let allWords: WordEntry[] = existingData
          ? JSON.parse(existingData)
          : [];

        // Parse uploaded data
        const dataArray: ImportedWordEntry[] = Array.isArray(json)
          ? json
          : Object.values(json as Record<string, ImportedWordEntry>);
        const newWords: WordEntry[] = dataArray.map(
          (item: ImportedWordEntry, index: number) => ({
            id: Math.max(...allWords.map((w) => w.id), 0) + index + 1,
            native: item.native || item.english || "",
            foreign: item.foreign || item.czech || "",
            foreignLanguage: item.foreignLanguage || item.language || "",
          }),
        );

        allWords = [...allWords, ...newWords];
        localStorage.setItem("wordDatabase", JSON.stringify(allWords));
        alert("Translations updated successfully!");

        if (onUploadSuccess) {
          onUploadSuccess();
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        alert("Invalid JSON file. Please check the format.");
        console.error("JSON parsing error:", error);
      }
    };

    reader.readAsText(file);
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.native.trim() ||
      !formData.foreign.trim() ||
      !formData.foreignLanguage.trim()
    ) {
      alert("Please fill in all fields.");
      return;
    }

    const existingData = localStorage.getItem("wordDatabase");
    const allWords: WordEntry[] = existingData ? JSON.parse(existingData) : [];

    const newWord: WordEntry = {
      id: allWords.length > 0 ? Math.max(...allWords.map((w) => w.id)) + 1 : 1,
      native: formData.native,
      foreign: formData.foreign,
      foreignLanguage: formData.foreignLanguage,
    };

    allWords.push(newWord);
    localStorage.setItem("wordDatabase", JSON.stringify(allWords));
    alert("Word added successfully!");

    setFormData({ native: "", foreign: "", foreignLanguage: "" });

    if (onUploadSuccess) {
      onUploadSuccess();
    }
  };

  return (
    <div className="mb-16 w-full max-w-4xl mx-auto">
      {/* Add Word Form */}
      <div className="mb-12 p-8 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 dark:text-slate-100">
        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
          Add{" "}
          <span className="text-blue-600 dark:text-blue-400">
            Primary Words
          </span>
        </h2>
        <form onSubmit={handleAddWord} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
                Native Word
              </label>
              <input
                type="text"
                value={formData.native}
                onChange={(e) =>
                  setFormData({ ...formData, native: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="e.g., Hello"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
                Foreign Translation
              </label>
              <input
                type="text"
                value={formData.foreign}
                onChange={(e) =>
                  setFormData({ ...formData, foreign: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="e.g., Hola"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-300">
              Foreign Language
            </label>
            <input
              type="text"
              value={formData.foreignLanguage}
              onChange={(e) =>
                setFormData({ ...formData, foreignLanguage: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="e.g., Spanish"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Add Word
          </button>
        </form>
      </div>

      {/* Upload JSON */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">
          Or Upload{" "}
          <span className="text-blue-600 dark:text-blue-400">JSON</span> File
        </h2>
        <input
          ref={fileInputRef}
          className="mt-3 h-16 w-full rounded-lg border-2 border-dashed border-slate-300 bg-transparent p-2 text-slate-900 transition-colors hover:border-blue-400 dark:border-slate-700 dark:text-slate-100 md:w-64"
          type="file"
          accept=".json"
        />
        <button
          onClick={uploadFile}
          className="rounded-xl border border-transparent bg-indigo-500 px-6 py-2 font-medium text-white transition duration-200 hover:bg-indigo-600 dark:bg-indigo-400 dark:hover:bg-indigo-300"
        >
          Upload
        </button>
      </div>
    </div>
  );
}

export default WordsInput;
