export type BlogTopic = "english" | "german" | "spanish" | "katchup";

export interface BlogSection {
  heading: string;
  body: string[];
}

export interface BlogArticle {
  slug: string;
  topic: BlogTopic;
  title: string;
  excerpt: string;
  readTime: string;
  sections: BlogSection[];
}

export const TOPIC_META: Record<
  BlogTopic,
  { label: string; flag: string; color: string }
> = {
  english: {
    label: "English",
    flag: "🇬🇧",
    color:
      "border-sky-200/80 bg-sky-100/80 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-200",
  },
  german: {
    label: "German",
    flag: "🇩🇪",
    color:
      "border-amber-200/80 bg-amber-100/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200",
  },
  spanish: {
    label: "Spanish",
    flag: "🇪🇸",
    color:
      "border-rose-200/80 bg-rose-100/80 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200",
  },
  // Not a language: how the app itself works, for the questions the UI can only
  // answer with a badge and a number.
  katchup: {
    label: "Using KatchUp",
    flag: "🍅",
    color:
      "border-emerald-200/80 bg-emerald-100/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "how-katchup-counts-learned-words",
    topic: "katchup",
    title: "How KatchUp Decides a Word Is \"Learned\"",
    excerpt:
      "Why a word can say \"Learned ×4\" after only two flip cards, and what the number next to every word on your Learned Words page actually counts.",
    readTime: "4 min read",
    sections: [
      {
        heading: "Words collect mastery points, not rounds",
        body: [
          "Every word you practise carries a small score. Answer it right and the score goes up; answer it wrong and it drops by one. Once the score reaches 3, the word is marked Learned and KatchUp stops serving it in normal practice rounds.",
          "The important part: not every right answer is worth the same. A right answer is worth 1 point in most games — but 2 in the ones where you had to commit before seeing the answer.",
        ],
      },
      {
        heading: "Flip cards and speed spelling are worth two",
        body: [
          "Swiping a flip card to the right is you saying \"I already know this one.\" That claim is worth 2 points, which is why two confident swipes are enough to move a word from new to Learned.",
          "Speed spelling works the same way: typing a word out correctly is worth 2, because reproducing a word from nothing is much stronger evidence than picking it from four options.",
          "Multiple-choice and matching games give 1 point per right answer. They are easier, and recognizing a word is not the same as knowing it.",
        ],
      },
      {
        heading: "So what does ×4 mean?",
        body: [
          "On the Learned Words page, a word marked Learned shows its mastery score. \"Learned ×4\" means four points of mastery — which two confident flip cards will give you. It is not four rounds, four days, or four separate practice sessions.",
          "A word still in practice shows something different: the plain number of times you have answered it correctly. \"In practice ×2\" means you have had it right twice but have not reached mastery yet — usually because a wrong answer in between took a point back off.",
          "The two numbers are counted on different scales on purpose. Before a word is mastered, what helps you is knowing how much practice it has had. After it is mastered, what matters is how solid that mastery is.",
        ],
      },
      {
        heading: "Getting it wrong is cheap",
        body: [
          "A wrong answer costs one point and un-marks the word as Learned so it comes back into rotation. It does not reset you to zero. Two clean rounds are not thrown away by a single slip, and a word you keep forgetting will simply keep reappearing until it sticks.",
        ],
      },
      {
        heading: "One word, one score — across every deck",
        body: [
          "If the same word appears in two of your decks, it is not tracked twice. KatchUp files progress by the word itself, so answering \"das Fenster\" in a house deck and again in a home-repairs deck feeds the same score.",
          "Games you start from the games hub, without picking a deck, count too — with one catch. In an open-ended round like Score Rush, the same word can come up over and over, so a word counts once per round no matter how many times it appears. Forty repeats of one word in one round is not forty practices.",
        ],
      },
    ],
  },
  {
    slug: "how-to-use-katchup-effectively",
    topic: "katchup",
    title: "Getting the Most Out of KatchUp",
    excerpt:
      "Short rounds, honest swipes, and knowing which game to open. A practical guide to using KatchUp so the words actually stay.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Short and daily beats long and occasional",
        body: [
          "A practice round is ten words by default — small enough to finish while the kettle boils. That size is deliberate: the thing that makes vocabulary stick is meeting a word again just before you would have forgotten it, and that only works if you come back often.",
          "One round a day will outrun an hour every Sunday. If you only ever do one thing with this app, make it that.",
        ],
      },
      {
        heading: "Be honest with the flip cards",
        body: [
          "A right swipe is worth double, and nothing checks it. That makes flip cards the fastest way to move words forward — and the fastest way to fool yourself into a page full of words you cannot actually produce.",
          "The test worth applying: could you have said the word out loud before you flipped the card? If not, swipe left. A word you send back costs you one point and a few seconds. A word you wave through disappears from your practice rounds while you still don't know it.",
        ],
      },
      {
        heading: "Prove it with typing, not tapping",
        body: [
          "Multiple-choice games are good for meeting new words: they give you the answer in front of you and let you build recognition cheaply. But recognition fades fastest, which is why those games are worth 1 point per answer.",
          "When you think a word is genuinely learned, take it into Speed Spelling. Typing it from memory is the closest thing here to using the word in real life, and it is scored accordingly.",
        ],
      },
      {
        heading: "Let the app pick the words",
        body: [
          "Practice rounds skip words you have already mastered and lead with the ones you have never seen, the ones you get wrong most, and the ones you have not met in a while. You do not need to hunt for your weak spots — starting a round is how you find them.",
          "When you have worked through a deck, the review round pulls your hardest words back out and tops the round up from the rest of the deck, so the whole pack gets a pass rather than just the sore spots.",
        ],
      },
      {
        heading: "Build decks small and specific",
        body: [
          "A deck of 20 words about one topic beats a deck of 300 covering everything. Small decks reach the satisfying part — a full bar, a finished pack — while a giant deck just feels like a chore that never moves.",
          "Save words inside the phrase you met them in where you can. \"Take a decision\" versus \"make a decision\" is the kind of thing a single-word deck can never teach you.",
        ],
      },
      {
        heading: "Check your Learned Words page for the real picture",
        body: [
          "The Learned Words page lists everything you have practised, mastered words first. If a word is sitting there at \"In practice\" after many rounds, that is the app telling you it is not going in — and it is usually worth attacking differently: say it out loud, write a sentence with it, or find where you actually met it.",
          "For what the number next to each word means, see \"How KatchUp Decides a Word Is Learned.\"",
        ],
      },
    ],
  },
  {
    slug: "english-daily-habits",
    topic: "english",
    title: "5 Daily Habits That Actually Improve Your English",
    excerpt:
      "You don't need a classroom to get better at English. These five small habits, done consistently, beat a few hours of cramming every weekend.",
    readTime: "4 min read",
    sections: [
      {
        heading: "1. Talk to yourself, out loud, every day",
        body: [
          "Narrating your own actions in English — while cooking, commuting, or tidying up — forces you to retrieve words in real time instead of just recognizing them. It feels awkward for the first week and then becomes a genuinely useful five-minute habit.",
          "Pick one routine moment (making coffee, walking the dog) and describe it out loud in English every time you do it. Repetition on the same topic builds fluency faster than novelty.",
        ],
      },
      {
        heading: "2. Read something slightly too easy",
        body: [
          "Learners often pick material that's too hard because it feels more serious. But reading a text where you understand 90%+ without a dictionary trains your brain to process English rather than translate it word by word.",
          "Save the harder articles for active study sessions. Use easy reading for volume — the goal is exposure, not decoding.",
        ],
      },
      {
        heading: "3. Shrink your vocabulary reviews to under two minutes",
        body: [
          "Long review sessions are where motivation goes to die. A short, daily burst of spaced repetition — reviewing words you've already learned right before you'd naturally forget them — keeps vocabulary from leaking away between study sessions.",
          "This is exactly the gap that quick, game-like review rounds are built to fill: small enough to never skip, frequent enough to matter.",
        ],
      },
      {
        heading: "4. Collect phrases, not just words",
        body: [
          "\"Make a decision,\" not just \"decision.\" \"Heavy traffic,\" not just \"traffic.\" Native speakers lean on fixed word pairings (collocations) constantly, and single-word vocabulary lists miss them entirely.",
          "When you save a new word, save it inside the phrase you found it in. You'll sound far more natural for the same amount of memorization effort.",
        ],
      },
      {
        heading: "5. Get corrected — and let it sting a little",
        body: [
          "Mistakes you never hear about get repeated forever. Whether it's a friend, a tutor, or a language partner, seek out low-stakes correction regularly. The goal isn't perfection, it's catching the same error before it becomes a habit.",
        ],
      },
    ],
  },
  {
    slug: "english-listening-practice",
    topic: "english",
    title: "How to Train Your Ear: Listening Practice for English Learners",
    excerpt:
      "Reading English and understanding spoken English are different skills. Here's how to close the gap without feeling lost.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Why listening feels harder than reading",
        body: [
          "In real speech, words blur together, speakers drop sounds, and there's no pause button in a live conversation. Your brain has to segment a continuous stream of sound into words it recognizes — a skill that reading simply doesn't build.",
          "That's why a learner who reads novels comfortably can still struggle to follow a fast podcast. It's not a vocabulary problem; it's a processing-speed problem.",
        ],
      },
      {
        heading: "Start with shadowing",
        body: [
          "Shadowing means listening to a short clip and repeating it out loud almost simultaneously, copying rhythm and intonation rather than translating meaning. It trains your mouth and ear together, which passive listening never does.",
          "Use content with a transcript (many podcasts and YouTube videos have one) so you can check what you actually heard versus what you thought you heard.",
        ],
      },
      {
        heading: "Listen twice: once for gist, once for detail",
        body: [
          "On the first pass, don't pause or look anything up — just try to get the general idea. On the second pass, stop at the parts that were unclear and figure out why: an unfamiliar word, a contraction, or simply speed.",
          "This two-pass method mirrors how native listeners handle unclear audio, and it keeps you from the trap of pausing every three seconds, which kills comprehension of the overall flow.",
        ],
      },
      {
        heading: "Train with accents on purpose",
        body: [
          "If you only ever practice with one accent, any other accent will sound like a different language. Deliberately rotate between a few accents (for example British, American, and Australian) so your ear generalizes instead of overfitting.",
        ],
      },
    ],
  },
  {
    slug: "german-cases-explained",
    topic: "german",
    title: "German Cases Without the Headache: A Beginner's Guide",
    excerpt:
      "Nominative, accusative, dative, genitive — the four words that make most beginners want to quit. Here's the shortcut that actually helps.",
    readTime: "6 min read",
    sections: [
      {
        heading: "Forget the grammar terms for a second",
        body: [
          "Cases exist to answer one question: who is doing what to whom? English mostly answers this with word order (\"The dog bites the man\" vs. \"The man bites the dog\"). German instead changes the article and adjective endings, which is why word order in German can be more flexible than in English.",
          "Once you see cases as a labeling system rather than a memorization nightmare, they get much less intimidating.",
        ],
      },
      {
        heading: "Learn the roles before the endings",
        body: [
          "Nominative: the subject — the one doing the action. Accusative: the direct object — the thing directly affected by the action. Dative: the indirect object — usually the person something is given or done to or for. Genitive: possession — whose thing it is.",
          "\"Der Mann gibt dem Kind den Ball\" — the man (nominative) gives the child (dative) the ball (accusative). Notice each noun's article changed based on its role, not its meaning.",
        ],
      },
      {
        heading: "Prioritize accusative and dative first",
        body: [
          "Genitive is fading from casual spoken German and is often replaced with \"von + dative\" in everyday speech. Nominative you already use correctly by instinct once you know your articles. That leaves accusative and dative as the two that are worth focused, deliberate practice — especially the prepositions that always trigger one or the other (für always takes accusative, mit always takes dative, and so on).",
        ],
      },
      {
        heading: "Drill with minimal pairs",
        body: [
          "Practice short sentence pairs that differ only in case, like \"Ich sehe den Mann\" (accusative) versus \"Ich helfe dem Mann\" (dative). Minimal pairs make the case difference the only variable, so your brain has to actually notice it instead of guessing from context.",
        ],
      },
    ],
  },
  {
    slug: "german-word-order",
    topic: "german",
    title: "Why German Word Order Feels Backwards (And How to Get It Right)",
    excerpt:
      "The verb-at-the-end rule trips up almost every beginner. Here's the pattern behind it, once you stop translating word by word.",
    readTime: "5 min read",
    sections: [
      {
        heading: "The rule everyone half-remembers",
        body: [
          "In a main clause, the conjugated verb is always the second element — not necessarily the second word, the second element. \"Heute gehe ich ins Kino\" puts \"heute\" (today) first and the verb second, even though the subject \"ich\" comes after the verb.",
          "This is the famous \"verb-second\" (V2) rule, and it's consistent enough that once it clicks, it stops being a rule you think about and becomes something you just hear.",
        ],
      },
      {
        heading: "Subordinate clauses flip everything",
        body: [
          "In a clause introduced by words like \"weil\" (because), \"dass\" (that), or \"wenn\" (if/when), the conjugated verb jumps to the very end: \"Ich bleibe zu Hause, weil es regnet.\" This is the part that makes German famously feel backwards to English speakers reading a sentence left to right.",
          "The fix isn't memorizing more rules — it's exposure. Read or listen to enough subordinate clauses and the verb-at-the-end pattern becomes predictable rather than surprising.",
        ],
      },
      {
        heading: "Practice by building, not translating",
        body: [
          "Translating English sentences word-for-word into German word order will consistently fail, because the two languages structure information differently. Instead, practice building German sentences directly: start with a time word or subject, add the verb in the correct slot, then fill in the rest.",
          "Short, spoken drills where you build five or six variations of the same sentence (changing only what comes first) train the pattern far better than reading a grammar explanation twice.",
        ],
      },
    ],
  },
  {
    slug: "spanish-conjugation-shortcuts",
    topic: "spanish",
    title: "Spanish Verb Conjugation: Shortcuts That Actually Work",
    excerpt:
      "You don't need to memorize every table on day one. Here's how to conjugate confidently while your brain catches up on the irregulars.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Learn the three endings, not the six forms",
        body: [
          "Regular Spanish verbs fall into three families: -ar, -er, and -ir. Instead of memorizing six conjugated forms per tense as unrelated words, learn the ending pattern once per family and per tense — the stem barely changes, only the tail does.",
          "\"Hablar\" → hablo, hablas, habla, hablamos, habláis, hablan. Once that pattern is automatic for one -ar verb, it transfers almost for free to hundreds of others.",
        ],
      },
      {
        heading: "Front-load the irregulars that show up constantly",
        body: [
          "Ser, estar, ir, tener, and hacer are irregular, but they're also some of the most frequent verbs in the language, which means you'll see them constantly and get more natural repetition than with any flashcard deck. Learn these five properly before worrying about rarer irregular verbs.",
        ],
      },
      {
        heading: "Use present tense as your foundation, always",
        body: [
          "When you're unsure of a tense mid-conversation, default to present tense and keep talking rather than freezing to search for the \"correct\" form. Native listeners forgive tense mistakes far more easily than long, awkward pauses — fluency beats precision at the beginner stage.",
        ],
      },
      {
        heading: "Group practice by person, not by verb",
        body: [
          "Instead of drilling one verb through all six persons in a row, drill many different verbs but only in the \"yo\" form, then only in the \"tú\" form, and so on. This mirrors how conversation actually works — you rarely conjugate the same verb six ways in a row, but you constantly need the \"yo\" form of whatever verb comes up next.",
        ],
      },
    ],
  },
  {
    slug: "spanish-mistakes-beginners",
    topic: "spanish",
    title: "7 Common Mistakes Spanish Beginners Make (And How to Fix Them)",
    excerpt:
      "Most beginner Spanish mistakes repeat across almost every learner. Spotting them early saves months of reinforcing the wrong habit.",
    readTime: "6 min read",
    sections: [
      {
        heading: "1. Mixing up ser and estar",
        body: [
          "\"Ser\" is for identity and inherent qualities (\"Soy alto\" — I am tall), \"estar\" is for states and locations (\"Estoy cansado\" — I am tired). A quick test: if the quality could plausibly change by tomorrow, it's usually \"estar.\"",
        ],
      },
      {
        heading: "2. Forgetting gender agreement past the noun",
        body: [
          "Beginners often get the article right (\"la mesa\") but forget that adjectives must agree too (\"la mesa roja,\" not \"la mesa rojo\"). Practice noun-adjective pairs together as a single chunk instead of learning them separately.",
        ],
      },
      {
        heading: "3. Overusing subject pronouns",
        body: [
          "Spanish conjugation already tells you who's doing the action, so \"yo,\" \"tú,\" and \"él\" are usually dropped unless you need emphasis or clarity. \"Hablo español\" sounds natural; \"Yo hablo español\" in every sentence sounds over-emphatic to a native ear.",
        ],
      },
      {
        heading: "4. Confusing por and para",
        body: [
          "A rough shortcut: \"para\" points toward a destination, purpose, or deadline (\"para ti,\" \"para el lunes\"); \"por\" covers cause, duration, or exchange (\"por eso,\" \"por dos horas\"). It's not a perfect rule, but it resolves most everyday cases.",
        ],
      },
      {
        heading: "5. Direct translation of English phrasal verbs",
        body: [
          "English leans heavily on phrasal verbs (\"look up,\" \"give in,\" \"figure out\") that don't translate word for word. Learn the Spanish verb as a whole unit (\"averiguar\" for \"figure out\") rather than trying to reconstruct it piece by piece.",
        ],
      },
      {
        heading: "6. Ignoring the personal 'a'",
        body: [
          "When the direct object of a verb is a specific person, Spanish inserts \"a\" before it: \"Veo a mi hermano,\" not \"Veo mi hermano.\" It has no English equivalent, which is exactly why it's easy to forget.",
        ],
      },
      {
        heading: "7. Treating false friends as real cognates",
        body: [
          "\"Embarazada\" means pregnant, not embarrassed. \"Éxito\" means success, not exit. \"Actualmente\" means currently, not actually. False friends look like free vocabulary but silently cause some of the most memorable mistakes — worth learning as a dedicated list.",
        ],
      },
    ],
  },
];

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}
