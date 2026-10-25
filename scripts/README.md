# Scripts

This directory is reserved for repeatable project setup, quality, migration, and
maintenance scripts. Phase 9 commands are documented in
[`docs/testing/PHASE_9_TESTING.md`](../docs/testing/PHASE_9_TESTING.md); the
backend also exposes the short `backend\test` command.

`verify_postgres_docker.ps1` checks the local Docker PostgreSQL configuration,
data persistence, authentication, and delayed backend startup using an isolated
temporary project. See [the Docker guide](../docs/docker/README.md).

## Docker integration and security

- `build_docker.ps1`: build both images with commit-SHA/version tags and OCI
  revision labels; uncommitted builds are explicitly tagged `-dirty`.
- `docker_smoke_fixture.py`: inserts synthetic users/campus content only in a
  fresh `unicircle_compose_smoke` test DB; piped to the isolated backend, never
  included in an application image.
- `docker_smoke_smtp.py` / `compose.test.yaml`: capture-only TLS/authenticated
  SMTP fixture for actual registration and OTP verification in that test DB.
  Never use this overlay with the normal or production stack.
- `../frontend/scripts/verify_compose.mjs`: production-image browser/BFF/API/PG
  journeys, permissions, migrations, persistence, and scoped cleanup.
- `scan_docker.ps1 -Version IMAGE_TAG`: digest-pinned image vulnerability scan;
  fail on high/critical findings, retain ignored JSON reports, remove only the
  generated archive exports. No Docker socket or real secrets are mounted.

See [the Docker guide](../docs/docker/README.md) for commands and external-service
limitations. These scripts do not implement Phase 11 CI or deploy the project.
