# BiteQuest backend

Backend-only hackathon MVP for demo sessions, nearby restaurants, collections, credit earning/redemption, and streamed adventure planning. The authoritative frontend contract is in `shared/contracts.ts`; the stable synthetic catalog is in `shared/fixtures.json`.

## Local setup

Prerequisites: Node.js 20+, Docker Desktop, and the Supabase CLI.

```powershell
npm install
npx supabase start
npx supabase db reset
Copy-Item .env.example .env.local
npx supabase status
```

Copy the API URL and service-role key printed by `npx supabase status` into `.env.local` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Keep `APP_ORIGIN=http://localhost:3000` and `DEMO_MODE=true`, then start the server:

```powershell
npm run check:env
npm run dev
```

`.env.local` is ignored by Git. Never prefix server secrets with `NEXT_PUBLIC_`. In deployment, put the same values in the hosting provider's encrypted environment/secret settings.

## Credentials

Core local functionality requires no purchased third-party key. It needs:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: values from the local Supabase CLI or your hosted Supabase project's API settings.
- `APP_ORIGIN`: frontend origin allowed to make cookie-authenticated writes.
- `DEMO_MODE=true`: enables simulated visits and redemptions.

The complete provider-assisted adventure experience uses:

- ZooWork: set `ADVENTURE_PROVIDER=zoowork` and provide either `ZOODATA_API_KEY` (`sk-…`) for `https://api.zoodata.ai/v1/systemone`, where `ZOOWORK_MODEL` defaults to `instinct`, or a ZooWork Platform key `ZOOWORK_API_KEY` (`zwp_…`). A Platform key uses the Managed Agents API: the backend reuses one labelled `bitequest-adventure-planner` agent (created on first use, all tools denied) and opens one session per adventure. `ZOOWORK_AGENT_MODEL` picks its model (default `litellm/gpt-5.6-luna`).
- Novita alternative: set `ADVENTURE_PROVIDER=novita`, `NOVITA_API_KEY`, and `NOVITA_MODEL`. This is an alternative to ZooWork, not an additional planner call.
- Moss semantic ranking: `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, and `MOSS_INDEX_NAME`. The index must contain documents whose IDs match restaurant IDs; build or rebuild it from the database with `npm run moss:seed`. Moss is only consulted when the adventure request includes `preferences`. If it is unavailable, catalog ranking continues.
- Tavily enrichment: `TAVILY_API_KEY`. It is optional and is skipped for the bundled synthetic venues.

Set `ADVENTURE_PROVIDER=deterministic` to run adventures without any AI key. Provider errors and malformed output fall back to this mode.

## API

All routes are under `/api/v1`:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/session/demo` | Create or resume a 24-hour demo session |
| GET | `/me` | Read summary, XP, level, and balance |
| GET | `/restaurants/nearby` | Search the catalog by coordinate and radius |
| GET | `/collection` | Read discovered restaurants |
| GET | `/wallet` | Read balance and recent ledger entries |
| POST | `/visits` | Record a qualifying simulated purchase |
| POST | `/redemptions` | Spend credits at another restaurant |
| POST | `/adventures/stream` | Stream a bounded adventure plan over SSE |

Create a session and retain its cookie:

```powershell
curl.exe -i -c cookies.txt -X POST http://localhost:3000/api/v1/session/demo `
  -H "Origin: http://localhost:3000"
```

Request a deterministic adventure:

```powershell
curl.exe -N -b cookies.txt -X POST http://localhost:3000/api/v1/adventures/stream `
  -H "Origin: http://localhost:3000" `
  -H "Content-Type: application/json" `
  -d '{"location":{"latitude":37.7749,"longitude":-122.4194},"maxSpendCents":3000,"maxDurationMinutes":90,"maxStops":2,"onlyUndiscovered":true}'
```

Mutation routes require an `Idempotency-Key` header. Browser requests must include credentials so the `bitequest_session` HttpOnly cookie is sent, and their `Origin` must match `APP_ORIGIN`. Responses use direct camelCase objects; failures use `{ "error": { "code", "message", "retryable" } }`.

## Frontend handoff

- Import or mirror the types from `shared/contracts.ts` and fixture IDs from `shared/fixtures.json`.
- Send `credentials: "include"` on every request after creating the demo session.
- For the adventure endpoint, parse named SSE events: three `progress` stages followed by one `complete` or `error` event.
- Money is integer cents, XP is integer, points are `{ latitude, longitude }`, and route coordinates are `[longitude, latitude]`.
- Visit and redemption values are calculated by the server. The client supplies evidence and an idempotency key, never award amounts.

## Database and lifecycle

`npx supabase db reset` applies the migrations and reloads the 18 synthetic restaurants. Stop the local stack with `npx supabase stop`. Financial state lives in the wallet ledger and the mutation functions update domain rows, XP, idempotency records, and stored responses in one PostgreSQL transaction.
