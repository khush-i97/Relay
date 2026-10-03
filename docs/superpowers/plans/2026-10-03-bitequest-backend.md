# BiteQuest Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete contract-v1.0 BiteQuest backend with local Supabase, atomic rewards, deterministic/provider-assisted adventures, tests, and setup documentation.

**Architecture:** Next.js route handlers validate and authenticate requests, while PostgreSQL functions own all atomic monetary mutations and idempotent responses. Pure TypeScript modules own calculation and provider validation; every external provider is bounded behind an adapter and falls back to deterministic planning.

**Tech Stack:** Next.js, TypeScript, Zod, Supabase/Postgres, Vitest, official optional provider SDKs or small `fetch` adapters.

**Spec:** `docs/superpowers/specs/2026-10-03-bitequest-backend-design.md`

## Global Constraints

- Contract v1.0 uses camelCase JSON, integer cents/XP, ISO UTC timestamps, opaque IDs, nullable unknowns, and `[longitude, latitude]` route coordinates.
- `wallet_transactions` is the credit source of truth; no process-memory financial state.
- Visits and redemptions commit domain rows, ledger, XP, idempotency, and response in one SQL transaction.
- Demo sessions use hashed random tokens in Postgres and HttpOnly SameSite=Lax cookies.
- Provider calls never occur while a database lock is held and never mutate financial state.
- Planning finishes within 45 seconds, uses at most three stops, and always validates provider output.
- Local Supabase through Docker is the default integration-test environment.
- Build only backend functionality; no product UI.

## Review Focus

- Concurrent first visits to the same restaurant produce one award and one discovery.
- Exact replay occurs before freshness/day/balance checks and returns the stored response.
- DST transitions use the `America/Los_Angeles` earning date without duplicate or skipped eligibility.
- Concurrent redemptions cannot make the ledger balance negative.
- Malformed or hallucinated provider output terminates as a validated fallback, never an invalid plan.

---

### Task 1: Scaffold and Freeze the Shared Contract

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `next-env.d.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/api/health/route.ts`
- Create: `shared/contracts.ts`, `shared/fixtures.json`
- Create: `tests/unit/contracts.test.ts`, `tests/unit/fixtures.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: all v1 request/response/domain types, `ApiErrorCode`, `API_ERROR_STATUS`, `SF_DEMO_CENTER`, and stable restaurant fixtures used by later tasks.

- [ ] **Step 1: Write failing contract and fixture tests**

Assert level math fields/types, direct success objects, all eight endpoint-related request/response types, 15-20 unique synthetic fixtures, stable demo IDs, authored rarity XP, 50-cent rewards, valid coordinates, and explicit `isSynthetic: true`.

- [ ] **Step 2: Run unit tests and verify RED**

Run: `npm test -- tests/unit/contracts.test.ts tests/unit/fixtures.test.ts`

Expected: FAIL because the contract and fixtures do not exist.

- [ ] **Step 3: Scaffold the minimum Next.js server and implement contracts/fixtures**

Use strict TypeScript. Pin compatible dependencies. The root page identifies the backend without adding product UI; `/api/health` returns `{ status: "ok" }`.

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `npm test -- tests/unit/contracts.test.ts tests/unit/fixtures.test.ts && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: scaffold BiteQuest backend contract`

### Task 2: Add Pure Domain Rules and Validation

**Files:**
- Create: `lib/server/domain/summary.ts`, `lib/server/domain/geo.ts`, `lib/server/domain/time.ts`, `lib/server/domain/canonical-json.ts`
- Create: `lib/server/validation.ts`, `lib/server/errors.ts`
- Create: `tests/unit/domain.test.ts`, `tests/unit/validation.test.ts`

**Interfaces:**
- Produces: `buildSummary(totalXp: number, balanceCents: number): Summary`, `haversineMeters(a: Point, b: Point): number`, `sfLocalDate(instant: Date): string`, `canonicalHash(value: unknown): Promise<string>`, strict Zod schemas, and `ApiProblem`.
- Consumes: shared contract types from Task 1.

- [ ] **Step 1: Write failing domain and validation tests**

Cover XP boundaries, Haversine just inside/outside 100 meters, SF midnight and DST transitions, canonical key ordering, radius 100-5000, visit location/purchase constraints, rejection of unknown mutation fields, redemption bounds shape, and adventure defaults/limits.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/unit/domain.test.ts tests/unit/validation.test.ts`

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement the minimum pure functions and schemas**

Use platform `crypto.subtle`, `Intl.DateTimeFormat`, and direct math; add no utility dependency.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/unit/domain.test.ts tests/unit/validation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add backend domain rules`

### Task 3: Create Supabase Schema, Seed, and Transaction Functions

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20261003000100_bitequest_schema.sql`
- Create: `supabase/migrations/20261003000200_bitequest_functions.sql`
- Create: `supabase/seed.sql`
- Create: `tests/integration/database.test.ts`, `tests/helpers/supabase.ts`

**Interfaces:**
- Produces SQL functions `create_or_resume_demo_session`, `get_summary`, `record_visit`, `record_redemption`, `consume_rate_limit`, and read views/functions used by routes.
- Consumes exact contract JSON field names and fixtures from Tasks 1-2.

- [ ] **Step 1: Write failing local-Supabase database tests**

Assert schema constraints, seed count/IDs, session reuse/expiry, first visit rows and summary, exact replay, changed-payload conflict, receipt reuse, daily cap, later-day zero XP, portability, redemption debit, concurrent visit/redemption safety, and injected rollback.

- [ ] **Step 2: Run integration tests and verify RED**

Run: `npm run test:integration -- tests/integration/database.test.ts`

Expected: FAIL because schema/functions are absent.

- [ ] **Step 3: Implement schema, grants, indexes, seed, and security-definer functions**

Lock `profiles` before user-scoped reads in monetary functions. Use fixed `search_path`, server-only execution grants, unique constraints, canonical request hashes passed by the server, and stored HTTP response JSON/status.

- [ ] **Step 4: Reset local Supabase and run integration tests**

Run: `npm run db:reset && npm run test:integration -- tests/integration/database.test.ts`

Expected: PASS with no negative balances or duplicate awards.

- [ ] **Step 5: Commit**

Commit: `feat: add atomic Supabase reward ledger`

### Task 4: Add Server Infrastructure and Read Routes

**Files:**
- Create: `lib/server/config.ts`, `lib/server/supabase.ts`, `lib/server/session.ts`, `lib/server/origin.ts`, `lib/server/http.ts`, `lib/server/log.ts`, `lib/server/rate-limit.ts`
- Create: `app/api/v1/session/demo/route.ts`, `app/api/v1/me/route.ts`, `app/api/v1/restaurants/nearby/route.ts`, `app/api/v1/collection/route.ts`, `app/api/v1/wallet/route.ts`
- Create: `tests/unit/http.test.ts`, `tests/integration/read-routes.test.ts`

**Interfaces:**
- Produces: `withRequestContext`, `requireSession`, `validateWriteOrigin`, `jsonError`, server Supabase client, and five contract-v1 routes.
- Consumes SQL read/session functions from Task 3 and validation/domain utilities from Task 2.

- [ ] **Step 1: Write failing infrastructure and route tests**

Cover secure cookie attributes, session reuse, 401 reads, blocked origins, summary fields, Haversine sorting/radius bounds, discovery state, wallet limit 50, durable limits, and redacted logs.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/unit/http.test.ts && npm run test:integration -- tests/integration/read-routes.test.ts`

Expected: FAIL because infrastructure/routes are absent.

- [ ] **Step 3: Implement infrastructure and routes**

Use server-only environment access. Keep request bodies, cookies, receipt IDs, and exact coordinates out of logs.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/unit/http.test.ts && npm run test:integration -- tests/integration/read-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add sessions and read APIs`

### Task 5: Add Visit and Redemption Routes

**Files:**
- Create: `app/api/v1/visits/route.ts`, `app/api/v1/redemptions/route.ts`
- Create: `lib/server/mutations.ts`
- Create: `tests/integration/mutation-routes.test.ts`

**Interfaces:**
- Produces contract `VisitResponse` and `RedemptionResponse` routes with stored 201 replay and shared errors.
- Consumes strict schemas, session/origin/rate-limit helpers, canonical hashing, restaurant rules, and Task 3 SQL functions.

- [ ] **Step 1: Write failing route integration tests**

Cover missing idempotency keys, unknown/extra fields, unauthenticated requests, `DEMO_MODE=false`, origin rejection, all location failures, too-small purchase, unknown restaurant, successful earn/read consistency, replay/conflict/receipt reuse, portability, amount limits, concurrent overspend, and exact 20-cent acceptance result.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:integration -- tests/integration/mutation-routes.test.ts`

Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement minimal route orchestration**

Validate and hash before calling the single SQL mutation function. Map typed SQL outcomes without duplicating financial rules in TypeScript.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm run test:integration -- tests/integration/mutation-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add idempotent reward mutations`

### Task 6: Add Adventure Planning and Provider Adapters

**Files:**
- Create: `lib/server/adventure/planner.ts`, `lib/server/adventure/validate-plan.ts`, `lib/server/adventure/sse.ts`
- Create: `lib/server/providers/types.ts`, `lib/server/providers/deterministic.ts`, `lib/server/providers/zoowork.ts`, `lib/server/providers/novita.ts`, `lib/server/providers/moss.ts`, `lib/server/providers/tavily.ts`, `lib/server/providers/index.ts`
- Create: `app/api/v1/adventures/stream/route.ts`
- Create: `tests/unit/adventure.test.ts`, `tests/unit/providers.test.ts`, `tests/integration/adventure-route.test.ts`

**Interfaces:**
- Produces: `planAdventure(input, context, signal): Promise<AdventurePlan>`, `PlanningProvider.rank(...)`, `encodeSse(event)`, and the POST SSE endpoint.
- Consumes catalog/discovery/eligibility reads, pure geo/time rules, shared contract types, and provider environment configuration.

- [ ] **Step 1: Write failing planning/provider/SSE tests**

Cover at most three stops, walk/duration math, budget and duration fallback to one stop, daily credit estimates, undiscovered XP, no-results, ZooWork choice parsing, Novita structured parsing, invalid/repeated IDs, Moss load failure, Tavily synthetic skip, provider timeout, arbitrary SSE framing, exactly one terminal event, and cancellation without writes.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/unit/adventure.test.ts tests/unit/providers.test.ts && npm run test:integration -- tests/integration/adventure-route.test.ts`

Expected: FAIL because planning modules/routes are absent.

- [ ] **Step 3: Implement deterministic planner, validated adapters, and live SSE route**

ZooWork uses `/v1/systemone` structured `choice`; Novita uses its OpenAI-compatible endpoint; Moss dynamically imports and fails open; Tavily submits at most two real venues. Bound all calls under the 45-second application deadline.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/unit/adventure.test.ts tests/unit/providers.test.ts && npm run test:integration -- tests/integration/adventure-route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add bounded adventure streaming`

### Task 7: Document Local Development, Environment, and Handoff

**Files:**
- Create: `.env.example`, `README.md`
- Create: `scripts/check-env.mjs`
- Create: `tests/unit/env-docs.test.ts`

**Interfaces:**
- Produces documented local setup and exact required/optional variables for developers and deployment.
- Consumes final scripts, routes, and provider choices from Tasks 1-6.

- [ ] **Step 1: Write failing environment-documentation test**

Assert every runtime environment variable appears in `.env.example` and README, server secrets are not prefixed `NEXT_PUBLIC_`, local Supabase/Docker setup is complete, and core versus optional keys are labeled.

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- tests/unit/env-docs.test.ts`

Expected: FAIL because documentation is absent.

- [ ] **Step 3: Write README, sample environment, and environment checker**

Document install, `supabase start`, status-derived local keys, reset/seed, dev server, unit/integration/full verification, curl examples, cookie/origin behavior, frontend handoff, provider selection, deployment, and secret placement.

- [ ] **Step 4: Run documentation and environment checks**

Run: `npm test -- tests/unit/env-docs.test.ts && npm run check:env`

Expected: PASS using documented local defaults or a clear list of missing runtime-only values.

- [ ] **Step 5: Commit**

Commit: `docs: add backend setup and handoff guide`

### Task 8: Full Verification and Acceptance

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Produces a buildable, tested backend branch ready for frontend integration.

- [ ] **Step 1: Reset the isolated local database**

Run: `npm run db:reset`

Expected: migrations and seed complete successfully.

- [ ] **Step 2: Run all automated checks**

Run: `npm run verify`

Expected: unit tests, integration tests, typecheck, lint, and production build all pass.

- [ ] **Step 3: Run the acceptance journey**

Run: `npm run test:acceptance`

Expected: a fresh session earns 50 cents at A, redeems 30 cents at B, replays both mutations without change, and reads a 20-cent balance.

- [ ] **Step 4: Audit spec coverage and secrets**

Compare every design requirement to implementation/tests. Run repository secret scanning and verify `.env.local` is ignored.

- [ ] **Step 5: Request whole-branch review and resolve Critical/Important findings**

Compare the branch to `main` with the committed spec and this plan as requirements.

- [ ] **Step 6: Commit verification fixes**

Commit: `test: complete BiteQuest backend verification`
