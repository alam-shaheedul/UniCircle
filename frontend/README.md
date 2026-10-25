# UniCircle frontend

This directory contains the Next.js App Router frontend. It is TypeScript-first and organized by feature so UI, domain types, and feature-specific behavior stay together.

## Setup

Requires Node.js 20.19 or newer.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`.
Set `BACKEND_API_URL` in that local file to the server-side FastAPI origin.
Authentication requires the backend database migration, JWT/OTP secrets, and
working SMTP credentials. No JWT or password belongs in a `NEXT_PUBLIC_*` value.

## Commands

```bash
npm run dev          # local development server
npm run check        # formatting, lint, and type checking
npm run build        # production build
npm run format       # apply Prettier formatting
```

## Architecture

- `src/app` owns routes, layouts, and framework-level loading/error UI.
- `src/features` owns feature-specific components and types.
- `src/components/ui` contains genuinely reusable presentation primitives.
- `src/components/shared` contains application-wide composition components.
- `src/services/contracts` defines interfaces implemented by real authentication,
  club/event, directory, campus, resource/chat, transport, and forum adapters, plus
  mock services for remaining features.
- `src/mocks` contains typed mock repositories, services, and data for features
  not yet connected to their backend.
- `src/features/home/content` contains the reviewed static Home content; the
  public Home route reads it directly because it has no API or CMS.
- `src/config` owns public environment access and route constants.

Other route components call service interfaces through `src/services`; they do
not import mock data directly. The auth adapters call same-origin BFF handlers,
which keep tokens out of browser JavaScript.

The club and event pages use the FastAPI club/event endpoints through a
same-origin `/api/club-events/*` handler. The club workspace appears only for
students mapped as admins of that club; the backend independently enforces
authorization for all changes. Admins can edit club details, add/remove other
verified student admins by student ID, and create, edit, or delete club events.
The ten initial clubs are seeded by the backend, and new events appear here
only after a Club Admin creates them. Club Admins can also configure BDT 200
membership recruitment with bKash and Nagad accounts and review applications
on a dedicated page. Students see member, pending, closed, or application states
on each club page. The global notification UI combines live event, membership
approval, and published campus announcement/update notifications.

The Community Forum uses the authenticated FastAPI forum endpoints through the
same-origin `/api/forum/*` handler. Posts and comments are text-only. Reporting
state survives reloads, and the App Admin report queue uses the live moderation
API to dismiss reports or soft-remove posts from the General User feed.

## Production Docker image (Phase 10.2)

From the repository root:

```powershell
docker build --tag unicircle-frontend:phase10.2 ./frontend
docker run --detach --name unicircle-frontend --publish 127.0.0.1:3000:3000 --env BACKEND_API_URL=http://host.docker.internal:8000 unicircle-frontend:phase10.2
```

The image uses a digest-pinned Node.js 22 slim base, `npm ci`, and a three-stage
build. The runtime serves Next.js standalone output with `node server.js` as
the non-root `node` account, with campus media/public files and `.next/static`
copied separately. Development dependencies, tests, local environment files,
agent instructions, and build caches are excluded. Image optimization may write
to `.next/cache`; application code remains root-owned. `/` is the Docker liveness
check and remains available without a backend connection.

`BACKEND_API_URL` is a server-only runtime value. Docker Desktop uses
`host.docker.internal` for a host backend; Compose uses `http://backend:8000`.
Never pass database/JWT/SMTP secrets to this image. No public build
variables are currently required; `NEXT_PUBLIC_API_URL` is the unused legacy
placeholder and does not control authenticated BFF requests. Any future
`NEXT_PUBLIC_*` value is public and frozen during the build, so never use it for
secrets. Existing production Secure/HttpOnly cookie behavior is retained; use
HTTPS for deployed authenticated sessions.

To run the smoke test from `frontend/` after the container becomes healthy:

```powershell
node scripts/verify_docker.mjs http://127.0.0.1:3000 unicircle-frontend
```

It uses the installed Playwright/Edge tooling to check Home, campus images/video,
login, role-specific registration validation, protected-route redirects, layout
overflow, and browser errors on desktop/mobile. It also checks Docker health,
non-root execution, runtime file exclusions, and absence of baked runtime
credentials. Screenshots go to ignored `tmp/docker-frontend/`. This test does not
register real users or send email. Use `docker stop unicircle-frontend` followed
by `docker rm unicircle-frontend` to remove only the API-facing frontend container.
This Next.js version returns exit code 143 after graceful Docker SIGTERM cleanup;
that signal-based exit is expected, not an application crash.
See [the Docker guide](../docs/docker/README.md) for local PostgreSQL setup.

## Integrated Docker stack (Phases 10.4 and 10.5)

The full stack, ordered migrations, runtime secrets, private networking,
read-only/non-root hardening, versioned builds and vulnerability gate are covered
in [docs/docker/README.md](../docs/docker/README.md). For isolated production-image
browser/API/PostgreSQL journeys after a build, run from this directory:

```powershell
node scripts/verify_compose.mjs IMAGE_TAG
```

The test uses production images, a temporary database, synthetic users, and an
isolated TLS/authenticated SMTP capture fixture. It never sends external email
or calls your real model service, and removes only its own Docker resources.
