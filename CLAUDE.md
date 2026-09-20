# CLAUDE.md

Guidance for Claude Code when working in `real-bite-server`. Product/architecture specs live in `../../docs/` (see the root `CLAUDE.md`); the backend spec is **`docs/11-backend-mvp1.md`** (tables, API, auth, jobs, infra) with the module map in `docs/02-architecture.md` §4.

## Status

Foundation only. There are **no feature modules or tables yet**: features are added one step at a time, in the order the user asks for. Don't build ahead.

**Don't write tests** (specs, fakes, e2e) unless the user explicitly asks; testing is deferred by decision (`docs/02` §4.6). The single health e2e that exists stays.

## Commands

```bash
npm run db:up          # local Postgres 16 + PostGIS (docker compose, port 5432, localhost only)
npm run db:down
npm run start:dev      # watch mode, http://localhost:3000/v1
npm run build          # nest build -> dist/main.js
npm run lint           # oxlint --type-aware
npm run test           # vitest unit (none yet; passes with no tests)
npm run test:e2e       # vitest e2e (only test/health.e2e-spec.ts)
npm run db:generate    # drizzle-kit: SQL migration from src/common/db/schema -> drizzle/
npm run db:migrate
npm run db:studio
```

Setup: `cp .env.example .env`, then `npm run db:up`. npm is the package manager.

## Stack notes that aren't obvious

- **Nest 12, ESM** (`"type": "module"`, `nodenext`): relative imports **must end in `.js`** (`import { X } from './x.js'`), even for `.ts` files.
- **Vitest, not Jest; oxlint, not ESLint.** Vitest doesn't emit decorator metadata, so constructor injection uses explicit `@Inject(TOKEN)` (see `health.controller.ts`). Follow that for every injected dependency.
- **Env is validated by zod at boot** (`src/common/config/env.schema.ts`). Add new variables there and to `.env.example`; a bad env must fail startup, never fall back silently. Read config through `ConfigService<Env, true>`.
- **DB access** goes through the injected `DB` token (Drizzle over a `pg` Pool, `src/common/db`). Schema files live in `src/common/db/schema/` and are re-exported from its `index.ts`.
- **URI versioning** (`enableVersioning`, default `1`) gives `/v1/...`; `main.ts` also sets Helmet, CORS from `CORS_ORIGINS`, and a 1 MB body limit (uploads bypass the API: presigned POST straight to S3).
- **`pg` Pool needs an `'error'` listener** (`db.module.ts`). Without one, restarting Postgres crashes the whole API process. Keep it.
- The API binds `0.0.0.0` on purpose (Docker network; the port is never published in prod).
- Node's npm cache in `~/.npm` had root-owned files on the dev machine; if `npm install` hits `EACCES`, use `--cache <tmpdir>` rather than `sudo`.

## Layout

Only real code exists so far:

```
src/
  main.ts, app.module.ts
  common/config/   zod env schema
  common/logging/  nestjs-pino: LoggingModule, pino-options.ts (redaction, request id, dev pretty), index.ts seam
  common/db/       DbModule (pg Pool + Drizzle; exports `DB` only), db.types.ts, drizzle-query-logger.ts, schema/
  health/          GET /v1/health/live (process) and /v1/health[/ready] (503 when DB down), via terminus
test/              health e2e only (testing is deferred)
drizzle/           generated SQL migrations (commit them, review in PRs)
```

Feature modules get created as they're built, following `docs/02` §4: `auth/`, `users/`, `catalog/`, `search/`, `media/`, `photos/`, `safety/`, `verification/`, `scans/`, `credits/`, `admin/`, plus `common/` (errors, idempotency, logging). `ai/`, `discovery/`, `entitlements/` are later phases.

## Code conventions (NestJS best practices)

Full text in `../../docs/02-architecture.md` §4.1–4.7; these follow the `nestjs-best-practices` skill in `.claude/skills/`. Consult that skill's `rules/` when writing modules, then check §4.7 for where we deliberately differ (Zod not class-validator, `jobs` table not BullMQ, no Passport).

- **Feature folders**, never technical layers: `<feature>.module/controller/service/repository.ts`, `dto/`.
- **One-way module graph** (layers 0–4 in §4.1). No `forwardRef`. A module is provided in exactly one place; only `@Global()` for layer-0 infrastructure. `admin` orchestrates cross-module transactions and nothing imports it.
- **controller → service → repository.** Only repositories import Drizzle tables, and they select explicit column lists (this is what keeps `capture_location`, `gold_answer` and uploader identity out of responses). Drizzle schema stays centralized in `src/common/db/schema/`, one file per area.
- **Transactions:** the orchestrating service opens one via `TransactionRunner` and passes `tx` down; repositories accept an optional executor. No ambient transaction.
- **Ports** (`PasswordHasher`, `MailSender`, `ObjectStorage`, `SafetyScanner`, `ScanParser`, …): small interface + `Symbol` token + `@Inject`.
- **Everything is a singleton.** No request-scoped providers, no `ModuleRef.get()`.
- **Errors:** services throw `DomainException` subclasses with a stable `code`; one global filter builds `{ error: { code, message, details? } }`. Jobs and cron catch their own errors.
- **Requests:** URI versioning (`enableVersioning`), strict Zod schemas on every body/query/param, global default-deny `AuthGuard` with `@Public()`, `@Roles()`, `@CurrentUser()`. Responses come from explicit mappers, never raw rows.
- **Tests:** none for now; see the note under Status.
- **Logging is `nestjs-pino`** (`docs/11` §7.4): inject `PinoLogger` (`@Inject(PinoLogger)`), `setContext(Foo.name)` once, log `logger.warn({ err, ...fields }, 'message')`. Import it from `common/logging`, the single seam. Never `console.*` (lint error) or `new Logger()`. Redaction is by configured path (`pino-options.ts`), and query strings are kept out of request lines, so don't log request bodies, OCR text, locations or full emails. `PinoLogger` is transient-scoped (the one allowed exception to singletons). Avoid `@InjectPinoLogger`: it only registers classes evaluated before `LoggingModule`, which breaks under ESM import order.
- No N+1: one query per list. Free-text fields get `max()` lengths.

### Not built yet (by design)

No global exception filter, validation pipe, auth guard, `TransactionRunner` or `userId` on log lines yet; each arrives with its first consumer. The readiness probe doesn't check the migration version until migrations exist.

## Rules from the docs that constrain code

Settled; don't design around them without asking.

- **Our own auth** (`docs/11` §2): Google ID token verified server-side + email/password (Argon2id via `@node-rs/argon2` behind a `PasswordHasher` interface), JWT access (HS256, 15 min) + rotating opaque refresh tokens. **Every authenticated request re-checks** session revocation, `token_version`, `users.status` and `users.role` in one query; never trust a role from the token. No Cognito, no Supabase.
- **Drizzle, SQL-first migrations**, reviewed in PRs. Postgres 16 with `postgis`, `pg_trgm`, `citext`, `pgcrypto`; UUID v7 keys generated in the app. The first migration owns `CREATE EXTENSION`.
- **Brand consistency is enforced by composite foreign keys** (`docs/11` §3.2), not application code.
- **Bites ledger is append-only** (`credit_ledger`, trigger blocks UPDATE/DELETE); every write carries an `idempotency_key`; reversals are negative rows; balances come from the `credit_balances` view.
- **Community verification is shadow mode in v1:** votes are recorded, the admin's approve/reject decides, all in one transaction (photo status, task, vote `matched_outcome`, ledger rows, audit log).
- **Evidence labels are computed at read time**, never stored. `capture_location`, uploader identity, `gold_answer` and other users' ledgers are never returned.
- **Screenshots never leave the device:** `POST /v1/scans` receives redacted text lines only; store matched IDs, never raw text. v1 has **no AI** (deterministic `CatalogScanParser`). Any later AI goes through the provider-agnostic gateway; never import a vendor AI SDK in feature code.
- **Generic catalog:** the menu belongs to the brand; never key code to specific brands/outlets (the v1 chains are seed data).
- **Uploads are untrusted:** presigned POST with `content-length-range`, then `HeadObject` + `sharp` decode + sha256 before a photo exists (`docs/11` §4.2).
- **Background work** runs in-process off a `jobs` table with leases, backoff and `dedupe_key` (`docs/11` §6); no SQS yet.
- **API conventions:** JSON camelCase, cursor pagination `{ items, nextCursor }`, `Idempotency-Key` on money-writing POSTs, errors `{ error: { code, message, details? } }`, `429` with `Retry-After`. Request/response shapes will be Zod schemas in a shared package so the app imports the same types.
- Photo sourcing: no scraping; Google Places store `place_id` only; YouTube embed only; never republish brand ad images or menu copy (`docs/03`).
