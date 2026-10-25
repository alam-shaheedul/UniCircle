# Deployment documentation

UniCircle uses Neon PostgreSQL and one Vercel Services project containing the
Next.js frontend and FastAPI backend. The backend has no public rewrite; frontend
server routes call it through the generated `BACKEND_API_URL` service binding.
Browser requests remain same-origin, retaining session cookies and CSRF checks.
Services is currently beta. This setup does not provision paid integrations or
require an Ollama process on the developer's laptop.

## Database and secrets

The existing database was copied to the user-selected Neon branch with a
transactional restore, then verified against every table's row count and content
fingerprint. A local ignored backup is retained. Production `DATABASE_URL` uses
the matching Neon pooled endpoint, TLS and the `postgresql+psycopg` driver.
Do not rerun a restore over this database. Apply future Alembic migrations as a
controlled release step, not at function startup.

Configure production environment variables in Vercel. `DATABASE_URL`,
`JWT_SECRET`, `OTP_PEPPER`, `SMTP_PASSWORD` and `GROQ_API_KEY` are Secret variables.
Set `APP_ENV=production`, the canonical HTTPS `FRONTEND_URL`, JWT/OTP settings,
SMTP host/port/TLS/user/sender and `RAG_CHAT_PROVIDER=groq`. No secret uses a
`NEXT_PUBLIC_` name. Never upload `.env`, backups or CLI authentication files;
`.vercelignore` explicitly excludes these.

## Cloud assistant

Set `RAG_EMBEDDING_PROVIDER=fastembed`,
`FASTEMBED_MODEL=BAAI/bge-small-en-v1.5` and `RAG_KNOWLEDGE_MODE=curated`.
Install the backend's `cloud` extra. The build runs
`python -m app.modules.assistant.prepare_model`, downloading the small CPU ONNX
model into the function bundle and verifying offline loading. Production requests
load only the bundled files, without Hugging Face downloads or Ollama calls.
Groq generates answers using the configured Qwen model and server-only key.
The model artifact hash is checked during builds to prevent silent changes to
the embedding space used by the existing Neon index.

Index the reviewed MD/TXT knowledge using the same model against Neon before
release: `python -m app.modules.assistant.ingest`. Cloud vectors use a separate
source prefix, preserving the existing local Ollama index. Changing embedding
models requires reindexing; queries never mix incompatible vectors. Respect
knowledge review expiry dates and provider free-tier rate limits.

## Release and rollback

Phase 12's automated main-branch release gate, smoke workflow and controlled
migration/rollback commands are documented in [the CD runbook](CD.md).
The manual staged-release steps below remain an operator recovery procedure;
normal main pushes now wait for the required Vercel **CI gate** check.

Use Node 24 on Vercel and Python 3.12 for the backend. Keep the project root at the
repository root; `vercel.json` defines each service's directory and private binding.

1. Verify CLI account, team, project, production variables and Git revision.
2. Run backend lint/tests and frontend type/lint/tests.
3. Deploy with `vercel deploy --prod --skip-domain`.
4. Test the deployment URL with `vercel curl`: `/`, `/login`, `/api/health`,
   protected-route redirects and authentication API responses.
5. Promote that same production deployment with `vercel promote <deployment-url>`.
6. Verify the public production URL, existing-user login, OTP delivery, feature
   data, admin permissions and an assistant answer. Do not mark manual checks done
   merely because the build succeeds.

`/api/health` checks frontend-to-backend liveness without exposing configuration.
It is not a database readiness or SMTP test. Inspect runtime logs for failures;
never paste credentials, request bodies or personal records into logs/reports.
Rollback to a known-good deployment with `vercel rollback <deployment-url>`;
database migrations and data changes need their own compatible rollback plan.
Configure Neon restore retention and regular backups separately; the initial
local archive is not an ongoing production backup policy.

## Initial release verification — 12 October 2026

Production: https://unicircle-cuet.vercel.app (project `unicircle-cuet`). The
GitHub repository is connected for subsequent deployments from `main`.
The production deployment was staged, tested, then promoted without changing its
build. The optimized FastAPI bundle is approximately 120 MB.

Verified: 164 backend tests, 24 frontend tests, frontend type/lint checks, backend
lint/format checks, offline embedding loading, separate Neon cloud indexing and
four retrieval topics, and a Groq answer using Neon context. Public browser checks
confirmed home/login rendering, ten registration inputs, private-service health,
the correct nonexistent-user login rejection, protected assistant redirect and no
JavaScript runtime errors. The welcome text and local campus imagery render.

Still requires manual checks: successful existing-user/admin login, OTP email
delivery, authenticated feature workflows and a deployed assistant conversation.
The initial mobile clipping issue was fixed in a subsequent responsive-layout
update: shared containers now fit the viewport, banners/typography are compact,
and the welcome message, images and introductory video are preserved. Browser
regression checks cover 320, 390, 768 and 1366 CSS-pixel widths, public account
screens, authenticated pages, club details, mobile navigation and admin panels.
Authenticated layout checks use only the disposable local test fixture, not
production credentials or records. See `frontend/tests/e2e/responsive-layout.spec.ts`.
Preview environment secrets/database isolation and an ongoing backup policy also
remain to be configured. Do not use the production database for automated tests.

