# Deployment Checklist

Complete these steps before deploying `medical-mvp` to Vercel.

## Environment Variables

Set the following in the **Vercel Dashboard** → Project → Settings → Environment Variables (Production) before hitting deploy:

| Variable | Instructions |
| --- | --- |
| `DATABASE_URL` | Get this from Neon/Supabase. Must be a Postgres connection string that supports **pgvector**. |
| `NEXTAUTH_SECRET` | Generate using `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Set to the production domain, e.g. `https://my-app.vercel.app`. |
| `APP_BASE_URL` | Set to the same production domain, e.g. `https://my-app.vercel.app`. |
| `OPENROUTER_API_KEY` | Required for AI generation (mentor, RAG cases, digest). Get from OpenRouter. Set before deploy so runtime AI calls succeed. |
| `BLOB_READ_WRITE_TOKEN` | Required for clinical image uploads via Vercel Blob. Create a Blob store in the Vercel dashboard (Storage → Blob) and copy the token. |
| `CRON_SECRET` | Generate a strong secret for the weekly-digest cron job (e.g. `openssl rand -base64 32`). |

## Pre-launch Database Setup

Run these commands **locally** against the production database before launching. Point `DATABASE_URL` at the production Neon/Supabase URL (temporarily in your shell or a local `.env`), then:

```bash
npx prisma db push
npx prisma db seed
```

- `npx prisma db push` — syncs the Prisma schema (including pgvector) to the production database.
- `npx prisma db seed` — seeds initial data required for the app to function.
