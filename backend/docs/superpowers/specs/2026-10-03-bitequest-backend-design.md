# BiteQuest Backend Design

**Date:** October 3, 2026  
**Branch:** `feat/bitequest-backend`  
**Contract:** v1.0  
**Source:** `02-backend-pdd.pdf`, with shared integration requirements cross-checked against `01-frontend-pdd.pdf`

## Purpose

Build the complete backend for the BiteQuest hackathon MVP. Diners receive an isolated demo session, browse a synthetic San Francisco restaurant catalog, record qualifying simulated purchases, collect restaurants, earn permanent XP and platform-funded credits, redeem those credits at another restaurant, and request a bounded adventure plan. Application and database code remain authoritative for XP and monetary state.

This repository owns the backend only. It exposes the shared v1 contract and fixtures for the separately developed frontend, but does not implement frontend screens.

## Success Criteria

- The API paths, JSON shapes, statuses, and error envelope match contract v1.0.
- A fresh session can earn 50 cents at restaurant A, redeem 30 cents at restaurant B, and retain 20 cents across replay and process restart.
- XP, visits, discoveries, redemptions, ledger entries, and idempotency responses mutate atomically.
- Concurrent requests cannot double-award credits, exceed the daily cap, double-redeem a receipt, or produce a negative balance.
- Adventure output contains only catalog IDs and server-calculated costs, XP, rewards, route estimates, and totals.
- Local Supabase is the documented default database and integration-test environment.
- External provider failures produce a labeled deterministic fallback without changing monetary state.

## Scope

### Included

- Minimal Next.js App Router server scaffold using the Node runtime.
- Shared TypeScript contracts and 15-20 stable synthetic SF restaurant fixtures.
- Local Supabase configuration, migrations, seed data, row-level access restrictions, and PostgreSQL functions.
- Demo sessions, authenticated reads, nearby search, collection, wallet, visit earning, redemption, and streaming adventure routes.
- ZooWork Instinct, Novita, Moss, and Tavily adapters with deadlines and deterministic fallbacks.
- Durable per-session rate limiting, structured operational logging, and request IDs.
- Unit tests and local-Supabase integration/concurrency tests.
- README instructions for local setup, API usage, frontend handoff, tests, deployment, and secrets.

### Excluded

- Frontend screens or state management.
- Real payment, receipt, merchant, reimbursement, settlement, or fraud integrations.
- Merchant funding, merchant enrollment, or production financial claims.
- Persistent third-party search results.
- PostGIS, background jobs, social features, reviews, dashboards, or production account management.

## Technology and Repository Layout

- Next.js App Router, TypeScript, Zod, and `@supabase/supabase-js`.
- Supabase Postgres and SQL functions for transactional mutations.
- Vitest for TypeScript tests and local Supabase for database integration tests.
- Provider SDKs are added only when an official, current SDK is available and materially reduces code. Plain `fetch` is preferred for small HTTP adapters.

Owned paths:

- `app/api/v1/`: route handlers.
- `lib/server/`: server-only validation, auth, data access, domain logic, planning, providers, rate limiting, and logging.
- `shared/contracts.ts`: authoritative contract v1.0 types and constants.
- `shared/fixtures.json`: authoritative synthetic catalog fixture.
- `supabase/migrations/`: schema, permissions, indexes, and transactional functions.
- `supabase/seed/`: reproducible seed SQL.
- `tests/`: unit and integration suites.

The root application has only the minimum files required for Next.js to build. It does not include a product UI.

## Shared Contract

JSON uses camelCase. Money is integer USD cents, XP is integer, timestamps are ISO UTC strings, IDs are opaque strings, and unknown values are `null`. Points use `{ latitude, longitude }`; route coordinates use `[longitude, latitude]`.

The contract defines:

- `Summary`, including `totalXp`, `level`, `xpIntoLevel`, `xpNeededForNextLevel`, `balanceCents`, `rewardFunding: "platform"`, and `verificationMode`.
- Restaurant, nearby result, discovery, wallet transaction, and collection/wallet response types.
- Session, visit, redemption, and adventure request/response types.
- Adventure stops, route estimate, totals, provider outcome, and fallback/no-results modes.
- SSE progress, complete, and error event unions.
- A shared `{ error: { code, message, retryable, details? } }` error envelope.

Endpoint paths under `/api/v1` remain fixed:

- `POST /session/demo`
- `GET /me`
- `GET /restaurants/nearby`
- `GET /collection`
- `GET /wallet`
- `POST /visits`
- `POST /redemptions`
- `POST /adventures/stream`

Success objects are returned directly without a `data` wrapper. Session creation returns 200. New visits and redemptions return 201. Idempotent replay returns the stored status and response. Reads return 200.

## Persistent Data Model

Postgres contains:

- `profiles`: one row per user with nonnegative `total_xp`; this row is the per-user mutation lock.
- `restaurants`: server-authored catalog and reward rules.
- `visits`: qualifying earning visits only, unique by user/receipt and user/restaurant/local date.
- `discoveries`: unique user/restaurant collection records tied to a unique first visit.
- `redemptions`: simulated debits, unique by user/demo receipt.
- `wallet_transactions`: immutable credit ledger with unique references; balance is `sum(delta_cents)`.
- `idempotency_records`: unique user/operation/key with request hash and saved HTTP response.
- `demo_sessions`: hashed token, public session cache ID, user, and expiry.
- `rate_limit_events`: durable, indexed per-session request events for planning and mutation windows.

All money and XP constraints are enforced in SQL as well as at the request boundary. Browser roles receive no direct write permission for financial tables or privileged functions. Privileged functions fix their `search_path` and are executable only by the trusted server role.

## Session and Request Security

`POST /session/demo` generates a cryptographically random token, stores only its SHA-256 hash, creates a user/profile at zero XP and balance, and sets the raw token in an HttpOnly, SameSite=Lax cookie. The cookie is Secure under HTTPS and expires after 24 hours. A valid existing cookie returns its current session instead of resetting state.

The response exposes a separate opaque `sessionId` for client cache keys; it is not an authentication token. Authenticated routes resolve the user from the cookie and never accept a client-provided user ID.

Cookie-authenticated writes validate `Origin` against the request origin or configured public application origin. Missing sessions return 401. Blocked origins and disabled demo mutations return 403. Secrets remain server-only.

## Read APIs

`GET /me` returns an authoritative summary. `GET /collection` returns all discoveries for the small catalog. `GET /wallet` returns the complete balance and at most 50 newest ledger entries.

`GET /restaurants/nearby` validates latitude, longitude, and a radius from 100 through 5000 meters. It calculates straight-line Haversine distance on the server, filters to the radius, sorts ascending by distance, and includes discovery and current reward-eligibility state. The MVP does not require PostGIS.

## Visit Mutation

`POST /visits` requires `Idempotency-Key` and a strict `VisitRequest` containing restaurant ID, captured location, and simulated purchase evidence (`receiptId`, `billCents`). Client award values, verification flags, and unknown fields are rejected.

Location requires valid coordinates, accuracy from 0 through 100 meters, capture no more than 60 seconds old, no more than 5 seconds in the future, and Haversine distance no more than 100 meters. The bill must be at least 500 cents. Simulated purchases are available only when `DEMO_MODE=true`.

One SQL function performs the mutation:

1. Lock the profile row.
2. Replay an identical idempotency record before re-evaluating time, day, or balance; conflicting payloads return `IDEMPOTENCY_CONFLICT`.
3. Reject reused receipts and an existing earning visit for the same restaurant and SF local date.
4. Sum earned credits for the SF local day and enforce the 200-cent cap.
5. Read the server restaurant rules and award first-discovery XP only when no discovery exists.
6. Insert the visit, optional discovery, positive 50-cent ledger entry, and XP increment.
7. Calculate the authoritative summary and persist the 201 response and status in the same transaction.

Rarity XP is common 150, rare 400, epic 800, and legendary 1200. Repeat qualifying visits on later days award 50 cents and zero discovery XP.

## Redemption Mutation

`POST /redemptions` requires `Idempotency-Key`, restaurant ID, `demoReceiptId`, `billCents`, and `amountCents`. Amount must be from 1 through the minimum of current balance, bill, and 500 cents. The user must have a successful earning visit at a different restaurant.

One SQL function locks the same profile row, handles replay/conflict first, checks receipt uniqueness, recalculates balance and portability, inserts a simulated redemption and one negative ledger entry, calculates the authoritative summary, and saves the 201 response atomically. Redemption never awards XP, creates a discovery, or earns credits.

Insufficient balance returns `INSUFFICIENT_BALANCE`; missing cross-venue eligibility returns `PORTABILITY_REQUIRED`. The response states `settlementStatus: "simulated"` and never claims a real payment or bill reduction.

## Idempotency and Error Mapping

Validated canonical JSON is serialized with stable object-key ordering and hashed with SHA-256. Scope is user + operation + key. Identical replays return the exact stored body and status. Different normalized input returns 409 without mutation. A reused receipt under a new key returns `RECEIPT_ALREADY_USED`.

Routes map failures consistently:

- 401: unauthenticated.
- 403: origin blocked or demo mode disabled.
- 404: unknown restaurant.
- 409: idempotency conflict, receipt reuse, eligibility, daily cap, or balance conflict.
- 422: malformed data, invalid/stale/inaccurate/future/far location, or too-small purchase.
- 429: durable rate limit exceeded.
- 503: temporary database or provider service failure.

Unexpected errors are logged with request ID and return a non-sensitive shared error.

## Adventure Planning

The application loads the catalog and discovery/reward state, emits `catalog_loaded`, then deterministically filters closed venues, `onlyUndiscovered`, budget eligibility, and preference tags. Unknown availability remains labeled unknown. It emits `candidates_ranked` only after ranking completes.

The provider receives no more than ten catalog candidates and cannot write ledger state. The provider result is only an ordering of existing IDs with short reasons. Application code rejects unknown/repeated IDs and reconstructs meal costs, discovery XP, potential credits, route segments, walking time, duration, and totals.

Plans contain at most three stops. Segment walk time is `ceil(distanceMeters / 75)`. Duration adds 20 minutes per stop. Total meal cost cannot exceed `maxSpendCents`; total duration cannot exceed `maxDurationMinutes`. Potential XP applies only to undiscovered stops. Potential credits are estimated in route order using current daily eligibility and remaining cap.

If a multi-stop plan does not fit, the planner tries one stop. No eligible candidates yields a complete empty plan with an explanation. Provider failure, timeout, invalid output, or unavailable native runtime yields `mode: "fallback"` with an explicit live-AI-unavailable explanation.

## Provider Roles

- **ZooWork Instinct:** primary structured decision provider. The current public `/v1/systemone` API is used to choose among bounded catalog candidate labels. It does not orchestrate tools or generate ledger commands.
- **Novita:** separately selectable OpenAI-compatible planner that returns structured ordered IDs and reasons. It is not called in the same request merely to duplicate ZooWork's decision.
- **Moss:** optional semantic ranking for authored restaurant text using `@moss-js/moss`. Dynamic loading and a bounded deadline prevent native/runtime failure from blocking planning.
- **Tavily:** optional short sourced enrichment for at most two real venues. Synthetic fixture venues are never submitted, so the initial all-synthetic catalog skips Tavily by design.

`ADVENTURE_PROVIDER` selects ZooWork, Novita, or deterministic planning. All provider adapters accept an abort signal and enforce deadlines within a 45-second overall limit. There are no unbounded retries; malformed model output may receive at most one repair attempt, and output remains below 1200 tokens.

## Streaming

`POST /adventures/stream` validates authentication and input before streaming. It returns `text/event-stream` with `Cache-Control: no-cache` and app-owned `progress`, `complete`, or `error` frames. Arbitrary network chunking does not change the JSON event contract.

The live request owns all work; no fire-and-forget task survives the response. Exactly one complete or error event terminates a started stream. Request disconnect aborts provider work when supported. Planning has no monetary writes.

## Rate Limits and Logging

The database-backed limiter targets 10 planning requests and 30 mutation attempts per session per rolling minute. Expired limiter rows may be cleaned opportunistically; correctness does not depend on process memory.

Structured logs include request ID, route, HTTP status, provider outcome, and elapsed milliseconds. They exclude cookies, API keys, raw receipt IDs, request bodies containing receipts, and precise coordinates. Location exists only in request memory for validation.

## Verification Strategy

Unit tests cover canonical JSON hashing, Haversine boundaries, SF local-date/DST behavior, XP/level summaries, route calculations, budget/duration validation, provider-output validation, and SSE formatting.

Local-Supabase integration tests use real concurrent calls and an isolated resettable database. They prove:

- First visit creates exactly one visit, discovery, positive ledger entry, XP award, and 50-cent balance.
- Exact replay preserves body/status and row counts; changed payload under the key returns 409.
- Receipt reuse under a new key returns 409 without an award or debit.
- Simultaneous first visits create one award; concurrent daily earnings cannot exceed 200 cents.
- Concurrent redemptions cannot overspend and balance never becomes negative.
- An injected failure between domain and ledger writes rolls back XP, rows, ledger, and idempotency.
- Distance just inside/outside 100 meters, stale/inaccurate/future location, and bills below 500 cents behave correctly.
- SF calendar boundaries and daylight-saving transitions are correct; later-day repeat visits earn credits but zero XP.
- Unauthenticated writes, unknown venues, client award overrides, blocked origins, and `DEMO_MODE=false` are rejected.
- Invalid AI output becomes a validated fallback or empty plan; stream cancellation never changes financial state.
- The acceptance sequence persists 50 earned cents, 30 redeemed cents, and a 20-cent balance across replay and server restart.

## Local Development and Delivery

The README makes local Supabase through the Supabase CLI and Docker the default workflow. It documents prerequisites, startup, migration reset/seed, generated local environment values, development, unit tests, integration tests, API examples, and shutdown.

`.env.example` contains placeholders only. Local secrets go in ignored `.env.local`; deployment secrets go in the host's secret configuration. Required and optional variables are documented with visibility and purpose. The final handoff lists which keys are necessary for the core backend and which enable optional providers.

The frontend handoff consists of `shared/contracts.ts`, `shared/fixtures.json`, the stable `/api/v1` routes, cookie requirements, and example requests. Required fields and error semantics do not change without coordination; future changes prefer additive optional fields.
