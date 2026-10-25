# Phase 9 systematic testing

Phase 9 adds repeatable tests at the component, API, persistence, browser,
security, RAG, and performance layers. Real SMTP delivery, the public CUET site,
and Ollama are replaced by deterministic test doubles. The production adapters
remain covered by configuration and safe-failure tests.

## Commands

Run the backend suite from `backend/`:

```powershell
.\.venv\Scripts\python -m ruff check app tests scripts
.\.venv\Scripts\python -m pytest -q --basetemp=.pytest-temp
.\.venv\Scripts\python scripts\verify_migrations.py
```

For the normal backend lint-and-test gate, `backend\test` is the short Windows
command equivalent of the first two commands.

`verify_migrations.py` creates a randomly named schema in the configured local
PostgreSQL database, upgrades it from an empty schema to Alembic head, verifies
the critical tables, and drops only that schema in a `finally` block.

Run the frontend gates from `frontend/` with Node 20.19 or newer:

```powershell
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

The Playwright command starts a disposable SQLite-backed FastAPI test server on
port 8012 and an isolated Next.js development output on port 3215. It uses the
installed Microsoft Edge browser and never reads or mutates the developer
database. Its fixed OTP is `123456` and is valid only inside that process.

## Coverage map

- Frontend component tests cover registration, CUET email and role IDs, OTP,
  login, navigation permissions, notifications, directory selection,
  club/event state and registration, resource request/chat, transport dates,
  forum forms and inert rendering of untrusted markup, Admin guard behavior,
  and assistant loading/answer states.
- FastAPI tests cover authentication, directory, campus explorer, clubs/events,
  resource sharing/chat, transport, forum moderation, news, shared
  notifications, App Admin integration, and the assistant API.
- Integration tests cover the full authentication, club proposal/approval,
  free/paid event registration, resource conversation, moderation, and
  announcement-notification chains.
- Persistence tests enable SQLite foreign keys and verify many-to-many club
  administration, cascade and rejection behavior, rollback, important indexes,
  and a two-session duplicate-registration race.
- Performance smoke tests exercise directory, paginated forum, cursor-based
  message history, transport, and notification reads with a generous three
  second local budget. Bounds reject list sizes greater than 100.
- Browser tests run public/authenticated registration, fixed-OTP, login,
  protected-route, directory, controlled-assistant, and Admin workspace checks
  at desktop and mobile viewport sizes.

## RAG quality gate

The CUET-specific corpus is in
`backend/tests/fixtures/rag_evaluation.json`. Each case stores the question,
expected official CUET source, key facts, answerability, and freshness class.

The deterministic suite verifies:

- official `https://cuet.ac.bd` source policy;
- preprocessing, date extraction, chunk size/overlap, and cosine ranking;
- grounded answer output without public source cards;
- safe no-context and unrelated-question behavior;
- generic 503 handling when Ollama fails, without leaking provider details;
- freshness-marked cases for data that must be re-crawled; and
- a three-second local read-path budget, while live Ollama latency is monitored
  separately because it depends on the host hardware and selected model.

Refresh `refresh-required` cases after each scheduled CUET crawl. A release is
blocked if an answerable case cannot retrieve its expected CUET document, an
unsupported case produces invented facts, sources appear in the public answer,
or external-provider details escape the API.

## Security gate

Tests verify password hashing/JWT behavior, owner-scoped chats and
notifications, recipient-only request decisions, per-club and App Admin
authorization, OTP expiry/cooldown, rate-limit behavior, narrow production
CORS, inert rendering of untrusted forum text, and private event-registration
data exclusion. `.env` must be ignored and untracked; only placeholder
`.env.example` values may be committed. Ollama remains bound to backend-trusted
infrastructure (the local default is loopback `127.0.0.1:11434`).

## Exit policy

A Phase 9 release candidate requires all commands above to pass, a clean
PostgreSQL migration verification, no known critical/high security issue, and
no failing answerability/grounding case. Live SMTP delivery and a live Ollama
query are deployment-environment smoke checks, not deterministic CI tests.
