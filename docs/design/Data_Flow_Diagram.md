# UniCircle data flow diagrams (DFD)

Status: **logical design**, based on the [HLD](HLD.md), [LLD](LLD.md), and [ERD](ERD.md). Rounded nodes are processing functions, cylinders are persistent stores, and rectangles are external people/systems. Arrows label data, not authorization grants. The browser-to-Next.js BFF hop is inside the UniCircle boundary; FastAPI is the final data-authorization boundary.

## Level 0 — context

```mermaid
flowchart LR
    Visitor[Visitor] -->|public page request, registration or login form| System([UniCircle web application])
    Member[General User] -->|feature queries, posts, requests, event forms, questions| System
    AppAdmin[App Admin] -->|transport, news, club decisions, moderation| System
    ClubAdmin[Student Club Admin] -->|club and event changes| System
    System -->|public Home, auth result| Visitor
    System -->|scoped pages, status, notifications, answers| Member
    System -->|review queues and action results| AppAdmin
    System -->|own-club data and registration review| ClubAdmin
    System -->|OTP email request| SMTP[SMTP provider]
    Sources[Approved CUET sites] -->|published campus text and metadata| System
    System -->|bounded question plus retrieved evidence| Ollama[Private Ollama / Qwen3]
    Ollama -->|candidate answer| System
```

No user password, OTP, JWT, private chat, registration record, or bKash transaction ID is placed in a model prompt. The SMTP provider receives only the verification recipient, code, and basic email content. The frontend never sends a user-supplied role, owner ID, or club-admin flag as authority.

## Level 1 — primary processes and data stores

```mermaid
flowchart LR
    User[General User] -->|account forms| Auth([1. Auth and profile])
    User -->|browse query| Campus([2. Campus reads])
    User -->|club, event, request data| Clubs([3. Clubs and events])
    User -->|resource, chat, forum data| Community([4. Community])
    User -->|questions, notification actions| Assist([7. Assistant and notifications])
    Admin[App Admin] -->|review and publication commands| AdminWork([5. Admin operations])
    ClubAdmin[Student Club Admin] -->|own-club management| Clubs
    Worker[Scheduled worker] -->|event time and outbox claims| Delivery([6. Delivery jobs])
    Site[Approved CUET sites] -->|allowlisted pages| Ingest([8. Source ingestion])

    Auth <-->|accounts, OTP digests, session state| D1[(D1 Identity)]
    Campus <-->|departments, faculty, locations, transport| D2[(D2 Campus, transport, news)]
    Clubs <-->|clubs, events, registrations| D3[(D3 Clubs and events)]
    Community <-->|requests, messages, posts, reports| D4[(D4 Community)]
    AdminWork <-->|transport, news, reviews| D2
    AdminWork <-->|club decisions| D3
    AdminWork <-->|moderation| D4
    AdminWork -->|published update or announcement| D5[(D5 Outbox and notifications)]
    D3 -->|event start and end times| Delivery
    Delivery <-->|pending jobs and delivered notices| D5
    Assist <-->|own notification rows and read marks| D5
    Assist <-->|approved sources and chunks| D6[(D6 RAG metadata and vector index)]
    Ingest -->|source metadata and approved chunks| D6

    Auth -->|OTP delivery| Mail[SMTP]
    Assist -->|retrieved evidence and question| Model[Private Ollama / Qwen3]
    Model -->|candidate text| Assist

    Auth -->|auth result| User
    Campus -->|campus DTOs| User
    Clubs -->|public counts and own state| User
    Community -->|participant-scoped data| User
    Assist -->|notifications or grounded answer| User
```

`D1`–`D5` are logical areas of the same PostgreSQL database, not separate deployed databases. `D6` combines PostgreSQL source metadata with a vector index whose product is still unselected. The delivery worker is a planned process; current backend code has only a notification service foundation. Access to every store is mediated by services/repositories rather than direct browser queries.

## Level 2 — account registration and verification

```mermaid
flowchart LR
    Applicant[CUET applicant] -->|registration fields| BFF([Next.js auth adapter])
    BFF -->|validated payload| Register([Register pending account])
    Register -->|hash and save| Users[(User records)]
    Register -->|email and purpose| Issue([Issue OTP])
    Issue -->|keyed digest, expiry, attempts| Challenges[(OTP challenge)]
    Issue -->|code and recipient| SMTP[SMTP]
    Applicant -->|email and received code| BFF
    BFF -->|verification payload| Verify([Check and consume OTP])
    Verify <-->|locked challenge| Challenges
    Verify -->|verified timestamp| Users
    BFF -->|username/email and password| Login([Authenticate and create session])
    Login <-->|current user and password hash| Users
    Login -->|jti digest and expiry| Sessions[(Auth sessions)]
    Login -->|short-lived JWT for server cookie| BFF
    BFF -->|safe session user, HttpOnly cookie| Applicant
```

The application does not send an access token after registration or OTP issuance. Password plaintext exists only in the inbound request long enough to verify/hash it. The OTP challenge stores a digest; the code is delivered by email only. OTP verification and `verified_at` update must be atomic. Login reads current account state and writes an active session. See the [authentication sequence](Sequence_Diagram.md#registration-verification-and-login) for ordering, retries, and failure branches.

## DFD balancing and privacy checks

- Level 1 inputs/outputs are subsets of Level 0: visitors/users/Admins provide forms and commands; UniCircle returns scoped views/results; SMTP and CUET sites are external collaborators, while Ollama is a private supporting service.
- The document [flow diagram](Document_Flow_Diagram.md) tracks individual forms and review records; it should not be read as a second database design.
- The notification list is owner-scoped, conversation data is participant-scoped, and event-registration rows are limited to the registrant and that club's admins. Data minimization belongs in response DTOs, not just frontend hiding.
- App Admin operations pass through FastAPI authorization even if an Admin-only page is hidden from General Users. No direct `D1`–`D6` browser access exists.
