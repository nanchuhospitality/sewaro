# Sewaro MVP (Phase 1)

QR-based, view-only digital menu platform for hotels/restaurants.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres + Storage)

## Run locally
1. Copy envs:
   - `cp .env.example .env.local`
2. Install deps:
   - `npm install`
3. Run migration in Supabase SQL editor using `supabase/migrations/0001_init.sql`.
4. Start app:
   - `npm run dev`

## Required env vars
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (required for superadmin admin-user creation)

## Seed scripts
1. Set seed vars in `.env.local`:
   - `SEED_SUPERADMIN_EMAIL`
   - `SEED_SUPERADMIN_PASSWORD`
   - `SEED_DEMO_ADMIN_EMAIL`
   - `SEED_DEMO_ADMIN_PASSWORD`
   - Optional:
     - `SEED_DEMO_BUSINESS_NAME`
     - `SEED_DEMO_BUSINESS_SLUG`

2. Run:
   - `npm run seed:superadmin`
   - `npm run seed:demo`
