<p align="center">
  <img src="./public/katchup_logo_2_transparent.png" alt="KatchUp logo" width="360">
</p>

<p align="center"><strong>"Oh sh*t, how do you say that in German?" ...don't worry, try KatchUp! 🐣</strong></p>

<br>

<!-- Just another flipcards wrapper with integrated ai, but for this time it actually makes sense. -->

Learn words by playing. A multiplayer language-learning app — fast mini-games,
live duels, and vocabulary decks you can write yourself or have generated for you.

[katchup.jakubkuzel.com](https://katchup.jakubkuzel.com)

## <s>What it is</s> Why you need KatchUp

AI is everywhere, but it won't replace actual speaking—at least, not yet. Most vocab apps are just a deck of flashcards with a streak counter bolted on. KatchUp is built differently. We are more than just React-wrapped flashcards:

- **Don't know where to start?** KatchUp assesses your level and gives you exactly the words you need.
- **Want to learn something specific?** Generate your own custom decks instantly using the built-in Gemini AI.
- **Think flashcards are boring?** Don't worry, we've got 5 other fast-paced mini-games to keep you hooked.
- **Think you're better than me?** Queue up for a Live Duel with your friends and let's finally find out.

<br>

## Game modes

<table>
  <tr>
    <td width="33%"><img src="./public/speed_spelling.webp" alt="Speed Spelling"><p align="center">
    <td width="33%"><img src="./public/one_of_three.webp" alt="One of Three"><p align="center">
    <td width="33%"><img src="./public/word_pairing.webp" alt="Word Pairing"><p align="center">
      </sub></p></td>
  </tr>
</table>

## Features

- **Live Duel & Bot Battles** — real-time head-to-head over WebSockets against matched opponents, or practice against a bot when no one is queuing.
- **Six Game Modes** — One of Three, Flip Cards, Speed Spelling, Word Pairing, Score Rush, and Live Duel—all powered by a single, shared word database.
- **Custom & AI Decks** — add words one at a time, bulk-import JSON files, or generate a full deck from any topic using Gemini AI.
- **Friends & Co-op Quests** — add friends, complete shared quests, track streaks, and climb community leaderboards.
- **Level Assessment Test** — places new learners at a sensible difficulty right away instead of forcing them to start from scratch.
- **Installable PWA with Offline Sync** — study anywhere offline, your progress automatically syncs once you're back online.
- **Flexible Auth** — sign in effortlessly with Google, GitHub, or Discord.
- **Fair Monetization** — optional rewarded ads (AdSense H5 Games) to top up energy instead of paywalls, plus Stripe-powered voluntary donations.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Tailwind CSS v4**
- **PostgreSQL** (Neon) via **Drizzle ORM**
- **NextAuth v5** (Google / GitHub / Discord)
- **Upstash Redis** — matchmaking state, caching
- **Pusher** — WebSocket channels for real-time duels
- **Google Gemini API** — AI deck generation
- **GSAP** + **Three.js** — page animations and a 3D mascot scene
- **Zustand** — client-side game state
- **Stripe** — donation checkout

### Architecture

Everything lives in one Next.js app — the `app/api/*` routes are the backend,
there's no separate server. Auth writes straight to Postgres through the
Drizzle adapter. A duel goes: queue for a match (state kept in Redis) → once
paired, both clients join a Pusher channel keyed by match ID → moves broadcast
over that channel instead of polling. Games read from either the shared word
database or a player's own deck in Postgres, AI-generated decks are a
server-side call to Gemini that returns a structured word list. See
[DOCUMENTATION.md](./DOCUMENTATION.md) for the full schema and module breakdown.
## Running it locally

Requirements: Node 18+, a Postgres URL (Neon works), an Upstash Redis instance,
and a Pusher app.

```bash
git clone https://github.com/xxKuzi/KatchUp.git
cd KatchUp
npm install
cp .env.example .env.local   # fill in the values below
npm run db:generate && npm run db:push
npm run dev
```

Open [localhost:3000](http://localhost:3000).

**Required:** `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN`, `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` /
`PUSHER_CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER`.

**Optional:** `AUTH_GOOGLE_ID`/`SECRET`, `AUTH_GITHUB_ID`/`SECRET`,
`AUTH_DISCORD_ID`/`SECRET` (sign-in providers), `GEMINI_API_KEY` (AI deck
generation), `STRIPE_SECRET_KEY` + `STRIPE_DONATION_PRICE_ID` (donations),
`NEXT_PUBLIC_ADSENSE_*` (rewarded ads — leave unset and the ad button just
doesn't show up).

## License

This repository is shared for portfolio and educational viewing purposes only. You are welcome to clone and execute the project locally to evaluate how it works. However, no permission is granted to modify, redistribute, or incorporate this code into other repositories or software. See [LICENSE](./LICENSE).
