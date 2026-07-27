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
- Text/creative-direction only (headline, hook, body copy, written visual direction, CTA) at generation
  time — see "Creative image generation" below for the follow-on feature that turns `visual_direction`
  into an actual image. Both `brand_profiles` and `ad_concepts` are owned directly by `user_id` (RLS),
  unlike `competitor_ads`' indirect ownership through `competitors`.

## Agents overview

`src/features/agents-overview` is a read-only dashboard (`/dashboard/agents`) summarizing the other
AI-powered features as status cards — no new tables, no new secrets, no mutations:

- **Only `infrastructure/` and `ui/` layers exist** — there's no user input to validate (`domain/`) and no
  Server Actions (`application/`), since this feature only reads.
- **Status is derived, not tracked**: a card shows "Active" when its underlying run count is greater than
  0, "Idle" otherwise — a real signal from existing data, not a separately maintained flag.
- **No success-rate metric yet, deliberately**: nothing in the app persists failed runs today (Server
  Actions surface an error to the UI but don't write a failure record anywhere), so a genuine success
  percentage isn't computable. `AgentCard` accepts an optional `successRate` prop that simply isn't passed
  yet, rather than showing a fabricated number.
- Counts come from `count(*)` queries directly against `ad_analyses` and `ad_concepts` (same
  database-level cross-feature read pattern as `ad-concepts`'s inspiration picker) — both already RLS-scoped
  to the current user, so no extra filtering is needed here.
- `AgentCard` also supports a `comingSoon` state (muted card, "Coming soon" badge, no run count) for agents
  that are on the roadmap but not built yet — currently just Campaign Manager, blocked on
  `ads_management`-level Meta permissions.
- `AgentCard` also supports a `connected` boolean prop, for agents whose natural state is "connected or
  not" rather than a run count — used by Ad Performance Tracker (`isMetaAdAccountConnected()`, a direct
  `count(*)` check against `meta_ad_account_connections`, same cross-feature-read-at-the-database pattern
  as everywhere else). When passed, it replaces the runs-based status/content entirely rather than trying
  to force a "connected" agent through the "N runs" metaphor.

## Concept refinement

Concept Refiner (`refine-concept.ts` / `refine-concept-form.tsx` / `RefineConcept*`, part of the
`ad-concepts` feature rather than a separate one) lets a user iterate on an existing generated concept with
a short instruction, producing a new concept rather than editing in place:

- `ad_concepts.refined_from_concept_id` is a **nullable, self-referential foreign key** (`on delete set
null`) — a refinement is a new row pointing back at the concept it came from, so the original is never
  lost and both remain comparable in the history list.
- The refinement instruction is stored in the existing `brief` column — that column has always meant "the
  prompt that produced this row", which applies equally to a full generation brief or a one-line refinement
  instruction.
- Uses the same `client.messages.parse()` + `zodOutputFormat(conceptSchema)` pattern as generation, but at
  `effort: "medium"` rather than `"high"` — refining one concept against a specific instruction is a more
  constrained edit than generating 3 concepts from scratch.
- `/dashboard/agents`'s "Concept Generator" and "Concept Refiner" cards are counted as mutually exclusive
  (`refined_from_concept_id is null` vs. `is not null`) so the two numbers sum to the true total.

## Ad performance tracking

`src/features/ad-performance` lets a user connect their own Meta ad account (read-only) and see recent
performance — deliberately different from `competitor-analysis`, which reads _other_ businesses' public ad
data via a server-held token. This is the first feature involving a per-user OAuth connection to a third
party:

- **Facebook Login for Business, not classic Facebook Login.** Its OAuth dialog takes a `config_id` (from
  a Login Configuration created in the Meta app dashboard, requesting `ads_read`) instead of a `scope`
  parameter — confirmed against Meta's current docs before building, since assuming the classic flow would
  have silently failed.
- **The connect flow is two Route Handlers, not a Server Action**, because Server Actions can't receive the
  `GET` + query-string redirects that both starting and completing an OAuth flow require:
  - `src/app/api/meta/oauth/start/route.ts` — sets a random CSRF `state` value in an httpOnly cookie, then
    redirects to Meta's authorize URL.
  - `src/app/api/meta/oauth/callback/route.ts` — verifies `state` against that cookie, exchanges the code
    for a short-lived then a long-lived (~60 day) token, fetches the user's ad accounts (auto-selecting the
    first), and saves the connection.
  - The callback identifies _which app user_ is connecting via the existing Supabase session cookie
    (`createClient()` + `getUser()`), not by encoding identity in `state` — a top-level browser redirect
    back to our own domain still carries our session cookies.
- **`meta_ad_account_connections`** is one row per user (unique on `user_id`), RLS-scoped directly to
  `auth.uid()` (same shape as `brand_profiles`).
- **No token refresh automation and no multi-account picker yet** — both are documented fast-follows, not
  silent omissions. When a stored token has expired, `/dashboard/performance` shows a reconnect prompt
  rather than failing silently.
- **Access tokens are stored as plain `text`**, protected only by RLS and Postgres/Supabase's at-rest
  encryption — not separately encrypted at the column level. Acceptable for a v1 with `ads_read`-scoped
  tokens (read-only, can't spend money or modify campaigns), but worth revisiting with something like
  Supabase Vault before this handles many real users' tokens.

## Creative image generation

Creative Generator (`image-generation-client.ts` / `generate-creative-image.ts` /
`GenerateCreativeImageForm`, part of `ad-concepts` rather than a separate feature — same precedent as
Concept Refiner) turns a concept's `visual_direction` text into an actual AI-generated image, on demand:

- **Claude cannot generate images** — it's text/vision-in, text-out only. This is the app's first
  non-Anthropic AI vendor: **OpenAI**, via the `openai` npm package, chosen over Google Imagen/fal.ai/
  Replicate/Stability because it's a plain API-key-plus-billing account, no app-review process (unlike
  the Meta integrations above).
- **Model is `gpt-image-2`, not `gpt-image-1`** — `gpt-image-1` shuts down 2026-10-23; `gpt-image-2`
  (shipped April 2026) is current. Confirmed against OpenAI's live docs rather than assumed, since a
  training-data prior here would have been stale.
- **No `response_format` param is sent.** Verified against the installed SDK's own type definitions
  (`node_modules/openai/resources/images.d.ts`), not just docs prose: GPT image models — unlike
  `dall-e-2`/`dall-e-3` — don't support `response_format` at all and always return base64 in
  `data[0].b64_json`. There is no URL-returning mode to accidentally pick, so the usual "signed/temporary
  URL expiry" pitfall doesn't apply here.
- `quality: "medium"` (not `"high"`) — balances output quality against latency/cost; OpenAI's docs note
  complex prompts can take up to ~2 minutes at higher quality. `src/app/dashboard/concepts/page.tsx`
  exports `maxDuration = 60` to give the Server Action room to finish on a serverless deploy.
- **The prompt deliberately excludes literal text** (headline/CTA) — image models render legible text
  unreliably, so only `visual_direction` plus brand tone/industry go into the prompt, with an explicit
  instruction not to render text overlays.
- **First use of Supabase Storage in this app** (bucket `ad-creative-images`), created via a plain SQL
  migration (`insert into storage.buckets ...`) rather than a dashboard step — confirmed this is
  Supabase's documented, supported approach. The bucket is **private**, not public, to stay consistent
  with the rest of the app's RLS-everywhere posture; `getSignedImageUrls()` generates 1-hour signed URLs
  server-side each time `/dashboard/concepts` renders, the same "fetch fresh per request" shape the rest
  of the app already uses.
- **One image per concept, not a gallery**: `ad_concepts.creative_image_path` (nullable) stores the
  Storage object path (`{user_id}/{concept_id}.png`), and regenerating overwrites the same object
  (`upsert: true`) instead of accumulating versions — mirrors `brand_profiles`' 1-per-user simplicity.
- **New `ad_concepts` RLS policy**: an `update` policy scoped to `auth.uid() = user_id` was added — the
  table previously had only `select`/`insert`, since nothing before this updated a concept row in place.
- **`storage.objects` RLS** is scoped by path convention rather than a column: policies check
  `auth.uid()::text = (storage.foldername(name))[1]`, i.e. the first path segment is the owning user's id.

### Reference-image generation (product-accurate creative)

Pure text-to-image generation invents the product from scratch — unacceptable for a brand (Copper Soul)
selling specific, real jewelry pieces. `ad_concepts.product_image_url` (nullable) lets a concept point at
an actual product photo; when set, image generation uses OpenAI's **edit** endpoint instead of generate,
compositing the real product into a new scene rather than fabricating one:

- **`client.images.edit()`, not `.generate()`**, whenever at least one reference image is available —
  `generateConceptImage()` in `image-generation-client.ts` takes an optional `{ product?, logo? }`
  references argument and switches endpoints accordingly, rather than being two near-duplicate functions.
  `gpt-image-2` supports the edit endpoint with reference images — confirmed against OpenAI's live docs
  after finding the installed SDK's own docstring comment listed an incomplete/stale model list for
  `edit()` (missing `gpt-image-2`, even though the actual `model` param type and OpenAI's guide both
  confirm support).
- **No `input_fidelity` param** — that knob is for other GPT image models; "gpt-image-2 always processes
  image inputs at high fidelity automatically" per OpenAI's docs, so passing it would be a no-op at best.
- **No masking** — GPT Image's masking is prompt-guided, not pixel-precise, so a full-image edit with an
  explicit "preserve the product exactly, only change the surroundings" instruction does the same job as
  a mask would here, with less complexity.
- **Not a guaranteed pixel-perfect result** — this is a general-purpose edit model, not a specialized
  product-compositing tool. High-fidelity reference processing is the best lever OpenAI exposes, but some
  drift in the product's exact appearance is possible; validate on real products before relying on this
  for production creative.
- **Reference photo via URL paste, not upload** — Copper Soul's product photos already live on a public,
  stable Shopify CDN URL per product, so pasting that URL needs no new upload UI or storage bucket. A
  file-upload alternative is a documented fast-follow, not built.
- **`isAllowedExternalImageHost()` / `fetchExternalImage()` (`image-generation-client.ts`) guard against
  SSRF**: any Server Action that fetches a user-pasted URL server-side — without a check, that's a vector
  for making the server request arbitrary/internal hosts. `cdn.shopify.com`/`*.myshopify.com` are always
  allowed (safe for any store); a store serving CDN/asset files on its own custom domain instead —
  confirmed empirically against Copper Soul's real product and logo URLs, which resolve to
  `www.copper-soul.com/cdn/shop/...`, not `cdn.shopify.com` — additionally needs its domain allowlisted via
  the optional `SHOPIFY_STORE_HOSTNAME` env var. These helpers live in the **infrastructure** layer (they
  need `env`, and `domain/` is meant to stay IO/config-free per this repo's layering convention,
  `src/features/README.md`) and are shared by both the product-photo path (`generate-creative-image.ts`)
  and the brand-logo path (`save-brand-profile.ts`) — the domain schemas only validate that the submitted
  values are well-formed URLs.
- **Optional, not mandatory** — `generateCreativeImageAction` falls back to the original text-only
  generation path when no `productImageUrl` is supplied, so exploratory concepts without a chosen SKU yet
  are unaffected.

### Real brand logo compositing

Instructing the model in prose to "show the brand logo" produces an invented, illegible emblem — GPT
image models render arbitrary text unreliably. `brand_profiles.logo_image_url` (nullable, optional even
though every other brand-profile field is required — its absence only means generated images fall back to
an invented emblem, not degraded ad copy) lets the _real_ logo image be supplied as a second reference
image alongside the product photo:

- `generateConceptImage()` accepts up to two reference images (`product`, `logo`) and passes whichever are
  present to `client.images.edit()` as an array — `Uploadable | Array<Uploadable>` already supports
  multiple images, so no new OpenAI capability was needed, just a prompt that explains each reference's
  role ("this one is the product, preserve it exactly" / "this one is the logo, reproduce it faithfully").
- Verified end-to-end with a real product photo + Copper Soul's real logo: the result showed the logo
  legibly embossed on the jewelry box's interior lining, a clear improvement over the invented-emblem
  fallback — confirming reference images are dramatically more reliable than prose description for
  anything involving exact text/branding.
- Same SSRF allowlist (`isAllowedExternalImageHost`) applies to the logo URL as the product photo URL,
  checked in `saveBrandProfileAction` at save time (fast feedback) rather than only at generation time.

## Follow-ups (deliberately not done during scaffolding)

- **`src/types/supabase.ts`** — generate once a real Supabase project is linked:
  `supabase gen types typescript --project-id <ref> > src/types/supabase.ts`
- **`src/config/`** — create when the first real non-secret config value (site metadata, feature flags, etc.)
  needs a home.
- **shadcn components** — add on demand with `pnpm dlx shadcn@latest add <component>` as features need them;
  none are pre-installed.
