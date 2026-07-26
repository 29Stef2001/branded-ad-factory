# Branded Ad Factory

Analyze competitor ads and generate on-brand ad concepts for e-commerce brands.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase · pnpm

## Getting started

    pnpm install
    cp .env.example .env.local   # fill in your Supabase project's URL and anon key
    pnpm dev

## Scripts

- `pnpm dev` — start the dev server
- `pnpm build` / `pnpm start` — production build/start
- `pnpm lint` — ESLint
- `pnpm format` / `pnpm format:check` — Prettier
- `pnpm typecheck` — TypeScript, no emit

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the project structure and layering conventions.
