# UniCircle entity–relationship design

Status: project ERD, drafted 2026-09-20 from the [project context](../../UniCircle_AI_Project_Context.md) and [feature plan](../../UniCircle_Feature_Wise_Implementation_TODO.md). The project owner authorized creating the missing ERD. These are **logical tables and intended constraints**, not a claim that migrations already exist. Implement each area through reviewed Alembic migrations during Phase 7. See the [design index](README.md), [HLD](HLD.md), and [LLD](LLD.md) for runtime and API boundaries.

`USER` is shared across the diagrams. `PK`, `FK`, and `UK` mark primary, foreign, and unique keys. Nullable fields and multi-column constraints are specified below the diagrams; Mermaid does not express every PostgreSQL rule. IDs are UUIDs unless noted. All timestamps are timezone-aware UTC. Money is integer minor units (paisa), not floating point.

## Identity, clubs, and events

```mermaid
erDiagram
    USER ||--o{ AUTH_SESSION : opens
    USER ||--o{ OTP_CHALLENGE : receives
    USER ||--o{ CLUB_CREATION_REQUEST : submits
    USER ||--o{ CLUB_ADMIN : administers
    USER ||--o{ CLUB_MEMBER : joins
    USER ||--o{ CLUB_MEMBERSHIP_REQUEST : applies
    USER ||--o{ EVENT_INTEREST : chooses
    USER ||--o{ EVENT_REGISTRATION : registers
    CLUB_CREATION_REQUEST o|--o| CLUB : creates_if_approved
    CLUB ||--|{ CLUB_ADMIN : has
    CLUB ||--o{ CLUB_MEMBER : includes
    CLUB ||--o{ CLUB_MEMBERSHIP_REQUEST : receives
    CLUB ||--o{ EVENT : hosts
    EVENT ||--o{ EVENT_INTEREST : receives
    EVENT ||--o{ EVENT_REGISTRATION : receives

    USER {
        uuid id PK
        string username UK
        string admin_id UK
        string email UK
        string password_hash
        string role
        string university_id
        uuid department_id FK
        string first_name
        string last_name
        string home_address
        string department_name
        string phone
        string bio
        datetime verified_at
        boolean is_active
        datetime created_at
    }
    AUTH_SESSION {
        uuid id PK
        uuid user_id FK
        string jti_digest UK
        datetime issued_at
        datetime expires_at
        datetime revoked_at
    }
    AUTH_RATE_LIMIT {
        uuid id PK
        string scope
        string key_digest
        datetime window_started_at
        int attempt_count
    }
    OTP_CHALLENGE {
        uuid id PK
        uuid user_id FK
        string recipient_email
        string purpose
        string digest
        int attempts_remaining
        datetime issued_at
        datetime expires_at
        datetime consumed_at
    }
    CLUB_CREATION_REQUEST {
        uuid id PK
        uuid requester_user_id FK
        uuid reviewer_user_id FK
        string proposed_name
        string proposed_short_name
        string category
        string tagline
        string description
        string purpose
        string[] planned_activities
        string campus_need
        string expected_impact
        string status
        datetime reviewed_at
        datetime created_at
    }
    CLUB {
        uuid id PK
        uuid creation_request_id FK, UK
        string name UK
        string short_name UK
        string category
        string tagline
        string description
        string[] activities
        string contact_email
        boolean membership_recruitment_open
        int membership_fee
        string membership_bkash_number
        string membership_nagad_number
        datetime created_at
    }
    CLUB_ADMIN {
        uuid club_id PK, FK
        uuid user_id PK, FK
        uuid granted_by_user_id FK
        datetime granted_at
    }
    CLUB_MEMBER {
        uuid club_id PK, FK
        uuid user_id PK, FK
        datetime joined_at
    }
    CLUB_MEMBERSHIP_REQUEST {
        uuid id PK
        uuid club_id FK
        uuid user_id FK
        string applicant_name
        string email
        string student_id
        string department_name
        string phone
        string motivation
        string payment_method
        string transaction_id
        int fee
        string status
        uuid reviewer_id FK
        datetime reviewed_at
        datetime created_at
    }
    EVENT {
        uuid id PK
        uuid club_id FK
        string title
        string category
        string summary
        string description
        string location
        datetime starts_at
        datetime ends_at
        string registration_mode
        int fee_minor_units
        string bkash_number
        datetime deleted_at
    }
    EVENT_INTEREST {
        uuid user_id PK, FK
        uuid event_id PK, FK
        string status
        datetime updated_at
    }
    EVENT_REGISTRATION {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        string participant_name
        string email_snapshot
        string student_id_snapshot
        string department_name_snapshot
        string bkash_trxid
        string payment_status
        datetime created_at
    }
```

- `USER.role` is `student`, `teacher`, `staff`, or `admin`. Public registration accepts only the first three. General users require `username`, a canonical email at exactly `@cuet.ac.bd` or `@student.cuet.ac.bd`, names, home address, and `university_id`; Admin accounts instead require `admin_id` and are created only by a restricted provisioning command. `password_hash` is Argon2; no plaintext password column exists. `verified_at` is null until CUET email verification. Admin accounts are provisioned as verified. `is_active` gates all protected access. The existing `AuthIdentity.is_verified` is derived from `verified_at IS NOT NULL`.
- Uniqueness: case-insensitive `username`, canonical `email`, `admin_id`, and `(role, university_id)` for general users. Add `CHECK` constraints for role-dependent nullability and valid roles. Do not treat a client role or JWT role claim as authority.
- `OTP_CHALLENGE` has a unique `(recipient_email, purpose)` key for the current challenge. Store only a keyed digest, not the code. Issuance, cooldown, attempt decrement, expiry, consumption, and replacement must use a transaction/row lock. `AUTH_SESSION` stores a digest of the JWT `jti`, never the JWT itself; logout revokes the row. Every authenticated request verifies the JWT, the unrevoked session, and the current user record.
- `AUTH_RATE_LIMIT` keeps fixed-window counters keyed by a digest of action plus
  account identifier or network peer, rather than storing raw identifiers or IPs.
  Unique `(scope, key_digest)` prevents duplicate counters. The initial auth
  implementation is migration `20260921_0002`.
- `USER.department_name` temporarily holds the free-text department/unit field
  used by the existing profile editor. It is not a trusted academic affiliation;
  `department_id` can be added when the directory model is implemented.
- `CLUB_ADMIN` is a student-only many-to-many mapping, independent of global App Admin. A club must retain at least one admin; enforce this in a locked transaction when removing admins. Club-request approval locks the pending request, creates exactly one club and its initial admin, and records the reviewer atomically. Existing CUET clubs may have null `creation_request_id` and must be seeded with at least one admin before club management opens.
- Club short name, category, tagline, and activities are needed by the current frontend. A request must also capture purpose and the planned campus need/impact required by the workflow; the existing mock form will need those additional fields when connected.
- `CLUB_MEMBER` is optional general membership information, not a grant of management privileges. Do not infer club-admin status from it.
- Club membership recruitment starts closed. Opening it requires both bKash and Nagad numbers; `CLUB.membership_fee` is constrained to BDT 200. `CLUB_MEMBERSHIP_REQUEST` is unique on `(club_id, user_id)` and only accepts `pending` or `approved`. Approval atomically adds `CLUB_MEMBER`, records the reviewing Club Admin, and creates one unread shared `NOTIFICATION`. Pending request data and transaction IDs are private to mapped admins of that club.
- `EVENT.registration_mode` is `none`, `free`, or `paid`; paid events require positive `fee_minor_units` and `bkash_number`. Event state (`upcoming`, `ongoing`, `finished`) is derived from the current time and start/end timestamps. `EVENT_INTEREST.status` is `interested` or `going`, one row per `(user_id, event_id)`.
- Public `CLUB.memberCount` is derived from `CLUB_MEMBER`; `EVENT.attendeeCount` counts `going` interest rows and `EVENT.registeredCount` counts submitted registrations. A paid registration still counts as submitted while payment review is pending; the UI must not label that as confirmed payment.
- `EVENT_REGISTRATION` is student-only and unique on `(event_id, user_id)`. The form captures participant details as snapshots; validate the CUET email and compare student identity to the authenticated account. For paid events, require `bkash_trxid` but set `payment_status=pending_review` until a club admin verifies it. A submitted transaction ID is **not** proof of payment. Expose only the registration total publicly; restrict individual rows to that club's admins and authorized staff. Consider a partial unique index on `(event_id, bkash_trxid)` where the transaction ID is present.

## Directory, campus, and transport

```mermaid
erDiagram
    DEPARTMENT ||--o{ FACULTY : lists
    DEPARTMENT o|--o{ USER : optional_academic_unit
    BUS ||--o{ DRIVER : normally_assigned
    BUS ||--o{ TRANSPORT_SCHEDULE : runs
    DRIVER ||--o{ TRANSPORT_SCHEDULE : drives
    TRANSPORT_ROUTE ||--o{ TRANSPORT_SCHEDULE : follows

    DEPARTMENT {
        string code PK
        string name
        string description
        string address
        string office_email
        string phone
        string source_url
        integer sort_order
    }
    FACULTY {
        string id PK
        string department_code FK
        integer source_id
        string name
        string designation
        string email
        string phone
        string office
        string profile_url
        integer sort_order
    }
    CAMPUS_LOCATION {
        uuid id PK
        string name UK
        string short_name
        string category
        string address
        string description
        string details
        string map_url
        float map_x
        float map_y
        string image_ref
    }
    BUS {
        string id PK
        string name UK
        string bus_type
        string registration UK
        boolean is_active
    }
    DRIVER {
        uuid id PK
        integer source_row UK
        string name
        string phone UK
        string driver_class
        string assigned_bus_id FK
        boolean is_active
    }
    TRANSPORT_ROUTE {
        string id PK
        string name UK
        json outbound_stops
        json return_stops
        boolean is_active
    }
    TRANSPORT_SCHEDULE {
        uuid id PK
        date service_date
        time start_time
        time end_time
        string title
        string direction
        string origin
        string destination
        string route_id FK
        string bus_id FK
        uuid driver_id FK
        string recurrence
        date recurrence_until
        boolean is_active
    }
```

- Seed the 12 required departments, including both MME and WRE. A general user's department association is optional; staff or newly registered users need not claim an academic department. Faculty contact data is directory content, not automatically a login account; linking a faculty profile to a registered teacher is optional future work. The same CUET person can have entries in multiple departments, so `(department_code, source_id)` is unique rather than `source_id` alone. Missing faculty contact fields remain null rather than fabricated.
- Home-page content stays static unless Admin-managed content is explicitly requested. Campus images/video are asset references, not database blobs.
- One `TRANSPORT_SCHEDULE` row assigns one bus, driver, and route to a service window. Rows with matching date/time/title are grouped into one trip response for the frontend; unique `(service_date, start_time, bus_id)` prevents a duplicate bus allocation. `recurrence` supports `once`, `daily`, `weekly`, and `monthly`, with an optional end date, so Admin edits apply to the recurring template without materializing months of rows. Each driver has a normal bus allocation for the directory, while a schedule records the actual driver for that run. Route stop order is stored as reviewed outbound/return JSON arrays. General-user queries expand only current/future occurrences and reject past dates.

## Resource requests, chat, and community

```mermaid
erDiagram
    USER ||--o| RESOURCE_PROFILE : has
    RESOURCE_PROFILE ||--o{ RESOURCE_PROFILE_CATEGORY : offers
    USER ||--o{ RESOURCE_REQUEST : requests
    RESOURCE_REQUEST ||--o| CONVERSATION : opens_when_accepted
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ MESSAGE : sends
    USER ||--o{ FORUM_POST : authors
    FORUM_POST ||--o{ FORUM_COMMENT : receives
    USER ||--o{ FORUM_COMMENT : writes
    FORUM_POST ||--o{ FORUM_REPORT : receives
    USER ||--o{ FORUM_REPORT : files

    USER {
        uuid id PK
    }
    RESOURCE_PROFILE {
        uuid user_id PK, FK
        string level
        string hall
        string availability_note
        datetime updated_at
    }
    RESOURCE_PROFILE_CATEGORY {
        uuid user_id PK, FK
        string category PK
    }
    RESOURCE_REQUEST {
        uuid id PK
        uuid requester_user_id FK
        uuid recipient_user_id FK
        string category
        string resource_name
        string description
        string status
        datetime responded_at
        datetime created_at
    }
    CONVERSATION {
        uuid id PK
        uuid resource_request_id FK, UK
        datetime created_at
    }
    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        uuid sender_user_id FK
        string body
        datetime sent_at
    }
    FORUM_POST {
        uuid id PK
        uuid author_id FK
        string body
        datetime created_at
        datetime updated_at
        datetime removed_at
        uuid removed_by_user_id FK
    }
    FORUM_COMMENT {
        uuid id PK
        uuid post_id FK
        uuid author_id FK
        string body
        datetime created_at
        datetime updated_at
    }
    FORUM_REPORT {
        uuid id PK
        uuid post_id FK
        uuid reporter_id FK
        uuid reviewer_id FK
        string reason
        string status
        datetime resolved_at
        datetime created_at
        datetime updated_at
    }
```

- `RESOURCE_PROFILE` supplies optional discovery details and categories; private contact/address fields from `USER` are not returned in discovery. The mock `mutualConnections` number has no supported data source and must be removed from the live DTO rather than invented. `RESOURCE_REQUEST.status` is `pending`, `accepted`, or `rejected`, and requester/recipient must differ. `CONVERSATION.resource_request_id` is unique and can be created only for an accepted request. Only the two request participants may read or send messages. Chat is **not** claimed to be cryptographically end-to-end encrypted.
- Forum posts and comments contain text only. No reactions or media tables. Reports are unique per `(post_id, reporter_id)`; only App Admin may review them. Moderated posts use `removed_at` soft removal so reports and audit relationships remain intact; removed posts and their comments are hidden from General User feeds.

## News, notifications, and AI knowledge

```mermaid
erDiagram
    USER ||--o{ NEWS_ITEM : publishes
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ ADMIN_AUDIT_LOG : performs
    RAG_SOURCE ||--o{ RAG_CHUNK : contains
    USER ||--o{ RAG_QUERY_AUDIT : asks

    USER {
        uuid id PK
    }
    EVENT {
        uuid id PK
    }
    NEWS_ITEM {
        uuid id PK
        uuid author_id FK
        string kind
        string title
        string summary
        json content
        string audience
        string status
        datetime published_at
        datetime created_at
        datetime updated_at
    }
    NOTIFICATION {
        uuid id PK
        uuid recipient_id FK
        string type
        string title
        string message
        string related_object_type
        string related_object_id
        string href
        string dedupe_key
        datetime read_at
        datetime created_at
    }
    ADMIN_AUDIT_LOG {
        uuid id PK
        uuid actor_id FK
        string action
        string target_type
        string target_id
        json details
        datetime created_at
    }
    RAG_SOURCE {
        uuid id PK
        string url UK
        string title
        string content_type
        string content_hash
        string status
        datetime published_at
        datetime crawled_at
        string error_message
        json source_metadata
    }
    RAG_CHUNK {
        uuid id PK
        uuid source_id FK
        int chunk_index
        string content
        string content_hash
        json embedding
    }
    RAG_QUERY_AUDIT {
        uuid id PK
        uuid user_id FK
        string question_hash
        string status
        int source_count
        datetime created_at
    }
```

- Only App Admin can create or manage news. `NEWS_ITEM.status` is `draft` or `published`; only published items appear to General Users. `NOTIFICATION` is the consolidated owner-scoped inbox for event transitions, club membership approvals, and campus updates/announcements. Unique `(recipient_id, dedupe_key)` prevents duplicate delivery; the related-object pair is either fully populated or fully null. Publishing an **update or announcement** creates recipient rows in the same transaction; ordinary news does not notify everyone. Moving an item back to draft removes its corresponding notifications. Event start/finish detection remains separately scheduled and creates each transition only once. Migration `c31f2a9d8e40` backfills the earlier feature-owned notification rows without changing the frontend contract.
- `ADMIN_AUDIT_LOG` is append-only application data for successful sensitive App Admin mutations. It records the live Admin actor, stable action/target identifiers, safe structured metadata, and timestamp in the same transaction as the change. It never stores credentials, tokens, OTPs, payment transaction IDs, or full request bodies; only an App Admin may list it.
- `RAG_SOURCE` is restricted to approved CUET URLs. `RAG_CHUNK` has unique `(source_id, chunk_index)` and stores the selected local `embeddinggemma:300m` vector in PostgreSQL JSON for bounded cosine retrieval. `RAG_QUERY_AUDIT` stores no raw question or answer; its digest/outcome rows support per-user rate limits. No chat-transcript storage is required by the current AI-assistant workflow.

## Authentication and migration decisions

1. Backend issues short-lived HS256 access JWTs with `sub`, `iss`, `aud`, `iat`, `nbf`, `exp`, and random `jti`. The existing default is 30 minutes. `JWT_SECRET` is a server signing **key**, not a pre-made token; users must never paste a JWT into that variable. Use a distinct `OTP_PEPPER`. Both must be long random values supplied outside Git. JWTs contain no trusted role claim. [FastAPI's JWT guidance](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) notes that JWT payloads are signed, not encrypted.
2. Use a same-origin Next.js backend-for-frontend (BFF) for browser requests: the BFF sets an `HttpOnly`, `Secure` (production), `SameSite=Lax`, host-only cookie containing the access JWT; it sends the JWT to FastAPI as a Bearer token server-side. Do not put tokens in `localStorage` or `sessionStorage`. Check `Origin` and a CSRF token on state-changing cookie-authenticated requests; SameSite alone is not a CSRF solution. Browser JavaScript never reads the JWT. [OWASP's session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) supports these cookie and CSRF precautions.
3. Version 1 has no refresh token. On expiry, require login again. Login creates `AUTH_SESSION` with a digest of `jti`; protected requests require an unrevoked, unexpired session and the current active/verified user. Logout revokes that session and clears the cookie. Admin deactivation revokes all of that user's sessions. Session lookups add a database read; index `user_id`, `jti_digest`, and expiry. A future refresh-token design requires a separate review and migration.
4. A restricted one-time Admin provisioning command will accept Admin ID/password from a secure interactive prompt or temporary environment variables, hash the password, insert `USER.role=admin`, and remove the bootstrap secret from the environment afterward. Public registration can never set `admin`. Club-admin rights come only from `CLUB_ADMIN` membership. No default Admin credentials are seeded.
5. Review migrations in dependency order: `USER`/auth, directory/campus, clubs/events, transport, resources/chat, forum, news/notifications, then RAG metadata. Add constraints and indexes in the same migration as each table, with reversible downgrades where safe. Seed only non-secret development reference data. Never seed production passwords or OTPs.

These choices make Phase 7 implementation possible; API response shapes, rate limits, deployment origins, and the vector engine should still be verified as their corresponding features are built.
