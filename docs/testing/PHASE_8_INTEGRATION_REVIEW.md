# Phase 8 cross-feature integration review

Review date: 29 September 2026

## Scope and result

The production frontend is connected exclusively through the typed API services in
`frontend/src/services/index.ts`. The obsolete `frontend/src/mocks` tree was removed.
ESLint now rejects imports from `@/mocks/**` or any `mocks` directory, and the
production build runs that source check through `prebuild`.

Backend integration tests use an isolated SQLAlchemy database and exercise the real
FastAPI routes, validation, authorization, persistence, and notification fan-out.
External delivery/generation boundaries use deterministic test doubles: the OTP test
mailer captures the delivered code, and the assistant test model returns a grounded
answer. Production SMTP and Ollama availability remain deployment concerns rather
than requirements for a repeatable integration suite.

## General-user journey evidence

| Journey | Verification evidence |
| --- | --- |
| Public Home exposes Login and Sign up; protected pages require a session | `HomeEntry`, authenticated layout/server-session guard, and production Next.js build |
| Register, receive OTP, verify, login, and logout | `test_registration_verification_login_logout_and_profile` and `test_student_subdomain_registration_otp_and_email_login` |
| Browse Home | Public and authenticated Home variants compile in the production route tree |
| Browse departments and faculty profiles | `test_directory_endpoints_and_validation`, CUET-profile success and fallback tests |
| Browse CUET campus locations | `test_seed_and_campus_endpoints` and CUET-boundary validation |
| Browse clubs and events | Club seed/list/detail tests and the production club/event route build |
| Submit a pending club request | `test_club_request_review_is_private_and_idempotent` verifies requester-only pending history |
| Approve a club; requester becomes initial admin | The club-review test verifies public visibility, one persisted club, and the initial `ClubAdmin` mapping |
| Add a second club admin; both can manage | `test_seed_and_admin_permissions` creates events as both mapped students and rejects an unrelated user |
| Create/register for free and paid events once; update totals | `test_paid_registration_and_event_notifications` verifies both payment modes, duplicate prevention, and totals |
| Set Interested/Going and receive lifecycle notifications | Event interest and exact start/end boundary tests |
| Request a resource, accept it, and chat | `test_acceptance_unlocks_chat_for_only_two_participants` verifies participant-only conversation access |
| Browse transport schedules and drivers | Transport snapshot, future-date boundary, PDF-driver, and assignment tests |
| Create, comment on, and report a forum post | Forum post/comment and report tests |
| Browse news and receive an announcement notification | Published-visibility and deduplicated notification tests |
| Ask the Campus AI Assistant | Authenticated assistant route and grounded-retrieval tests |

## App Admin journey evidence

| Journey | Verification evidence |
| --- | --- |
| Use the separate Admin login and access the Admin workspace | `test_admin_login_is_provisioned_and_separate`; frontend role gate in the authenticated feature route |
| Update transport schedules, routes, drivers, and buses | `test_only_admin_can_manage_schedules_drivers_routes_and_buses` |
| Publish news and notify eligible users | News CRUD, published visibility, fan-out, deduplication, and read-state tests |
| Review reports and remove an inappropriate forum post | `test_report_review_and_soft_post_removal` |
| Approve one club request and reject another | Club request test verifies only the approved club becomes public |
| Prevent General Users from accessing Admin APIs and page | `test_general_user_cannot_access_any_admin_workspace_api`; server and client Admin role gates |
| Audit sensitive Admin actions | `test_sensitive_admin_mutation_is_audited_and_audit_is_admin_only` plus feature mutation audit assertions |

## Repeatable verification

The built production server smoke check returned `200` for Home, Login, and Sign up;
the Home response contained the two account actions and the CUET welcome content.
An unauthenticated request to `/directory` returned a `307` redirect to `/login`.

From `backend`:

```powershell
.\.venv\Scripts\python -m pytest -p no:cacheprovider -q
.\.venv\Scripts\python -m ruff check app tests migrations
```

From `frontend`:

```powershell
npm run check
npm run build
```

The build command automatically executes `verify:production-sources` before Next.js
compilation.
