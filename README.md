# Tailor Ledger — Global Tailor Accounting SaaS

EN-first ledger for tailor shops worldwide. 7 languages (EN TR RU DE FR ES AR, RTL ready), 3 professional themes
(Notebook Classic / Pro Light / Pro Dark), day/month close, Z-report, Excel, backup, AI assistant.

- App: `/app` — ledger + assistant
- Landing + pricing ($3/mo Pro): `/`
- Billing: Lemon Squeezy checkout + webhook skeleton (`/api/billing/*`)
- AI: Groq primary, Ollama local, HuggingFace fallback (`src/lib/hf.ts`)
- DB: Postgres via `DATABASE_URL` (Vercel: Neon/Supabase). Without DB it runs on file mirror (local only).

## Run

```bash
npm install
cp .env.example .env.local  # fill keys, never commit .env.local
npm run dev
```

## Deploy (Vercel)

1. Push this folder to GitHub (private).
2. Vercel → New Project → import.
3. Env vars: `DATABASE_URL`, `GROQ_API_KEY`, `HUGGINGFACE_API_KEY`, `LEMONSQUEEZY_API_KEY`,
   `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID`, `NEXT_PUBLIC_APP_URL`.
4. Lemon dashboard webhook URL: `https://YOUR-DOMAIN/api/billing/webhook`.

## Notes

- `.env.local`, `data/*.json`, `*.log` are gitignored.
- File store is for local dev; production uses Postgres (Vercel filesystem is ephemeral).
