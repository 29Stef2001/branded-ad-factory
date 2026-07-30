# Scheduled jobs

## What runs, and when

| Job                        | Schedule        | Endpoint                         |
| -------------------------- | --------------- | -------------------------------- |
| Creative Intelligence sync | 04:00 UTC daily | `GET /api/jobs/sync-performance` |

One pass does ingest → attribute → score, for every account with a Meta
connection. 04:00 UTC is chosen so Meta has finished settling the previous day
before it is fetched.

## Configuration

Two variables, both set on the Vercel project as well as locally:

| Variable                    | Purpose                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CRON_SECRET`               | Vercel attaches this as `Authorization: Bearer …` on every cron invocation. The handler refuses to run without it — unset means unavailable, never open.                                     |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron has no user session, and RLS scopes every query to the caller, so a scheduled sync using the normal client would see nothing. **Bypasses RLS** — used only under `src/app/api/jobs/**`. |

Generate the secret with:

    openssl rand -hex 32

The service-role key is in the Supabase dashboard under Project Settings → API.

## Why the job is built the way it is

**Resumable.** Vercel Hobby stops a function at 60 seconds regardless of
`maxDuration` — a limit image generation has already hit. Each pass works for
40 seconds, writes a cursor, and returns `partial`; the next invocation picks up
where it stopped. That is also what makes it work at a thousand ads rather than
five.

**Idempotent.** Facts upsert on `(meta_entity_id, stat_date)`, so re-running a
window corrects rows instead of duplicating them. Running the same sync twice is
a no-op.

**Single-flight.** A partial unique index on `job_runs (user_id, job_name) where
status = 'running'` means two overlapping invocations cannot both ingest the
same window. The second one is told a sync is already running and stops.

**Per-account isolation.** One account's broken Meta token is reported in the
response body, not raised — otherwise the scheduler would treat the whole run as
failed and retry every account.

## Checking on it

The Creative Performance page shows the last run and its status. Deeper history
is in `job_runs`, one row per invocation with its cursor, processed count and
error.

To trigger it by hand:

    curl -i -H "Authorization: Bearer $CRON_SECRET" \
      https://<deployment>/api/jobs/sync-performance

The "Sync now" button in the UI runs the same code path through a Server Action,
under the signed-in user's own session rather than service role.
