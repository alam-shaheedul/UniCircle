# Continuous integration

[`ci.yml`](ci.yml) runs on pull requests targeting `main`, pushes to `main`,
and manual **Actions → CI → Run workflow** requests. Superseded runs for the
same branch/PR are cancelled. CI itself never deploys. Phase 12 uses Vercel's
Git integration with a required **CI gate** Deployment Check and
[`cd.yml`](cd.yml) for post-promotion, commit-specific production smoke checks.
See [the release runbook](../../docs/deployment/CD.md).

| Check | What must pass |
| --- | --- |
| Frontend checks | Locked npm install, ESLint (zero warnings), TypeScript, release-harness tests, Vitest unit/component tests, Next.js production build |
| Backend checks | Hash-locked runtime install, pinned test tools, Ruff lint/format, knowledge-base validation, all unit/in-process API tests, Alembic upgrade, PostgreSQL HTTP/API tests |
| Docker (backend/frontend) | Both production Dockerfiles build, runtime user is non-root; backend includes valid curated knowledge files |
| CI gate | All of the above succeeded; failure, cancellation or skipped prerequisites cannot pass |

## Database and external services

The backend job creates a disposable PostgreSQL 16 service named `unicircle_ci`.
Its published credentials are test-only, not application credentials. Integration
tests explicitly require `CI_TEST_DATABASE_URL`, migrate a separate randomly
named schema for each test, and remove only that schema afterwards. The tests
exercise registration/OTP/login/logout/profile, student email domains, real JWT
authorization, news publication and persisted notifications. Every HTTP request
uses a fresh database session. Existing feature tests additionally cover the
other modules with isolated SQLite databases and fake external services.

SMTP and LLM calls are faked; CI does not send email, crawl CUET, download model
weights, access the development database or need a running Ollama server.
Without `CI_TEST_DATABASE_URL`, PostgreSQL-specific tests skip locally. If it
is supplied but wrong or unreachable, they fail rather than silently falling
back to a different database.

## Reports and troubleshooting

Open the failing job in [Actions](https://github.com/anindya357/UniCircle/actions).
JUnit XML reports are uploaded as `frontend-tests` and `backend-tests`, including
when a test fails, and kept for seven days. Build output stays in job logs;
images are neither pushed to a registry nor deployed.

Reproduce frontend checks from `frontend`:

```powershell
npm ci
npm run lint -- --max-warnings=0
npm run typecheck
npm run test:unit
npm run build
```

Reproduce backend checks from `backend` using the project's Python 3.12 venv:

```powershell
.\.venv\Scripts\python -m pip install -r requirements-ci.txt
.\.venv\Scripts\ruff check app tests scripts
.\.venv\Scripts\ruff format --check app tests scripts
.\.venv\Scripts\python -m app.modules.assistant.ingest --check
.\.venv\Scripts\python -m pytest -m 'not integration' --strict-markers
```

To run PostgreSQL tests, explicitly set `CI_TEST_DATABASE_URL` to a **disposable**
local PostgreSQL database named `unicircle_ci`, then run
`python -m pytest -m integration --strict-markers`. Never use the project's real
database or production credentials for this purpose.

## Main branch policy and security

Protect `main` with the stable **CI gate** check, require the branch to be
up-to-date, require one approving review and dismiss stale approvals. Preserve
the repository owner's existing administrator bypass for the requested direct
`main` workflow; contributors' PR merges require review and passing CI. Admin
bypass means an owner can still push directly before CI finishes, so a green
run on the pushed commit is required by Vercel before assigning the production
domain. Direct pushes do not bypass that Vercel check.

Actions use immutable commit pins, checkout does not persist Git credentials,
and the workflow grants only `contents: read`. No repository/environment
secrets are referenced. Untrusted code runs using `pull_request`, never
`pull_request_target`, and cannot deploy or publish images. Docker build-cache
writes are enabled only on pushes to the trusted `main` branch. Dependency and
image security scans and coverage reports remain optional future additions;
existing Phase 10 security-review/deployment prerequisites are not bypassed.
