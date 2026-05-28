# AnimePahe Simple

A minimal Next.js app with a small AnimePahe wrapper that works on Vercel.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open: http://localhost:3000

## API endpoints

- `/api/animepahe?path=search&query=one+piece`
- `/api/search?q=one+piece`
- `/api/animepahe?path=latest`
- `/api/animepahe?path=info&id={session}`
- `/api/animepahe?path=episodes&id={session}`
