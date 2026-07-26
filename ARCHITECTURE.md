# Architecture

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI + Nova preset) · Supabase · pnpm

## Layering

    src/
      app/            # routing only — thin layouts/pages/route handlers, no business logic
      components/
        ui/            # shadcn primitives — generated via `pnpm dlx shadcn add <name>`, not hand-written
        (shared/)      # cross-feature reusable presentational components, created as needed
      lib/
        env.ts          # validated environment schema (see below)
        supabase/        # client.ts (browser), server.ts (RSC/Server Actions), middleware.ts (session refresh)
        utils.ts         # cn() class-merging helper
      features/         # domain features — see src/features/README.md for the per-feature layering convention
      proxy.ts           # Next.js 16 proxy (formerly "middleware") — refreshes the Supabase session

`src/app/**` route files stay thin: they compose UI/logic from a feature's `application` or `ui` layer.
Business logic does not live directly in route files.

## Data mutations: Server Actions by default

Server Actions, colocated in each feature's `application/` layer, are the default way to create/update data —
called directly from Server or Client Components. `src/app/api/**` route handlers are reserved for cases that
need an explicit external HTTP contract (webhooks, third-party integrations, non-Next consumers), not for
ordinary in-app mutations.

## Environment variables

All environment variables are declared and validated in `src/lib/env.ts` via `@t3-oss/env-nextjs` + `zod`.
`next.config.ts` imports this module so a misconfigured environment fails fast at build/start time rather
than surfacing as a runtime error on first use. **Never read `process.env` directly** — always import `env`
from `src/lib/env.ts`, and add new variables to its schema when a feature needs them.

## Supabase

- `src/lib/supabase/client.ts` — browser client, for Client Components.
- `src/lib/supabase/server.ts` — cookie-aware client for Server Components/Actions.
- `src/lib/supabase/middleware.ts` — session-refresh helper, invoked from `src/proxy.ts` on every request.
  Returns `{ response, user }` so `src/proxy.ts` can make route-protection decisions without a second
  auth check.

`SUPABASE_SERVICE_ROLE_KEY` is intentionally not configured yet — add it to `src/lib/env.ts`'s server schema
only once a server-only/admin feature actually needs it. Auth (`src/features/auth`) never uses it: new
`public.profiles` rows are created by a database trigger (`supabase/migrations/`), not app code.

## Authentication

`src/features/auth` is the first feature built on the `domain/application/infrastructure/ui` convention:

- Email/password registration, login, logout, forgot-password, and reset-password, plus a `GET
/auth/callback` route handler that exchanges a Supabase PKCE `code` for a session (used by both the
  signup-confirmation and password-reset email links).
- Route protection lives in `src/proxy.ts`: unauthenticated users hitting `/dashboard` or
  `/reset-password` are redirected to `/login`; authenticated users hitting `/login`, `/register`, or
  `/forgot-password` are redirected to `/dashboard`. `/reset-password` is deliberately excluded from the
  latter rule since Supabase's recovery link signs the user into a temporary session before they land there.
- `NEXT_PUBLIC_SITE_URL` (added to `src/lib/env.ts`) builds the absolute `emailRedirectTo`/`redirectTo`
  URLs used in signup-confirmation and password-reset emails.

## Follow-ups (deliberately not done during scaffolding)

- **`src/types/supabase.ts`** — generate once a real Supabase project is linked:
  `supabase gen types typescript --project-id <ref> > src/types/supabase.ts`
- **`src/config/`** — create when the first real non-secret config value (site metadata, feature flags, etc.)
  needs a home.
- **shadcn components** — add on demand with `pnpm dlx shadcn@latest add <component>` as features need them;
  none are pre-installed.
