import type { Language } from "@/app/_lib/translations";

/**
 * The UI learningLanguage uses the label-style names ("deutsch"), while the
 * DB topic decks store the canonical language key ("german"). This mapping
 * bridges the two naming conventions.
 */
const UI_TO_DB: Record<string, string> = {
  deutsch: "german",
};

/** Maps a UI `Language` to the foreignLang value used by seeded topic decks. */
export function uiLangToForeignLang(lang: Language): string {
  return UI_TO_DB[lang] ?? lang;
}
