export type Language = "english" | "czech" | "deutsch";

export interface Translations {
  [key: string]: string | Translations;
}

export const LANGUAGES: Record<Language, string> = {
  english: "English",
  czech: "Čeština",
  deutsch: "Deutsch",
};

export const translations: Record<Language, Translations> = {
  english: {
    navbar: {
      games: "Games",
      myDecks: "My Decks",
      friends: "Friends",
      healthBar: "Health Bar",
    },
    common: {
      welcome: "Welcome",
      language: "Language",
      theme: "Theme",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      add: "Add",
      back: "Back",
      practice: "Practice",
      create: "Create",
      name: "Name",
      native: "Native",
      foreign: "Foreign",
      words: "words",
      noDecksYet: "No decks yet. Create your first one in the deck editor.",
      totalDecks: "total decks",
    },
    home: {
      hello: "Hello",
      welcomeText: "welcome to KatchUp...",
      topPicks: "Top picks",
      exploreMore: "Explore more",
      flipCards: "Flip Cards",
      oneOfThree: "One of Three",
    },
    myDecks: {
      title: "Your decks",
      description: "here you can edit and practice your custom words",
      openDeckEditor: "Open Deck Editor",
      customDecksByLanguages: "Custom Decks by Languages",
      lastPracticed: "Last practiced",
      never: "Never",
      words: "words",
      nativeWord: "Native Word",
      foreignTranslation: "Foreign Translation",
      foreignLanguage: "Foreign Language",
      addWord: "Add Word",
      uploadJSON: "Or Upload JSON File",
      wordDatabase: "Word Database",
      noWordsYet: "No words added yet. Add your first word above!",
      deleteWord: "Delete",
      editWord: "Edit",
    },
    deckEditor: {
      deckEditor: "Deck Editor",
      createCustomDecksText:
        "Create custom decks by language pair and edit words in each deck.",
      newDeck: "New Deck",
      deckName: "Deck name",
      nativeLang: "Native language",
      foreignLang: "Foreign language",
      createDeckButton: "Create Deck (crypto.randomUUID)",
      decks: "Decks",
      chooseADeck: "Choose a deck to start editing.",
      deckId: "Deck id",
      deleteDeck: "Delete Deck",
      addNewWord: "Add Word",
      wordIdColumn: "Word id",
      action: "Action",
    },
    practice: {
      choosePracticeMode: "Choose Practice Mode",
      backToDecks: "Back to Decks",
      info: "Info",
      deckHasWords: "This deck has",
      chooseAMode: "words. Choose a practice mode to start.",
      deckNotFound: "Deck not found. Please select a deck from the overview.",
      gameInfoText: "Choose a practice mode",
    },
    games: {
      flipCards: "Flip Cards",
      flipCardsDesc: "Flip through cards and test your memory",
      oneOfThree: "One of Three",
      oneOfThreeDesc: "Choose the correct translation from three options",
      guessMatch: "Guess Match",
      guessMatchDesc: "Match native words with their translations",
      quickGuess: "Quick Guess",
      quickGuessDesc: "Rapid-fire translation challenges",
    },
  },
  czech: {
    navbar: {
      games: "Hry",
      myDecks: "Moje balíčky",
      friends: "Přátelé",
      healthBar: "Zdravolní stav",
    },
    common: {
      welcome: "Vítejte",
      language: "Jazyk",
      theme: "Motiv",
      edit: "Upravit",
      delete: "Smazat",
      save: "Uložit",
      cancel: "Zrušit",
      add: "Přidat",
      back: "Zpět",
      practice: "Trénovat",
      create: "Vytvořit",
      name: "Jméno",
      native: "Nativní",
      foreign: "Cizí",
      words: "slov",
      noDecksYet: "Dosud žádné balíčky. Vytvořte si první v editoru balíčků.",
      totalDecks: "celkem balíčků",
    },
    home: {
      hello: "Ahoj",
      welcomeText: "vítejte v KatchUp...",
      topPicks: "Top volby",
      exploreMore: "Prozkoumat více",
      flipCards: "Obrácené karty",
      oneOfThree: "Jeden ze tří",
    },
    myDecks: {
      title: "Vaše balíčky",
      description: "zde můžete upravovat a trénovat svá vlastní slova",
      openDeckEditor: "Otevřít editor balíčku",
      customDecksByLanguages: "Vlastní balíčky podle jazyků",
      lastPracticed: "Naposledy trénováno",
      never: "Nikdy",
      words: "slov",
      nativeWord: "Nativní slovo",
      foreignTranslation: "Cizí překlad",
      foreignLanguage: "Cizí jazyk",
      addWord: "Přidat slovo",
      uploadJSON: "Nebo nahrát soubor JSON",
      wordDatabase: "Databáze slov",
      noWordsYet: "Dosud žádná slova. Přidejte své první slovo výše!",
      deleteWord: "Smazat",
      editWord: "Upravit",
    },
    deckEditor: {
      deckEditor: "Editor balíčku",
      createCustomDecksText:
        "Vytvářejte vlastní balíčky podle jazykové dvojice a upravujte slova v každém balíčku.",
      newDeck: "Nový balíček",
      deckName: "Jméno balíčku",
      nativeLang: "Nativní jazyk",
      foreignLang: "Cizí jazyk",
      createDeckButton: "Vytvořit balíček (crypto.randomUUID)",
      decks: "Balíčky",
      chooseADeck: "Vyberte si balíček k úpravě.",
      deckId: "ID balíčku",
      deleteDeck: "Smazat balíček",
      addNewWord: "Přidat slovo",
      wordIdColumn: "ID slova",
      action: "Akce",
    },
    practice: {
      choosePracticeMode: "Vyberte režim tréninku",
      backToDecks: "Zpět na balíčky",
      info: "Info",
      deckHasWords: "Tento balíček má",
      chooseAMode: "slov. Vyberte si režim tréninku a začněte.",
      deckNotFound: "Balíček nenalezen. Vyberte si prosím balíček z přehledu.",
      gameInfoText: "Vyberte si režim tréninku",
    },
    games: {
      flipCards: "Obrácené karty",
      flipCardsDesc: "Obraťte karty a testujte svou paměť",
      oneOfThree: "Jeden ze tří",
      oneOfThreeDesc: "Vyberte správný překlad ze tří možností",
      guessMatch: "Deduktivní shodování",
      guessMatchDesc: "Spárujte nativní slova s jejich překlady",
      quickGuess: "Rychlý odhad",
      quickGuessDesc: "Rychlé výzvy překladu",
    },
  },
  deutsch: {
    navbar: {
      games: "Spiele",
      myDecks: "Meine Decks",
      friends: "Freunde",
      healthBar: "Gesundheitsbalken",
    },
    common: {
      welcome: "Willkommen",
      language: "Sprache",
      theme: "Design",
      edit: "Bearbeiten",
      delete: "Löschen",
      save: "Speichern",
      cancel: "Abbrechen",
      add: "Hinzufügen",
      back: "Zurück",
      practice: "Üben",
      create: "Erstellen",
      name: "Name",
      native: "Muttersprache",
      foreign: "Fremdsprache",
      words: "Wörter",
      noDecksYet: "Noch keine Decks. Erstellen Sie Ihr erstes im Deck-Editor.",
      totalDecks: "Decks insgesamt",
    },
    home: {
      hello: "Hallo",
      welcomeText: "willkommen bei KatchUp...",
      topPicks: "Top-Auswahl",
      exploreMore: "Mehr erkunden",
      flipCards: "Lernkarten",
      oneOfThree: "Eins von drei",
    },
    myDecks: {
      title: "Ihre Decks",
      description: "Hier können Sie Ihre eigenen Wörter bearbeiten und üben",
      openDeckEditor: "Deck-Editor öffnen",
      customDecksByLanguages: "Benutzerdefinierte Decks nach Sprachen",
      lastPracticed: "Zuletzt trainiert",
      never: "Nie",
      words: "Wörter",
      nativeWord: "Wort in Muttersprache",
      foreignTranslation: "Fremdsprachige Übersetzung",
      foreignLanguage: "Fremdsprache",
      addWord: "Wort hinzufügen",
      uploadJSON: "Oder JSON-Datei hochladen",
      wordDatabase: "Wortdatenbank",
      noWordsYet:
        "Noch keine Wörter hinzugefügt. Fügen Sie Ihr erstes Wort oben hinzu!",
      deleteWord: "Löschen",
      editWord: "Bearbeiten",
    },
    deckEditor: {
      deckEditor: "Deck-Editor",
      createCustomDecksText:
        "Erstellen Sie benutzerdefinierte Decks nach Sprachenpaar und bearbeiten Sie Wörter in jedem Deck.",
      newDeck: "Neues Deck",
      deckName: "Deck-Name",
      nativeLang: "Muttersprache",
      foreignLang: "Fremdsprache",
      createDeckButton: "Deck erstellen (crypto.randomUUID)",
      decks: "Decks",
      chooseADeck: "Wählen Sie ein Deck zum Bearbeiten.",
      deckId: "Deck-ID",
      deleteDeck: "Deck löschen",
      addNewWord: "Wort hinzufügen",
      wordIdColumn: "Wort-ID",
      action: "Aktion",
    },
    practice: {
      choosePracticeMode: "Wählen Sie den Übungsmodus",
      backToDecks: "Zurück zu Decks",
      info: "Info",
      deckHasWords: "Dieses Deck hat",
      chooseAMode: "Wörter. Wählen Sie einen Übungsmodus zum Starten.",
      deckNotFound:
        "Deck nicht gefunden. Bitte wählen Sie ein Deck aus der Übersicht.",
      gameInfoText: "Wählen Sie einen Übungsmodus",
    },
    games: {
      flipCards: "Lernkarten",
      flipCardsDesc: "Lernkarten umblättern und Ihr Gedächtnis testen",
      oneOfThree: "Eins von drei",
      oneOfThreeDesc: "Wählen Sie die richtige Übersetzung aus drei Optionen",
      guessMatch: "Paarspiel",
      guessMatchDesc:
        "Ordnen Sie Wörter in Muttersprache ihren Übersetzungen zu",
      quickGuess: "Schneller Tipp",
      quickGuessDesc: "Schnelle Übersetzungsherausforderungen",
    },
  },
};

export function getTranslation(
  language: Language,
  key: string,
  defaultValue = key,
): string {
  const keys = key.split(".");
  let current: unknown = translations[language];

  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return defaultValue;
    }
  }

  return typeof current === "string" ? current : defaultValue;
}

export function t(
  translations: Translations,
  key: string,
  defaultValue = key,
): string {
  const keys = key.split(".");
  let current: unknown = translations;

  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return defaultValue;
    }
  }

  return typeof current === "string" ? current : defaultValue;
}
