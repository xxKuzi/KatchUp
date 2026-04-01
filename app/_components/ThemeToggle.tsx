"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const activeTheme = resolvedTheme === "dark" ? "dark" : "light";

  const toggleTheme = () => {
    setTheme(activeTheme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${activeTheme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${activeTheme === "dark" ? "light" : "dark"} mode`}
      className="group inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-slate-900"
    >
      <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-300">
        {activeTheme === "dark" ? (
          <Sun className="h-3 w-3" />
        ) : (
          <Moon className="h-3 w-3" />
        )}
      </span>
      <span>{activeTheme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
