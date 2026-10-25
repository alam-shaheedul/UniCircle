# UniCircle — Project Context for AI Agents

> **Purpose of this file**
>
> This document provides the persistent project context an AI coding agent should read before making architectural, frontend, backend, database, testing, Docker, CI/CD, or deployment changes to **UniCircle**.
>
> The goal is to keep AI-assisted development consistent with the approved project proposal, the detailed project workflow, and the team's implementation strategy.
>
> **Important:** Do not treat this file as permission to implement the whole system at once. UniCircle is being developed step by step for learning and understanding.

---

# 1. Project Identity

**Project Name:** UniCircle

**Project Type:** Software Engineering course project

**Project Domain:** University / campus information and community platform

**Primary Institution Context:** Chittagong University of Engineering & Technology (CUET)

**Main Goal:** Build a centralized campus platform where university members can access campus information, communicate, discover clubs and events, share/request resources, view transport information, participate in community discussions, receive official news and notifications, and ask campus-related questions through a RAG-based AI assistant.

The broader project vision is to reduce the problem of campus information being scattered across departmental websites, social-media pages, and unofficial communication channels.

---

# 2. Source-of-Truth Hierarchy

AI agents must use the following priority when interpreting project requirements.

## 2.1 Detailed Project Workflow

The **Project Workflow Description** is the primary source for current feature behavior and implementation requirements.

It defines:

- The current user/entity model.
- Registration and authentication behavior.
- Page-by-page feature behavior.
- Resource-request and chat workflow.
- Transport behavior.
- Community forum rules.
- News and announcement behavior.
- RAG assistant behavior.
- Admin-page responsibilities.
- Navbar and notification behavior.

If implementation details in older/broader documents are vague, prefer the detailed workflow.

## 2.2 Project Proposal

The **Software Engineering project proposal** is the source for:

- Overall problem statement.
- Overall objectives.
- Broad platform scope.
- Selected core technologies.
- RAG/LangChain/local Ollama direction.
- Agile development context.

## 2.3 Approved System Design

Once architecture diagrams, HLD, LLD, ERD, DFDs, API contracts, and other design documents are approved, those documents become the technical source of truth.

AI agents must not silently redesign approved architecture.

## 2.4 Feature TODO / Implementation Plan

Use the project implementation TODO plan as the execution sequence.

The current intended development order is:

```text
Project foundation
→ complete frontend feature-by-feature
→ backend foundation
→ backend feature-by-feature
→ connect each backend feature to frontend
→ complete testing
→ Dockerization
→ CI
→ CD
→ production deployment
→ monitoring/documentation
```

---

# 3. Current Scope Clarification

The original proposal contains broad feature ideas. The detailed workflow provides the current implementation behavior.

## 3.1 Active Features Defined in the Detailed Workflow

The active detailed workflow currently includes:

1. Authentication
2. Home Page
3. Department and Faculty Directory
4. Campus Explorer
5. Club and Event Hub
6. Resource Sharing Platform
7. User-to-user Chat after accepted resource request
8. Transport Section
9. Community Discussion Forum
10. Campus News and Announcements
11. Campus AI Assistant
12. Admin Page
13. Navbar / Navigation
14. Notifications

## 3.2 Attendance Scope Warning

The original proposal mentions an **Automated Attendance System** accessible from a teachers' panel.

However, the current detailed Project Workflow Description does **not** define the attendance feature or its behavior.

Therefore:

> **Do not implement or invent the attendance feature unless the team explicitly adds a detailed attendance requirement or approved design.**

If an AI agent encounters an older design or proposal reference to attendance, it should flag the discrepancy rather than invent an attendance algorithm.

---

# 4. User / Entity Model

The detailed workflow defines two high-level entity categories.

## 4.1 General User

A General User is a university member.

General User roles are:

- Student
- Teacher
- Staff

A General User registers for an account.

The selected role determines which university identifier must be supplied during registration.

Examples:

```text
Student → Student ID
Teacher → Teacher ID
Staff → Staff ID
```

All General Users use the normal application after authentication.

### Student Club Admin

A Club Admin is not a separate global account role. It is a registered General User
with the `student` role whose user ID is mapped to one or more clubs.

- One student may administer multiple clubs.
- One club may have multiple student admins.
- Club-admin permissions apply only to clubs mapped to that user ID.
- A club admin may update that club, manage its student admins, and add, edit, or
  remove that club's events.
- The backend must enforce club-admin authorization for every mutation.

## 4.2 App Admin

The App Admin manages the application and centrally controlled information.

The Admin:

- Does not use normal public registration.
- Acts as a privileged/superuser account.
- Uses special Admin credentials.
- Has access to Admin-only pages and APIs.
- Can manage transport information.
- Can manage campus news, updates, and announcements.
- Can moderate reported community posts.
- Can approve or reject student club-creation requests.
- Can manage other application information only where explicitly assigned by approved requirements/design.

Important:

> Hiding an Admin button in the frontend is not authorization. Every Admin backend operation must enforce Admin authorization server-side.

---

# 5. Technology Stack

The project uses the following primary stack.

## Frontend

- Next.js
- React
- TypeScript

## Backend

- FastAPI
- Python

## Database

- PostgreSQL

## ORM / Database Migrations

Expected project direction:

- SQLAlchemy
- Alembic

Use the versions and exact configuration selected by the project setup.

## Authentication

Detailed workflow specifies:

- JWT authentication
- Password-based login
- CUET email verification using OTP
- Python SMTP for sending OTP email

## AI / RAG

Project direction specifies:

- Gemma LLM model
- LangChain
- Retrieval-Augmented Generation (RAG)
- Campus/CUET knowledge base

The exact embedding model, vector database/store, retrieval strategy, chunking strategy, and ingestion process must follow the approved RAG design.

## DevOps

- Git
- GitHub
- Docker
- Docker Compose
- GitHub Actions

## Deployment

The proposal lists Vercel as one available cloud/deployment resource.

Do not assume the complete production provider topology until the deployment design is approved.

---

# 6. Architectural Direction

The project must remain:

- Modular
- Well structured
- Easy to understand
- Feature-oriented
- Testable
- Maintainable
- Suitable for step-by-step learning

The preferred backend direction is a **modular monolith**, unless the approved system architecture says otherwise.

Do not split the project into microservices simply because there are many features.

A single FastAPI application may contain clearly separated domain modules.

Example conceptual module boundaries:

```text
auth
users
home
directory
campus_explorer
clubs_events
resources
messaging
transport
forum
news
notifications
assistant
admin
```

These names are illustrative. Follow the actual approved repository structure.

---

# 7. Implementation Philosophy

The project is being built with AI assistance, but the developer wants to **learn and understand every step**.

AI agents should behave as:

- Teacher
- Reviewer
- Pair programmer
- Debugger

AI agents should avoid behaving as:

- Full-project autopilot
- Architecture replacement system
- Requirement inventor
- "Generate the entire feature without explanation" tool

When helping with implementation:

1. Work on the requested small task.
2. Explain the relevant concept.
3. Respect the existing architecture.
4. Keep changes scoped.
5. Explain why the code belongs in that layer/module.
6. Point out trade-offs.
7. Add or update tests when appropriate.
8. Avoid unrelated refactoring.
9. Never silently change feature requirements.

---

# 8. Required Development Order

The project intentionally uses an unusual but explicit implementation order.

## Stage A — Overall System Design

The complete system is designed before feature implementation.

Design artifacts can include:

- System Context Diagram
- Use Case Diagram
- High-Level Architecture
- HLD
- DFD Level 0
- DFD Level 1
- Required DFD Level 2 diagrams
- Complete ERD
- Database design
- API architecture
- Frontend architecture
- Sitemap
- Wireframes
- Sequence diagrams
- Authentication/authorization design
- RAG architecture
- Security design
- Docker architecture
- CI/CD architecture
- Deployment architecture

Do not redesign these during coding unless a real implementation discovery requires a documented design update.

## Stage B — Project Foundation

Create:

- Repository structure
- Git workflow
- Environment configuration
- Next.js foundation
- Shared frontend structure
- Mock service architecture

## Stage C — Complete Frontend First

All feature UIs are implemented feature-by-feature before the backend feature implementation begins.

Frontend development uses:

- Typed mock data
- Mock services
- Shared types/interfaces
- Loading states
- Error states
- Empty states
- Responsive UI
- Role-aware UI

Do not place arbitrary hard-coded mock values directly throughout page components.

Use a mock service/data layer that can later be replaced by real API services.

## Stage D — Backend + Integration

After the complete frontend is usable:

1. Build FastAPI foundation.
2. Configure PostgreSQL.
3. Configure SQLAlchemy/Alembic.
4. Implement each backend feature one at a time.
5. Replace that feature's frontend mock service with the real FastAPI API.
6. Test the complete feature.
7. Continue to the next feature.

## Stage E — Testing

Complete the systematic testing pass after all major integration is complete.

## Stage F — Dockerization

Dockerize the integrated application.

## Stage G — CI/CD

Create GitHub Actions workflows.

## Stage H — Production Deployment

Deploy the final tested system.

---

# 9. Frontend Feature Context

# 9.1 Shared Navbar

All major pages use a top Navbar/Navmenu.

It should allow users to navigate between pages.

It also contains a notification control.

The navigation shown should depend on the authenticated user's permissions where required.

---

# 9.2 Notifications

Notifications currently have at least these required sources:

- Event starts.
- Event finishes.
- New campus update/announcement.

The backend should eventually provide persisted/readable notifications according to approved design.

Users should only access their own notifications.

---

# 10. Feature 1 — Authentication

## 10.1 General User Registration

General Users register with required information including:

- Username
- CUET email
- Password
- Role
- Role-specific university ID

Role choices:

- Student
- Teacher
- Staff

The workflow requires **CUET email only**.

No non-CUET email should be accepted.

The approved email-domain rule accepts exactly `@cuet.ac.bd` and
`@student.cuet.ac.bd`. CUET student addresses can use the latter; reject
unlisted subdomains and lookalike domains. OTP delivery still proves control
of the supplied address before login.

## 10.2 OTP Email Verification

After registration:

1. Generate OTP.
2. Send OTP to the user's CUET email using Python SMTP/email service.
3. User enters OTP.
4. Server validates OTP.
5. Successful validation marks the account verified.

Implementation must include sensible security rules from the approved auth design, such as:

- OTP expiry
- Resend handling
- Avoid storing/logging sensitive OTP values insecurely
- Preventing login before verification if that is the finalized flow

## 10.3 General User Login

Registered/verified General Users log in using:

- Username or CUET email
- Password

JWT authentication is used.

## 10.4 Admin Login

The App Admin does not use General User registration.

Admin uses:

- Special Admin ID
- Admin password

Do not hard-code real production Admin credentials in committed source code.

---

# 11. Feature 2 — Home Page

The Home page is the public landing page. Before authentication it shows the current
CUET Home content with Login and Sign up as the application-entry actions; other
feature pages remain protected. After authentication, the same Home page is the first
main-app page and displays the authenticated Navbar.

The page should contain:

- A “Welcome to CUET Campus” message at the top.
- Basic CUET information.
- History / establishment information.
- Achievements.
- Facilities.
- Images.
- Videos.

Every authenticated General User can view this page.

Whether the content is static frontend content or database-managed content should follow the approved system design.

Do not add an unnecessary CMS unless requirements/design call for it.

---

# 12. Feature 3 — Department and Faculty Directory

The workflow specifies department tabs for:

- CSE
- EEE
- ME
- CE
- ETE
- BME
- MME
- MIE
- PME
- WRE
- Architecture
- URP

When a user selects a department, show:

- Department information/details.
- Teachers/faculty belonging to the department.
- Faculty contact details.

The backend/database design should preserve the relationship between departments and faculty.

---

# 13. Feature 4 — Campus Explorer

Campus Explorer shows:

- A demo campus map as an image.
- Important campus locations.
- Address/location information.
- Detailed descriptions.

Example locations from the workflow include:

- Gol Chottor
- TSC
- Basketball Ground
- Central Field
- Gymnasium
- Stores
- Halls
- Academic Buildings
- Research Centres

The user should be able to:

- Scroll through locations.
- Select/tap a location.
- View detailed information.

This is not real-time location tracking.

The proposal explicitly excludes real-time location tracking from scope.

---

# 14. Feature 5 — Club and Event Hub

## 14.1 Clubs

Users can browse different clubs.

Club administration is a many-to-many relationship between registered student user
IDs and clubs:

- One student may administer multiple clubs.
- One club may have multiple student admins.
- A mapped club admin may update club details, add another registered student as an
  admin, or remove an admin while preserving at least one admin.
- Any registered student may submit a new-club request with the proposed club details,
  planned activities, purpose, campus need, and expected impact.
- The App Admin reviews each request. Approval creates the public club and maps the
  requester as its initial club admin; rejection does not create a club.

Club details may contain:

- Club information.
- Member information.
- Activities.
- Ongoing events.
- Upcoming events.
- Recently finished events.

## 14.2 Events

There is also a separate event-focused section.

Users can browse upcoming/ongoing club events.

Users can indicate:

- Interested
- Going

Only mapped admins of the event's club may create, update, or delete that event.

A club admin decides per event whether registration is enabled. When enabled, the
registration form collects the participant's name, CUET email, Student ID, department
name, and bKash transaction ID for a paid event. For a paid event, the configured fee
and bKash number appear above the form. The event UI shows the total number of
registrations. Event registration and Interested/Going remain separate states.

The exact state model should follow the approved ERD/API design.

## 14.3 Event Notifications

The workflow requires notifications when an event:

- Starts.
- Finishes.

The exact scheduling/background mechanism must come from the approved architecture.

Do not invent a random scheduler without checking project design.

---

# 15. Feature 6 — Resource Sharing Platform

This feature is based on **user-to-user resource requests**.

The page shows a list of other users in a style conceptually similar to “people you may know”.

A user can request a resource from another user.

Examples from the workflow:

- Notebook
- Lab report
- T-scale
- Bicycle
- Similar resources

Typical request states:

- Pending
- Accepted
- Rejected

Exact schema/state transitions must follow approved LLD/API design.

---

# 16. Resource-Request Chat

When the receiving user accepts a resource request, the two users can chat regarding resource collection or related coordination.

Important terminology clarification:

The workflow says “End to end chat system”.

For implementation purposes, this means **chat between the two endpoint users** unless cryptographic end-to-end encryption is explicitly added as a separate approved requirement.

Do not claim the chat is cryptographically end-to-end encrypted unless the system actually implements and verifies E2EE.

Chat access should follow authorization rules.

A user must not be able to access unrelated users' conversations.

---

# 17. Feature 7 — Transport Section

The Transport page shows complete transport information.

A selected day's schedule should include data such as:

- Date
- Bus Name
- Bus Driver
- Bus Type
- Route information
- Schedule/time information

Bus types listed in the workflow:

- Student Bus
- Teacher Bus
- Staff Bus

## 17.1 Date Behavior

- One day's schedule is visible at a time/page/view.
- User can select another day.
- Past-day bus schedules should not be visible to normal users.

## 17.2 Bus Drivers

There is a separate “Bus Drivers” tab.

It shows:

- Driver name
- Contact number

## 17.3 Admin Transport Management

The Admin manages:

- Weekly/monthly schedule information.
- Route information.
- Bus-related information where required.
- Driver information.

General Users consume this data through the main Transport page.

---

# 18. Feature 8 — Community Discussion Forum

The forum is a CUET community discussion area.

## 18.1 Posts

Users can create text posts about:

- Community problems
- Help requests
- Discussions
- Other campus/community topics

Current constraints:

- Text only.
- No image posts.
- No video posts.
- No reaction system such as love/emoji reactions.

Do not add reactions or media upload unless requirements change.

## 18.2 Comments

Other users can comment on posts.

Comments are part of the required workflow.

## 18.3 Reporting / Moderation

A user can report a post to the Admin.

Admin can:

- View reported posts.
- Remove an inappropriate reported post.

Do not expose moderation actions to General Users.

---

# 19. Feature 9 — Campus News and Announcements

The page displays:

- Latest campus news.
- Updates.
- Announcements.

Items should appear in a serial/list format, normally newest first if consistent with the approved API design.

The Admin controls this information from the Admin Page.

Admin can provide/manage necessary news, updates, and announcements.

New updates and announcements should also generate notifications for users.

---

# 20. Feature 10 — Campus AI Assistant

The Campus AI Assistant is a chatbot built using **Retrieval-Augmented Generation (RAG)**.

Its purpose is to answer campus-related questions using a CUET knowledge base.

## 20.1 Knowledge Sources

Updated requirement (2026-10-08): maintain a reviewed, independently written
`CUET_Knowledge_Base.md` and its matching `.txt` companion under the backend
assistant module. These local files are the default runtime knowledge source.
Research may use:

- CUET main website.
- Related CUET websites/articles.
- Government institutional information, original ranking publishers, reliable
  dated reporting, and attributed campus maps for otherwise unavailable facts.

Every section records evidence URLs, its review date and a review-after date.
Unknown or conflicting facts are labelled; historical appointments and exact
map directions must not be invented. No indiscriminate website scrape enters
the curated index. Old web chunks remain stored but are not retrieved by default.

The approved system design should define exactly which sources are trusted/allowed.

Do not indiscriminately scrape or ingest arbitrary websites.

## 20.2 RAG Ingestion Flow

Conceptual flow:

```text
Reviewed local CUET Markdown/TXT (web crawling is explicit research opt-in)
→ load/extract text
→ clean/process
→ chunk
→ embed
→ vector storage
→ source metadata
```

## 20.3 RAG Query Flow

Conceptual flow:

```text
User question
→ validate/process
→ retrieve relevant knowledge chunks
→ construct context
→ call local Ollama/Qwen
→ generate grounded answer
→ return answer
```

Use source metadata internally for retrieval and auditing; do not display citations,
source cards, or source URLs with assistant answers.

## 20.4 RAG Safety/Quality Expectations

The assistant should:

- Answer campus-related questions from the knowledge base.
- Avoid pretending unsupported information exists.
- Handle “no relevant information found”.
- Handle Ollama/model-service failures.
- Keep the Ollama service private to the backend.
- Never expose the model service directly to browser/client code.

---

# 21. Special Feature — Admin Page

The Admin Page is visible only to App Admin.

It is the central management area for responsibilities explicitly assigned to Admin.

Required current areas include:

## Transport

- Manage schedules.
- Manage route information.
- Manage driver information.
- Maintain weekly/monthly transport data.

## News / Updates / Announcements

- Add.
- Edit where allowed.
- Remove where allowed.
- Publish/manage according to approved design.

## Community Moderation

- View reported posts.
- Remove reported posts where appropriate.

## Club Request Governance

- Review pending student club-creation requests.
- Approve a request to create the club and assign its requester as initial Club Admin.
- Reject a request without creating a club.
- Do not use the App Admin role for routine club or event editing; those mutations
  belong to mapped student Club Admins.

## Other Information

Only add other Admin capabilities if approved requirements or design documents assign them to Admin.

Do not create arbitrary CRUD panels for every database table.

---

# 22. API Design Expectations

Use RESTful FastAPI endpoints unless the approved design says otherwise.

Expected broad API groups may include:

```text
/api/v1/auth
/api/v1/users
/api/v1/home
/api/v1/departments
/api/v1/faculty
/api/v1/campus
/api/v1/clubs
/api/v1/events
/api/v1/resources
/api/v1/conversations
/api/v1/messages
/api/v1/transport
/api/v1/forum
/api/v1/news
/api/v1/notifications
/api/v1/assistant
/api/v1/admin
```

These paths are conceptual.

Follow the approved API specification if it exists.

For each endpoint consider:

- Actor
- Authentication
- Authorization
- Request schema
- Response schema
- Validation
- Status codes
- Business errors

Do not expose ORM models directly as unrestricted public API contracts.

---

# 23. Database Expectations

PostgreSQL is the primary relational database.

Database design should follow the approved ERD.

Expected conceptual areas include:

- Users / roles
- Departments
- Faculty
- Campus locations
- Clubs
- Club members
- Events
- User event status
- Resource requests
- Conversations
- Messages
- Buses
- Drivers
- Routes
- Transport schedules
- Forum posts
- Comments
- Reports
- News/announcements
- Notifications
- RAG source metadata where appropriate

Do not create tables simply from this list if the approved ERD models them differently.

Use:

- Primary keys
- Foreign keys
- Unique constraints
- Proper nullability
- Appropriate indexes
- Migrations

Schema changes should use Alembic migrations rather than manual production edits.

---

# 24. Frontend Expectations

The frontend should be:

- Modular by feature.
- Strongly typed.
- Responsive.
- Consistent.
- Accessible where practical.
- Prepared for loading/error/empty states.

Feature components should live with their feature when possible.

Shared components should contain only genuinely reusable UI.

Use a service layer for API communication.

Avoid:

- Fetch calls duplicated everywhere.
- Backend URLs hard-coded in page components.
- Mock data scattered inside UI components.
- Business authorization implemented only in frontend.

---

# 25. Authentication and Security Rules

AI agents must preserve these principles.

## Passwords

- Never store plaintext passwords.
- Use approved password hashing.
- Never log passwords.

## JWT

- JWT secret must be environment-based.
- Tokens must have appropriate expiry.
- Protected APIs must validate authentication.
- Authorization is separate from authentication.

## OTP

- Validate expiry.
- Prevent obvious resend abuse.
- Do not log OTP in production.
- Do not expose OTPs through APIs.

## Admin

- Admin registration is not public.
- Admin write endpoints require backend authorization.

## Secrets

Never commit:

```text
DATABASE_URL with production credentials
JWT_SECRET
SMTP_PASSWORD
OLLAMA remote credentials, if any
production admin password
cloud credentials
```

Use `.env.example` for variable names only.

---

# 26. Testing Expectations

Testing is required at multiple levels.

## Frontend

- Unit/component tests
- Form validation
- Role/permission-aware UI
- Important feature behavior

## Backend

- Unit tests
- Service/business-logic tests

## API

- Authentication tests
- Authorization tests
- Validation tests
- Success/error responses

## Database Integration

- Migrations
- Constraints
- Relationships
- Transactions

## Feature Integration

Test cross-layer flows such as:

```text
Registration → OTP → login → protected endpoint
```

```text
Resource request → acceptance → chat
```

```text
Forum post → report → Admin moderation
```

```text
Announcement publish → user notification
```

## End-to-End

Automate critical browser journeys.

## RAG Evaluation

Use a CUET-specific test dataset to evaluate:

- Correct retrieval.
- Grounded responses.
- Unsupported questions.
- No-context behavior.
- Source behavior where applicable.
- External API failures.

---

# 27. Docker Expectations

Dockerization happens near the final phase after functional integration/testing.

Expected services:

```text
frontend
backend
postgres
```

Add other infrastructure only if the approved architecture requires it.

Docker goals:

- Reproducible environment.
- Production-ready images.
- Runtime secrets.
- Health checks.
- Proper networking.
- Persistent development DB volume.
- No secrets copied into images.

Use Docker Compose for local multi-container execution.

---

# 28. CI/CD Expectations

CI/CD uses GitHub Actions.

## CI

Pull requests should eventually verify:

Frontend:

- Install
- Lint
- Type-check
- Tests
- Production build

Backend:

- Install
- Lint/format checks
- Unit tests
- Test database
- Migrations
- API/integration tests

Docker:

- Frontend image builds
- Backend image builds

## CD

Production deployment should happen only after CI succeeds.

Conceptual flow:

```text
main/tag
→ CI
→ build production artifact/image
→ deploy
→ apply controlled DB migration
→ health check
→ smoke test
```

Never deploy automatically after failed tests.

---

# 29. Production Expectations

Production design should account for:

- Frontend hosting
- Backend/container hosting
- PostgreSQL
- RAG/vector storage
- Media/file storage if needed
- HTTPS
- Environment secrets
- Domain/DNS if used
- Logging
- Monitoring
- Database backup

Do not assume production uses the development Docker Compose PostgreSQL container.

A managed PostgreSQL service is preferable when the deployment design chooses one.

---

# 30. Git / Team Workflow

Use small feature branches and pull requests.

Example:

```text
feature/auth-frontend
feature/directory-frontend
feature/auth-backend
feature/directory-backend
fix/otp-expiry
```

A normal change flow:

```text
Issue/task
→ feature branch
→ implementation
→ tests
→ commit
→ push
→ pull request
→ CI
→ review
→ merge
```

Keep commits understandable.

Avoid combining unrelated features in one huge commit/PR.

---

# 31. Definition of Done

A backend-connected feature should not be considered complete until:

- Requirement is implemented.
- Approved design is followed.
- Database migration exists if required.
- Schemas/models are correct.
- Business logic is in the appropriate layer.
- API works.
- Authentication is enforced where required.
- Authorization is enforced where required.
- Validation exists.
- Error cases are handled.
- Tests pass.
- Frontend mock is replaced.
- Frontend loading/error/empty states work against real API.
- Integration is tested.
- Documentation is updated.
- CI passes.

---

# 32. Rules for AI Coding Agents

Before changing code, the AI agent should:

1. Read this file.
2. Read the relevant approved design/LLD.
3. Read the implementation TODO for the current phase.
4. Inspect existing code structure.
5. Make the smallest change that satisfies the requested task.
6. Preserve existing conventions.

AI agents **must not**:

- Rebuild the architecture without being asked.
- Introduce microservices without approval.
- Add new major libraries without explaining why.
- Change database schema without a migration.
- Invent requirements.
- Add features that are not in scope.
- Remove security checks to simplify implementation.
- Put business authorization only in frontend.
- Expose backend secrets to Next.js/browser.
- Call Ollama directly from frontend.
- Store plaintext passwords.
- Hard-code real credentials.
- Implement the whole project when asked for one step.
- Perform large unrelated refactors.
- Rename public APIs/modules casually.
- Claim cryptographic E2EE exists unless actually designed and implemented.
- Implement Automated Attendance until requirements are explicitly restored/defined.

---

# 33. How AI Should Respond During Development

When asked to help implement a feature, prefer this pattern:

```text
1. Identify the current task.
2. Explain where it fits in the architecture.
3. State which files/layers are relevant.
4. Explain the concept briefly.
5. Make or suggest the scoped change.
6. Explain important lines/decisions.
7. Add/update tests.
8. Mention any design decision that requires team confirmation.
```

When reviewing code:

- Identify correctness issues.
- Identify architectural violations.
- Identify security problems.
- Identify missing validation.
- Identify missing tests.
- Explain why each issue matters.
- Do not rewrite unrelated code.

When debugging:

1. Explain the root cause.
2. Identify the smallest fix.
3. Explain why the fix works.
4. Mention regression tests when useful.

---

# 34. Questions That Require Clarification Instead of Guessing

An AI agent should not invent answers when the project documents have not defined something important.

Examples currently requiring approved design/requirements if encountered:

- Exact Admin provisioning method.
- Exact JWT storage strategy in the browser.
- Access-token/refresh-token design.
- Exact chat realtime mechanism (WebSocket vs polling/other).
- Whether chat requires cryptographic E2EE.
- Event notification scheduler/background mechanism.
- Exact vector database/store.
- Exact embedding model.
- Exact RAG crawling/ingestion schedule.
- Exact trusted CUET source list.
- Whether Home content is static or Admin-managed.
- Whether directory/campus explorer content is Admin-managed.
- Production hosting providers.
- Automated Attendance behavior.

If a decision is already present in approved design documents, follow that decision instead of asking again.

---

# 35. Non-Goals / Out-of-Scope Items

From the original proposal, the platform excludes:

- Course registration.
- Examination management.
- Online payment systems.
- Real-time location tracking.

Do not introduce these systems.

The current detailed workflow also does not define:

- Social-media-style reactions.
- Image/video forum posts.
- Public Admin registration.

Do not add them unless requirements are changed.

---

# 36. One-Sentence Project Summary

> **UniCircle is a modular CUET campus information and community web platform built with Next.js, FastAPI, PostgreSQL, Docker, GitHub Actions, and a RAG-based local Ollama/Qwen campus assistant, developed through complete system design followed by frontend-first feature implementation, backend integration, testing, containerization, CI/CD, and production deployment.**

---

# 37. Quick Context for a New AI Session

If an AI agent only has time to read one short section, use this:

```text
Project: UniCircle, a CUET campus information/community platform.

Users:
- General User: Student / Teacher / Staff
- App Admin: privileged superuser, no public registration

Frontend:
- Next.js + TypeScript

Backend:
- FastAPI + Python

Database:
- PostgreSQL

Auth:
- General User registration
- CUET email only
- role-specific university ID
- OTP verification through Python SMTP
- JWT login
- separate Admin credentials

Features:
- Home
- Department/Faculty Directory
- Campus Explorer
- Clubs/Events
- Interested/Going event state
- Event notifications
- Resource requests between users
- Chat after resource request acceptance
- Transport schedules/routes/drivers
- Text-only Community Forum + comments + report-to-Admin
- News/updates/announcements + notifications
- RAG Campus AI Assistant
- Admin management page
- Global Navbar + notifications

Implementation order:
1. Complete system design
2. Project/frontend foundation
3. ALL frontend features using typed mock services
4. Backend foundation
5. Backend feature-by-feature + replace that frontend mock with real API
6. Full integration/testing
7. Docker
8. GitHub Actions CI/CD
9. Production deployment

Critical constraints:
- Modular, maintainable architecture
- AI should teach/review, not blindly generate the whole project
- Never invent requirements
- No real-time location
- No course registration/exam/payment
- Forum is text-only, comments only, no reactions
- Do not expose secrets
- Admin authorization must be server-side
- Ollama is backend-only
- Do NOT implement Automated Attendance unless detailed requirements are explicitly added
```
