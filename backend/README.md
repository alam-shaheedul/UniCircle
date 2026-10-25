# UniCircle backend foundation

Phases 6.1–6.3 provide the FastAPI and database foundation. Phase 7 includes
Authentication Feature 1, the Department and Faculty Directory, Campus Explorer,
Club & Event Hub, Resource Sharing + Chat, Transport, Community Forum, Campus
News & Announcements, and the Campus AI Assistant/RAG backend.

Backend Feature 2 is intentionally static: the public Home page reads reviewed
content from `frontend/src/features/home/content`, with media shipped from
`frontend/public/media/home`. It has no Home database tables, seed, or FastAPI
endpoint, and no Admin editing API unless a future CMS decision changes the design.

## Python setup

Use Python 3.12 or newer. From `backend/`:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -e '.[dev]'
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, after the virtual environment is set up, you can use `.\run`
from `backend/` as the short start command. It always uses this project's
Python 3.12 virtual environment, even if your global `uvicorn` uses Python 3.10.

On macOS/Linux, use `python3.12 -m venv .venv` and `.venv/bin/python`.
`GET /health` is the unversioned liveness endpoint; auth routes live under
`/api/v1/auth` and profile updates at `/api/v1/users/me`. OpenAPI JSON is at
`/api/v1/openapi.json` and interactive docs
at `/docs`. The health check does not require a database connection.

## Configuration

The app reads environment variables, with optional ignored `.env` files in
the repository root and `backend/` (the backend file takes precedence). Copy
the root `.env.example` to `.env` and set a real `DATABASE_URL` as needed. Never
commit actual credentials. `APP_ENV` is `development`, `testing`, or
`production`; testing and production require an explicit non-default database
URL. `FRONTEND_URL` controls the allowed CORS origin. Development also permits
the equivalent localhost/127.0.0.1 origin at the same port. There is no wildcard
CORS origin.

The Phase 6.3 security services need a distinct `JWT_SECRET` and `OTP_PEPPER`,
each at least 32 bytes. Authentication and OTP operations fail closed when
their keys are absent; production startup additionally requires SMTP settings.
Configure `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_ACCESS_TOKEN_MINUTES` consistently
across deployments. SMTP supports `starttls` or `ssl` only. Never use real
mailbox credentials in committed files or test fixtures.

The current-user dependency verifies the JWT, checks its unrevoked database
session, then loads the latest active, verified account and role. Roles inside
tokens are never trusted. OTP challenges and login throttles are stored in the
database; the in-memory stores under `tests/` are test fixtures only. Registration
fails closed if SMTP is not configured. Real SMTP delivery must be validated
with the selected provider before production use.

### Sign-up OTP and forgotten passwords

General-user sign-in remains password-only and requires a verified account.
Registration sends an email-verification code; a correctly authenticated retry
of the same pending registration resumes code entry without replacing user data.

Password recovery reuses the configured TLS SMTP sender:
`POST /api/v1/auth/forgot-password` → `/password-reset/verify-otp`
→ `/reset-password`. A browser uses the same-origin Next.js BFF, which keeps
challenge IDs/reset grants in HttpOnly cookies and never exposes grants to client
JavaScript. Recovery acknowledges known/unknown emails generically; invalid,
expired, or exhausted reset codes share a safe error. Resends are rate-limited.
Only a valid code creates a ten-minute, single-use reset grant; its hash is stored
under a distinct purpose in the existing `otp_challenges` table. A new password
uses the registration password policy and revokes all old sessions/challenges in
one user-locked transaction. Login takes the same user lock to serialize against
password changes. No schema migration or production-data replacement is required.
Provisioned App Admins have no email account and retain their separate ID/password
login; they cannot use the public General User recovery flow.

The default development URL is
`postgresql+psycopg://unicircle_dev@localhost:5432/unicircle_dev`. On a local
PostgreSQL installation that trusts local connections, create a dedicated role
and database once (run as a PostgreSQL administrator):

```powershell
createuser -U postgres unicircle_dev
createdb -U postgres -O unicircle_dev unicircle_dev
```

If your PostgreSQL installation requires a password, set one for this
development role and put the matching URL in your ignored `.env`. Do not use
the passwordless example for a remotely accessible server. The role owns only
its development database; do not reuse it for testing or production.

## Database and migrations

Run from `backend/` with the configured environment:

```powershell
.\.venv\Scripts\python -m alembic history
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m alembic current
```

The reviewed first revision (`20260920_0001`) is intentionally empty. Revision
`20260921_0002` creates authentication tables; `20260921_0003` creates the
department and faculty directory tables. Both can be applied with the command
above. After migrating, load the reviewed CUET snapshot from `backend/`:

```powershell
.\.venv\Scripts\python -m app.modules.directory.seed
```

The seed is idempotent. It contains 12 CUET departments and 292 current-faculty
listings retrieved on 21 September 2026 from the public CUET department pages
and their underlying API. It is a snapshot, not a live sync; recheck CUET before
relying on it as current. Missing fields remain null. No faculty login accounts
are created. A person listed in multiple departments has one directory entry
per department. The read-only directory routes require an authenticated account:
`GET /api/v1/departments`, `GET /api/v1/departments/{code}`,
`GET /api/v1/departments/{code}/faculty`, `GET /api/v1/faculty/{entry_id}`,
and `GET /api/v1/faculty/{entry_id}/profile`. The profile route fetches that
faculty member's public CUET details on demand, returns only an explicit
allowlist of academic/contact fields, and falls back to the saved listing when
CUET is unavailable. CUET's private response fields are never exposed.

Campus Explorer uses reviewed OpenStreetMap data for CUET's Raozan campus.
Revision `20260921_0004` adds `campus_locations`; after upgrading, seed it with:

```powershell
.\.venv\Scripts\python -m app.modules.campus.seed
```

The seed is idempotent and contains 24 named places, all checked against the
mapped CUET boundary (OSM way 681604170). The protected read endpoints are
`GET /api/v1/campus/map`, `GET /api/v1/campus/locations`, and
`GET /api/v1/campus/locations/{location_id}`. The map response includes the
boundary and attributed tile URL; locations include coordinates and their OSM
source links. This is a reviewed snapshot, not a live OSM sync or route planner.
No campus Admin editing API is enabled.

## Club & Event Hub

Revision `ddcf224a1d10` adds club membership/admin, club-creation request,
event, interest, registration, and the original event-notification table. Apply migrations
before starting the backend. To create the ten existing clubs and assign the
sole active, verified student as their initial admin, run once from `backend/`:

```powershell
.\.venv\Scripts\python -m app.modules.clubs.seed
```

The seed is idempotent. It refuses to guess if there is not exactly one eligible
student; pass `--student-id UUID` to select one explicitly. It does not create
demo events, fake members, or fake leaders. Future students are not automatically
made admins. Club Admins may add another verified student admin, but cannot
remove the last admin. App Admins review club-creation requests; approval
atomically creates a club and grants the requester initial admin access.

Revision `7b6f0c2d91aa` adds the membership-recruitment workflow. Recruitment is
closed by default. A mapped Club Admin must save valid bKash and Nagad numbers
before opening it. The fee is fixed at BDT 200 by both API validation and a
database check constraint. A student can submit one request per club; approval
creates the membership and a persistent unread notification in one transaction.
Only that club's admins may view, approve, or remove pending requests.

Protected endpoints are under `/api/v1`: `GET /clubs`, `GET /clubs/{id}`,
`GET /clubs/{id}/members`, `GET /clubs/{id}/events`, `GET /events`,
`GET /events/{id}`, `PUT /events/{id}/interest`, `POST /events/{id}/registrations`,
and `GET /notifications/me`. Students use `/clubs/requests`,
`/clubs/requests/mine`, and `/clubs/{id}/membership-requests`; App Admins use
`/admin/club-requests` and
`/admin/club-requests/{id}/review`. Club Admins use `/clubs/administered`,
`PUT /clubs/{id}`, `/clubs/{id}/admins`, `/clubs/{id}/membership-settings`,
and the membership-review and club/event write routes. The
OpenAPI page at `/docs` shows request/response details. Registration records
and payment review are visible only to that club's admins or App Admins.
Public event responses expose counts, not participant details. Paid submissions
start as `pending_review`; a transaction ID alone never confirms payment.

Event status is derived from UTC start/end times. To create start/finish
notifications, run this idempotent job every minute with an external scheduler
(for example Windows Task Scheduler or cron):

```powershell
.\.venv\Scripts\python -m app.modules.clubs.notifications
```

The job notifies interested, going, or registered users. A unique constraint
prevents duplicate state notifications. No in-process scheduler is started by
the API. The frontend club/event pages and global notification UI use the live
API.

## Resource sharing and chat

Revision `667afe78e4cf` adds opt-in resource profiles/categories, resource
requests, accepted-request conversations, and messages. Apply migrations before
using `/resources` or `/chat`. No demo students or requests are seeded. A student
appears in discovery only after saving a discoverable profile with at least one
resource category. Email, phone, and home address are never returned by the
discovery endpoint. A single registered student cannot send a request to
themselves; register and verify another student account to test both sides.

Authenticated General Users can use `GET/PATCH /api/v1/resource-profile/me`,
`GET /api/v1/users/discover`, `POST /api/v1/resource-requests`,
`GET /api/v1/resource-requests/mine`, and
`POST /api/v1/resource-requests/{id}/decision`. Only the recipient can accept or
reject. Acceptance creates one conversation; only its two participants may list
it, fetch messages, or send messages through `/api/v1/conversations` and
`/api/v1/conversations/{id}/messages`. Discovery, requests, and conversations
are paginated; message history supports `before_id` and `after_id` cursors.
The frontend refreshes these REST endpoints periodically. Chat messages are
server-readable; this is **not** cryptographic end-to-end encryption. Use TLS
outside local development.

## Community discussion forum

Revision `9e4a2b1c7d30` adds text-only forum posts, comments, and moderation
reports. General Users can list/create posts, list/add comments, and report a
post through `/api/v1/forum/posts`. Each user can report a post only once.
Image/video fields and reaction data are rejected or unsupported by design.

App Admin moderation is under `/api/v1/admin/forum/reports`. Dismissing a report
keeps the post visible. Removing a reported post soft-removes it, hides its
comments from every General User endpoint, and retains the post/report audit
record. All moderation permissions are enforced by FastAPI, not by the UI.

## Campus news and announcements

Revision `4f7a2c8d1b90` adds persisted campus news, updates, announcements, and
recipient-scoped publication notifications. Authenticated users read only
published items through `GET /api/v1/news` and `GET /api/v1/news/{id}`; results
are newest first. App Admin CRUD and draft/publish controls are under
`/api/v1/admin/news` and are protected server-side.

Publishing an update or announcement creates one notification for every active,
verified General User in the same transaction. A database uniqueness constraint
prevents duplicate recipient/item rows. Plain news does not fan out. Moving an
item back to draft removes its notifications and hides it from General Users.
Notification links point to the live news detail route and use the existing
owner-scoped read and mark-all-read endpoints. The news list/detail pages and
Admin publishing workspace now use these APIs rather than prototype data.

## Shared notifications

Revision `c31f2a9d8e40` adds the consolidated `notifications` table and backfills
existing event, club-membership, and campus update/announcement notices. New
producers use the shared repository and unique `(recipient_id, dedupe_key)`
constraint, so retries update current content without duplicating delivery.

Authenticated users list only their inbox with `GET /api/v1/notifications/me`,
mark one item through `PUT /api/v1/notifications/{id}/read`, and mark every
unread item through `PUT /api/v1/notifications/read-all`. Both write endpoints
scope their update by the current authenticated recipient; another user's ID is
returned as not found. The response contract remains compatible with the
global frontend notification menu.

## App Admin integration

App Admin accounts cannot be created through public registration. Provision them
only with `python -m app.modules.auth.provision_admin`; the dedicated Admin login
does not accept General User credentials. Every `/api/v1/admin/*` endpoint checks
the current live account through `get_current_admin`. Frontend route guards and
hidden navigation are usability controls, not authorization controls.

The Admin workspace uses live APIs for transport management, campus publishing,
forum moderation, and club-request review. The club-request API returns pending
and reviewed history, and approval atomically creates the club plus its initial
student administrator. Club management endpoints separately verify the
student-to-club mapping on every mutation, preventing an administrator of one
club from changing another club.

Revision `e42a7b1c9d50` adds append-only `admin_audit_logs`. Successful club
review, forum moderation, campus publishing, and transport mutations add an
audit row in the same transaction. Records contain actor, action, target, time,
and safe operational metadata only—never passwords, JWTs, OTPs, payment IDs, or
request bodies. App Admins can inspect the bounded trail through
`GET /api/v1/admin/audit-logs`; General Users receive `403`.

## Campus AI Assistant / RAG

Revision `a18d6c9e4f20` adds approved knowledge sources, embedded chunks, and
privacy-minimal query audits. Apply the migration and make the configured
Ollama embedding model available before building the initial CUET snapshot:

```powershell
ollama pull embeddinggemma:300m
```

### Hosted Qwen chat on Groq

Put `GROQ_API_KEY` in the ignored repository `.env` or backend `.env`, never in
frontend variables, source code, images, or GitHub. Restart the backend after
changing settings. `RAG_CHAT_PROVIDER=auto` (the default) selects Groq whenever
the key is nonempty; it selects local Ollama chat only when no key is present.
Set `RAG_CHAT_PROVIDER=groq` to require Groq or `ollama` to explicitly use local
chat. An invalid key or a failed Groq request does **not** silently fall back to
Ollama. The real key is held as a masked `SecretStr` in settings.

The hosted model defaults to `GROQ_CHAT_MODEL=qwen/qwen3.8-27b`. This is a
[Groq preview model](https://console.groq.com/docs/model/qwen/qwen3.8-27b), so
review availability before deployment. Requests disable reasoning, hide reasoning
output, cap completion length (`GROQ_MAX_OUTPUT_TOKENS=512`) and use a bounded
timeout (`GROQ_TIMEOUT_SECONDS=60`). Provider quota exhaustion returns a safe
429, while invalid credentials/model access, network failures and unusable
responses return safe 503 errors without upstream bodies or keys.
Existing per-user limits still apply; Groq's shared request/token quota can be
exhausted sooner. See [Groq rate limits](https://console.groq.com/docs/rate-limits).

Only the question and retrieved public CUET excerpts are sent to Groq; user
records, email addresses, tokens and other account data are not added to the
prompt. Users should not include private information in their questions.
Answers retain the existing no-sources presentation and reviewed-corpus rules.
The existing Python HTTP client is used; no frontend SDK or framework migration
is required.

**Embeddings still use Ollama's `embeddinggemma:300m`.** Switching chat models
does not change vector dimensions or require re-indexing. Keep the embedding
server reachable for both ingestion and each question. This change alone does
not remove the laptop dependency for deployment: provision a reachable private
embedding service, or implement a hosted embedding provider and rebuild the
index with that provider before switching retrieval. If explicitly choosing
local chat, also install `ollama pull qwen3:1.7b`.

Docker Compose passes the Groq settings at runtime. Its `--env-file .env.compose`
must contain the key separately; it does not automatically copy the root `.env`.
Do not print resolved Compose configuration containing real secrets.

To build the knowledge index, run from `backend/`:

```powershell
.\.venv\Scripts\python -m app.modules.assistant.ingest --check
.\.venv\Scripts\python -m app.modules.assistant.ingest
```

The default corpus is `app/modules/assistant/knowledge/CUET_Knowledge_Base.md`,
with a matching `.txt` companion. Sixteen independently written, reviewed
sections cover campus location, academics, institutes, halls, ITBI, TSC,
rankings and leadership, with evidence URLs, review dates and explicit unknowns.
There are no website requests during local ingestion or question answering.
Edit the Markdown, run `python -m app.modules.assistant.ingest --export-txt`
using your activated project environment, check both files, then run ingestion.
Re-indexing is atomic; model failure leaves the previous index intact. Unchanged
sections skip embedding; model changes or `--force` rebuild vectors. Docker
images include both files, so rebuild the backend after editing the corpus.

`RAG_KNOWLEDGE_MODE=curated` is the default. Old scraped sources remain in the
database but are excluded from curated retrieval; no users or other app data
are deleted. Retrieval also excludes removed/changed snapshots, embeddings
from another model, and sections past their review date. Re-verify facts and
update dates before refreshing; re-running ingestion does not renew review dates.
Leadership needs weekly review, rankings monthly review, and general campus
facts quarterly/half-yearly review. Admin knowledge status reports review-due
sections. Unknown pro-VC and teacher-headcount information is not fabricated.

### Troubleshooting empty or unavailable knowledge

Having scraped pages in the database does **not** mean the curated corpus has
been indexed. After switching to curated mode or changing the Markdown document,
run `python -m app.modules.assistant.ingest` from the activated backend environment
(without `--web`). Check the admin knowledge-status endpoint for eligible sources
and chunks, rather than the total number of old source records.

No eligible chunks now produces HTTP 503 with `assistant_knowledge_not_ready`,
not a misleading answer saying every question is unrelated. This also covers a
stale snapshot, a different embedding model or an entirely expired corpus. A
ready index with genuinely insufficient retrieval confidence still returns the
normal `not-found` answer. The fix is to index/review the corpus, not weaken the
similarity threshold or feed excluded old scrapes into answers.

If `ollama list` is empty although model files exist on E:, check **Ollama desktop
Settings → model storage** as well as the `OLLAMA_MODELS` environment variable.
The desktop app can have an explicit old folder saved in its settings. On this
development machine both should point to `E:\OllamaModels`; restart Ollama after
correcting the folder. Existing model files do not need to be downloaded again.
See [Ollama's model-location and environment-variable guidance](https://docs.ollama.com/faq).

The legacy crawler remains an explicit research tool:
`python -m app.modules.assistant.ingest --web --max-pages 500`.
It still applies the strict approved-host/robots policy. Scraped results do not
enter assistant answers unless an operator explicitly selects
`RAG_KNOWLEDGE_MODE=web`. See `docs/design/RAG_Knowledge_Source_Policy.md`.

Authenticated users ask through `POST /api/v1/assistant/ask`. The service
retrieves relevant chunks, sends only those public excerpts and the question to
the configured Groq or local Ollama chat provider, returns a clean answer without
citation/source metadata, and emits a no-context response when retrieval confidence
is insufficient. Per-user fixed-window limits and output
limits bound resource usage. `GET /api/v1/admin/assistant/knowledge` reports
eligible corpus counts and review-due sections to App Admins. Browser requests use the same-origin Next.js proxy;
the Ollama service is never exposed to browser JavaScript.

## Transport

Revision `0363e1e5ad21` adds transport routes, buses, drivers, and recurring
schedule assignments. After applying migrations, load the reviewed CUET data:

```powershell
.\.venv\Scripts\python -m app.modules.transport.seed
```

The idempotent seed contains the 20 supplied bus names, the regular,
Chawkbazar, and Rastar Matha routes, and four daily service windows. It imports
only PDF rows 7-31 because those 25 records are designated drivers; rows 1-6
are officials/staff and rows 32-46 are helpers, security, or office staff.
Names are transliterated to English and phone numbers retain the PDF digits.
Every driver receives a deterministic, repeatable bus allocation. The source
PDF itself is not copied into the repository.

Authenticated users read `GET /api/v1/transport/snapshot`, `/transport/dates`,
`/transport/schedules?service_date=YYYY-MM-DD`, and `/transport/drivers`.
Normal APIs reject past dates. App Admin writes are under
`/api/v1/admin/transport`: routes, buses, drivers, and schedules support create,
update, and guarded delete operations. Recurrence supports once, daily, weekly,
and monthly templates with an optional end date. The Admin transport UI uses
these APIs; the announcement and report sections use their respective live APIs.

Future feature work should add ORM models, import them from
`app/db/models.py`, generate a candidate revision with
`alembic revision --autogenerate -m "description"`, then **review and edit**
its operations, constraints, indexes, nullability, data migrations, and
rollback behavior before applying it. Do not use `Base.metadata.create_all()`
for application schema management. Use separate development/test databases.

`Base` supplies a stable constraint naming convention. `TimestampMixin` is
opt-in for future models; no primary-key type or domain relationship is chosen
until the approved ERD is available. The request-scoped `get_db` dependency
closes sessions; future feature services own transaction commits and rollbacks.

No passwords or Admin accounts are seeded. To create an App Admin after applying
the migration, run this interactive command from `backend/`:

```powershell
.\.venv\Scripts\python -m app.modules.auth.provision_admin --admin-id YOUR_ADMIN_ID
```

It prompts twice for a password without putting it in shell history. Public
registration cannot create Admins. Existing General Users register with a CUET
email at `@cuet.ac.bd` or `@student.cuet.ac.bd`, verify the emailed code, then
sign in. If mail delivery fails after the pending account is saved, use the
resend-code flow when SMTP is working.

The FastAPI login responses contain JWTs for the trusted Next.js BFF only. The
BFF places them in HttpOnly cookies and strips them from browser-facing JSON.
Sessions expire after `JWT_ACCESS_TOKEN_MINUTES`; there is no refresh token.

## Quality checks

```powershell
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check app tests migrations
.\.venv\Scripts\python -m ruff format --check app tests migrations
```

## Backend Docker image (Phases 10.1 and 10.3)

From the repository root, with Docker Desktop using Linux containers:

```powershell
docker build --tag unicircle-backend:phase10.3 ./backend
```

The two-stage image uses the official Python 3.12 slim Bookworm base pinned to
an immutable digest, installs only production dependencies from the hash-locked
`requirements.lock`, and runs Uvicorn as UID/GID `10001`. The lock is resolved
for Linux/Python 3.12, not copied from the Windows development virtualenv.
The final image contains the application, reviewed CUET JSON snapshots, and
Alembic configuration/migrations. It excludes development tools, tests, local
virtualenvs, caches, agent instruction files, and environment files. Code is
root-owned so the non-root service cannot modify it.

Prepare an ignored runtime environment file; never supply secrets as build
arguments or copy them into a Dockerfile:

```powershell
Copy-Item .env .env.docker
```

Edit `.env.docker` before running. Set `APP_ENV=production` and retain your
configured JWT/OTP secrets and SMTP settings. For PostgreSQL running on this
Windows laptop, replace only the `localhost`/`127.0.0.1` host in `DATABASE_URL`
with `host.docker.internal`, retaining the database, port, username, and
password. Container `localhost` refers to the container itself. A future Compose
database will instead use its service name. Point `OLLAMA_BASE_URL` at a private
Ollama endpoint reachable from Docker (usually
`http://host.docker.internal:11434` on Docker Desktop); verify host network and
firewall access separately. Do not expose Ollama publicly.

Run the backend on the usual port:

```powershell
docker run --detach --name unicircle-backend --publish 127.0.0.1:8000:8000 --env-file .env.docker unicircle-backend:phase10.3
Invoke-RestMethod http://127.0.0.1:8000/health
docker inspect --format '{{.State.Health.Status}}' unicircle-backend
docker logs unicircle-backend
```

If port 8000 is occupied by your local backend, use
`--publish 127.0.0.1:8010:8000` and request port 8010 instead. The health response
is `{"data":{"status":"ok","service":"unicircle-api"}}`. Docker checks it
every 30 seconds, with a 20-second startup grace period. `/health` proves API
liveness only; it does not prove database, SMTP, or model-service readiness.
Production settings validation still runs on startup and refuses incomplete
security/SMTP configuration.

The default container command first probes PostgreSQL with authenticated
`SELECT 1` queries, retrying for `DATABASE_STARTUP_TIMEOUT_SECONDS` (default 60)
at `DATABASE_STARTUP_RETRY_SECONDS` intervals (default 2). Each connection attempt
has a short timeout. It exits unsuccessfully if the database remains unavailable
and never logs the URL/password or raw connection error. After readiness it
replaces the process with Uvicorn so graceful termination still works. This gate
does not apply migrations or check schema/model/SMTP readiness. Native `run.cmd`
behavior is unchanged. For a release command that needs the same readiness gate:

```powershell
docker run --rm --env-file .env.docker unicircle-backend:phase10.3 python -m app.db.wait
```

Apply migrations explicitly before serving a new revision, using the same image
and runtime configuration:

```powershell
docker run --rm --env-file .env.docker unicircle-backend:phase10.3 python -m alembic upgrade head
```

Existing seed, admin-provisioning, ingestion, and notification commands can also
run in this image by replacing the command after the image name. Migrations and
seeds are deliberately not executed automatically by each API container.
Uvicorn runs without development reload; its exec-form startup receives Docker
termination signals and shuts down gracefully.

To stop and remove just the API container:

```powershell
docker stop unicircle-backend
docker rm unicircle-backend
```

### Updating the dependency lock

Recompile when changing `pyproject.toml`, then rebuild and test. From the
repository root, use the same Linux/Python base and pinned pip-tools version:

```powershell
docker run --rm --mount "type=bind,source=$PWD/backend,target=/src" --workdir /src python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258 sh -c "python -m pip install pip-tools==7.6.1 && pip-compile --generate-hashes --strip-extras --no-emit-index-url --no-emit-trusted-host --output-file=requirements.lock pyproject.toml"
```

Add `--upgrade` to `pip-compile` for an intentional dependency refresh. Review
and commit the resulting lock, and update/test the base digest periodically to
receive OS/Python security fixes. See
[Docker's image-building guidance](https://docs.docker.com/build/building/best-practices/)
and [pip-tools' reproducibility guidance](https://pip-tools.readthedocs.io/en/stable/).
Local PostgreSQL is documented in [the Docker guide](../docs/docker/README.md).
Full Compose integration, ordered migrations and hardening are documented in
[the Docker guide](../docs/docker/README.md). Use `scripts/build_docker.ps1` for
commit-SHA/version tags instead of the older phase-specific smoke tags above.

### Repeatable image smoke check

After building, run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/verify_docker.ps1 -Image unicircle-backend:phase10.3
```

This uses synthetic runtime settings and a temporary container on a random
loopback port. It checks missing-secret rejection, HTTP health, Docker health,
non-root/read-only execution, runtime dependencies, migration availability,
snapshot inclusion, environment/dev-file exclusion, and graceful shutdown. It
removes its own test container afterward and never accesses the real database,
sends email, or calls Ollama. An image smoke check does not replace the existing
feature integration suite or external-service connectivity testing.
The liveness-only check overrides the default command to avoid contacting a
database; `scripts/verify_postgres_docker.ps1` separately tests the default gated
startup against a real, isolated PostgreSQL container.

## Continuous integration (Phase 11)

GitHub Actions now runs Ruff lint/format checks, validates the curated knowledge
files, runs the complete unit/API suite, applies Alembic to disposable PostgreSQL
and runs PostgreSQL-specific HTTP integration tests. Docker builds are checked
after both frontend and backend jobs succeed. See the
[CI guide](../.github/workflows/README.md) for commands, reports, branch policy
and security boundaries. Test tools are pinned in `requirements-ci.txt`.

PostgreSQL tests use `CI_TEST_DATABASE_URL` only, require a disposable database
named `unicircle_ci`, and migrate/drop their own randomly generated schemas.
They skip when that variable is absent; they never reuse the normal application
database. SMTP is faked and no real CUET user, email or model server is involved.
