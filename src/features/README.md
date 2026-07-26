# Features

Each domain feature (e.g. `competitor-analysis`, `ad-generation`) gets its own folder here, structured as:

    src/features/<feature>/
      domain/          # entities, value objects, pure business rules — no framework/IO deps
      application/     # use cases / orchestration — calls domain + infrastructure, framework-agnostic
      infrastructure/  # Supabase queries, external API clients, adapters implementing domain interfaces
      ui/              # feature-specific React components, composed from src/components/ui and src/components

`src/app/**` route files stay thin: they import from a feature's `application` or `ui` layer and do not
contain business logic directly. Server Actions colocated under a feature's `application/` layer are the
default mutation pattern (see `ARCHITECTURE.md`); `src/app/api/**` route handlers are reserved for cases
needing an external HTTP contract (webhooks, non-Next consumers).

No feature folders exist yet — this file documents the convention for the first one.
