# Creative Intelligence — Architecture

Status: **proposed, not implemented.** This document is the spec to approve before any module is built.

---

## 1. The constraint that shapes everything

Before the design, the number it has to survive. The connected Meta account, last 30 days:

|                       |                                |
| --------------------- | ------------------------------ |
| Spend                 | **$66.75** (~$2.22/day)        |
| Impressions           | **4,241**                      |
| Clicks                | **324**                        |
| CTR                   | 7.64%                          |
| Conversions / revenue | **not collected at all today** |

This matters more than any diagram here, so it goes first rather than in a caveats section at the end.

**Per-creative learning needs per-creative evidence.** If those 4,241 impressions are spread over even five creatives, each has ~850 impressions and ~65 clicks per month. The 95% confidence interval on a 7.6% CTR at n=850 runs roughly 5.9%–9.7%. Two creatives would have to differ by more than ~3 percentage points before you could honestly say one beat the other. Slice that same sample by hook type, then by offer type, then by visual style — which is what modules 4 through 8 do — and each subgroup holds a few dozen impressions. At that size a pattern detector will always find patterns. They just will not be real.

**A second problem: CTR is the only signal available.** No purchase or revenue data is being fetched. A system that optimises CTR alone reliably learns to produce clickbait — the highest-CTR creative is frequently the worst earner. Any honest version of this must model revenue from day one, even while that column is empty.

**This does not mean don't build it.** It means the architecture has to make evidence a first-class concept rather than an afterthought, so the system says _"not enough data"_ by construction instead of producing confident nonsense. Three consequences run through every module below:

1. **Every derived claim carries an evidence tier.** Nothing reaches a recommendation without clearing a threshold.
2. **Scoring shrinks small samples toward the account mean** (Wilson / empirical Bayes) rather than ranking on raw rates. This is the mathematically correct answer to small-n, not a workaround.
3. **Collection is decoupled from inference.** Ingestion and the fact table are built to full production quality now, so evidence accumulates from today. The inference modules stay honest while it accumulates and get better on their own as it does.

The same architecture serves 4,241 impressions and 4 billion. Only the evidence tier changes what it is willing to say.

---

## 2. Module map

Ten modules, in four layers. Arrows are data dependencies.

```
                          ┌──────────────────────────────────┐
   META GRAPH API ───────▶│ 1. Ingestion                     │
                          │    ads, adsets, campaigns,       │
                          │    daily insights, actions       │
                          └────────────┬─────────────────────┘
                                       │
                          ┌────────────▼─────────────────────┐
                          │ 2. Creative Performance DB       │
                          │    facts + attribution to our    │
                          │    own ad_concepts               │
                          └────────────┬─────────────────────┘
                                       │
                          ┌────────────▼─────────────────────┐
                          │ 3. Performance Scoring           │
                          │    shrunk metrics, evidence tier │
                          └────────────┬─────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌──────▼─────┐ ┌───────▼─────┐        │
│ 5. Winning   │ │ 6. Hook    │ │ 7. Offer   │ │ 8. Visual   │        │
│    creative  │ │  analysis  │ │  analysis  │ │  analysis   │        │
│    analysis  │ │            │ │            │ │             │        │
└───────┬──────┘ └─────┬──────┘ └──────┬─────┘ └───────┬─────┘        │
        │              │               │               │              │
        └──────────────┴───────┬───────┴───────────────┘              │
                               │                          ┌───────────▼──┐
                     ┌─────────▼──────────┐               │ 4. Pattern   │
                     │ 9. Recommendations │◀──────────────│   detection  │
                     └─────────┬──────────┘               └──────────────┘
                               │
                     ┌─────────▼──────────┐
                     │ 10. Batch          │
                     │     generation     │──────┐
                     └────────────────────┘      │
                                                 ▼
                                   ┌─────────────────────────────┐
                                   │ EXISTING CREATIVE GENERATOR │
                                   │ concepts → prompt → image   │
                                   │ → QA  (unchanged)           │
                                   └─────────────────────────────┘
```

**Layer 1 — Facts (1, 2).** No intelligence. Mirror Meta accurately and link ads back to the concepts that produced them. This is the part that must be right; everything above it inherits its errors.

**Layer 2 — Measurement (3, 4).** Arithmetic and statistics, no AI. Deterministic, cheap, testable. Runs on every creative every day.

**Layer 3 — Interpretation (5, 6, 7, 8).** AI analysis, expensive, gated by evidence and cached by content hash. Only ever runs on creatives that have cleared a threshold.

**Layer 4 — Action (9, 10).** Turns findings into concepts, then into images, through the pipeline that already exists.

---

## 3. Database schema

Nine new tables. Existing tables are untouched except for two additive columns noted in §3.10.

Naming follows the existing convention (`snake_case`, plural, `created_at`/`updated_at`, RLS on every table, ownership through `user_id` or a parent FK).

### 3.1 `meta_ad_entities` — the account mirror

One row per Meta object. A slowly-changing dimension: names and statuses change, history does not need preserving.

```sql
create table public.meta_ad_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  entity_type text not null check (entity_type in ('campaign','adset','ad')),
  meta_id text not null,                      -- Meta's own id
  parent_meta_id text,                        -- adset -> campaign, ad -> adset
  name text not null,
  status text,                                -- ACTIVE / PAUSED / ARCHIVED ...
  effective_status text,

  -- Ad-level creative identity, used for attribution (§4).
  creative_meta_id text,
  image_hash text,                            -- Meta's hash of the image it serves
  thumbnail_url text,
  perceptual_hash text,                       -- ours, see §4.2

  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, meta_id)
);

create index on public.meta_ad_entities (user_id, entity_type, status);
create index on public.meta_ad_entities (user_id, parent_meta_id);
create index on public.meta_ad_entities (perceptual_hash) where perceptual_hash is not null;
```

### 3.2 `creative_links` — attribution

The join between _their_ ad and _our_ concept. Deliberately its own table rather than a column on `meta_ad_entities`, because the relationship is many-to-many (one concept can be run as several ads; one ad can be a remix) and because how the link was made is worth recording.

```sql
create table public.creative_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  meta_entity_id uuid not null references public.meta_ad_entities (id) on delete cascade,
  concept_id uuid not null references public.ad_concepts (id) on delete cascade,
  generation_id uuid references public.creative_generations (id) on delete set null,

  match_method text not null check (
    match_method in ('naming_convention','perceptual_hash','manual','api_created')
  ),
  match_confidence numeric(4,3) not null,     -- 0..1
  confirmed_by_user boolean not null default false,

  created_at timestamptz not null default now(),
  unique (meta_entity_id, concept_id)
);

create index on public.creative_links (user_id, concept_id);
```

### 3.3 `ad_insights_daily` — the fact table

One row per ad per day. **This is the table that has to scale**; everything else is small by comparison. At a million active creatives it grows by a million rows a day.

```sql
create table public.ad_insights_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  meta_entity_id uuid not null references public.meta_ad_entities (id) on delete cascade,
  stat_date date not null,

  impressions bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric(8,4),
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  spend numeric(14,4) not null default 0,

  -- Conversion side. Empty today; the columns exist so the scoring model does
  -- not have to change the day a pixel starts reporting.
  purchases bigint not null default 0,
  revenue numeric(14,4) not null default 0,
  add_to_cart bigint not null default 0,
  initiate_checkout bigint not null default 0,
  leads bigint not null default 0,

  -- Video engagement, for creatives that are video.
  video_plays bigint not null default 0,
  video_p25 bigint not null default 0,
  video_p50 bigint not null default 0,
  video_p75 bigint not null default 0,
  video_p100 bigint not null default 0,

  -- Meta restates recent days for up to ~28 days as attribution settles.
  is_final boolean not null default false,
  synced_at timestamptz not null default now(),

  primary key (meta_entity_id, stat_date)
) partition by range (stat_date);
```

**Partitioned by month from the start.** Retrofitting partitioning onto a live 300M-row table is a migration nobody wants; declaring it now costs one extra line. A helper creates next month's partition ahead of time, and old partitions can be detached rather than deleted.

```sql
create index on public.ad_insights_daily (user_id, stat_date);
```

**Rates are never stored.** CTR, CPC, CPM and ROAS are derived at query time. Storing them invites the classic bug of averaging averages — the mean of daily CTRs is not the CTR of the period.

### 3.4 `creative_metrics` — the rollup

Scoring reads this, not the daily facts. Recomputed by a job rather than a view, because at scale a view over hundreds of millions of rows is not a thing you want on a dashboard render path.

```sql
create table public.creative_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid references public.ad_concepts (id) on delete cascade,
  meta_entity_id uuid references public.meta_ad_entities (id) on delete cascade,

  window_days int not null check (window_days in (7, 14, 30, 90, 0)),  -- 0 = lifetime

  impressions bigint not null default 0,
  clicks bigint not null default 0,
  link_clicks bigint not null default 0,
  spend numeric(14,4) not null default 0,
  purchases bigint not null default 0,
  revenue numeric(14,4) not null default 0,

  -- Derived, written by the scoring job (§6).
  ctr numeric(8,6),
  ctr_lower_bound numeric(8,6),               -- Wilson; what ranking actually uses
  cpc numeric(12,4),
  cpm numeric(12,4),
  roas numeric(10,4),
  roas_shrunk numeric(10,4),                  -- empirical Bayes toward account mean
  cpa numeric(12,4),

  composite_score numeric(6,3),               -- 0..100
  evidence_tier text not null check (
    evidence_tier in ('insufficient','directional','confident')
  ),
  percentile_rank numeric(5,4),               -- within this account and window

  computed_at timestamptz not null default now(),
  unique (concept_id, meta_entity_id, window_days)
);

create index on public.creative_metrics (user_id, window_days, composite_score desc);
```

### 3.5 `creative_features` — what a creative _is_

Extracted once per concept and cached. This is the vocabulary that pattern detection correlates against performance.

Most of it comes free: the concept generator already produces `structured_concept` with hook, scene, subject, lighting, camera style, emotional driver. Re-deriving that with AI would be paying twice for something already written down. Only the visual attributes that exist solely in the rendered pixels need a vision call.

```sql
create table public.creative_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept_id uuid not null references public.ad_concepts (id) on delete cascade,

  -- Categorical, closed vocabularies. Free text cannot be grouped, and
  -- grouping is the entire point of this table.
  hook_type text,                -- scarcity | social_proof | founder_story | ...
  hook_text text,
  offer_type text,               -- discount | free_shipping | bundle | none | ...
  offer_strength text,           -- none | soft | strong
  promotional_message_id uuid references public.approved_promotional_messages (id),

  emotional_driver text,
  visual_style text,             -- documentary | studio | ugc | flat_lay | ...
  composition text,              -- close_up | wide | overhead | ...
  has_person boolean,
  shows_founder boolean,
  shows_product boolean,
  text_on_image boolean,
  dominant_colors text[],
  brightness text,               -- dark | mid | bright

  -- Provenance: which extraction produced this, so a prompt change can
  -- invalidate exactly the rows it affects.
  source text not null check (source in ('structured_concept','vision_model','manual')),
  extraction_run_id uuid references public.analysis_runs (id),
  content_hash text not null,    -- of the inputs; skip re-extraction when unchanged

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (concept_id)
);

create index on public.creative_features (user_id, hook_type);
create index on public.creative_features (user_id, offer_type);
create index on public.creative_features (user_id, visual_style);
```

### 3.6 `pattern_observations` — what correlates

Module 4 writes here. One row per hypothesis, carrying its own evidence so nothing downstream can quote it without also seeing how thin it is.

```sql
create table public.pattern_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  dimension text not null,       -- hook_type | offer_type | visual_style | ...
  segment_value text not null,   -- scarcity | discount | documentary | ...
  window_days int not null,

  creatives_in_segment int not null,
  impressions bigint not null,
  clicks bigint not null,
  conversions bigint not null,
  spend numeric(14,4) not null,

  segment_metric numeric(10,6) not null,      -- the segment's shrunk rate
  baseline_metric numeric(10,6) not null,     -- all other creatives
  lift numeric(8,4) not null,                 -- segment / baseline - 1
  metric_name text not null,                  -- ctr_lower_bound | roas_shrunk | ...

  -- Honest statistics, stored rather than implied.
  p_value numeric(10,8),
  confidence_interval_low numeric(10,6),
  confidence_interval_high numeric(10,6),
  evidence_tier text not null check (
    evidence_tier in ('insufficient','directional','confident')
  ),

  computed_at timestamptz not null default now(),
  unique (user_id, dimension, segment_value, window_days, metric_name)
);
```

### 3.7 `analysis_runs` — AI provenance

Every AI call in this system writes one row. Without it there is no way to answer "why did it say that last Tuesday", no way to cost the feature, and no way to invalidate results after a prompt change.

```sql
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  analysis_type text not null check (analysis_type in (
    'winning_creative','hook','offer','visual','recommendation','feature_extraction'
  )),
  subject_type text not null,    -- concept | segment | account
  subject_id uuid,

  model text not null,
  prompt_version text not null,  -- bump to invalidate cached results
  input_hash text not null,      -- identical inputs are never paid for twice

  status text not null check (status in ('running','succeeded','failed')),
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  duration_ms int,
  error text,

  result jsonb,

  created_at timestamptz not null default now()
);

create unique index on public.analysis_runs (user_id, analysis_type, prompt_version, input_hash)
  where status = 'succeeded';
```

### 3.8 `recommendations` — the daily proposals

```sql
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  recommendation_date date not null,
  rank int not null,

  kind text not null check (kind in (
    'scale_winner','iterate_on_winner','retire_loser','test_hypothesis','fix_gap'
  )),
  title text not null,
  rationale text not null,

  -- What it is about, and what it is based on.
  concept_id uuid references public.ad_concepts (id) on delete set null,
  pattern_ids uuid[] not null default '{}',
  evidence_tier text not null,
  expected_effect text,                       -- deliberately qualitative

  -- The generation brief, if this recommendation is actionable.
  suggested_brief text,
  suggested_hook_type text,
  suggested_offer_type text,
  suggested_visual_style text,

  status text not null default 'proposed' check (
    status in ('proposed','accepted','dismissed','generated')
  ),
  analysis_run_id uuid references public.analysis_runs (id),

  created_at timestamptz not null default now(),
  unique (user_id, recommendation_date, rank)
);
```

### 3.9 `batch_runs` and `batch_items` — daily generation

```sql
create table public.batch_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  run_date date not null,
  trigger text not null check (trigger in ('scheduled','manual')),
  status text not null check (status in ('queued','running','completed','failed','cancelled')),

  requested_count int not null,
  succeeded_count int not null default 0,
  failed_count int not null default 0,
  budget_usd numeric(10,4),                   -- hard ceiling; see §7.3
  spent_usd numeric(10,4) not null default 0,

  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, run_date, trigger)
);

create table public.batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid not null references public.batch_runs (id) on delete cascade,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  concept_id uuid references public.ad_concepts (id) on delete set null,
  generation_id uuid references public.creative_generations (id) on delete set null,

  status text not null check (status in ('queued','generating','qa','done','failed','skipped')),
  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3.10 Changes to existing tables

Two additive columns. Nothing is altered or dropped.

```sql
alter table public.ad_concepts
  add column if not exists origin text not null default 'manual'
    check (origin in ('manual','recommendation','batch')),
  add column if not exists source_recommendation_id uuid
    references public.recommendations (id) on delete set null;

alter table public.creative_generations
  add column if not exists perceptual_hash text;
```

`perceptual_hash` is computed at upload time in the existing `uploadConceptImage` path. It is what makes automatic attribution possible later, and it costs nothing to record now.

---

## 4. Attribution — the hard part

Everything above assumes we know which Meta ad came from which of our concepts. That link does not exist yet and is the single most likely place for this system to quietly produce garbage.

**Why it is hard here:** we cannot create ads. `ads_management` is still pending Meta App Review, so the user exports an image and uploads it in Ads Manager by hand. Nothing carries our concept id across that gap.

Three mechanisms, in the order they are tried:

### 4.1 Naming convention — cheap and exact

The user names the ad with a short prefix the app shows them on the concept card, e.g. `CS-a1b2c3 — Final stock cuffs`. Ingestion parses `CS-<first 6 of concept uuid>`.

Confidence `1.0` when it resolves to exactly one concept. Costs nothing, exact when followed, and it will sometimes not be followed.

### 4.2 Perceptual hash — automatic and fuzzy

At generation we store a perceptual hash (dHash, 64-bit) of the PNG. Meta serves a re-encoded, re-sized copy, so an exact checksum will never match — this is why `image_hash` from Meta alone is not enough. We fetch the ad's thumbnail, hash it the same way, and compare Hamming distance.

- distance ≤ 6 → confidence ~0.9, proposed automatically
- distance 7–12 → surfaced for one-click confirmation
- distance > 12 → not a match

Fuzzy by nature. It proposes; it does not decide. That is why `creative_links.confirmed_by_user` exists.

### 4.3 Manual — the fallback that must exist

A screen listing unlinked Meta ads beside candidate concepts, thumbnails side by side, one click to link. Unglamorous and the only thing that is always correct.

### 4.4 When `ads_management` arrives

The whole problem disappears. Ads we create carry `match_method = 'api_created'` and confidence `1.0`, and the other three paths remain only for ads created before that, or by hand.

**Unattributed ads are still ingested.** They count toward account baselines even when we cannot say which concept produced them. What they must never do is enter per-creative scoring — a wrong link is worse than a missing one, because it teaches the system a false lesson with full confidence.

---

## 5. Data flow

### 5.1 Daily, automatic

```
03:00 UTC  ingest:entities     Meta → meta_ad_entities         (~1 min)
03:10 UTC  ingest:insights     Meta → ad_insights_daily        (incremental, 28-day restatement window)
03:30 UTC  attribute           unlinked ads → creative_links   (auto + queue for confirmation)
03:40 UTC  rollup              ad_insights_daily → creative_metrics
03:50 UTC  score               creative_metrics: shrunk rates, composite, evidence tier
04:00 UTC  extract_features    new concepts → creative_features (structured_concept; vision only if needed)
04:10 UTC  detect_patterns     creative_features × creative_metrics → pattern_observations
04:30 UTC  analyse             AI: winners, hooks, offers, visuals   [gated on evidence tier]
05:00 UTC  recommend           AI: synthesise → recommendations
05:30 UTC  batch_generate      recommendations → existing generator  [opt-in, budget-capped]
```

Each step is independently re-runnable and idempotent. A failure at 04:10 does not lose the ingestion at 03:10, and re-running any step produces the same result.

### 5.2 The restatement window

Meta revises the last ~28 days as attribution settles. Ingestion therefore re-fetches a rolling 28-day window every night, not just yesterday, and upserts on `(meta_entity_id, stat_date)`. Rows older than 28 days are marked `is_final` and never fetched again.

This is the difference between a fact table that converges on the truth and one that is permanently a few percent wrong in a way nobody notices.

### 5.3 Scale

| Concern        | Approach                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Insight volume | Monthly partitions on `ad_insights_daily`; detach old partitions rather than delete            |
| Query cost     | Dashboards read `creative_metrics`, never the daily facts                                      |
| API limits     | Cursor pagination, batch requests, per-account rate budget, exponential backoff on code 17/613 |
| AI cost        | `analysis_runs.input_hash` uniqueness — identical inputs are never paid for twice              |
| Vision cost    | Only for creatives at `confident` tier; the rest use `structured_concept`, which is free       |
| Job duration   | Every job chunks and checkpoints; none assumes it can finish in one invocation                 |

---

## 6. Scoring logic

Deterministic arithmetic, no AI. This module is pure domain code and should be the most heavily tested part of the system.

### 6.1 Metric hierarchy

Optimise the most meaningful metric the data actually supports, and say which one was used:

1. **ROAS** — `revenue / spend`. Used when the window has ≥ 25 purchases.
2. **CPA** — `spend / purchases`. Used at ≥ 10 purchases.
3. **CTR lower bound** — used otherwise, _and flagged as a proxy_.

Today every account falls to tier 3. The UI has to say so, in those words, rather than presenting a CTR ranking as if it were a revenue ranking.

### 6.2 Wilson lower bound — why ranking is not on raw CTR

Raw CTR ranks a creative with 1 click from 5 impressions (20%) above one with 700 clicks from 10,000 (7%). The Wilson score lower bound fixes this by asking what rate the data can actually support:

```
p̂     = clicks / n
z     = 1.96                       (95%)
denom = 1 + z²/n
centre= p̂ + z²/(2n)
margin= z · √( p̂(1-p̂)/n + z²/(4n²) )
lower = (centre − margin) / denom
```

Worked, at this account's real numbers — a creative with 500 impressions and 38 clicks:

- raw CTR **7.60%**
- Wilson lower bound **5.58%**

The 2-point discount _is_ the uncertainty, made explicit. At 50,000 impressions the same 7.6% barely moves. Small samples sink on their own, with no arbitrary minimum-impression rule to tune.

### 6.3 Shrinkage for revenue

ROAS on small spend is even noisier than CTR — one purchase swings it wildly. Empirical Bayes toward the account mean:

```
roas_shrunk = (revenue + k · μ_account · spend) / (spend + k · spend)
```

`k` is a prior weight (start at 1.0, i.e. equal weight to prior and observation at equal spend). A creative with $3 spend and one $80 order does not get to claim 26× ROAS.

### 6.4 Composite score

`0..100`, computed only over dimensions that have data, with the weights renormalised over whatever is present:

| Component                               | Weight | Notes                                |
| --------------------------------------- | ------ | ------------------------------------ |
| Efficiency (ROAS or CPA, shrunk)        | 45     | dropped entirely when no conversions |
| Engagement (CTR lower bound)            | 30     |                                      |
| Cost (CPM vs account median)            | 10     |                                      |
| Volume delivered (log impressions)      | 10     | rewards proven reach, not raw spend  |
| Recency (exponential, 14-day half-life) | 5      |                                      |

With no conversion data the efficiency term is absent and the rest renormalise to 100 — the score stays comparable, and `evidence_tier` records that it is a weaker judgement.

### 6.5 Evidence tiers

The gate the whole system leans on:

| Tier           | Condition                                                          | What it may be used for                                   |
| -------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| `insufficient` | < 1,000 impressions **and** < 30 clicks                            | Display only. Never ranked, never analysed, never quoted. |
| `directional`  | ≥ 1,000 impressions **or** ≥ 30 clicks                             | Hypotheses to test. Always phrased as such.               |
| `confident`    | ≥ 10,000 impressions **and** ≥ 200 clicks, **or** ≥ 25 conversions | Recommendations, AI analysis, batch generation.           |

**At $66.75 a month the whole account produces one `directional` bucket at best.** Stated plainly so nobody is surprised when the first weeks of this feature mostly say "collecting". That is the system working, not failing.

### 6.6 Pattern detection (module 4)

For each dimension in `creative_features`, group creatives, compare each segment against the pooled rest:

- two-proportion z-test for rate metrics; Welch's t-test for continuous ones
- **Benjamini–Hochberg correction** across all segments tested that day — testing 40 segments at p < 0.05 yields two false positives by construction, and a system that reports those as insights is worse than no system
- minimum 3 creatives and 1,000 impressions per segment before a segment is tested at all
- both the effect size and the interval are stored, because "hooks with scarcity get +40% CTR (95% CI: −5% to +85%)" is an honest sentence and "+40%" alone is not

---

## 7. Background jobs

### 7.1 Runner

No job runner exists in this repo today. Given Next.js on Vercel, the natural fit is **Vercel Cron → authenticated route handlers under `src/app/api/jobs/*`**, with a `job_runs` ledger for idempotency and observability.

Route handlers rather than Server Actions, for the same reason `/api/generation-progress` is a route handler: this needs its own HTTP contract, and Server Actions are serialised per client.

Each handler:

- authenticates a shared secret header (`CRON_SECRET`), never a user session
- claims the job row via conditional update, so two overlapping invocations cannot both run
- processes in bounded chunks and checkpoints progress
- is safe to invoke twice

### 7.2 The 60-second problem, again

Vercel Hobby caps functions at 60 seconds regardless of `maxDuration` — the constraint already hit when image generation took 102 seconds. Ingesting a month of daily insights for a large account will not fit either.

So **no job may assume it can finish in one invocation.** Each processes a chunk, writes a cursor, and returns; the cron fires again minutes later and resumes. Slower, but it works on Hobby and it works at a million creatives, which the single-shot version does at neither.

### 7.3 Cost control

Batch generation spends real money without a human present. Three hard limits, enforced in code and not merely configured:

1. `batch_runs.budget_usd` — a per-run ceiling; the run stops when it would be exceeded
2. a daily creative cap (default 3)
3. opt-in per user, default **off**

And the pipeline's existing QA stays in force: an automatically generated creative that fails QA is never presented as ready. The loop cannot lower its own standards.

---

## 8. APIs

Internal, all under the existing auth. Server Actions for anything a user triggers; route handlers only where an external contract is genuinely needed.

**Cron-triggered route handlers** (secret header, no user session):

```
POST /api/jobs/ingest-entities
POST /api/jobs/ingest-insights
POST /api/jobs/attribute
POST /api/jobs/rollup
POST /api/jobs/score
POST /api/jobs/extract-features
POST /api/jobs/detect-patterns
POST /api/jobs/analyse
POST /api/jobs/recommend
POST /api/jobs/batch-generate
```

**Server Actions** (`application/` layer, per existing convention):

```
syncMetaDataAction()                   manual "sync now"
confirmCreativeLinkAction(id)          confirm a proposed attribution
rejectCreativeLinkAction(id)           reject one
linkCreativeManuallyAction(adId, conceptId)
acceptRecommendationAction(id)         → creates a concept via the existing generator
dismissRecommendationAction(id, reason)
runBatchNowAction()                    manual batch, same budget ceiling
setBatchSettingsAction(settings)
```

**Read paths** are plain server-component queries against `creative_metrics`, `pattern_observations` and `recommendations` — no API layer, matching how every existing page reads data.

---

## 9. AI prompts

Four analysis prompts and one synthesis prompt. All use `messages.parse` with `zodOutputFormat`, as the existing concept generator and QA client already do, and all write an `analysis_runs` row.

### 9.1 The rule every prompt carries

Each prompt receives the evidence tier and impression counts for everything it is shown, and is instructed:

> Every claim must be supported by the numbers provided. Where evidence is `directional`, phrase findings as hypotheses to test, never as conclusions. If the data does not support a finding, say so and return an empty list. Do not infer a pattern from fewer than three creatives. You will be judged on whether your claims survive more data, not on how many you make.

Guardrails in a prompt are not a substitute for the arithmetic gate in §6.5 — they are the second line behind it. The system does not send `insufficient`-tier data to a model at all.

### 9.2 Winning creative analysis (module 5)

- **In:** the top N creatives at `confident` tier, with their metrics, their `structured_concept`, their image, and the account baseline.
- **Out:** `{ whatWorked[], whyItLikelyWorked[], repeatableElements[], oneOffFactors[], confidence }`
- **Note:** it is explicitly asked to separate what is repeatable from what was luck or timing. The distinction is the whole value; without it the system recommends re-running a creative that happened to catch a good week.

### 9.3 Hook analysis (module 6)

- **In:** hooks grouped by `hook_type`, each with shrunk CTR, lift, CI and creative count.
- **Out:** `{ hookPerformance[], recommendedHookTypes[], hooksToAvoid[], untestedHookTypes[] }`
- **Note:** `untestedHookTypes` matters as much as the winners. The most valuable thing a system with thin data can say is which question has not been asked yet.

### 9.4 Offer analysis (module 7)

- **In:** performance grouped by `offer_type` and `offer_strength`, joined to the approved promotional messages.
- **Out:** `{ offerPerformance[], strongestOffers[], offerFatigueSignals[], recommendedOffers[] }`
- **Constraint:** it may only ever recommend messages from `approved_promotional_messages`. The existing hard rule — generation never invents promotional copy — is not relaxed because a model suggested something. Its output is validated against the approved list before it is stored, by the same `matchApprovedMessage` used today.

### 9.5 Visual analysis (module 8)

- **In:** the actual images of top and bottom performers (vision), with their metrics.
- **Out:** `{ visualPatterns[], compositionFindings[], colorFindings[], subjectFindings[], recommendations[] }`
- **Note:** the only module that needs vision on the rendered image, so the only expensive one. Gated to `confident` tier and cached on `input_hash`.

### 9.6 Recommendation synthesis (module 9)

- **In:** the four analyses, the current brand context (via the existing `buildBrandContext`), the approved messages, and what was recommended in the last 14 days.
- **Out:** ranked `recommendations[]`, each with `kind`, rationale, evidence tier, and a generation brief.
- **Constraints:** must not repeat a recommendation dismissed in the last 14 days; must respect brand rules; must include at least one `test_hypothesis` when overall evidence is thin, because at low volume the right move is usually to learn faster, not to double down on a maybe.

---

## 10. How this connects to the existing Creative Generator

The loop only matters if it closes. Four connection points, all additive — no existing module changes shape.

### 10.1 Brand Profile stays the single source of truth

Creative Intelligence never writes to `brand_profiles`. Performance findings are _evidence_, not brand identity, and the rule that every AI module reads its brand facts from one place is what stopped three prompts drifting apart before.

Learned guidance travels as its own context, alongside brand context, clearly labelled as such.

### 10.2 A new prompt section

`domain/image-prompt.ts` already assembles the image prompt as labelled sections, and the Prompt Builder already shows them marked "You edit this" / "Auto-added". Performance guidance becomes one more section:

```ts
export type PromptSectionKey =
  | "brief"
  | "references"
  | "brand_context"
  | "founder"
  | "image_rules"
  | "performance" // ← new
  | "scene"
  | "message"
  | "language";
```

It appears **only** when evidence is `confident`, and it says where it came from — "Creatives with a visible founder have outperformed the account baseline by 34% over 12 creatives (95% CI: 8–61%)". The user sees it in the Prompt Builder like every other auto-added block, which means the moment the system starts learning something wrong, it is visible rather than buried.

### 10.3 Concept generation gains an optional input

`generateConcepts()` takes an optional `performanceGuidance` argument. Absent, it behaves exactly as today. Present, it is included in the prompt as a distinct section with its evidence tier attached.

The existing hard rules are untouched: three concepts, structured output, and a promotional message drawn only from the approved list.

### 10.4 Batch generation reuses the pipeline verbatim

Module 10 calls the existing path — `insertConcepts` → `generateCreativeImageAction` → QA — with no fork. A batch creative and a hand-made one are the same object, run through the same QA, subject to the same hard failures. The only difference is `ad_concepts.origin`.

That reuse is deliberate. A parallel "automatic" pipeline would drift from the reviewed one within weeks, and the automatic path is exactly the one that most needs the QA gate.

### 10.5 Navigation

Following the rule already established — only production-ready pages appear:

```
Workflow                      (unchanged)
Intelligence          ← new group, appears when the first module ships
  Creative Performance
  Patterns
  Recommendations
  Batch Generation
Insights                      (unchanged)
```

---

## 11. Build order

Each phase is independently useful and independently reviewable. Nothing later is required for anything earlier to pay off.

| Phase | Modules | Delivers                                            | Depends on         |
| ----- | ------- | --------------------------------------------------- | ------------------ |
| **1** | 1, 2    | Per-ad daily data flowing in and attributed         | —                  |
| **2** | 3       | Scored, ranked creatives with honest evidence tiers | 1                  |
| **3** | 5       | "Here is why your best creative worked"             | 2                  |
| **4** | 4, 6, 7 | Pattern, hook and offer analysis                    | 2, and enough data |
| **5** | 8       | Visual analysis                                     | 4                  |
| **6** | 9       | Daily recommendations                               | 3, 4, 5            |
| **7** | 10      | Daily batch generation                              | 6                  |

**Phase 1 is the one to build now, and it is worth building even if nothing else follows.** It is the only phase whose value grows while you wait: every day it runs, the evidence base gets deeper. Phases 4 onward are gated on data volume rather than engineering effort — building them before there is anything to detect produces a convincing-looking system with nothing behind it.

**My recommendation on sequencing:** build Phase 1 and 2, then stop and look at real numbers before committing to Phase 4+. If spend stays near $2/day, the honest move is to keep collecting and revisit the inference modules when there is something to infer from. That is a product decision, not a technical one, and it is yours.

---

## 12. Open questions

Answers needed before Phase 1 begins:

1. **Conversion tracking.** Is a Meta Pixel or CAPI configured on the store? Without it, `purchases` and `revenue` stay zero permanently and this system can only ever optimise CTR — a real ceiling on what it can be worth.
2. **Ad volume.** How many distinct ads are running in the account today? It decides whether per-creative attribution has anything to attribute.
3. **Naming.** Willing to prefix ad names with the concept code shown on the card? It makes attribution exact and costs one copy-paste.
4. **Spend trajectory.** Is $2/day the plan, or a starting point? It changes which phases are worth building this quarter.
5. **Batch generation.** Should it ever run without review, or always stage creatives for approval? My recommendation is staged-for-approval, at least until the recommendation quality has been observed for a month.
