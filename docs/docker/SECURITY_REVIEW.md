# Phase 10.5 Docker security review

Status: hardening and scan/review implemented; **production release is blocked**
by outstanding high/critical findings. No findings have been suppressed and no
risk acceptance is assumed. This is not a penetration test or deployment approval.

## Scan evidence

Trivy 0.75.0 is pinned by digest in `scripts/scan_docker.ps1`. The scanner receives
only exported image archives and a report directory, not Docker's socket,
credentials, environment files, or database volumes. It fails on all detected
high/critical findings, including those without available patches. Reports are
local ignored artifacts in `tmp/docker-security/reports/`; rerun before every
release because vulnerability data changes.

Clean-checkout images tagged `ba42f16abe59` (full source revision
`ba42f16abe59dc1a65cc17e62039ace5fe231b62`) were scanned on 7 October 2026 UTC.
Results match the earlier `phase10.5-dirty` verification build:

| Runtime image                  | High | Critical | Findings with a reported fix |
| ------------------------------ | ---: | -------: | ---------------------------: |
| UniCircle backend / Debian 12  |   53 |        2 |                            0 |
| UniCircle frontend / Debian 12 |   48 |        1 |                            0 |
| PostgreSQL 16 Alpine           |   21 |        1 |                           22 |

These are scanner package/finding counts, not confirmed exploitable application
paths. The scan reports no high/critical Python production-package findings,
no high/critical frontend Node-package findings, and no high/critical Alpine OS findings.
This does not establish that lower-severity vulnerabilities are absent.

Before available patches and runtime-tool removal, the backend/frontend scans
reported 63/67 high-or-critical findings. Changes:

- Refreshed the Python base to a patched immutable upstream digest, resolving
  available Perl/PCRE2 fixes without changing locked Python dependencies.
- Applied the available pinned Debian Perl patch in the Node runtime.
- Removed unused npm/npx, Corepack and Yarn from the frontend runtime.
- Updated the compatible production transitive dependency `source-map-js` to
  1.2.2. `npm audit --omit=dev` reports zero findings for the current lockfile.

## Outstanding findings and action

Backend/frontend remaining findings are in Debian packages with no fixed version
reported for the installed distribution at scan time. Critical examples are
`libsqlite3-0` CVE-2025-7458 (backend) and `zlib1g` CVE-2023-45853 (both images;
distribution status `will_not_fix`). No automatic exception is made for that
status. Refresh reviewed base images/packages when fixes are available, or assess
exact affected code paths and obtain explicit, documented risk acceptance.
Do not silently switch the application's OS/runtime or suppress scanner output.

PostgreSQL's 22 findings are in the Go standard library embedded in
`/usr/local/bin/gosu` (Go 1.24.6), including critical CVE-2025-68121. The pinned
official image did not contain a patched binary at review time. Compose starts
PostgreSQL as its non-root `postgres` account, bypassing the root-to-user `gosu`
entrypoint path, but the binary is still present and the scan still fails.
Use a reviewed patched upstream image/binary or document an approved exception
after a reachability assessment; the current mitigation is not risk acceptance.

The full host `npm audit` also reports nine development-tool findings (one
moderate, six high, two critical), involving the Vitest/mocker/tinypool and
Next.js ESLint transitive toolchains. These are not copied into the standalone
runtime. They still require a reviewed compatible tooling upgrade and test run;
do not expose dev/test servers publicly or apply breaking forced upgrades as
part of this Docker change.

## Applied controls and remaining deployment work

All application/migration/database containers run non-root with read-only roots,
dropped capabilities, no-new-privileges, bounded writable tmpfs and PID limits.
Database storage is a named volume. The frontend cannot join the internal DB
network; backend has no published host port. The production overlay removes the
DB host port. Runtime secrets are not built into images. Secure/HttpOnly cookies
remain enabled, and normal production-image startup rejects placeholder secrets.
The TLS test-mail trust certificate exists only in the isolated test overlay.

Logs use stdout/stderr with bounded Docker rotation; health/startup ordering and
graceful shutdown are tested. Commit-SHA/version tags and OCI revision labels
identify builds; an uncommitted build is tagged `-dirty`, never a release.

Before deployment, resolve or explicitly accept the scan gate; configure HTTPS,
separate production secrets and least-privilege DB accounts, reviewed CPU/memory
limits, ingress/network policy, database backups with restore testing, monitoring,
and external SMTP/Ollama acceptance. Hosting, CI/CD and production credentials
are later phases. No real deployment or risk acceptance was performed here.
