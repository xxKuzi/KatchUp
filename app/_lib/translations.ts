export type Language = "english" | "czech" | "deutsch";

export interface Translations {
  [key: string]: string | Translations;
}

export const LANGUAGES: Record<Language, string> = {
  english: "English",
  czech: "Čeština",
  deutsch: "Deutsch",
};

export const LANGUAGE_FLAGS: Record<Language, string> = {
  english: "🇬🇧",
  czech: "🇨🇿",
  deutsch: "🇩🇪",
};

export const translations: Record<Language, Translations> = {
  english: {
    navbar: {
      games: "Games",
      topics: "Topics",
      myDecks: "My Decks",
      friends: "Me & Friends",
      energy: "Energy",
      resetsIn: "Resets in",
      earnEnergy: "Earn energy back",
      speedSpellingDrill: "Speed spelling drill",
      reviewMistakes: "Review your mistakes",
      buildReviewList: "Practice more to build your review list.",
      energyFull: "Energy full — come back after you spend some.",
    },
    auth: {
      signIn: "Sign in",
      signOut: "Sign out",
    },
    authGate: {
      games:
        "Your game streak and wins are saved for friends. Sign in to unlock game arena.",
      topics:
        "Track your topic progress and unlock packs with keys. Sign in to continue.",
      friends:
        "Let your friends see your progress and challenge your streak. Sign in to open Friends.",
    },
    common: {
      welcome: "Welcome",
      language: "Language",
      theme: "Theme",
      auto: "Auto",
      light: "Light",
      dark: "Dark",
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
    topics: {
      badge: "Learning Packs",
      title: "Choose a Topic",
      subtitle:
        "Five topics, each with five levels. Finish a topic to earn a key and unlock the next one.",
      keys: "Keys",
      levelsDone: "levels done",
      topic: "Topic",
      locked: "Locked Topic",
      needKey: "Use 1 key to unlock this pack.",
      unlock: "Unlock with key",
      noKeys: "No keys yet",
      notFound: "Topic was not found.",
      back: "Back to topics",
      progress: "Progress",
      level: "Level",
      done: "Done",
      pending: "Pending",
      mode: "Mode",
      play: "Play",
      markComplete: "Mark complete",
      completedTitle: "Topic completed",
      completedText: "You earned a key. Return to topics to unlock a new pack.",
      ascend: "Ascend this pack",
      ascended: "Ascended",
    },
    leaderboard: {
      title: "Friends League",
      subtitle:
        "Recruit friends, build 4-player teams, and climb through five leagues.",
    },
    friendsPage: {
      title: "Friends League",
      subtitle:
        "Add friends, build a squad of four, and beat rival teams to earn promotion.",
      currentLeague: "Current league",
      yourXp: "Your XP",
      teamGap: "Team gap",
      promotionProgress: "Promotion progress",
      leagueLadder: "League ladder",
      squadTitle: "Build your squad",
      addFriends: "Add friends",
      yourTeam: "Your team",
      rivalTeam: "Rival team",
      leaderboardTitle: "League leaderboard",
      trainingTitle: "XP tasks",
    },
  },
  czech: {
    navbar: {
      games: "Hry",
      topics: "Temata",
      myDecks: "Moje balíčky",
      friends: "Já a přátelé",
      energy: "Energie",
      resetsIn: "Obnoví se za",
      earnEnergy: "Získej zpět energii",
      speedSpellingDrill: "Rychlé psaní",
      reviewMistakes: "Zopakuj si chyby",
      buildReviewList: "Procvičuj víc a vytvoř si seznam k opakování.",
      energyFull: "Energie je plná — vrať se, až nějakou spotřebuješ.",
    },
    auth: {
      signIn: "Prihlasit se",
      signOut: "Odhlasit se",
    },
    authGate: {
      games:
        "Vase herni serie a vyhry se ukladaji pro pratele. Prihlaste se pro odemceni her.",
      topics:
        "Sledujte pokrok v tematech a odemykejte balicky pomoci klicu. Prihlaste se.",
      friends:
        "At vasi pratele vidi vas pokrok a vyzyvaji vas. Prihlaste se pro sekci Pratele.",
    },
    common: {
      welcome: "Vítejte",
      language: "Jazyk",
      theme: "Motiv",
      auto: "Auto",
      light: "Svetly",
      dark: "Tmavy",
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
    topics: {
      badge: "Balicky uceni",
      title: "Vyberte tema",
      subtitle:
        "Pet temat, kazde s peti urovnemi. Dokoncete tema, ziskejte klic a odemknete dalsi.",
      keys: "Klice",
      levelsDone: "urovni hotovo",
      topic: "Tema",
      locked: "Zamcene tema",
      needKey: "Pouzijte 1 klic pro odemceni.",
      unlock: "Odemknout klicem",
      noKeys: "Zatim zadne klice",
      notFound: "Tema nebylo nalezeno.",
      back: "Zpet na temata",
      progress: "Pokrok",
      level: "Uroven",
      done: "Hotovo",
      pending: "Ceka",
      mode: "Rezim",
      play: "Hrat",
      markComplete: "Oznacit jako hotove",
      completedTitle: "Tema dokonceno",
      completedText:
        "Ziskali jste klic. Vratte se na temata a odemknete novy balicek.",
      ascend: "Povysit tento balicek",
      ascended: "Povyseno",
    },
    leaderboard: {
      title: "Liga přátel",
      subtitle:
        "Přidávejte přátele, skládejte týmy po 4 hráčích a stoupejte pěti ligami.",
    },
    friendsPage: {
      title: "Liga přátel",
      subtitle:
        "Přidávejte přátele, stavte čtyřčlenný tým a porážejte soupeře pro postup.",
      currentLeague: "Současná liga",
      yourXp: "Vaše XP",
      teamGap: "Rozdíl týmů",
      promotionProgress: "Postup do vyšší ligy",
      leagueLadder: "Žebříček lig",
      squadTitle: "Sestavte tým",
      addFriends: "Přidat přátele",
      yourTeam: "Váš tým",
      rivalTeam: "Soupeřův tým",
      leaderboardTitle: "Žebříček přátel",
      trainingTitle: "XP úkoly",
    },
  },
  deutsch: {
    navbar: {
      games: "Spiele",
      topics: "Themen",
      myDecks: "Meine Decks",
      friends: "Ich & Freunde",
      energy: "Energie",
      resetsIn: "Zurücksetzen in",
      earnEnergy: "Energie zurückverdienen",
      speedSpellingDrill: "Schnelles Buchstabieren",
      reviewMistakes: "Fehler wiederholen",
      buildReviewList: "Übe mehr, um deine Wiederholungsliste zu füllen.",
      energyFull: "Energie voll — komm zurück, wenn du welche verbraucht hast.",
    },
    auth: {
      signIn: "Anmelden",
      signOut: "Abmelden",
    },
    authGate: {
      games:
        "Deine Spielserie und Siege werden fur Freunde gespeichert. Melde dich an, um Spiele freizuschalten.",
      topics:
        "Verfolge deinen Themenfortschritt und schalte Pakete mit Schlusseln frei. Melde dich an.",
      friends:
        "Lass Freunde deinen Fortschritt sehen und dich herausfordern. Melde dich an fur Freunde.",
    },
    common: {
      welcome: "Willkommen",
      language: "Sprache",
      theme: "Design",
      auto: "Auto",
      light: "Hell",
      dark: "Dunkel",
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
    topics: {
      badge: "Lernpakete",
      title: "Thema auswahlen",
      subtitle:
        "Funf Themen mit jeweils funf Levels. SchlieBe ein Thema ab, erhalte einen Schlussel und schalte das nachste frei.",
      keys: "Schlussel",
      levelsDone: "Levels fertig",
      topic: "Thema",
      locked: "Gesperrtes Thema",
      needKey: "Nutze 1 Schlussel, um dieses Paket zu entsperren.",
      unlock: "Mit Schlussel entsperren",
      noKeys: "Noch keine Schlussel",
      notFound: "Thema wurde nicht gefunden.",
      back: "Zuruck zu Themen",
      progress: "Fortschritt",
      level: "Level",
      done: "Fertig",
      pending: "Offen",
      mode: "Modus",
      play: "Spielen",
      markComplete: "Als fertig markieren",
      completedTitle: "Thema abgeschlossen",
      completedText:
        "Du hast einen Schlussel erhalten. Gehe zur Themenubersicht, um ein neues Paket zu entsperren.",
      ascend: "Dieses Paket aufwerten",
      ascended: "Aufgewertet",
    },
    leaderboard: {
      title: "Freunde-Rangliste",
      subtitle:
        "Demnachst: Einladungen, Wochenrennen und gemeinsame Meilensteine.",
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
