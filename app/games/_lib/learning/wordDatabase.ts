import {
  Lecture,
  LectureWord,
  SupportedLanguage,
  WordsDatabase,
} from "./types";

const germanLectureSeeds: Array<Array<[string, string]>> = [
  [
    ["Hallo", "Hello"],
    ["Tschuss", "Bye"],
    ["Danke", "Thanks"],
  ],
  [
    ["Bitte", "Please"],
    ["Ja", "Yes"],
    ["Nein", "No"],
  ],
  [
    ["Morgen", "Morning"],
    ["Abend", "Evening"],
    ["Freund", "Friend"],
  ],
  [
    ["Wasser", "Water"],
    ["Brot", "Bread"],
    ["Milch", "Milk"],
  ],
  [
    ["Haus", "House"],
    ["Schule", "School"],
    ["Arbeit", "Work"],
  ],
  [
    ["Stadt", "City"],
    ["Land", "Country"],
    ["Strasse", "Street"],
  ],
  [
    ["Familie", "Family"],
    ["Kind", "Child"],
    ["Eltern", "Parents"],
  ],
  [
    ["Schnell", "Fast"],
    ["Langsam", "Slow"],
    ["Leicht", "Easy"],
  ],
  [
    ["Reisen", "Travel"],
    ["Lernen", "Learn"],
    ["Sprechen", "Speak"],
  ],
  [
    ["Verstehen", "Understand"],
    ["Erklaren", "Explain"],
    ["Verbessern", "Improve"],
  ],
];

const spanishLectureSeeds: Array<Array<[string, string]>> = [
  [
    ["Hola", "Hello"],
    ["Adios", "Bye"],
    ["Gracias", "Thanks"],
  ],
  [
    ["Por favor", "Please"],
    ["Si", "Yes"],
    ["No", "No"],
  ],
  [
    ["Manana", "Morning"],
    ["Noche", "Night"],
    ["Amigo", "Friend"],
  ],
  [
    ["Agua", "Water"],
    ["Pan", "Bread"],
    ["Leche", "Milk"],
  ],
  [
    ["Casa", "House"],
    ["Escuela", "School"],
    ["Trabajo", "Work"],
  ],
  [
    ["Ciudad", "City"],
    ["Pais", "Country"],
    ["Calle", "Street"],
  ],
  [
    ["Familia", "Family"],
    ["Nino", "Child"],
    ["Padres", "Parents"],
  ],
  [
    ["Rapido", "Fast"],
    ["Lento", "Slow"],
    ["Facil", "Easy"],
  ],
  [
    ["Viajar", "Travel"],
    ["Aprender", "Learn"],
    ["Hablar", "Speak"],
  ],
  [
    ["Entender", "Understand"],
    ["Explicar", "Explain"],
    ["Mejorar", "Improve"],
  ],
];

const czechLectureSeeds: Array<Array<[string, string]>> = [
  [
    ["Ahoj", "Hello"],
    ["Nazdar", "Bye"],
    ["Dekuji", "Thanks"],
  ],
  [
    ["Prosim", "Please"],
    ["Ano", "Yes"],
    ["Ne", "No"],
  ],
  [
    ["Rano", "Morning"],
    ["Vecer", "Evening"],
    ["Kamarad", "Friend"],
  ],
  [
    ["Voda", "Water"],
    ["Chleb", "Bread"],
    ["Mleko", "Milk"],
  ],
  [
    ["Dum", "House"],
    ["Skola", "School"],
    ["Prace", "Work"],
  ],
  [
    ["Mesto", "City"],
    ["Zeme", "Country"],
    ["Ulice", "Street"],
  ],
  [
    ["Rodina", "Family"],
    ["Dite", "Child"],
    ["Rodice", "Parents"],
  ],
  [
    ["Rychly", "Fast"],
    ["Pomaly", "Slow"],
    ["Snadny", "Easy"],
  ],
  [
    ["Cestovat", "Travel"],
    ["Ucit se", "Learn"],
    ["Mluvit", "Speak"],
  ],
  [
    ["Rozumet", "Understand"],
    ["Vysvetlit", "Explain"],
    ["Zlepsit", "Improve"],
  ],
];

function buildLectures(
  language: SupportedLanguage,
  lectureSeeds: Array<Array<[string, string]>>,
): Lecture[] {
  return lectureSeeds.map((pairs, lectureIndex) => {
    const lectureNumber = lectureIndex + 1;
    const words: LectureWord[] = pairs.map(([foreign, native], wordIndex) => ({
      id: `${language}-l${lectureNumber}-w${wordIndex + 1}`,
      lecture: lectureNumber,
      foreign,
      native,
    }));

    return {
      number: lectureNumber,
      words,
    };
  });
}

export const WORDS_DATABASE: WordsDatabase = {
  german: buildLectures("german", germanLectureSeeds),
  spanish: buildLectures("spanish", spanishLectureSeeds),
  czech: buildLectures("czech", czechLectureSeeds),
};

export const TOTAL_LECTURES = 10;

export function getAllWords(language: SupportedLanguage): LectureWord[] {
  return WORDS_DATABASE[language].flatMap((lecture) => lecture.words);
}
