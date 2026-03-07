import React, { useEffect, useState } from "react";

// Updated to perfectly match your database schema
interface TranslationItem {
  id: number;
  english: string;
  foreign: string;
}

function TranslationDisplay() {
  const [translations, setTranslations] = useState<TranslationItem[] | null>(
    null,
  );

  // New state variables for handling edits
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    english: string;
    foreign: string;
  }>({
    english: "",
    foreign: "",
  });

  useEffect(() => {
    const storedData = localStorage.getItem("customTranslations");

    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);

        const dataArray = Array.isArray(parsedData)
          ? parsedData
          : Object.values(parsedData);

        const formattedData: TranslationItem[] = dataArray.map((item: any) => ({
          id: Number(item.id),
          english: item.english,
          foreign: item.foreign || item.czech || "Unknown",
        }));

        setTranslations(formattedData);
      } catch (error) {
        console.error(
          "Failed to parse translations from local storage:",
          error,
        );
      }
    }
  }, []);

  // Helper to sync state changes back to localStorage
  const updateLocalStorage = (newData: TranslationItem[]) => {
    localStorage.setItem("customTranslations", JSON.stringify(newData));
  };

  // --- Actions ---

  const handleDelete = (id: number) => {
    if (!translations) return;
    const updatedTranslations = translations.filter((item) => item.id !== id);
    setTranslations(updatedTranslations);
    updateLocalStorage(updatedTranslations);
  };

  const handleEditClick = (item: TranslationItem) => {
    setEditingId(item.id);
    setEditValues({ english: item.english, foreign: item.foreign });
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
          english: editValues.english,
          foreign: editValues.foreign,
        };
      }
      return item;
    });

    setTranslations(updatedTranslations);
    updateLocalStorage(updatedTranslations);
    setEditingId(null); // Exit edit mode
  };

  // --- Renders ---

  if (!translations || translations.length === 0) {
    return (
      <div className="p-8 text-gray-500">
        No translations loaded yet. Please upload a file!
      </div>
    );
  }

  return (
    <div className="p-8 w-full max-w-4xl mx-auto">
      <h2 className="text-2xl mb-4 font-bold text-gray-800">
        Current Translations
      </h2>

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900">English</th>
              <th className="px-6 py-4 font-medium text-gray-900">Foreign</th>
              <th className="px-6 py-4 font-medium text-gray-900 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {translations.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                {/* If this row is being edited, show inputs. Otherwise, show text. */}
                {editingId === item.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editValues.english}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            english: e.target.value,
                          })
                        }
                        className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 flex justify-end">
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded shadow-sm transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-600 bg-gray-100 hover:bg-gray-200 border px-3 py-1 rounded shadow-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {item.english}
                    </td>
                    <td className="px-6 py-4 text-blue-600">{item.foreign}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => handleEditClick(item)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-800 font-medium transition-colors"
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
