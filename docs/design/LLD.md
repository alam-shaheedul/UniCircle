# UniCircle low-level design (LLD)

Status: **planned Phase 7 contracts and invariants**. Authentication and
`PATCH /users/me` are implemented in migration `20260921_0002` and the FastAPI
auth/profile routers; other feature routes below remain proposed. The
[ERD](ERD.md) defines storage and the [HLD](HLD.md) defines runtime boundaries.

## Standard request path

```text
Browser → same-origin Next.js BFF → FastAPI router → Pydantic schema
        → current-user/session dependency → feature permission check
        → service transaction → repository/SQLAlchemy → PostgreSQL
        → response DTO → BFF → browser
```

FastAPI retains `/api/v1`. Successful JSON uses `{ "data": ... }`; errors use `{ "error": { "code", "message", "details"? } }`. List data uses `{ "items", "total", "limit", "offset" }` inside `data`, with bounded `limit` (currently 1–100). UUIDs are serialized as strings, datetimes as UTC ISO 8601, and money as integer minor units. Use `201` for created resources, `204` for completed actions with no body, `400/422` for malformed requests, `401` for missing/invalid authentication, `403` for a known forbidden action, `404` for absent or deliberately concealed objects, `409` for uniqueness/state conflicts, `429` for throttling, and `503` for unavailable dependencies. Do not put user-entered secrets into error details.

The BFF uses allowlisted feature handlers or a strictly allowlisted gateway, never an unrestricted URL proxy. Server Components can call FastAPI server-to-server; interactive client components use same-origin BFF endpoints. Next.js `proxy.ts` may redirect optimistically, but each protected page's server data loader and each FastAPI endpoint must verify access. Server-side feature adapters replace mock services one module at a time. Next.js [authentication](https://nextjs.org/docs/app/guides/authentication) and [BFF](https://nextjs.org/docs/app/guides/backend-for-frontend) guidance inform this boundary.

## Authentication and profile module

### Data and service methods

`UserRepository` handles case-insensitive identifier lookup, uniqueness, account insertion, verification, and profile updates. `OtpStore` implements the existing atomic challenge protocol. `AuthSessionRepository` stores a digest of random JWT `jti`, expiry, and revocation. A `get_current_user` dependency verifies signature/claims, finds an active session, then loads the **current** active and verified user. `get_current_admin` checks current `role=admin`; `require_club_admin(club_id)` checks a student mapping in `CLUB_ADMIN` at mutation time. Neither permission is inferred from frontend state or token claims.

Registration validates CUET email, role (`student|teacher|staff`), role-specific university ID, names/address, username, and password. Insert the pending account with Argon2 hash in one transaction; database unique constraints resolve races after pre-checks. Issue an OTP with cryptographically random code, keyed digest, expiry, resend cooldown, and attempt limit. SMTP is an external side effect: commit the pending account first, persist challenge, send, and discard that challenge if delivery fails; the pending account can retry. Never return or log the code. OTP verification locks the challenge and user, consumes the challenge once, and sets `verified_at` atomically. Expired, consumed, or exhausted challenges cannot activate the account.

General login accepts username or CUET email and a password. Admin login accepts only the provisioned Admin ID/password. Return the same generic credential error for missing accounts, wrong password, inactive accounts, and unverified accounts; avoid account enumeration. Apply rate limits by account identifier and client network identity. On success, create a session row and JWT with the same random `jti`. The Next.js BFF sets a host-only HttpOnly cookie; it returns a safe user DTO, not the token, to client code. Version 1 has no refresh token; expiry requires login again. Logout revokes the session and clears the cookie. Only a restricted one-time CLI provisions an Admin; no default Admin account or public Admin registration exists. See the [authentication sequence](Sequence_Diagram.md#registration-verification-and-login).

The current frontend `SessionUser` assumes every account has CUET email, username, and university ID. The ERD allows an Admin without those General User fields, so integration must use a discriminated General-User/Admin session DTO (or separate admin DTO); do not fabricate values for an Admin.

### Planned endpoints

| FastAPI route | Access | Main effect/result |
| --- | --- | --- |
| `POST /auth/register` | Public, rate-limited | Pending General User, return email only; no login token |
| `POST /auth/verify-otp` | Public, rate-limited | Consume valid OTP and verify account |
| `POST /auth/resend-otp` | Public, rate-limited | Generic acknowledgement; resend only when eligible |
| `POST /auth/login` | Public, rate-limited | General User JWT/session for BFF only |
| `POST /auth/forgot-password` | Public, rate-limited | Generic recovery acknowledgement; eligible account receives an SMTP code |
| `POST /auth/password-reset/verify-otp` | Public, challenge-bound and rate-limited | Valid recovery code creates a short-lived reset grant for the BFF only |
| `POST /auth/password-reset/resend-otp` | Public, email-scoped and rate-limited | Generic recovery acknowledgement; BFF uses the email from its recovery cookie; SMTP cooldown applies |
| `POST /auth/reset-password` | Verified, single-use reset grant | Hash new password, revoke sessions, remove pending challenges atomically |
| `POST /auth/admin/login` | Public, rate-limited | Provisioned App Admin JWT/session for BFF only |
| `GET /auth/me` | Authenticated | Safe current-user DTO from live account |
| `POST /auth/logout` | Authenticated | Revoke current session |
| `PATCH /users/me` | Authenticated | Update allowed profile fields; no role/ID/verification edits |

## Feature module boundaries and routes

### Implemented recovery invariant (October 2026)

Normal sign-in is password-only; OTP entry follows **Create account** during
sign-up. Existing pending sign-up retries require the same email, username,
role/university ID and the correct password; no existing account data is replaced.
On mobile, OTP/recovery pages use the compact auth shell so the form, not the
decorative banner, occupies the initial viewport.

Password-reset codes use a purpose and private-challenge-bound HMAC distinct from
registration OTPs. The BFF injects an HttpOnly, signed recovery ticket for the
requested email and strips secret grants from responses. Codes obey configured
expiry, cooldown and attempt
limits. Verified recovery creates a separate `password_reset_grant` row whose
ID/digest is the SHA-256 hash of a random 256-bit token; it is not a login JWT.
The grant expires after ten minutes. Reset consumes it, updates the Argon2 password
hash, revokes every existing session, and deletes pending OTPs in one transaction
under the user-row lock. Both login and reset use that lock, preventing an
old-password login from creating a session after a concurrent reset. The existing
OTP/session schema is reused; migration state and current accounts are preserved.

Recovery tickets use a separate derived signing key, issuer/audience, expiry and
random nonce; they are not login tokens or reset grants. Known and unknown emails
get the same randomized ticket shape, including repeated requests during cooldown.
A ticket alone can neither sign in nor reset a password without a valid email code.

The table lists a compact API surface, not a promise to build all endpoints at once. All IDs are validated UUIDs; user IDs for owner-scoped actions come from the session, **not** request bodies. `U` means verified General User, `S` student, `C` mapped admin of the specified club, and `A` App Admin. Public Home is static and has no content API for now.

| Module | Proposed FastAPI routes | Access and response rule |
| --- | --- | --- |
| Directory | `GET /departments`, `GET /departments/{code}`, `GET /departments/{code}/faculty`, `GET /faculty/{id}`, `GET /faculty/{id}/profile` | U; 12 seeded department codes; profile details fetched from CUET on demand with a public-field allowlist and saved-listing fallback |
| Campus explorer | `GET /campus-locations`, `GET /campus-locations/{id}` | U; public asset/map references only |
| Clubs | `GET /clubs`, `GET /clubs/{id}`, `GET /clubs/{id}/events` | U; no private member/admin IDs in public list DTO |
| Club requests | `POST /club-requests`, `GET /club-requests/mine` | S; request owner from session |
| Club governance | `GET /admin/club-requests`, `POST /admin/club-requests/{id}/decision` | A; decision exactly once, transactional |
| Club management | `PATCH /clubs/{id}`, `GET/POST /clubs/{id}/admins`, `DELETE /clubs/{id}/admins/{user_id}` | C; target of admin addition must be a registered student; never remove final admin |
| Events | `GET /events?status=`, `GET /events/{id}`, `POST /clubs/{id}/events`, `PATCH /events/{id}`, `DELETE /events/{id}` | Reads U, writes C for event's club; status derived from time |
| Event participation | `PUT /events/{id}/interest`, `POST /events/{id}/registrations`, `GET /events/{id}/registrations/mine` | U for interest, S for registration; one row per user/event |
| Event registration review | `GET /clubs/{id}/events/{event_id}/registrations`, `PATCH /clubs/{id}/events/{event_id}/registrations/{registration_id}/payment` | C; private participant and bKash data |
| Resource discovery | `GET /users/discover`, `GET /resource-profile/me`, `PATCH /resource-profile/me` | U; no home address or private contact in discovery |
| Resource requests | `POST /resource-requests`, `GET /resource-requests/mine`, `POST /resource-requests/{id}/decision` | U; only recipient accepts/rejects; no self-request |
| Chat | `GET /conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages` | U and a participant in the accepted request; bounded history |
| Transport | `GET /transport/schedules?date=`, `GET /transport/schedules/{id}`, `GET /transport/drivers`, `GET /transport/routes` | U; reject or omit past schedules, depending on endpoint contract |
| Transport management | `POST /admin/transport/schedules`, `PATCH/DELETE /admin/transport/schedules/{id}`; corresponding `/buses`, `/drivers`, `/routes` | A; recurrence expands to dated schedules in a bounded series |
| Forum | `GET /forum/posts`, `POST /forum/posts`, `GET /forum/posts/{id}`, `GET/POST /forum/posts/{id}/comments`, `POST /forum/posts/{id}/reports` | U; text only, paginated feed, report once per user/post |
| Forum moderation | `GET /admin/forum/reports`, `POST /admin/forum/reports/{id}/decision` | A; soft-delete reported post or resolve report |
| News | `GET /news`, `GET /news/{id}` | U; published items only, newest first |
| News management | `POST /admin/news`, `PUT/DELETE /admin/news/{id}`, `PUT /admin/news/{id}/status` | A; update/announcement publication and notifications commit together |
| Notifications | `GET /notifications/me`, `PUT /notifications/{id}/read`, `PUT /notifications/read-all` | U; own rows only, unread/read timestamps |
| Admin audit | `GET /admin/audit-logs` | A; bounded/filterable append-only records; no secret or payment data |
| Assistant | `POST /assistant/questions` | U; bounded question and grounded answer/status; sources remain internal; rate-limited |

Implementation must define exact Pydantic request/response schemas before each route is added. Do not expose the mock-only aggregate snapshots directly: `ClubEventSnapshot`, `ResourceSharingSnapshot`, `ForumSnapshot`, `TransportSnapshot`, and `AdminSnapshot` currently bundle unrelated private and public data. The frontend service adapters should compose their screens from scoped, paginated real endpoints instead. The mock `mutualConnections` field has no data source and is omitted from the live resource-discovery DTO.

## State transitions and transaction boundaries

| State machine | Allowed transition | Transaction invariant |
| --- | --- | --- |
| Account | pending → verified; active → inactive | OTP single-use and `verified_at` change commit together; no login while pending/inactive |
| Club request | pending → approved or rejected | Lock pending row; approval creates one club and initial student admin atomically; retries return existing result |
| Club admin membership | add/remove | Validate student identity; lock club membership set and refuse removal of final admin |
| Event interest | none ↔ interested ↔ going | Upsert one `(event_id,user_id)` row; not a registration |
| Event registration | absent → submitted | Check future/open event, mode, student identity, uniqueness; paid submission starts `pending_review` |
| Paid registration | pending_review → confirmed or rejected | Only that club's admin may review; never infer payment from transaction ID alone |
| Resource request | pending → accepted or rejected | Only recipient decides; accept creates at most one conversation in the same transaction |
| Forum report | open → resolved or post_removed | Only App Admin; removal soft-deletes post and hides comments in reads |
| News | draft → published | Publish timestamp and recipient notifications commit together; only published news is visible |
| Notification | unread → read | Owner-scoped update; repeated mark-as-read is idempotent |
| Admin mutation | authorized request → committed change + audit | Audit row and sensitive change commit or roll back together |

Event `upcoming/ongoing/finished` is derived from UTC start/end times, not manually edited. `attendeeCount` counts Going interest rows; `registeredCount` counts submitted registrations, including paid submissions awaiting review. The external event worker locks eligible event rows and creates shared notification rows with unique `(recipient_id,dedupe_key)`, so retries do not duplicate user-visible notices. News publication and membership approval create their notifications inside the source transaction. No in-process development timer should be mistaken for durable production scheduling.

## Feature-specific implementation notes

- **Directory/Explorer:** seed the 12 approved departments and current known faculty/location content through idempotent development data. Do not manufacture missing phone/email values. Home stays static with CUET media assets unless the product owner later requests CMS management.
- **Clubs/Events:** public club DTOs include name, short name, category, tagline, activities, and event counts. Return `canManage` or an admin-specific view only after permission lookup. Convert the frontend's fee display to integer paisa at the API boundary. Free/paid event registration and Interest/Going are independent. The club request form must add campus need and expected impact to match the ERD.
- **Resources/Chat:** discovery exposes only opted-in resource-profile fields. Current mock's all-messages snapshot must become owner-scoped conversation pages. REST with refresh/polling is the initial chat transport; WebSocket/realtime is deferred until justified. No claim of cryptographic E2EE.
- **Transport:** keep a dated four-window schedule and route variants. Recurrent Admin input materializes a bounded date range with a shared series ID; edits/deletes must specify one occurrence or the whole future series. Reject double-booked bus/driver assignments. Public queries do not reveal past dates.
- **Forum/News:** text-only posts/comments. News categories are `news`, `update`, `announcement`; only published items enter the public list. Private report details stay in Admin APIs. Announcements/updates generate idempotent shared notifications.
- **Assistant/RAG:** crawl only explicitly allowlisted public CUET HTTPS hosts, extract HTML/PDF content with LangChain, and persist source metadata plus local `embeddinggemma:300m` vectors in PostgreSQL JSON. The bounded service ranks at most 10,000 chunks by cosine similarity, returns a no-context result below threshold, and asks local `qwen3:1.7b` for a grounded answer without visible source metadata. Retrieved text is untrusted data, never an instruction or source of API permissions. See the [source policy](RAG_Knowledge_Source_Policy.md) and [RAG sequence](Sequence_Diagram.md#campus-assistant-query).

## Verification gates for each feature

Review the ERD slice and migration, test constraints with PostgreSQL, test service transitions and forbidden access, generate/check OpenAPI, adapt the corresponding frontend service, then run its browser journey. Do not mark a feature complete because its mock screen already looks finished. The complete project testing phases remain in the [feature plan](../../UniCircle_Feature_Wise_Implementation_TODO.md).
