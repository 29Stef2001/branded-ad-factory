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

## Competitor ad analysis

`src/features/competitor-analysis` tracks a competitor's Meta (Facebook/Instagram) Page and pulls their
ads from the public Meta Ad Library API (`ads_archive`), then generates AI analysis of each ad's copy on
demand:

- **Ingestion is fetch-on-add**: adding a competitor (name + numeric Meta Page ID) immediately calls the
  Ad Library API server-side and upserts the returned ads by `meta_ad_archive_id`. There is no background
  job — a manual "refresh" action can be added later if needed.
- **Analysis is on-demand per ad**, not automatic, to keep Claude API spend intentional.
- **Text only, not vision**: the Ad Library API's `ArchivedAd` object has no direct image/video URL field
  (only `ad_snapshot_url`, a link to Meta's own HTML preview page) — so analysis works from ad copy text
  only. `ad_snapshot_url` is surfaced as a "view original ad" link. Real visual analysis is a future
  enhancement, not built here.
- **Claude integration** (`infrastructure/claude-analysis-client.ts`): uses `client.messages.parse()` with
  `zodOutputFormat()` for guaranteed structured output (messaging angle, hook, tone, target audience, CTA,
  summary) — no manual JSON parsing. Model is `claude-opus-5`.
- **Secrets**: `ANTHROPIC_API_KEY` and `META_AD_LIBRARY_ACCESS_TOKEN` live in `src/lib/env.ts`'s server
  schema only — never exposed to the client.
- RLS scopes `competitors` → `competitor_ads` → `ad_analyses` back to `auth.uid()` through
  `competitors.user_id`, so a user only ever sees their own tracked competitors.
- **Meta requires identity verification for Ad Library API access** — confirmed empirically, not
  documented on the `ads_archive` reference page. A bare App Access Token (`{id}|{secret}`) is rejected
  with `error_subcode 2332004` ("App role required"); a User Access Token from the app's own Admin gets
  further but still fails with `error_subcode 2332002` ("Authorization and login needed... follow the
  steps at facebook.com/ads/library/api") until that Facebook account has completed Meta's identity
  confirmation process. This is a one-time step on the token owner's Facebook account, not something the
  app can do programmatically — do this before expecting real ad data to return.

## Ad concept generation

`src/features/ad-concepts` generates original, on-brand ad concepts from a campaign brief, optionally
informed by a competitor ad already analyzed by `competitor-analysis`:

- **One brand profile per user** (`brand_profiles`, unique on `user_id`) supplies the context — brand
  name, industry, tone, target audience, unique selling points — every generation call needs. All fields
  are required; a partial profile produces generic output.
- **Generation, not automation**: a campaign brief plus an optional "inspiration" pick from the user's
  already-analyzed competitor ads. When an inspiration ad is picked, the prompt explicitly instructs
  Claude to take a _different_ messaging angle than that competitor, turning Phase 2's analysis into real
  input rather than a filed-away report.
- **Fixed batch of 3 concepts** per generation, via a single `client.messages.parse()` call with
  `zodOutputFormat()` returning `{ concepts: [...] }` — same structured-output pattern as
  `competitor-analysis`, at `effort: "high"` (vs. `medium` for ad-copy analysis) since creative generation
  benefits more from deeper reasoning than straightforward extraction.
- **Cross-feature reads happen at the database, not the code level**: `ad-concepts`' own repository
  queries `competitor_ads` / `ad_analyses` / `competitors` directly for the inspiration list, rather than
  importing `competitor-analysis`'s repository functions — keeps the two features loosely coupled.
- Text/creative-direction only (headline, hook, body copy, written visual direction, CTA) — no image
  generation. Both `brand_profiles` and `ad_concepts` are owned directly by `user_id` (RLS), unlike
  `competitor_ads`' indirect ownership through `competitors`.

## Follow-ups (deliberately not done during scaffolding)

- **`src/types/supabase.ts`** — generate once a real Supabase project is linked:
  `supabase gen types typescript --project-id <ref> > src/types/supabase.ts`
- **`src/config/`** — create when the first real non-secret config value (site metadata, feature flags, etc.)
  needs a home.
- **shadcn components** — add on demand with `pnpm dlx shadcn@latest add <component>` as features need them;
  none are pre-installed.
