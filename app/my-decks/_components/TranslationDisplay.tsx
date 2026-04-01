import React, { useEffect, useState } from "react";

interface TranslationItem {
  id: number;
  native: string;
  foreign: string;
  foreignLanguage: string;
}

type StoredWordEntry = Partial<TranslationItem> & {
  english?: string;
  czech?: string;
  language?: string;
};

function TranslationDisplay() {
  const [translations, setTranslations] = useState<TranslationItem[] | null>(
    null,
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    native: string;
    foreign: string;
    foreignLanguage: string;
  }>({
    native: "",
    foreign: "",
    foreignLanguage: "",
  });

  function loadTranslations() {
    const storedData = localStorage.getItem("wordDatabase");

    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);

        const dataArray = Array.isArray(parsedData)
          ? parsedData
          : Object.values(parsedData as Record<string, StoredWordEntry>);

        const formattedData: TranslationItem[] = dataArray.map(
          (item: StoredWordEntry) => ({
            id: Number(item.id),
            native: item.native || item.english || "",
            foreign: item.foreign || item.czech || "",
            foreignLanguage: item.foreignLanguage || item.language || "",
          }),
        );

        setTranslations(formattedData);
      } catch (error) {
        console.error(
          "Failed to parse translations from local storage:",
          error,
        );
      }
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTranslations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const updateLocalStorage = (newData: TranslationItem[]) => {
    localStorage.setItem("wordDatabase", JSON.stringify(newData));
  };

  const handleDelete = (id: number) => {
    if (!translations) return;
    const updatedTranslations = translations.filter((item) => item.id !== id);
    setTranslations(updatedTranslations);
    updateLocalStorage(updatedTranslations);
  };

  const handleEditClick = (item: TranslationItem) => {
    setEditingId(item.id);
    setEditValues({
      native: item.native,
      foreign: item.foreign,
      foreignLanguage: item.foreignLanguage,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: number) => {
    if (!translations) return;

    const updatedTranslations = translations.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          native: editValues.native,
          foreign: editValues.foreign,
          foreignLanguage: editValues.foreignLanguage,
        };
      }
      return item;
    });

    setTranslations(updatedTranslations);
    updateLocalStorage(updatedTranslations);
    setEditingId(null);
  };

  if (!translations || translations.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No words added yet. Add your first word above!
      </div>
    );
  }

  return (
    <div className="p-8 w-full max-w-6xl mx-auto">
      <h2 className="text-2xl mb-4 font-bold text-slate-900 dark:text-slate-100">
        Word Database ({translations.length})
      </h2>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <table className="min-w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="border-b bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Native
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Foreign
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Language
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 text-right dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {translations.map((item) => (
              <tr
                key={item.id}
                className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60"
              >
                {editingId === item.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editValues.native}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            native: e.target.value,
                          })
                        }
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editValues.foreign}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            foreign: e.target.value,
                          })
                        }
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editValues.foreignLanguage}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            foreignLanguage: e.target.value,
                          })
                        }
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="rounded bg-green-600 px-3 py-1 text-white shadow-sm transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="rounded border border-slate-300 bg-slate-100 px-3 py-1 text-slate-700 shadow-sm transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {item.native}
                    </td>
                    <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400">
                      {item.foreign}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                        {item.foreignLanguage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => handleEditClick(item)}
                        className="font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="font-medium text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TranslationDisplay;
