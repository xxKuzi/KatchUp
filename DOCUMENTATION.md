# KatchUp - Project Documentation

## 1. Overview
**KatchUp** is a multiplayer language-learning platform featuring competitive mini-games, real-time matchmaking, custom vocabulary decks, and social features such as leaderboards and friends. Users can study vocabulary using spaced repetition concepts, compete with others in real-time language challenges, and track their progress over time.

## 2. Tech Stack Setup & Architecture

### Core Technologies
- **Framework:** Next.js 16 (App Router) with React 19.
- **Language:** TypeScript for end-to-end type safety.
- **Styling:** Tailwind CSS v4 & generic CSS (`app/globals.css`).
- **Animations:** GSAP (`@gsap/react`).
- **Icons:** Lucide React (`lucide-react`).

### Backend & Database
- **Database:** PostgreSQL (hosted via `@neondatabase/serverless`).
- **ORM:** Drizzle ORM (`drizzle-orm`) with `drizzle-kit` for migrations.
- **Authentication:** NextAuth.js (`next-auth` v5 beta) with Drizzle Adapter handling OAuth (Google/GitHub) and Sessions.
- **Caching & Key-Value DB:** Redis (hosted via Upstash) for temporary state, matchmaking, or quick asynchronous scores.
- **Real-time WebSockets:** Pusher (`pusher` on server, `pusher-js` on client) for real-time matchmaking, live game status, and multiplayer syncing.

### State Management
- **Client State:** Zustand for synchronous global game states.
- **Context API:** React Context (e.g., `languageContext.tsx`) for global UI themes or language toggles.

## 3. Project Structure

The project relies heavily on the Next.js App Router paradigm (`app/` directory nested routing).

```bash
KatchUp/
├── app/                      # Next.js App Router pages and API routes
│   ├── _components/          # Global UI components (Navbar, FeatureGate, etc.)
│   ├── _lib/                 # Global utilities Contexts (Auth, Translations)
│   ├── api/                  # Next.js API Routes (Backend logic)
│   │   ├── auth/             # NextAuth authentication endpoints
│   │   ├── flip-cards/       # Game logic, matchmaking, async scoring
│   │   └── friends/          # Friend search and profile endpoints
│   ├── friends/              # Social pages & profiles
│   ├── games/                # Mini-games wrapper structure
│   │   ├── flip-cards/       # Flip Cards game
│   │   ├── guess-match/      # Guess Match game
│   │   ├── one-of-three/     # One-of-Three game
│   │   └── quick-guess/      # Quick Guess game
│   ├── leaderboard/          # Global/League Leaderboards
│   ├── login/                # Authentication page
│   ├── my-decks/             # Custom vocabulary deck management
│   ├── sentences/            # Sentence practice modules
│   └── topics/               # Categorized language topics
├── db/                       # Drizzle ORM database schemas & setup
├── drizzle/                  # Auto-generated Drizzle migration files
├── lib/                      # Core configuration instances (Auth, DB, Redis, Pusher)
├── public/                   # Static assets & JSON templates
├── .env.local                # Local environment variables
└── package.json              # Project dependencies and scripts
```

## 4. Key Features & Modules

### 4.1 Authentication (`app/api/auth`)
Uses `next-auth` synced with Drizzle ORM connecting to PostgreSQL. Manages users, accounts (OAuth linking), sessions, and verification tokens. Core user entity definitions are found in `db/schema.ts`.

### 4.2 Multiplayer Matchmaking (`app/api/flip-cards/matchmaking`)
Players queue up and are paired using Redis or Drizzle. Once a match is confirmed, game instances are broadcast via **Pusher** so players can enter the `[matchId]` room and begin synchronized play.

### 4.3 Mini-Games (`app/games/*`)
- **Flip Cards:** Classic memory game adapted for vocabulary (match native word to foreign word).
- **One of Three:** Multiple-choice language test mode.
- **Guess Match & Quick Guess:** Fast-paced vocabulary association games.
These modes pull data from preset databases, or fallback to the local `playerProfile.ts` and `wordDatabase.ts`.

### 4.4 Custom Deck Management (`app/my-decks`)
Users can add individual words or bulk-import vocabulary lists via `.json` files. Data maps an ID, native word, translated word, and respective target language.

### 4.5 Leaderboards & Friends (`app/leaderboard`, `app/friends`)
Keeps track of user progress, correct counts, and wins securely via the database (`matches` and `match_players` tables).

## 5. Database Schema (Drizzle ORM)

The database schema (`db/schema.ts`) is grouped by standard Auth schemas and Game schemas:
- **`users`, `accounts`, `sessions`, `verification_tokens`**: Standard NextAuth compliance models.
- **`matches`**: Tracks individual multiplayer matchups, language settings, and current state (winner, finishedAt).
- **`match_players`**: Tracks the progression, correct guessing count, and match attachment for each user.
- **`match_questions`**: Snapshots the questions delivered to the match for validation.
- **`match_answers`**: Audit trail of player answers for asynchronous scoring calculations or disputes.

## 6. How to Run Locally

### Requirements
- Node.js (v18 or above recommended)
- PostgreSQL database URL (e.g., Neon or local pg)
- Redis URL (e.g., Upstash)
- Pusher App Credentials
- OAuth Keys (Google/GitHub)

### Setup Steps
1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env.local` and populate the required authentication, database, and Pusher API keys.

3. **Database Migration:**
   Deploy the tables defined in `db/schema.ts` to your PostgreSQL instance.
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Launch Application:**
   Start the local development server.
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to interact with KatchUp!