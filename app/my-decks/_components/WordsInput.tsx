import React, { useRef } from "react";

// Define the props for the component
interface WordsInputProps {
  onUploadSuccess?: () => void;
}

function WordsInput({ onUploadSuccess }: WordsInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = () => {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      alert("Please select a JSON file first.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        // e.target.result can be an ArrayBuffer or string, so we cast it
        const result = e.target?.result as string;
        const json = JSON.parse(result);

        // Save to local storage
        localStorage.setItem("customTranslations", JSON.stringify(json));
        alert("Translations updated successfully!");

        // Trigger a reload/callback in the UI if provided
        if (onUploadSuccess) {
          onUploadSuccess();
        }

        // Clear the input so the same file can be uploaded again if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        alert("Invalid JSON file. Please check the format.");
        console.error("JSON parsing error:", error);
      }
    };

    // Read the file as text
    reader.readAsText(file);
  };

  return (
    <div className="mb-16 flex-col flex items-center gap-4">
      <h2 className="text-2xl">
        Upload <span className="font-bold">JSON</span> file
      </h2>
      <input
        ref={fileInputRef}
        className="w-64 mt-3 h-16 border rounded-lg p-2"
        type="file"
        accept=".json"
      />
      <button
        onClick={uploadFile}
        className="px-4 py-2 bg-blue-500 text-white border border-transparent transition duration-200 hover:border-white rounded-xl"
      >
        Upload
      </button>
    </div>
  );
}

export default WordsInput;
