## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Copy [.env.example](.env.example) to `.env.local` and fill in your keys before running the app.

Required values:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` if you want Google sign-in
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` if you want GitHub sign-in
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY` and `NEXT_PUBLIC_PUSHER_CLUSTER`

## Word Deck Management

### Adding Words

Navigate to the "My Decks" page where you can manage your word decks. You have two options:

⚠️ Copyright Notice

This project is closed-source and provided here for portfolio and viewing purposes only. You are welcome to review the code, but no permission is granted to copy, modify, distribute, or use this software in any capacity. See the LICENSE file for full details.

#### Option 1: Add Individual Words

Use the form to add words one at a time:

- **Native Word**: The word in your native language (e.g., "Hello")
- **Foreign Translation**: The translation in the target language (e.g., "Hola")
- **Foreign Language**: The language you're learning (e.g., "Spanish")

#### Option 2: Import from JSON

Upload a JSON file with the following format:

```json
[
  {
    "id": 1,
    "native": "Hello",
    "foreign": "Hola",
    "foreignLanguage": "Spanish"
  },
  {
    "id": 2,
    "native": "Thank you",
    "foreign": "Gracias",
    "foreignLanguage": "Spanish"
  }
]
```

See `public/example-words.json` for a complete example.

### Data Storage

Words are stored in the browser's local storage under the `wordDatabase` key. The data structure includes:

- `id`: Unique identifier for each word
- `native`: Word in your native language
- `foreign`: Translation in the foreign language
- `foreignLanguage`: Name of the target language

### Managing Your Deck

Once words are added, you can:

- **View** all words in your database
- **Edit** native and foreign translations
- **Delete** words you no longer need
- **Filter** by language (shown as badges next to each translation)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
