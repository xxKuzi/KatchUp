"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLanguage } from "../_lib/languageContext";

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();

  const activeTheme = theme === "system" || !theme ? "system" : theme;

  useEffect(() => {
    setMounted(true);
  }, []);

  const options = [
    { value: "system", label: t("common.auto", "Auto"), icon: Monitor },
    { value: "light", label: t("common.light", "Light"), icon: Sun },
    { value: "dark", label: t("common.dark", "Dark"), icon: Moon },
  ] as const;

  return !mounted ? (
    <div />
  ) : (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {t("common.theme", "Theme")}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = activeTheme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-label={option.label}
              title={option.label}
              className={`flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
                isActive
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        {activeTheme === "system"
          ? `Follows system: ${resolvedTheme === "dark" ? t("common.dark", "Dark") : t("common.light", "Light")}`
          : `${t("common.theme", "Theme")}: ${
              activeTheme === "dark"
                ? t("common.dark", "Dark")
                : t("common.light", "Light")
            }`}
      </p>
    </div>
  );
}
