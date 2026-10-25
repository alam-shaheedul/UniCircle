# UniCircle Docker setup — Phase 10

Run commands from the repository root with Docker Desktop in Linux-container
mode. Docker's data remains in the previously configured D-drive location.
`compose.yaml` runs the production frontend/backend images and PostgreSQL on
isolated networks, with a one-shot migration job before the API starts. This is
local integration and production preparation, not a production deployment.

## Start the complete stack from a clean clone

Docker Compose 2.24.4+ (or newer Docker Desktop) is required for the production
overlay's `!reset` tag. No host Python/Node installation is needed to build/run
the application images. From the repository root:

```powershell
Copy-Item .env.compose.example .env.compose
```

Only copy on first setup; do not overwrite an existing configured file. Edit
`.env.compose`: generate distinct random database/JWT/OTP secrets and supply valid
SMTP settings. You can reuse your configured SMTP provider, but never commit its
password. Use a URI-safe local database password or provide a URL-encoded
`DOCKER_DATABASE_URL` with host `postgres:5432`. Placeholders intentionally cannot
start the production API. Existing native `.env` files are not changed or copied
into images. Do not print expanded `docker compose config` containing secrets;
use `config --quiet` for validation.

Build with a committed source revision and start:

```powershell
$env:IMAGE_TAG = (git rev-parse --short=12 HEAD).Trim()
powershell -ExecutionPolicy Bypass -File scripts/build_docker.ps1
docker compose --env-file .env.compose up --detach --no-build --wait
docker compose --env-file .env.compose ps --all
```

Open `http://localhost:3000` (or the configured `FRONTEND_PORT`). Chromium/Edge
supports Secure cookies on HTTP loopback for local testing; deployed sessions
require HTTPS. Do not switch cookie security off for Docker. Backend and frontend
remain in production mode, with no development reload servers.

The shared app network connects frontend → `http://backend:8000`. A separate
internal database network connects backend/migrate → `postgres:5432`; the
frontend is not on that network. No backend host port is published. PostgreSQL
waits for health, `migrate` waits for authenticated readiness and applies Alembic
head, backend waits for successful migration, then frontend waits for backend
health. A failed migration prevents API startup. Migration history is kept in the
database. Back up a populated DB before upgrades; restarting is not a rollback.

This Docker DB is separate from the existing native application DB. Existing
accounts, club-admin mappings, messages, and RAG corpus are **not** imported
automatically. Register users against the new stack, or separately plan a
reviewed backup/restore. No default Admin password or test accounts are seeded by
normal startup. Campus starter content is explicitly seeded using existing CLIs:

```powershell
docker compose --env-file .env.compose exec backend python -m app.modules.directory.seed
docker compose --env-file .env.compose exec backend python -m app.modules.campus.seed
docker compose --env-file .env.compose exec backend python -m app.modules.transport.seed
docker compose --env-file .env.compose exec backend python -m app.modules.auth.provision_admin --admin-id YOUR_ADMIN_ID
```

After a verified student exists, select that student's UUID explicitly when
bootstrapping clubs:

```powershell
docker compose --env-file .env.compose exec backend python -m app.modules.clubs.seed --student-id STUDENT_UUID
```

Ollama stays in the existing E-drive host installation. The backend-only
`OLLAMA_BASE_URL` defaults to `http://host.docker.internal:11434` on Docker Desktop;
verify model-service/firewall reachability without exposing it publicly. Linux
hosts need an explicitly reachable private model endpoint. Do not move/download
models into app images.

The current host endpoint is reachable from Docker, but its `/api/tags` response
returned no models during this review. Confirm that your existing E-drive model
directory is used by the running Ollama process and that both configured model
tags appear in `ollama list` before testing live RAG. No model files or global
Ollama settings were changed by this phase.

The new DB needs explicit knowledge ingestion before grounded answers are available.
This now loads the bundled reviewed CUET Markdown/TXT corpus, not the website
crawler. Rebuild the backend image after corpus changes. Configured Qwen and
embedding models must be present; ingestion failure leaves any prior index intact:

```powershell
docker compose --env-file .env.compose exec backend python -m app.modules.assistant.ingest
```

The approved event-notification command can be scheduled externally with
`docker compose --env-file .env.compose exec -T backend python -m app.modules.clubs.notifications`.
No extra in-process scheduler or unnecessary infrastructure is introduced.

Inspect logs and API liveness without publishing the backend:

```powershell
docker compose --env-file .env.compose logs --tail 100 backend migrate frontend
docker compose --env-file .env.compose exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').status)"
```

Stop with `docker compose --env-file .env.compose down`; the database volume
survives. Never add `--volumes` for normal shutdown. To rebuild changed code,
commit it, build its new image tag, then recreate the stack with the same volume.
Uncommitted builds use a `-dirty` tag; they are not release images.

## PostgreSQL development environment

```powershell
Copy-Item .env.compose.example .env.compose
```

Edit the ignored `.env.compose` and replace `POSTGRES_PASSWORD` with a new random
password used **only for this local database**. Leave the distinct development
database/user defaults or set your own. The committed example is a placeholder,
not a working secret. Do not copy production database credentials into this file.
Then start the database:

```powershell
docker compose --env-file .env.compose up --detach --wait postgres
docker compose --env-file .env.compose ps
```

The service uses pinned PostgreSQL 16 Alpine, SCRAM host authentication, the named
`unicircle_postgres_data` volume, and `pg_isready` health checks. It publishes only
`127.0.0.1:55432`, so other machines cannot connect through that binding. Set
`POSTGRES_PORT` if that port is occupied. Existing host/project databases are not
changed. PostgreSQL-only startup leaves an empty database; full-stack startup
applies reviewed migrations, while feature seeds remain explicit.

Connection hosts depend on where the client runs:

| Client                                                   | Database host          | Port                         |
| -------------------------------------------------------- | ---------------------- | ---------------------------- |
| Backend running natively on this laptop                  | `127.0.0.1`            | `55432` (or `POSTGRES_PORT`) |
| Separate Docker Desktop backend using the published port | `host.docker.internal` | `55432`                      |
| Backend/migrate sharing the Compose database network     | `postgres`             | `5432`                       |

Use `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE` for the backend's
runtime `DATABASE_URL`, with the matching values from `.env.compose`. URL-encode
reserved characters in username/password. Do not set this URL in frontend
environment files. For a local-only random password without URI delimiters:

```powershell
[guid]::NewGuid().ToString('N')
```

The backend container's default startup waits for an authenticated database
query before starting Uvicorn, with bounded retries and safe logs. Configure
`DATABASE_STARTUP_TIMEOUT_SECONDS` and `DATABASE_STARTUP_RETRY_SECONDS` at runtime
if needed. A standalone `python -m app.db.wait` command is available in the image.
Database readiness does not replace schema migrations. Compose
backend dependency wiring uses `condition: service_healthy`, following
[Docker's startup-order guidance](https://docs.docker.com/compose/how-tos/startup-order/).

Stop the database while preserving its data:

```powershell
docker compose --env-file .env.compose down
```

Normal shutdown/removal preserves the named volume. Do not add `--volumes`
unless you explicitly intend to erase this local database. Changing the initial
username/password/database environment values does not modify an already
initialized volume; use PostgreSQL administration to change credentials.
The development database account is not a production account. Production needs
separate runtime secrets, permissions, backups, and a reviewed hosting topology.

## Images and repeatable verification

```powershell
$env:IMAGE_TAG = (git rev-parse --short=12 HEAD).Trim()
powershell -ExecutionPolicy Bypass -File scripts/build_docker.ps1
powershell -ExecutionPolicy Bypass -File backend/scripts/verify_docker.ps1 -Image "unicircle-backend:$env:IMAGE_TAG"
powershell -ExecutionPolicy Bypass -File scripts/verify_postgres_docker.ps1 -BackendImage "unicircle-backend:$env:IMAGE_TAG"
```

The PostgreSQL check uses a unique temporary Compose project, random test
credentials, and a random loopback port. It verifies database health, rejected
bad passwords, named-volume persistence after container recreation, backend
waiting while PostgreSQL is stopped, recovery when it starts, and graceful API
shutdown. It removes only its own test containers/network/volume in `finally`,
then restores process environment values. Real project data is never used.

Frontend runtime and desktop/mobile browser-check commands are in
[frontend/README.md](../../frontend/README.md); backend runtime, readiness,
migration, and seed commands are in [backend/README.md](../../backend/README.md).

## Compose flow verification

After building images, install local frontend dev dependencies (`npm ci` in
`frontend/`, supported Node 20.19+ or 22) and run:

```powershell
node frontend/scripts/verify_compose.mjs IMAGE_TAG
```

This creates a random, isolated Compose project and a new DB named
`unicircle_compose_smoke`. It runs actual production images and migrations,
then inserts synthetic verified accounts with a fixture that refuses any other
database or a database already containing accounts. No auth dependencies are
overridden. The test-only `compose.test.yaml` overlay mounts a capture-only SMTP
fixture with a temporary trusted certificate, TLS and authentication. It checks
real registration, received OTP verification, rejection before verification,
browser login/cookies, scoped club/event actions,
registration/interest/membership, resources and private chat, forum moderation,
news and notifications, transport management, desktop/mobile pages, persistence
after app recreation, logout, and graceful shutdown. The fixture is not shipped
in images. Test containers, networks, and the temporary DB volume are removed
in `finally`; normal project volumes remain untouched.

The suite never sends external email or calls your model. Temporary test-only
mail/certificate artifacts and screenshots stay under ignored `tmp/`. The
existing auth/OTP and RAG tests cover their contracts/failures; actual provider
delivery, populated-corpus ingestion and model reachability need separate
environment acceptance checks. The Docker suite verifies the empty-index
assistant fallback, not model inference quality. Never load `compose.test.yaml`
with the normal stack or a populated database.

An optional third argument tests another checkout with the existing installed
test tooling: `node frontend/scripts/verify_compose.mjs IMAGE_TAG ABSOLUTE_CLONE_PATH`.
The checkout must contain the committed Compose files and fixtures; no native
environment files, database data, or virtual environment are needed in it.

## Production preparation and security review

Both app images use digest-pinned bases, locked production dependencies,
root-owned application files, non-root accounts, and exec-form startup. Frontend
runtime excludes npm/npx, Corepack, Yarn, development dependencies and host
environment files. A pinned available Debian patch is applied during its build;
the Python base was refreshed to the patched immutable digest. Version/revision
OCI labels and commit-SHA/release tags identify the source. Keep base digests,
lockfiles and scanner data under review; pinning does not mean vulnerability-free.

Compose runs frontend, backend, migrations **and PostgreSQL** as non-root,
with read-only roots, dropped capabilities, no-new-privileges and bounded PIDs.
Only PostgreSQL's data volume is persistent/writable; `/tmp`, its socket directory,
and frontend image cache are bounded tmpfs mounts. The pinned Alpine PostgreSQL
image uses UID/GID 70. Verify ownership before attaching externally created or
restored data; never solve permission errors by deleting a populated volume.
App logs go to stdout/stderr; rotated Docker logs are limited to 3 × 10 MB per
container. `init: true` forwards signals for the app containers, with 30-second
shutdown grace. Next.js and Uvicorn may exit 143 after SIGTERM cleanup when
running under init (or 0); the API must log completed application shutdown.
Liveness does not prove SMTP, RAG or every schema invariant.

The preparation overlay removes the PostgreSQL host port and requires a reviewed
image tag. Supply **separate production credentials**, an HTTPS frontend URL and
a private model endpoint; use the hosting provider's secret management and
review backup/restore, resource limits and network policy before deployment:

```powershell
docker compose --env-file .env.production -f compose.yaml -f compose.production.yaml up --detach --no-build --wait
```

`.env.production` is ignored; the command is documentation, not an automatic
deployment. The frontend remains loopback-bound, intended for a reviewed HTTPS
reverse proxy/ingress. Production hosting, managed database, TLS and CI/CD are
later phases, not silently selected here.

Run the release security gate:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/scan_docker.ps1 -Version IMAGE_TAG
```

The scanner is pinned to an immutable [Trivy 0.75.0 release](https://github.com/aquasecurity/trivy/releases/tag/v0.75.0).
It scans exported image archives, not your Docker socket, secrets or DB volumes,
using [Trivy's archive-input support](https://trivy.dev/docs/dev/references/configuration/cli/trivy_image/).
Reports are retained under ignored `tmp/docker-security/reports/`; generated
archives are removed afterward. Scanner DB cache is a reusable Docker volume
under Docker Desktop's configured data location. High/critical findings fail the
gate, including unfixed findings; nothing is automatically suppressed.
See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for current findings and limitations.
