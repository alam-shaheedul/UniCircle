# Phase 12 — Continuous delivery

## Release strategy and target

Push or merge to **main** in `anindya357/UniCircle`. No release branch or tag is
required. The owner may continue the requested direct-main workflow; collaborators
still follow the repository's existing review policy. CI failures must be fixed,
not bypassed with Force Promote.

The only deployment target is Vercel project `unicircle-cuet`,
`prj_We7z2NYfOS1maoDam22nblXG81Bc`, team
`team_9ApVXPRdZiBsxFQpQ8C940G2`. The public URL is
https://unicircle-cuet.vercel.app. Database migrations target only Neon branch
`br-silent-violet-b4vx6g0j` in project `withered-rice-30785873`.

```text
reviewed migration + backup (if schema changes)
→ push main
→ GitHub CI + Vercel production build
→ required CI gate passes on that commit
→ Vercel assigns production domains to the built services
→ CD waits for that exact public commit
→ read-only production smoke tests
→ verified release / failure requiring operator investigation
```

Vercel keeps building natively rather than duplicating its Python optimization
and Services binding logic in a GitHub runner. Backend and frontend are one
Services deployment, promoted together. Artifacts/deployments are versioned by
Git SHA and retained on Vercel; CI also builds both Docker images with
`sha-<full-commit>` tags and OCI revision labels. Vercel does not consume those
Docker images, so registry publishing is **not applicable**. No registry or paid
service was provisioned.

## The release gate

A production-only GitHub-provider Deployment Check named **CI gate** is configured
on the Vercel project. It blocks `deployment-alias` until the identically named
GitHub Actions check succeeds on the deployment commit (timeout: 3600 seconds).
Automatic production domain assignment remains enabled. Settings are stored on
Vercel, not inferred merely from workflow YAML.

To recreate this if the project is replaced: Project Settings → Build and
Deployment → Deployment Checks → Add Checks → GitHub → **CI gate**, production
only. Ensure the GitHub integration is connected and automatic production domain
assignment is enabled. Do not use Force Promote to skip failing checks.

This gate does not run database migrations or live smoke tests. Live smoke tests
run **after promotion**; their failure does not automatically roll back the site.

## Secrets and permissions

Production DB/JWT/OTP/SMTP/Groq secrets remain in **Vercel production environment
secret management**. The database direct connection is available to the operator
only through the ignored root `.env` or `RELEASE_DATABASE_URL` in a protected
shell. Never paste password-bearing URLs into commands, YAML, GitHub issues or
logs. `.env`, `.vercel` auth/cache files and backups are excluded from Git/upload.

`cd.yml` needs no production secret, Vercel token, bypass token or database key.
Its GitHub token has only `contents: read` and is passed exclusively to the fixed
GitHub API to verify the current `main` SHA. Public requests do not carry that
token, user cookies or application credentials. Actions are pinned to immutable
SHAs; checkout does not persist credentials. No PR/fork event can start this job.
If moving deployment into Actions later, configure a reviewed `production`
environment with main-only branches/reviewer protection and scoped secrets first;
do not copy the local CLI login token into GitHub.

## Controlled migrations

Do **not** migrate at server startup, during a Vercel build, or in parallel
frontend/backend jobs. Routine releases without migration changes do not write
to the database. Run this read-only preflight from `backend` before release:

```powershell
.\.venv\Scripts\python -m app.db.release
```

It reads the ignored direct Neon URL, verifies the exact host/database/TLS and
Neon branch identity, and compares the existing revision to the single code head.
It refuses pooled/wrong endpoints, unexpected connection options and missing or
unknown revisions. It never seeds, restores, deletes or updates user records.

For a schema change, before pushing the code that depends on it:

1. Run CI migration/integration tests using the disposable database. Review the
   migration for backward compatibility with the currently live application.
2. Create a fresh, recoverable Neon snapshot/branch or encrypted database backup;
   verify restoration and record its reference privately. The script requires an
   operator attestation/reference; it does not create or verify this backup.
3. Review exact current and target Alembic revisions, then explicitly apply:

```powershell
.\.venv\Scripts\python -m app.db.release --apply --confirm-branch br-silent-violet-b4vx6g0j --from-revision <reviewed-current> --to-revision <reviewed-head> --backup-reference <verified-backup-reference> --expand-only-confirmed
```

4. Rerun preflight, then push `main`. The apply command takes a cooperative
   PostgreSQL advisory lock, validates operator confirmations and verifies the
   resulting head. All release operators must use this entry point; arbitrary
   Alembic/SQL commands do not honor that lock. No automatic downgrade exists.

Use expand/contract migrations: first add compatible structures, then deploy
compatible code, and only remove old structures in a later separately reviewed
maintenance operation. Breaking migrations require a maintenance plan; they
must not use the `--expand-only-confirmed` release path. CI/Vercel checks cannot
replace the operator's pre-release migration review.

Initial preflight verified revision `e42a7b1c9d50` against the same code head;
no migration was applied and existing Neon records were preserved.

## Automated health and smoke checks

`CD` starts only when a successful **push-to-main CI run** completes in this
repository. It checks out that exact SHA, then polls the public `/api/health`
until it reports the same revision. An old healthy deployment cannot pass for
new code. Superseded commits are reported as skipped; unavailable releases time
out and fail. Jobs are serialized and are not abruptly cancelled mid-check.

Read-only checks cover:

- Backend liveness through the private frontend service binding.
- Home, login, registration and the separate admin login returning HTML.
- Anonymous access to authenticated routes redirecting to same-origin login.
- The served revision remaining unchanged during the checks.

The endpoint exposes only status and validated public Git SHA, not connection
details. It is **not** a database readiness, authenticated workflow, OTP delivery,
model-answer or browser-layout test. Those still require the manual checks in
the deployment README. Smoke checks never create users, send emails, mutate
production records or call the LLM. Tests exercise failure cases offline in CI.
Inspect Actions → CD and the Vercel deployment status for each release.

## Rollback and recovery

1. Record the failed and last known-good deployment URLs/IDs and commits. Select
   a previously verified **production** deployment of this same project, not a
   preview deployment. Inspect errors without exporting tokens or personal data.
2. Confirm the old application is compatible with the current Neon schema.
   Code rollback does not reverse migrations, user edits or registrations.
3. From the linked root, inspect the target, then roll back deliberately:

```powershell
npx --no-install vercel project inspect --scope anindya-majumders-projects --non-interactive
npx --no-install vercel rollback <known-good-production-url> --scope anindya-majumders-projects --non-interactive
```

For rollback verification, explicitly run the read-only assertions without the
latest-main filter (the normal CLI skips a SHA older than main):

```powershell
node --input-type=module -e "import {runChecks} from './scripts/release_smoke.mjs'; await runChecks('<known-good-full-sha>'); console.log('Rollback smoke checks passed')"
```

Deployments created before the revision endpoint cannot pass commit-specific
checks. Inspect their trusted Vercel metadata and verify health/pages separately;
never fabricate a revision to satisfy the check.

4. Re-test the existing user's login and important authenticated workflows.
   If a data restore is needed, obtain explicit approval and restore into a
   separate Neon branch first; never blindly overwrite live user records.
5. Vercel rollback disables automatic production assignment. After the fix passes
   CI, stage a **production** build (`--prod --skip-domain`), check that build with
   `vercel curl`, and explicitly promote that verified build to resume automatic
   assignment. Do not promote a preview/rebuilt artifact or bypass failed checks.

Rollback is documented, not executed against the live site merely to test CD.
The pipeline never upgrades account plans or provisions paid infrastructure.
