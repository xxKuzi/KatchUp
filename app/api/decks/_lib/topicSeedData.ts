// Canonical word lists for the fixed topic decks. Each entry pairs an English
// "native" word with its German and Spanish translations. The seed builds one
// topic deck per (topicKey, foreignLang) from this data.

export type SeedLanguage = "de" | "es";

export interface TopicSeedWord {
  native: string; // English
  de: string;
  es: string;
}

export interface TopicSeed {
  topicKey: string;
  // Display name per foreign language, mirrors the labels in topicsProgress.ts.
  name: Record<SeedLanguage, string>;
  words: TopicSeedWord[];
}

export const TOPIC_SEEDS: TopicSeed[] = [
  {
    topicKey: "autos",
    name: { de: "Autos", es: "Coches" },
    words: [
      { native: "car", de: "Auto", es: "coche" },
      { native: "road", de: "Strasse", es: "carretera" },
      { native: "wheel", de: "Rad", es: "rueda" },
      { native: "engine", de: "Motor", es: "motor" },
      { native: "brake", de: "Bremse", es: "freno" },
      { native: "driver", de: "Fahrer", es: "conductor" },
      { native: "fuel", de: "Kraftstoff", es: "combustible" },
      { native: "traffic", de: "Verkehr", es: "trafico" },
      { native: "speed", de: "Geschwindigkeit", es: "velocidad" },
      { native: "highway", de: "Autobahn", es: "autopista" },
    ],
  },
  {
    topicKey: "essen",
    name: { de: "Essen", es: "Comida" },
    words: [
      { native: "bread", de: "Brot", es: "pan" },
      { native: "water", de: "Wasser", es: "agua" },
      { native: "meat", de: "Fleisch", es: "carne" },
      { native: "cheese", de: "Kaese", es: "queso" },
      { native: "soup", de: "Suppe", es: "sopa" },
      { native: "breakfast", de: "Fruehstueck", es: "desayuno" },
      { native: "dinner", de: "Abendessen", es: "cena" },
      { native: "coffee", de: "Kaffee", es: "cafe" },
      { native: "sugar", de: "Zucker", es: "azucar" },
      { native: "plate", de: "Teller", es: "plato" },
    ],
  },
  {
    topicKey: "obst-gemuese",
    name: { de: "Obst & Gemuese", es: "Frutas y verduras" },
    words: [
      { native: "apple", de: "Apfel", es: "manzana" },
      { native: "banana", de: "Banane", es: "platano" },
      { native: "orange", de: "Orange", es: "naranja" },
      { native: "tomato", de: "Tomate", es: "tomate" },
      { native: "potato", de: "Kartoffel", es: "patata" },
      { native: "carrot", de: "Karotte", es: "zanahoria" },
      { native: "onion", de: "Zwiebel", es: "cebolla" },
      { native: "lemon", de: "Zitrone", es: "limon" },
      { native: "grape", de: "Traube", es: "uva" },
      { native: "salad", de: "Salat", es: "ensalada" },
    ],
  },
  {
    topicKey: "reisen",
    name: { de: "Reisen", es: "Viajes" },
    words: [
      { native: "airport", de: "Flughafen", es: "aeropuerto" },
      { native: "ticket", de: "Fahrkarte", es: "billete" },
      { native: "hotel", de: "Hotel", es: "hotel" },
      { native: "luggage", de: "Gepaeck", es: "equipaje" },
      { native: "passport", de: "Reisepass", es: "pasaporte" },
      { native: "train", de: "Zug", es: "tren" },
      { native: "map", de: "Karte", es: "mapa" },
      { native: "beach", de: "Strand", es: "playa" },
      { native: "station", de: "Bahnhof", es: "estacion" },
      { native: "journey", de: "Reise", es: "viaje" },
    ],
  },
  {
    topicKey: "alltag",
    name: { de: "Alltag", es: "Vida diaria" },
    words: [
      { native: "morning", de: "Morgen", es: "manana" },
      { native: "work", de: "Arbeit", es: "trabajo" },
      { native: "house", de: "Haus", es: "casa" },
      { native: "money", de: "Geld", es: "dinero" },
      { native: "friend", de: "Freund", es: "amigo" },
      { native: "phone", de: "Telefon", es: "telefono" },
      { native: "time", de: "Zeit", es: "tiempo" },
      { native: "week", de: "Woche", es: "semana" },
      { native: "sleep", de: "Schlaf", es: "sueno" },
      { native: "shopping", de: "Einkaufen", es: "compras" },
    ],
  },
];

export const SEED_FOREIGN_LANGUAGES: SeedLanguage[] = ["de", "es"];
export const TOPIC_NATIVE_LANG = "en";
