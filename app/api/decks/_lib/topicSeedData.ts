// Canonical word lists for the fixed topic decks. Each entry pairs an English
// "native" word with its German and Spanish translations. The seed builds one
// topic deck per (topicKey, foreignLang) from this data.

export type SeedLanguage = "german" | "spanish";

export interface TopicSeedWord {
  native: string; // English
  german: string;
  spanish: string;
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
    name: { german: "Autos", spanish: "Coches" },
    words: [
      { native: "car", german: "Auto", spanish: "coche" },
      { native: "road", german: "Strasse", spanish: "carretera" },
      { native: "wheel", german: "Rad", spanish: "rueda" },
      { native: "engine", german: "Motor", spanish: "motor" },
      { native: "brake", german: "Bremse", spanish: "freno" },
      { native: "driver", german: "Fahrer", spanish: "conductor" },
      { native: "fuel", german: "Kraftstoff", spanish: "combustible" },
      { native: "traffic", german: "Verkehr", spanish: "trafico" },
      { native: "speed", german: "Geschwindigkeit", spanish: "velocidad" },
      { native: "highway", german: "Autobahn", spanish: "autopista" },
    ],
  },
  {
    topicKey: "essen",
    name: { german: "Essen", spanish: "Comida" },
    words: [
      { native: "bread", german: "Brot", spanish: "pan" },
      { native: "water", german: "Wasser", spanish: "agua" },
      { native: "meat", german: "Fleisch", spanish: "carne" },
      { native: "cheese", german: "Kaese", spanish: "queso" },
      { native: "soup", german: "Suppe", spanish: "sopa" },
      { native: "breakfast", german: "Fruehstueck", spanish: "desayuno" },
      { native: "dinner", german: "Abendessen", spanish: "cena" },
      { native: "coffee", german: "Kaffee", spanish: "cafe" },
      { native: "sugar", german: "Zucker", spanish: "azucar" },
      { native: "plate", german: "Teller", spanish: "plato" },
    ],
  },
  {
    topicKey: "obst-gemuese",
    name: { german: "Obst & Gemuese", spanish: "Frutas y verduras" },
    words: [
      { native: "apple", german: "Apfel", spanish: "manzana" },
      { native: "banana", german: "Banane", spanish: "platano" },
      { native: "orange", german: "Orange", spanish: "naranja" },
      { native: "tomato", german: "Tomate", spanish: "tomate" },
      { native: "potato", german: "Kartoffel", spanish: "patata" },
      { native: "carrot", german: "Karotte", spanish: "zanahoria" },
      { native: "onion", german: "Zwiebel", spanish: "cebolla" },
      { native: "lemon", german: "Zitrone", spanish: "limon" },
      { native: "grape", german: "Traube", spanish: "uva" },
      { native: "salad", german: "Salat", spanish: "ensalada" },
    ],
  },
  {
    topicKey: "reisen",
    name: { german: "Reisen", spanish: "Viajes" },
    words: [
      { native: "airport", german: "Flughafen", spanish: "aeropuerto" },
      { native: "ticket", german: "Fahrkarte", spanish: "billete" },
      { native: "hotel", german: "Hotel", spanish: "hotel" },
      { native: "luggage", german: "Gepaeck", spanish: "equipaje" },
      { native: "passport", german: "Reisepass", spanish: "pasaporte" },
      { native: "train", german: "Zug", spanish: "tren" },
      { native: "map", german: "Karte", spanish: "mapa" },
      { native: "beach", german: "Strand", spanish: "playa" },
      { native: "station", german: "Bahnhof", spanish: "estacion" },
      { native: "journey", german: "Reise", spanish: "viaje" },
    ],
  },
  {
    topicKey: "alltag",
    name: { german: "Alltag", spanish: "Vida diaria" },
    words: [
      { native: "morning", german: "Morgen", spanish: "manana" },
      { native: "work", german: "Arbeit", spanish: "trabajo" },
      { native: "house", german: "Haus", spanish: "casa" },
      { native: "money", german: "Geld", spanish: "dinero" },
      { native: "friend", german: "Freund", spanish: "amigo" },
      { native: "phone", german: "Telefon", spanish: "telefono" },
      { native: "time", german: "Zeit", spanish: "tiempo" },
      { native: "week", german: "Woche", spanish: "semana" },
      { native: "sleep", german: "Schlaf", spanish: "sueno" },
      { native: "shopping", german: "Einkaufen", spanish: "compras" },
    ],
  },
];

export const SEED_FOREIGN_LANGUAGES: SeedLanguage[] = ["german", "spanish"];
export const TOPIC_NATIVE_LANG = "english";
