export type SupportedLanguage = "german" | "spanish" | "czech";

export interface LectureWord {
  id: string;
  lecture: number;
  foreign: string;
  native: string;
}

export interface Lecture {
  number: number;
  words: LectureWord[];
}

export type WordsDatabase = Record<SupportedLanguage, Lecture[]>;

export interface LearningProgress {
  language: SupportedLanguage;
  unlockedWordIds: string[];
  masteredWordIds: string[];
  wordStreaks?: Record<string, number>;
  currentLecture: number;
}

export interface LearningStats {
  activeCount: number;
  masteredCount: number;
  unlockedCount: number;
  totalCount: number;
}
