# UniCircle — Feature-wise Implementation TODO Plan

> **Basis:** This implementation plan follows the supplied **Project Workflow Description** and the agreed technology stack:
>
> - **Frontend:** Next.js + TypeScript
> - **Backend:** FastAPI
> - **Database:** PostgreSQL
> - **Containerization:** Docker + Docker Compose
> - **CI/CD:** GitHub Actions
> - **AI:** RAG-based Campus AI Assistant
>
> **Required implementation order:**  
> **Project foundation → complete frontend feature-by-feature → complete backend feature-by-feature and connect each feature to the frontend → testing → Dockerization → CI/CD → production deployment**
>
> **Scope note:** This checklist follows the workflow document as the implementation source of truth. It includes Authentication, Home, Department & Faculty Directory, Campus Explorer, Club & Event Hub, Resource Sharing + user-to-user chat, Transport, Community Forum, Campus News & Announcements, Campus AI Assistant, Admin Page, Navbar, and Notifications.

---

## 0. Master Implementation Strategy

Use this sequence for the whole project:

```text
1. Create repository and project structure
2. Configure coding standards and environment
3. Create frontend foundation
4. Implement ALL frontend features using mock data
5. Review complete frontend flow
6. Create backend foundation
7. Design/create database migrations
8. Implement backend feature-by-feature
9. Replace each frontend mock service with the real API
10. Complete cross-feature integration
11. Create and execute complete testing plan
12. Dockerize the application
13. Create CI pipeline
14. Create CD pipeline
15. Prepare production infrastructure
16. Deploy
17. Verify production system
18. Document final release
```

---

# PHASE 1 — Repository and Project Foundation

## 1.1 Create the GitHub repository

- [x] Create the project repository.
- [x] Add a meaningful repository description.
- [x] Add `.gitignore`.
- [x] Create `README.md`.
- [x] Create `.env.example`.
- [x] Protect sensitive values from Git.
- [x] Decide branch strategy.
- [x] Recommended branches:
  - [x] `main` — production-ready code.
  - [x] `develop` — intentionally deferred; the team does not need a long-lived integration branch yet.
  - [x] `feature/<feature-name>` — feature development.
  - [x] `fix/<issue-name>` — fixes.
- [x] Decide pull-request rules.
- [x] Require review before merging important branches.
- [x] Add issue templates if useful.
- [x] Add pull-request template with testing checklist.

---

## 1.2 Create top-level project structure

Create an initial structure similar to:

```text
unicircle/
├── frontend/
├── backend/
├── docs/
│   ├── design/
│   ├── api/
│   ├── testing/
│   └── deployment/
├── docker/
├── scripts/
├── .github/
│   └── workflows/
├── .env.example
├── .gitignore
├── compose.yaml
└── README.md
```

Tasks:

- [x] Create `frontend/`.
- [x] Create `backend/`.
- [x] Create `docs/`.
- [x] Create `docker/`.
- [x] Create `.github/workflows/`.
- [x] Add project setup instructions to `README.md`.
- [x] Prepare `docs/design/` for approved artifacts; no separate approved design files were provided in this workspace.

---

## 1.3 Define environment configuration

Create a clear separation between:

```text
Development
Testing
Production
```

Prepare placeholders for values such as:

```text
APP_ENV
FRONTEND_URL
BACKEND_URL
DATABASE_URL
JWT_SECRET
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
OLLAMA_BASE_URL
OLLAMA_CHAT_MODEL
OLLAMA_EMBEDDING_MODEL
```

Additional storage/vector-database variables can be added after the corresponding technology is finalized.

Tasks:

- [x] Create `.env.example`.
- [x] Never commit `.env`.
- [x] Document every environment variable.
- [x] Decide which variables belong to frontend.
- [x] Decide which variables belong only to backend.
- [x] Ensure secrets never become public Next.js environment variables.

---

# PHASE 2 — Frontend Foundation

> During the complete frontend phase, use **mock data and a mock service layer**.  
> Do not scatter hard-coded demo data directly through page components.

## 2.1 Initialize Next.js

- [x] Create the Next.js application.
- [x] Enable TypeScript.
- [x] Configure linting.
- [x] Configure formatting.
- [x] Define import aliases.
- [x] Create environment configuration.
- [x] Create the application route structure.
- [x] Create shared layouts.
- [x] Create a global error UI.
- [x] Create loading UI conventions.
- [x] Create empty-state conventions.
- [x] Create reusable form-error presentation.

---

## 2.2 Create a modular frontend structure

Use a structure based on project architecture, for example:

```text
frontend/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ui/
│   │   └── shared/
│   ├── features/
│   │   ├── auth/
│   │   ├── home/
│   │   ├── directory/
│   │   ├── campus-explorer/
│   │   ├── clubs-events/
│   │   ├── resources/
│   │   ├── chat/
│   │   ├── transport/
│   │   ├── forum/
│   │   ├── news/
│   │   ├── assistant/
│   │   ├── notifications/
│   │   └── admin/
│   ├── services/
│   ├── mocks/
│   ├── types/
│   ├── hooks/
│   ├── lib/
│   └── config/
└── ...
```

Tasks:

- [x] Keep feature-specific components inside their feature modules.
- [x] Keep truly reusable UI inside shared/UI folders.
- [x] Create TypeScript domain types.
- [x] Create a mock repository/service layer.
- [x] Make mock service interfaces similar to the expected future API service interfaces.
- [x] Avoid importing mock JSON directly inside page components.

---

# PHASE 3 — Shared Frontend Shell

## 3.1 Navbar

The workflow requires navigation across all pages and a notification button.

- [x] Create the top Navbar/Navmenu.
- [x] Add links for all General User pages.
- [x] Add user/profile area.
- [x] Add notification button.
- [x] Add active-route indication.
- [x] Add responsive/mobile navigation.
- [x] Hide Admin links from normal users.
- [x] Add logout control.
- [x] Prepare Navbar to consume authenticated-user data later.

### Frontend acceptance check

- [x] Every main page can be reached from navigation.
- [x] Navigation works on desktop.
- [x] Navigation works on mobile.
- [x] Admin-only navigation is visually separated.
- [x] Notification control is globally available after login.

---

## 3.2 Notification UI

Notifications will later support event state changes and campus announcements/updates.

- [x] Create notification dropdown/page.
- [x] Create notification item component.
- [x] Support unread/read visual state.
- [x] Support notification timestamp.
- [x] Support notification type.
- [x] Prepare mock event notifications.
- [x] Prepare mock campus-news/announcement notifications.
- [x] Add “mark as read” UI behavior using mock state.
- [x] Add empty notification state.

---

# PHASE 4 — FRONTEND FEATURE IMPLEMENTATION

# Feature 1 — Authentication Frontend

The workflow requires General User registration with CUET email, role selection, role-specific ID, OTP verification, normal-user login, and separate Admin credentials.
Accepted CUET mailbox domains are exactly `cuet.ac.bd` and `student.cuet.ac.bd`;
the second is used by student addresses. Other subdomains are not assumed valid.

## 4.1 Registration page

- [x] Create registration route/page.
- [x] Add username field.
- [x] Add CUET email field.
- [x] Add password field.
- [x] Add password confirmation field.
- [x] Add role selection:
  - [x] Student
  - [x] Teacher
  - [x] Staff
- [x] Dynamically show the required role-specific ID field:
  - [x] Student ID
  - [x] Teacher ID
  - [x] Staff ID
- [x] Validate required fields on frontend.
- [x] Validate CUET email format/domain according to the finalized requirement.
- [x] Add password validation feedback.
- [x] Add submit/loading state.
- [x] Add registration error state.
- [x] Mock successful registration response.

## 4.2 OTP verification page

- [x] Create OTP verification screen.
- [x] Show the verified email target.
- [x] Create OTP input.
- [x] Add submit state.
- [x] Add invalid OTP state.
- [x] Add expired OTP state.
- [x] Add resend OTP UI.
- [x] Add resend cooldown UI if required by final design.
- [x] Mock successful verification.
- [x] Navigate verified user to login or logged-in destination according to final auth flow.

## 4.3 Login page

### October 2026 authentication update

- [x] Open sign-up OTP immediately after a successful **Create account**, on mobile and desktop.
- [x] Keep mobile OTP/recovery headers compact, with numeric code entry and one-time-code autofill.
- [x] Show retry/resend code entry when account creation succeeds but SMTP delivery fails.
- [x] Resume the same pending registration safely after a lost response; never overwrite a registered account.
- [x] Keep normal sign-in password-only; registration OTP activates the account.
- [x] Add **Forgot password?** → email code → verified new-password form → return to sign-in.
- [x] Support new-password strength/confirmation validation and invalid-code feedback.
- [x] Verify the completed registration and recovery browser journeys at mobile and desktop widths (including 320px/390px/1366px reflow and refresh).

- [x] Create General User login.
- [x] Allow username or CUET email identifier.
- [x] Add password input.
- [x] Add validation errors.
- [x] Add invalid-credential state.
- [x] Add loading state.
- [x] Mock successful authentication.
- [x] Redirect successful General User login to Home.

## 4.4 Admin login UI

- [x] Decide whether Admin uses the same login screen or a dedicated route according to the approved design.
- [x] Support Admin ID.
- [x] Support Admin password.
- [x] Mock Admin session.
- [x] Redirect Admin to Admin Page.
- [x] Prevent normal-user mock session from entering Admin pages.

### Feature 1 frontend completion

- [x] Registration UI complete.
- [x] Role-dependent fields complete.
- [x] OTP UI complete.
- [x] General User login complete.
- [x] Admin login complete.
- [x] Protected-route mock behavior complete.
- [x] Responsive behavior checked.

---

# Feature 2 — Home Page Frontend

The Home page is the public landing page and remains the first main-app page after login. Before authentication it exposes only Login and Sign up as application-entry actions; every other feature remains protected.

## 4.5 Home page

- [x] Create Home route.
- [x] Make the existing Home page the public landing route.
- [x] Show only Login and Sign up as application-entry navigation before authentication.
- [x] Keep all non-Home feature pages protected by authentication.
- [x] Show the authenticated Navbar on Home after login.
- [x] Redirect successful user authentication to Home.
- [x] Add “Welcome to CUET Campus” hero/header area.
- [x] Add CUET basic-information section.
- [x] Add history section.
- [x] Add achievements section.
- [x] Add facilities section.
- [x] Add image/gallery area.
- [x] Add video/embed area.
- [x] Ensure every authenticated General User can view it.
- [x] Prepare content using mock/static frontend data until backend/content strategy is connected.
- [x] Optimize layout for mobile and desktop.

### Feature 2 frontend completion

- [x] All required information categories represented.
- [x] Images/videos have proper loading/fallback behavior.
- [x] Navigation works.
- [x] Page is responsive.

---

# Feature 3 — Department and Faculty Directory Frontend

## 4.6 Department list/tabs

Create entries for the departments specified in the workflow:

- [x] CSE
- [x] EEE
- [x] ME
- [x] CE
- [x] ETE
- [x] BME
- [x] MME
- [x] MIE
- [x] PME
- [x] WRE
- [x] Architecture
- [x] URP

## 4.7 Department details

- [x] Create department tab/list component.
- [x] Create department details view.
- [x] Display department description/information.
- [x] Add loading state.
- [x] Add no-data state.

## 4.8 Faculty directory

- [x] Display teachers/faculty belonging to selected department.
- [x] Create faculty card/list.
- [x] Show required contact information.
- [x] Add faculty-detail presentation if included in approved UI design.
- [x] Use typed department/faculty data from the backend.

### Feature 3 frontend completion

- [x] Every listed department can be selected.
- [x] Correct department data appears.
- [x] Faculty data changes with department.
- [x] Contact information is readable.
- [x] Empty-state behavior exists.

---

# Feature 4 — Campus Explorer Frontend

The implementation uses the mapped CUET Raozan campus boundary and campus-only
OpenStreetMap points. It no longer uses the original illustrative demo map.

## 4.9 Explorer layout

- [x] Create Campus Explorer route.
- [x] Show a real map clipped to CUET's Raozan campus outline, with no off-campus markers.
- [x] Create location list/cards.
- [x] Include mapped TSC, Basketball Ground, Central Field, Gymnasium,
      campus store, individual halls, academic buildings, research institute,
      and Teachers Goal Chattor (the OSM-labeled northern junction).
- [x] Add location name.
- [x] Add address/location description.
- [x] Add detailed information.
- [x] Implement scrolling list.
- [x] Implement “tap/click for details”.
- [x] Add selected-location state.
- [x] Use typed API-backed campus location data instead of illustrative mock data.

### Feature 4 frontend completion

- [x] Map is visible when OpenStreetMap tiles are available.
- [x] Locations are browsable.
- [x] User can open each location’s details.
- [x] Responsive layout and touch selection are implemented.

---

# Feature 5 — Club and Event Hub Frontend

During the frontend-only prototype, club requests, admin edits, and event registrations use mock state retained for the current browser tab so the student-to-App-Admin review flow can be demonstrated. This is not the production data store; Phase 7 replaces it with authenticated backend persistence.

## 4.10 Club section

- [x] Create Club & Event Hub route.
- [x] Create club tabs/list.
- [x] Create club details view.
- [x] Show club information.
- [x] Show member information.
- [x] Show activities.
- [x] Show ongoing events.
- [x] Show upcoming events.
- [x] Show recently finished events.

### Club ownership and student-admin controls

- [x] Model club-to-admin membership with registered student user IDs.
- [x] Support one student administering multiple clubs.
- [x] Support one club having multiple student admins.
- [x] Visually identify clubs administered by the current student.
- [x] Show club-management controls only to mapped admins of that club.
- [x] Allow a club admin to update club information and activities.
- [x] Allow a club admin to add another registered student as club admin.
- [x] Allow a club admin to remove an admin while preserving at least one admin.
- [x] Keep App Admin and Club Admin permissions separate.

### New club creation requests

- [x] Add a “Create a new club” action for registered students.
- [x] Create the club-request form.
- [x] Collect club name, short name, category, tagline, description, and planned activities.
- [x] Collect the reason, purpose, campus need, and expected impact for the proposed club.
- [x] Show the requesting student their mock request status.
- [x] Keep requested clubs hidden from the public directory until App Admin approval.

### Club membership recruitment

- [x] Show whether the authenticated student is already a member of each club.
- [x] Let Club Admins open or close membership recruitment for their own club.
- [x] Fix the standard membership fee at BDT 200 for every club.
- [x] Let Club Admins publish both bKash and Nagad payment numbers while recruitment is open.
- [x] Show a dedicated "Be a member" application form only to eligible non-members.
- [x] Collect applicant name, account email, Student ID, department, phone, motivation, payment method, and transaction ID.
- [x] Show clear member, pending-request, and recruitment-closed states.
- [x] Add a separate Club Admin page for pending membership requests.
- [x] Let Club Admins approve or remove pending requests.
- [x] Update the member count and membership state after approval.
- [x] Surface membership-approval notifications in the global notification UI.

## 4.11 Events section

- [x] Create separate events section/tab.
- [x] Display ongoing events.
- [x] Display upcoming events.
- [x] Create event details view/card.
- [x] Add `Interested` action.
- [x] Add `Going` action.
- [x] Show selected interest state.
- [x] Add event start date/time.
- [x] Add event end date/time/status.
- [x] Mock event-start notification.
- [x] Mock event-finish notification.
- [x] Connect mock notifications to the global notification UI.

### Club-admin event management

- [x] Allow only a mapped admin of the corresponding club to add events.
- [x] Allow only a mapped admin of the corresponding club to edit events.
- [x] Allow only a mapped admin of the corresponding club to delete events.
- [x] Let the club admin enable or disable registration per event.
- [x] For paid events, let the club admin configure the fee and bKash number.

### Event registration frontend

- [x] Create an event details and registration route.
- [x] Show the configured bKash number above paid-event registration forms.
- [x] Collect participant name, CUET email, Student ID, and department.
- [x] Collect bKash transaction ID only for paid events.
- [x] Show states for free, paid, unavailable, closed, and completed registration.
- [x] Prevent duplicate mock registration by the same user for the same event.
- [x] Display the total number of registered users for each registration-enabled event.
- [x] Keep event registration separate from Interested/Going state.

### Feature 5 frontend completion

- [x] Clubs are selectable.
- [x] Club-specific events are visible.
- [x] Global event list is available.
- [x] Interested/Going UI works with mock state.
- [x] Notification UI can represent start/end event notifications.
- [x] Membership recruitment, application, and Club Admin review UI is responsive and permission-aware.

---

# Feature 6 — Resource Sharing Platform Frontend

The workflow describes a people-discovery style list where users request physical/academic resources from other users. Chat becomes available after the other user accepts the request.

## 4.12 User/resource discovery UI

- [x] Create Resource Sharing route.
- [x] Create “people you may know”-style user list.
- [x] Create user resource/request card.
- [x] Support resource request categories/examples such as:
  - [x] Notebook
  - [x] Lab report
  - [x] T-scale
  - [x] Bicycle
  - [x] Other approved resource
- [x] Create resource request form/modal.
- [x] Add request message/details field if included in approved design.
- [x] Add request submit UI.
- [x] Display request status:
  - [x] Pending
  - [x] Accepted
  - [x] Rejected
- [x] Create received-request UI.
- [x] Create accept action.
- [x] Create reject action.
- [x] Mock all request-state transitions.

## 4.13 User-to-user chat frontend

> The workflow wording “end to end chat system” is treated here as a chat between the two users. Do not assume cryptographic end-to-end encryption unless that is separately added as a formal requirement.

- [x] Create conversation list.
- [x] Create chat screen.
- [x] Create message list.
- [x] Create message input.
- [x] Add message send behavior using mock state.
- [x] Add timestamps.
- [x] Add current-user vs other-user message presentation.
- [x] Disable/prevent chat before resource request is accepted.
- [x] Show chat access after accepted request.
- [x] Add empty conversation state.

### Feature 6 frontend completion

- [x] Users can be browsed.
- [x] Resource request can be composed.
- [x] Pending/accepted/rejected UI works.
- [x] Accepted request unlocks chat UI.
- [x] Chat UI is usable and responsive.

---

# Feature 7 — Transport Section Frontend

## 4.14 Schedule interface

- [x] Create Transport route.
- [x] Display one selected day’s schedule within one page/view.
- [x] Add date/day selector.
- [x] Prevent past schedules from appearing in normal user UI.
- [x] Display:
  - [x] Date
  - [x] Bus Name
  - [x] Driver
  - [x] Bus Type
  - [x] Route information
  - [x] Schedule/times
- [x] Support bus types defined by requirements:
  - [x] Student Bus
  - [x] Teacher Bus
  - [x] Staff Bus
- [x] Add no-schedule state.
- [x] Use future/current mock schedule data.

## 4.15 Bus Drivers tab

- [x] Create “Bus Drivers” tab.
- [x] List driver names.
- [x] Display contact numbers.
- [x] Add empty state.

### Feature 7 frontend completion

- [x] User can change date/day.
- [x] Selected day shows correct mocked schedule.
- [x] Past schedules are hidden.
- [x] Driver list is accessible.

---

# Feature 8 — Community Discussion Forum Frontend

The workflow allows text-only community posts, comments, and reporting. There are no reactions and no image/video posts.

## 4.16 Post creation

- [x] Create Community Forum route.
- [x] Create post composer at top of page.
- [x] Accept text only.
- [x] Do not add image/video upload.
- [x] Add validation for empty post.
- [x] Add submit state.
- [x] Mock new post creation.

## 4.17 Feed

- [x] Create scrollable community post feed.
- [x] Display author.
- [x] Display post text.
- [x] Display timestamp.
- [x] Do not add reaction buttons.
- [x] Add comments section.
- [x] Add text-comment input.
- [x] Add comment list.
- [x] Mock comment creation.

## 4.18 Reporting

- [x] Add “Report to Admin” option.
- [x] Add report confirmation UI.
- [x] Mock reported state.
- [x] Prevent accidental repeated reporting if that matches final design.

### Feature 8 frontend completion

- [x] Text posts can be mocked.
- [x] Comments work in mock state.
- [x] No reaction UI exists.
- [x] No image/video post UI exists.
- [x] Report action is available.

---

# Feature 9 — Campus News and Announcements Frontend

## 4.19 News/announcement page

- [x] Create News & Announcements route.
- [x] Display latest items in serial/list order.
- [x] Differentiate content types if desired:
  - [x] News
  - [x] Update
  - [x] Announcement
- [x] Add title.
- [x] Add content/summary.
- [x] Add publication date/time.
- [x] Add details view if required.
- [x] Add empty state.
- [x] Mock newest-first ordering.

## 4.20 Notification connection

- [x] Generate mock notification when a new update/announcement is inserted into mock state.
- [x] Display it in notification area.
- [x] Link notification to relevant item where appropriate.

### Feature 9 frontend completion

- [x] List ordering is correct.
- [x] News/updates/announcements are readable.
- [x] Notification UI supports these items.

---

# Feature 10 — Campus AI Assistant Frontend

## 4.21 Chatbot UI

- [x] Create Campus AI Assistant route.
- [x] Create chat-style interface.
- [x] Add question input.
- [x] Add send button.
- [x] Add user message bubble.
- [x] Add assistant response bubble.
- [x] Add loading/“thinking” state.
- [x] Add API-error state.
- [x] Add “information not found” response state.
- [x] Keep retrieval sources internal; do not display citation markers or source cards.
- [x] Use mocked campus-related responses for frontend implementation.
- [x] Do not call the Ollama model service directly from frontend.

### Feature 10 frontend completion

- [x] Complete chatbot interaction can be demonstrated with mock service.
- [x] Loading/error/no-answer states exist.
- [x] UI is ready to connect to FastAPI RAG endpoint later.

---

# Special Feature — Admin Page Frontend

The Admin Page is visible only to the App Admin and controls information required to operate the application.

## 4.22 Admin shell

- [x] Create protected Admin route/layout.
- [x] Create Admin dashboard.
- [x] Create Admin-only navigation.
- [x] Add unauthorized-access page/state.
- [x] Prepare role guard using mock auth.

## 4.23 Admin management sections

Implement admin UI for workflow-defined responsibilities.

### Transport management

- [x] Create schedule list.
- [x] Create schedule form.
- [x] Create route-management UI.
- [x] Create driver-management UI.
- [x] Support add/edit/remove UI states.
- [x] Support weekly/monthly schedule entry workflow.

### News/updates/announcements

- [x] Create list.
- [x] Create add form.
- [x] Create edit UI.
- [x] Create delete UI.
- [x] Create publish state if included in approved design.

### Community reports

- [x] Create reported-post queue.
- [x] Show report/post information.
- [x] Add remove-post action.
- [x] Add dismiss/resolve-report action if included in approved design.

### Club creation requests

- [x] Create a club-request review queue for the main App Admin.
- [x] Show requester, Student ID, club information, activities, and purpose.
- [x] Add approve and reject actions.
- [x] On mock approval, publish the club and assign the requester as initial club admin.
- [x] On rejection, retain the reviewed request without creating a club.

### Other centrally managed information

- [x] Add admin sections for other content only where the finalized overall system design explicitly assigns management responsibility to Admin.
- [x] Do not add unapproved administrative capabilities simply because CRUD is technically possible.

### Admin frontend completion

- [x] Admin-only route behavior works with mock auth.
- [x] Transport management screens complete.
- [x] News/announcement management screens complete.
- [x] Community-report moderation screens complete.

---

# PHASE 5 — Complete Frontend Review Before Backend Work

Do not begin feature backend implementation until the complete UI can be navigated and reviewed.

## 5.1 Full frontend walkthrough

- [ ] Register using mock flow.
- [ ] Verify mock OTP.
- [ ] Login.
- [ ] Confirm `/` is the public Home landing page with only Login/Sign up navigation while signed out.
- [ ] Confirm every non-public route redirects signed-out visitors to authentication.
- [ ] Visit Home.
- [ ] Visit every department.
- [ ] Visit Campus Explorer.
- [ ] Browse clubs/events.
- [ ] Submit a mock club-creation request as a student.
- [ ] Open a club administered by the current student.
- [ ] Add and remove a mock student club admin.
- [ ] Add, edit, and delete a club event as a Club Admin.
- [ ] Configure free and paid event registration.
- [ ] Submit a free and paid mock event registration.
- [ ] Verify the displayed event registration count updates.
- [ ] Mark event Interested/Going.
- [ ] Check mock notification.
- [ ] Send mock resource request.
- [ ] Accept mock request.
- [ ] Open chat.
- [ ] Browse Transport.
- [ ] Browse Drivers.
- [ ] Create mock forum post/comment/report.
- [ ] Browse news.
- [ ] Use mock AI Assistant.
- [ ] Login as mock Admin.
- [ ] Manage mock transport data.
- [ ] Manage mock announcements.
- [ ] Review mock reported post.
- [ ] Approve and reject mock club-creation requests as App Admin.
- [ ] Verify an approved club becomes public with the requester as initial admin.
- [ ] Verify a request survives student logout and App Admin login in the mock flow.
- [ ] Verify a club admin cannot manage a different club or remove the last admin.

## 5.2 Frontend cleanup

- [ ] Remove duplicated UI.
- [ ] Consolidate reusable components.
- [ ] Verify TypeScript types.
- [ ] Verify responsive layout.
- [ ] Verify forms.
- [ ] Verify loading states.
- [ ] Verify errors.
- [ ] Verify empty states.
- [ ] Ensure API-facing types/interfaces are centralized.
- [ ] Create a clear mapping from each mock service to the future backend endpoint.

---

# PHASE 6 — Backend Foundation

## 6.1 Initialize FastAPI

Create the backend after the frontend flow is stable.

Suggested modular structure:

```text
backend/
├── app/
│   ├── main.py
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── home/
│   │   ├── directory/
│   │   ├── campus_explorer/
│   │   ├── clubs_events/
│   │   ├── resources/
│   │   ├── messaging/
│   │   ├── transport/
│   │   ├── forum/
│   │   ├── news/
│   │   ├── notifications/
│   │   ├── assistant/
│   │   └── admin/
│   └── shared/
├── migrations/
├── tests/
└── ...
```

Tasks:

- [x] Initialize Python environment/project with Python 3.12 and `backend/pyproject.toml`.
- [x] Install FastAPI in the ignored backend virtual environment.
- [x] Configure Uvicorn ASGI entry point and run instructions.
- [x] Configure backend-only settings/environment loader.
- [x] Configure stdout logging without request-body or secret logging.
- [x] Add centralized application, HTTP, validation, and unexpected-error handling.
- [x] Add `/health` liveness endpoint.
- [x] Reserve `/api/v1` for feature endpoints and OpenAPI JSON.
- [x] Configure explicit development CORS origins.
- [x] Configure request validation and a consistent 422 error response.
- [x] Create reusable success/error response conventions.

---

## 6.2 PostgreSQL + ORM + migrations

At the time Phase 6.2 was completed, there was no project ERD, so it established
infrastructure only. The [working ERD](docs/design/ERD.md) was added afterward;
the baseline migration still creates only Alembic's version table. Feature
tables and their data seeds remain Phase 7 work.

- [x] Create a dedicated local development PostgreSQL role and database (`unicircle_dev`).
- [x] Configure a backend-only PostgreSQL connection and request-scoped sessions.
- [x] Configure SQLAlchemy 2 Declarative Base and constraint naming without inventing domain models.
- [x] Configure Alembic with the backend settings and model metadata.
- [x] Add an opt-in timestamp audit mixin; feature IDs/relationships were deferred until the working ERD was created.
- [x] Create an intentionally empty, reviewed baseline revision as the initial migration strategy.
- [x] Review the baseline revision and offline SQL before applying it to the development database; review future autogenerated revisions before application.
- [x] Document development-only, idempotent seeding strategy for when Phase 7 creates domain tables.

---

## 6.3 Common backend services

The shared services are implemented as storage-agnostic foundations. Phase 7
must connect them to approved user, OTP, and notification models/repositories;
the test-only in-memory stores are not production persistence.

- [x] Authentication/security utilities.
- [x] JWT utilities.
- [x] Password hashing.
- [x] Current-user dependency (identity lookup is supplied in Phase 7).
- [x] Admin authorization dependency (checks the current persisted role).
- [x] SMTP/email service (requires configured TLS credentials).
- [x] OTP service (requires atomic persistent store in Phase 7).
- [x] Notification service foundation (requires repository in Phase 7).
- [x] Pagination utilities where needed.
- [x] Common validation/error utilities.
- [x] Shared test fixtures.

---

# PHASE 7 — BACKEND FEATURE IMPLEMENTATION + FRONTEND CONNECTION

The owner-authorized [project ERD](docs/design/ERD.md) now supplies the working
entity and security design for Phase 7. Review concrete migrations against it.
The local `.env` contains only ignored, nonfunctional security placeholders;
real secrets and Admin credentials are not committed.

> For every feature below, use the same mini-cycle:
>
> ```text
> Confirm feature LLD
> → create/update DB migration
> → create ORM model(s)
> → create Pydantic schemas
> → create repository/data access
> → create service/business logic
> → create API routes
> → write backend unit/API tests
> → test endpoint manually
> → implement frontend API service
> → replace mock service
> → verify complete feature flow
> ```

---

# Backend Feature 1 — Authentication

Implementation completed in code with migration `20260921_0002`, FastAPI auth
routes, PostgreSQL-backed OTP/session storage, restricted Admin provisioning, and
the same-origin Next.js auth BFF. Automated route tests use a fake mailer and pass.
**Live completion remains unverified:** SMTP configuration and authentication
have passed local checks, but delivery to a real CUET inbox and a live
registration-to-login journey have not yet been confirmed.

## 7.1 Database

- [x] Create user/account model according to final ERD.
- [x] Store username.
- [x] Store CUET email.
- [x] Store hashed password only.
- [x] Store role.
- [x] Store appropriate Student/Teacher/Staff identifier according to approved model.
- [x] Store verification state.
- [x] Create required unique constraints.
- [x] Create OTP-related persistence only if required by approved OTP design.
- [x] Create migration.

## 7.2 Registration service

- [x] Validate registration payload.
- [x] Reject non-CUET email addresses.
- [x] Accept `@cuet.ac.bd` and `@student.cuet.ac.bd` for registration, OTP, and login.
- [x] Validate role.
- [x] Validate required role-specific ID (format awaits approved design).
- [x] Check username uniqueness.
- [x] Check email uniqueness.
- [x] Hash password during registration preparation and store only its hash.
- [x] Create pending/unverified account.
- [x] Generate OTP.
- [x] Apply OTP expiry.
- [x] Send OTP through configured Python SMTP/email service (fake-mailer test; live SMTP pending).
- [x] Prevent OTP from being logged in production.
- [x] Implement resend rules.

## 7.3 OTP verification

- [x] Verify OTP.
- [x] Reject invalid OTP.
- [x] Reject expired OTP.
- [x] Mark user as verified.
- [x] Prevent/restrict login before verification according to final auth design.

## 7.4 Login/JWT

- [x] Support username or CUET email login for General Users.
- [x] Validate password.
- [x] Issue JWT according to approved token strategy.
- [x] Implement token expiry.
- [x] Implement authenticated-user endpoint.
- [x] Implement logout behavior according to chosen JWT/session design.
- [x] Implement Admin authentication using the approved superuser/admin strategy.
- [x] Keep Club Admin as per-club membership for a student User ID, not as a separate global login role or a client-trusted JWT claim.
- [x] Never hard-code production Admin secrets in repository source.

## 7.5 Connect Authentication frontend

### Email-code password recovery (October 2026)

- [x] Reuse existing TLS SMTP settings for password-reset codes; no additional provider/key required.
- [x] Implement forgot-password, reset-code verification/resend, and new-password endpoints.
- [x] Separate registration/recovery OTP purposes; enforce expiry, cooldown, single use, and attempt/rate limits.
- [x] Give generic recovery acknowledgements/errors for unknown/inactive accounts; do not expose provider details.
- [x] Store only hashed, ten-minute reset grants in the existing OTP table; no migration/data replacement required.
- [x] Keep reset challenge IDs/grants in HttpOnly BFF cookies, not browser storage or URLs.
- [x] Reset the password and revoke all prior sessions/challenges atomically; serialize concurrent logins by user lock.
- [x] Add isolated security tests with captured mail plus a disposable PostgreSQL CI recovery test.
- [ ] Confirm real production inbox delivery with the account owner (test SMTP capture does not prove delivery).

- [x] Replace mock registration call.
- [x] Connect OTP submission.
- [x] Connect resend OTP.
- [x] Connect login.
- [x] Store authentication state according to approved security design.
- [x] Connect protected-route logic.
- [x] Keep Home public with Login/Sign up entry links and redirect authenticated General Users back to Home after login.
- [x] Protect every non-public feature route with backend/session-aware checks, not only client-side hiding.
- [x] Connect Admin route protection.
- [x] Connect logout.
- [x] Verify expired/invalid token behavior.

### Feature 1 backend/integration done when

- [ ] Real user can register.
- [x] CUET email restriction works.
- [ ] OTP email is delivered.
- [x] OTP verification works with the test mailer.
- [x] Verified user can login in integration tests.
- [x] JWT-protected API works in integration tests.
- [x] Admin authorization works in integration tests.
- [x] Frontend no longer uses auth mocks.

---

# Backend Feature 2 — Home Page

First decide from the approved design whether Home content is static frontend content or database-managed content.

Decision: Home content is intentionally static and ships with the frontend. No
Home database model, seed, read API, or Admin editing API is needed unless a
future product decision introduces a CMS. The database-managed path below is
therefore not applicable to this implementation.

If database-managed in a future CMS phase:

- [ ] Create Home content model(s).
- [ ] Add seed/default content.
- [ ] Create read endpoint.
- [ ] Create Admin update endpoints only if the approved design requires Admin-managed Home content.
- [ ] Connect Home frontend service.
- [ ] Remove Home mock data.

If intentionally static:

- [x] Document that decision.
- [x] Keep stable static content in frontend/content files.
- [x] Ensure media assets are handled according to production asset strategy.

---

# Backend Feature 3 — Department & Faculty Directory

## 7.6 Data layer

- [x] Create Department model.
- [x] Create Faculty/Teacher directory model according to ERD.
- [x] Create relationship between faculty and department.
- [x] Add contact fields required by design; leave unavailable CUET values null.
- [x] Create migration.
- [x] Seed CSE, EEE, ME, CE, ETE, BME, MME, MIE, PME, WRE, Architecture, and URP from the official CUET directory snapshot (21 September 2026).

## 7.7 API

- [x] Get all departments.
- [x] Get one department.
- [x] Get faculty for department.
- [x] Get faculty details if required by frontend.
- [x] Admin management endpoints not required by the current read-only directory design.
- [x] Add validation.

## 7.8 Frontend connection

- [x] Replace department mocks.
- [x] Replace faculty mocks.
- [x] Connect loading state.
- [x] Connect not-found/empty state.
- [x] Verify all 12 department selections against the seeded data.
- [x] Open faculty details within UniCircle; fetch public details from each corresponding CUET profile on demand and show saved directory information when CUET is unavailable.

---

# Backend Feature 4 — Campus Explorer

Source: OpenStreetMap CUET boundary (way 681604170) and reviewed mapped POIs.
The snapshot is campus-only; map tiles need network access in the browser.

## 7.9 Data/API

- [x] Create Campus Location model.
- [x] Store name.
- [x] Store address/location description.
- [x] Store details.
- [x] Store latitude/longitude and OpenStreetMap source references.
- [x] Use OpenStreetMap tiles; optional image reference is modeled but none is seeded.
- [x] Create migration.
- [x] Create protected map, list, and details endpoints.
- [x] Keep Admin CRUD out of scope; no approved editing design exists.

## 7.10 Frontend connection

- [x] Replace location mocks.
- [x] Connect explorer list.
- [x] Connect location details.
- [x] Use attributed OpenStreetMap tiles and a campus-only polygon mask.
- [x] Verify selected-location state and backend API behavior.

---

# Backend Feature 5 — Club & Event Hub

## 7.11 Club data

- [x] Create Club model.
- [x] Create club-member information model/relationship according to ERD.
- [x] Create a many-to-many Club Admin relationship between Club and registered Student User IDs.
- [x] Support one student administering multiple clubs and one club having multiple admins.
- [x] Add constraints preventing a club from losing its final admin (transactional API guard).
- [x] Create Club Creation Request model with requester, proposed club data, purpose, activities, status, and review timestamps.
- [x] Define request states: Pending, Approved, and Rejected.
- [x] On approval, atomically create the Club and assign the requester as its initial Club Admin.
- [x] Prevent unapproved club requests from appearing in the public club list.
- [x] Create activity/event relationships.
- [x] Create migrations.

### 7.11A Club membership recruitment

- [x] Store per-club recruitment open/closed state and bKash/Nagad payment accounts.
- [x] Enforce the standard BDT 200 membership fee at the database and API layers.
- [x] Create a Membership Request model linked to one Club and one Student User.
- [x] Store applicant snapshots, motivation, payment method, and transaction ID.
- [x] Prevent duplicate requests and applications from existing members.
- [x] Restrict the pending request queue, approval, removal, and settings endpoints to that club's mapped admins.
- [x] Make approval create the Club Member record, finalize the request, and create a user notification in one transaction.
- [x] Persist membership-approval notification read/unread state.
- [x] Add and apply the membership recruitment migration.

## 7.12 Event data

- [x] Create Event model.
- [x] Store start/end dates.
- [x] Store status or derive it consistently.
- [x] Link event to club where appropriate.
- [x] Create user-event interest/attendance-intention relationship for:
  - [x] Interested
  - [x] Going
- [x] Add uniqueness rules so a user does not create duplicate status entries for the same event.
- [x] Add per-event registration settings: enabled/disabled, free/paid, fee, and bKash number.
- [x] Create Event Registration model linked to Event and User.
- [x] Store participant name, CUET email, Student ID, department, and optional bKash transaction ID.
- [x] Keep registration records private to their club admins and authorized backend staff; expose only totals publicly.
- [x] Decide how paid registrations are reviewed or verified; a submitted bKash transaction ID must not be treated as confirmed payment automatically.
- [x] Require a transaction ID only when the event is paid.
- [x] Add uniqueness rules preventing duplicate registration by one user for the same event.
- [x] Define how the total registration count is calculated efficiently and consistently.

## 7.13 Club/Event API

- [x] List clubs.
- [x] Club details.
- [x] Club members/details required by frontend.
- [x] Club events.
- [x] List ongoing events.
- [x] List upcoming events.
- [x] List recently finished events.
- [x] Set/update Interested status.
- [x] Set/update Going status.
- [x] Return current user’s event status.
- [x] Submit a club-creation request as a registered student.
- [x] Return the current student's club-request history/status.
- [x] Expose a paginated pending/reviewed club-request queue to the main App Admin only.
- [x] Let the main App Admin approve or reject a pending club request exactly once; record reviewer and review time.
- [x] Make approval idempotent and transactional so retries cannot create duplicate clubs.
- [x] Return clubs administered by the current student.
- [x] Update club details only when the current user is a mapped admin of that club.
- [x] Add/remove club admins only when the current user is a mapped admin of that club.
- [x] Create/update/delete club events only when the current user is a mapped admin of that club.
- [x] Return event registration configuration and total registration count.
- [x] Submit event registration and return the current user's registration state.
- [x] Restrict registration to authenticated students and validate all participant fields, including the CUET email domain.
- [x] Validate paid-event bKash configuration and registration transaction IDs.
- [x] Prevent registrations after the event or registration window closes.
- [x] Return current-user club membership and membership-request state.
- [x] Update club membership recruitment settings as a mapped Club Admin.
- [x] Submit a membership request as an eligible registered student.
- [x] List, approve, or remove membership requests as a mapped Club Admin.
- [x] Return the unified authenticated-user notification list and read controls.

## 7.14 Event notifications

- [x] Define how “event started” is detected.
- [x] Define how “event finished” is detected.
- [x] Create notification records for relevant users.
- [x] Prevent duplicate start/end notifications.
- [x] Decide scheduler/background execution mechanism during detailed implementation (external scheduled job; deployment scheduling still required).
- [x] Test boundary times.

## 7.15 Frontend connection

- [x] Replace club mocks.
- [x] Replace event mocks.
- [x] Connect Interested/Going buttons.
- [x] Connect Club Admin membership and permission-aware controls.
- [x] Connect club detail/admin update actions.
- [x] Connect new-club request submission and request-status UI.
- [x] Connect event create/edit/delete actions.
- [x] Connect optional free/paid event registration and registration totals.
- [x] Connect event-status rendering.
- [x] Connect real notification list, including club membership approvals.
- [x] Verify event start/finish notification behavior.

---

# Backend Feature 6 — Resource Sharing + Chat

## 7.16 Resource request data

- [x] Create user-to-user Resource Request model.
- [x] Store requester.
- [x] Store requested user.
- [x] Store requested resource description/category.
- [x] Store status:
  - [x] Pending
  - [x] Accepted
  - [x] Rejected
- [x] Store timestamps.
- [x] Create constraints preventing invalid self-requests if required.
- [x] Create migration.

## 7.17 Resource API

- [x] List/discover users according to approved rules.
- [x] Send resource request.
- [x] View sent requests.
- [x] View received requests.
- [x] Accept request.
- [x] Reject request.
- [x] Authorize request updates so only the intended recipient can accept/reject.

## 7.18 Chat data

- [x] Create Conversation model.
- [x] Create Message model.
- [x] Link conversation to accepted resource request if that is the approved design.
- [x] Create migration.
- [x] Prevent chat creation before request acceptance.
- [x] Store sender.
- [x] Store recipient/conversation.
- [x] Store message text.
- [x] Store timestamps.

## 7.19 Chat API/realtime behavior

- [x] Create conversation list endpoint.
- [x] Create message-history endpoint.
- [x] Create message-send mechanism.
- [x] Decide whether the approved architecture uses:
  - [x] REST + refresh/polling, or
  - [ ] WebSocket/realtime connection.
- [x] Do not claim cryptographic end-to-end encryption unless it is formally designed and implemented.
- [x] Authorize conversation access.

## 7.20 Frontend connection

- [x] Replace discovered-user mocks.
- [x] Connect request creation.
- [x] Connect accept/reject.
- [x] Unlock chat only after accepted request.
- [x] Connect conversations.
- [x] Connect message history.
- [x] Connect message sending.
- [x] Implement realtime/polling behavior according to chosen architecture.

---

# Backend Feature 7 — Transport

## 7.21 Data models

- [x] Create Bus model if required by ERD.
- [x] Create Bus Driver model.
- [x] Create Route model if separate.
- [x] Create Transport Schedule model.
- [x] Store schedule date.
- [x] Store bus name/reference.
- [x] Store driver.
- [x] Store bus type.
- [x] Store route.
- [x] Store schedule/times.
- [x] Create migrations.

## 7.22 General User API

- [x] Get schedule for date.
- [x] Get current/upcoming available dates.
- [x] Prevent normal endpoint from returning past schedules according to workflow requirement.
- [x] List bus drivers.
- [x] Return driver contact number.

## 7.23 Admin API

- [x] Admin create schedule.
- [x] Admin update schedule.
- [x] Admin delete schedule where allowed.
- [x] Admin manage route.
- [x] Admin manage bus information where required.
- [x] Admin manage driver information.
- [x] Support weekly/monthly schedule maintenance workflow.
- [x] Protect every write endpoint with Admin authorization.

## 7.24 Frontend connection

- [x] Replace schedule mocks.
- [x] Connect date selector.
- [x] Connect schedule view.
- [x] Connect drivers tab.
- [x] Connect Admin schedule forms.
- [x] Connect Admin driver/route forms.
- [x] Verify past schedule is not exposed in normal user UI/API.

---

# Backend Feature 8 — Community Discussion Forum

## 7.25 Data models

- [x] Create Post model.
- [x] Create Comment model.
- [x] Create Report model.
- [x] Store text-only post content.
- [x] Store author.
- [x] Store timestamps.
- [x] Relate comments to posts and authors.
- [x] Relate reports to reporter and reported post.
- [x] Create migrations.

## 7.26 General User API

- [x] Create text post.
- [x] List posts.
- [x] Get post if required.
- [x] Add comment.
- [x] List comments.
- [x] Report post.
- [x] Validate text-only payloads.
- [x] Do not implement image/video upload for forum.
- [x] Do not implement reactions.

## 7.27 Admin moderation API

- [x] List reported posts.
- [x] Show report details.
- [x] Remove reported post.
- [x] Handle related comments according to deletion strategy.
- [x] Resolve/dismiss report if part of final design.
- [x] Protect moderation endpoints with Admin authorization.

## 7.28 Frontend connection

- [x] Replace feed mocks.
- [x] Connect post creation.
- [x] Connect comments.
- [x] Connect reporting.
- [x] Connect Admin report queue.
- [x] Connect Admin post removal.
- [x] Verify removed posts disappear from user feed.

---

# Backend Feature 9 — Campus News and Announcements

## 7.29 Data model

- [x] Create News/Announcement model according to ERD.
- [x] Store type/category if required.
- [x] Store title.
- [x] Store content.
- [x] Store publication timestamp.
- [x] Store author/Admin reference.
- [x] Create migration.

## 7.30 API

General User:

- [x] List published news/updates/announcements.
- [x] Sort newest first.
- [x] Get item details if required.

Admin:

- [x] Create item.
- [x] Update item.
- [x] Delete item.
- [x] Publish/unpublish only if included in approved design.
- [x] Protect Admin writes.

## 7.31 Announcement notifications

- [x] Create user notifications for new updates/announcements according to requirement.
- [x] Prevent duplicate notification creation.
- [x] Link notification to announcement.
- [x] Support read/unread status.

## 7.32 Frontend connection

- [x] Replace news mocks.
- [x] Connect newest-first list.
- [x] Connect details.
- [x] Connect notification entries.
- [x] Connect Admin create/edit/delete UI.

---

# Backend Feature 10 — Campus AI Assistant / RAG

Updated requirement (2026-10-08): use an independently written, reviewed CUET
knowledge base in matching Markdown and TXT files. Research may use official
university/government pages, original ranking publishers, reliable reporting
and attributed campus maps; do not rely on inaccurate whole-site scraping.
Answers remain grounded in the reviewed local corpus and omit displayed sources.

Chat-provider update (2026-10-12): use Groq-hosted `qwen/qwen3.8-27b` when the
backend-only `GROQ_API_KEY` is configured. Keep the existing Ollama embedding
index compatible; deploying without the development laptop still requires a
reachable embedding service or a separately implemented hosted embedding provider
and re-indexing. Real environment files and credentials must never be committed.

## 7.33 RAG ingestion foundation

- [x] Create curated CUET Markdown and plain-text knowledge files with review dates and evidence links.
- [x] Cover location, faculties/departments, institutes, halls, ITBI, TSC, rankings and administration; label unconfirmed facts.
- [x] Make local section-aware ingestion the default; retain web crawling only as an explicit opt-in.
- [x] Rebuild atomically and reject invalid or incompatible embeddings.
- [x] Exclude legacy scrapes, changed snapshots and review-expired sections from curated answers.
- [x] Rebuild the live curated index and verify grounded answers; re-use the index with Groq Qwen and the unchanged Ollama embedding model.

- [x] Finalize approved knowledge-source list.
- [x] Define “official/acceptable CUET source” policy.
- [x] Create ingestion module.
- [x] Fetch/load approved campus content.
- [x] Clean/extract useful text.
- [x] Split content into chunks.
- [x] Generate embeddings.
- [x] Store vectors in the approved vector store.
- [x] Store source metadata.
- [x] Store source URL/title/date metadata where available.
- [x] Prevent uncontrolled ingestion of unrelated sources.
- [x] Create refresh/update strategy.

## 7.34 RAG query pipeline

- [x] Accept user question through FastAPI.
- [x] Validate input.
- [x] Retrieve relevant chunks.
- [x] Construct context.
- [x] Construct controlled prompt.
- [x] Call Groq-hosted Qwen from backend only when configured; retain explicit local Ollama chat support.
- [x] Load a masked Groq key from ignored environment files and pass it only at backend runtime.
- [x] Handle Groq quota, authentication/model-access, timeout and invalid-response failures safely.
- [x] Preserve existing embeddings, controlled prompts, no-context handling and source-free answers.
- [ ] Provision deployment embeddings independent of the developer's laptop before public launch.
- [x] Generate grounded answer.
- [x] Return answer.
- [x] Keep retrieved-source metadata internal to the RAG service.
- [x] Handle no relevant context.
- [x] Handle Groq and Ollama/model failure.
- [x] Add rate/cost safeguards according to approved architecture.

## 7.35 Frontend connection

- [x] Replace AI mock service.
- [x] Connect question endpoint.
- [x] Connect loading state.
- [x] Connect answer.
- [x] Connect no-answer state.
- [x] Verify answers omit source cards, URLs, and citation markers.
- [x] Connect API error handling.
- [x] Verify the Ollama service is never exposed directly to the browser.

---

# Backend Shared Feature — Notifications

Because notifications are used by multiple features, consolidate them into one shared backend capability.

## 7.36 Notification model/API

- [x] Create Notification model.
- [x] Store recipient.
- [x] Store notification type.
- [x] Store message/title.
- [x] Store related-object reference according to approved design.
- [x] Store read/unread state.
- [x] Store creation timestamp.
- [x] List current user notifications.
- [x] Mark one as read.
- [x] Mark all as read if included in frontend.
- [x] Authorize users to access only their own notifications.

Notification sources currently required:

- [x] Event started.
- [x] Event finished.
- [x] Campus update/announcement.

---

# Backend Special Feature — Admin Page Integration

- [x] Ensure Admin identity cannot be self-registered.
- [x] Protect all Admin endpoints server-side.
- [x] Never rely only on hidden frontend buttons.
- [x] Connect every Admin page to its actual API.
- [x] Connect the club-request review queue, approve/reject actions, and reviewed history to App Admin APIs.
- [x] Ensure a club admin cannot access another club's management endpoints.
- [x] Add privacy-minimal, append-only audit logging for sensitive App Admin operations.
- [x] Verify normal General User receives `403`/appropriate denial for Admin endpoints.

---

# PHASE 8 — Cross-Feature Integration Review

After all feature backend integrations are complete:

## 8.1 Remove mocks

- [x] Search frontend for mock imports.
- [x] Remove feature mocks no longer needed.
- [x] Keep mock/test fixtures only inside test/development tooling.
- [x] Verify production build cannot accidentally use mock data.

## 8.2 Complete user journey

- [x] Land on public Home before authentication; only Login/Sign up is available.
- [x] Register.
- [x] Receive OTP email.
- [x] Verify account.
- [x] Login.
- [x] Browse Home.
- [x] Browse departments/faculty.
- [x] Browse campus locations.
- [x] Browse clubs/events.
- [x] Submit a club-creation request; see its pending status.
- [x] After App Admin approval, see the new club in the public directory and manage it as initial admin.
- [x] Add a second registered student as club admin and verify both students can manage it.
- [x] Create free and paid events, register once for each, and see the registration totals update.
- [x] Set Interested/Going.
- [x] Receive event notification.
- [x] Request resource.
- [x] Other user accepts.
- [x] Chat.
- [x] Browse transport schedule.
- [x] Browse drivers.
- [x] Create forum post.
- [x] Comment.
- [x] Report post.
- [x] Browse news/announcement.
- [x] Receive announcement notification.
- [x] Ask Campus AI Assistant.
- [x] Logout.

## 8.3 Complete Admin journey

- [x] Admin login.
- [x] Access Admin page.
- [x] Update transport schedule.
- [x] Update route/driver information.
- [x] Publish news/announcement.
- [x] Verify user receives notification.
- [x] Review reported forum post.
- [x] Approve one club request and reject another; only the approved club becomes public.
- [x] Remove inappropriate reported post.
- [x] Verify normal user cannot access Admin API or page.

---

# PHASE 9 — TESTING PLAN

Testing should exist during backend implementation, but this phase performs the **complete systematic test pass** before Docker/CD/deployment.

Completion evidence and repeatable commands are documented in
[`docs/testing/PHASE_9_TESTING.md`](docs/testing/PHASE_9_TESTING.md). Multi-actor
feature journeys are covered by the FastAPI integration suite; the Playwright
matrix verifies the critical public, authentication, directory, AI, and App
Admin browser boundaries on desktop and mobile.

# 9.1 Frontend unit/component tests

Suggested targets:

- [x] Registration validation.
- [x] CUET email validation presentation.
- [x] Role-specific ID field switching.
- [x] OTP form.
- [x] Login form.
- [x] Navbar permissions.
- [x] Notification unread/read UI.
- [x] Department tabs.
- [x] Event Interested/Going controls.
- [x] Club request form and status UI.
- [x] Club-admin membership editor and permission-aware controls.
- [x] Free/paid event-registration form validation and count UI.
- [x] Resource request status controls.
- [x] Chat input behavior.
- [x] Transport date selection.
- [x] Forum text-only form.
- [x] Comment form.
- [x] Admin route guard UI.
- [x] AI Assistant states.

Focus on behavior rather than testing implementation details.

---

# 9.2 Backend unit tests

Test business/service logic independently where practical.

Authentication:

- [x] CUET email validation.
- [x] Role-specific ID validation.
- [x] Password hashing/verification.
- [x] OTP creation.
- [x] OTP expiry.
- [x] OTP verification.
- [x] JWT creation/validation.

Club/Event:

- [x] Club request approval is transactional and creates one club with its requester as initial admin.
- [x] Rejecting a club request leaves no public club.
- [x] Final club admin cannot be removed.
- [x] Event management requires membership in that specific club.
- [x] Paid event configuration requires a fee and bKash number.
- [x] Paid registration requires a bKash transaction ID; free registration does not.
- [x] Duplicate event registration by the same student is rejected.
- [x] Upcoming/ongoing/finished classification.
- [x] Interested/Going transition logic.
- [x] Notification deduplication.

Resources:

- [x] Resource request state transitions.
- [x] Cannot accept someone else’s request.
- [x] Chat only after accepted request.

Transport:

- [x] Past schedules excluded from normal-user result.
- [x] Date filtering.
- [x] Bus-type validation.

Forum:

- [x] Empty post rejected.
- [x] Report behavior.
- [x] Moderation authorization.

News:

- [x] Newest-first ordering.
- [x] Announcement notification creation.

RAG:

- [x] Text preprocessing utilities.
- [x] Chunking behavior.
- [x] Retrieval helper behavior.
- [x] No-context fallback logic.

---

# 9.3 API tests

Use FastAPI test tooling/HTTP client against a test database.

Authentication:

- [x] Register valid user.
- [x] Reject non-CUET email.
- [x] Reject duplicate username.
- [x] Reject duplicate email.
- [x] OTP verification.
- [x] Login.
- [x] Reject invalid password.
- [x] Protected endpoint requires JWT.
- [x] Admin endpoint rejects General User.

Directory:

- [x] List departments.
- [x] Get department faculty.
- [x] Invalid department handling.

Explorer:

- [x] List locations.
- [x] Get location.

Clubs/Events:

- [x] List clubs.
- [x] List events.
- [x] Student submits club request and sees only their own request history.
- [x] General User cannot use App Admin request-review endpoints.
- [x] App Admin approves/rejects once; approval publishes club with requester as initial admin.
- [x] Club admin can add/remove only registered student admins for their own club.
- [x] Non-admin and another club's admin cannot create/edit/delete this club's events.
- [x] Free and paid registration validate fields and enforce one registration per student/event.
- [x] Public event response exposes the registration total but not private participant data.
- [x] Set Interested.
- [x] Set Going.
- [x] Prevent unauthorized action.

Resources/Chat:

- [x] Send request.
- [x] Accept/reject.
- [x] Reject unauthorized state change.
- [x] Chat blocked before acceptance.
- [x] Send/read message after acceptance.

Transport:

- [x] Get current/future schedule.
- [x] Verify past schedule does not appear.
- [x] List drivers.
- [x] Admin CRUD authorization.

Forum:

- [x] Create post.
- [x] Create comment.
- [x] Report post.
- [x] Admin removes reported post.
- [x] General User cannot use moderation endpoint.

News:

- [x] List.
- [x] Admin creates.
- [x] Notification generated.
- [x] General User cannot create.

AI:

- [x] Valid question.
- [x] Empty question.
- [x] No relevant context.
- [x] External model failure handled safely.

---

# 9.4 Database integration tests

- [x] Club-admin many-to-many relation supports multiple admins per club and multiple clubs per student.
- [x] Concurrent club approvals and event registrations remain unique and consistent.
- [x] Test migrations on clean test database.
- [x] Test required unique constraints.
- [x] Test foreign-key constraints.
- [x] Test cascade/restrict behavior.
- [x] Test transaction rollback.
- [x] Test important indexes/query paths if needed.
- [x] Test concurrent/duplicate actions where race conditions matter.

---

# 9.5 Feature integration tests

Examples:

Authentication integration:

```text
Register
→ user persisted
→ OTP generated
→ verification
→ login
→ JWT
→ protected endpoint
```

- [x] Test full authentication chain.

Event integration:

```text
User selects Going
→ database record
→ event reaches start
→ notification created
→ frontend notification endpoint returns it
```

- [x] Test full event-notification chain.

Club creation integration:

```text
Student submits proposal
→ App Admin approves
→ club becomes public
→ requester becomes initial club admin
→ requester adds another student admin
```

- [x] Test full club-request and administration chain, including rejection and unauthorized attempts.

Event registration integration:

```text
Club admin enables paid registration and sets bKash number
→ student submits details and transaction ID
→ one registration is stored
→ public total increases without exposing participant details
```

- [x] Test free/paid registration, duplicate prevention, and registration total consistency.

Resource integration:

```text
User A requests resource from User B
→ User B accepts
→ conversation becomes available
→ A/B exchange messages
```

- [x] Test full resource/chat chain.

Forum moderation integration:

```text
User creates post
→ another user reports
→ Admin sees report
→ Admin removes post
→ post disappears from feed
```

- [x] Test full moderation chain.

Announcement integration:

```text
Admin publishes announcement
→ item appears in list
→ notification created
→ user receives notification
```

- [x] Test full announcement chain.

---

# 9.6 End-to-End (E2E) browser testing

Automate the most important user journeys, not every visual detail.

- [x] Registration → OTP test flow using test email strategy.
- [x] Login → Home.
- [x] Public Home → Login/Sign up → authenticated Home; signed-out protected-route redirect.
- [x] Student club request → App Admin approval → new public club → requester admin controls.
- [x] Club admin event creation → optional free/paid registration → student submission → total update.
- [x] Directory navigation.
- [x] Club/event → Going.
- [x] Resource request → acceptance → chat.
- [x] Forum post → comment → report.
- [x] Admin login → transport update.
- [x] Admin login → announcement publish.
- [x] Admin moderation flow.
- [x] AI question/answer flow using controlled test/stub for external AI where appropriate.

---

# 9.7 Security testing checklist

- [x] Passwords are never stored plain text.
- [x] JWT secret is not committed.
- [x] SMTP password is not committed.
- [x] Ollama is reachable only from trusted backend infrastructure.
- [x] Admin endpoints enforce server-side authorization.
- [x] Club-management endpoints enforce per-club student-admin membership server-side.
- [x] Club-request review endpoints require main App Admin authority server-side.
- [x] Event registration records and bKash transaction IDs are not exposed in public responses or logs.
- [x] Users cannot read another user’s private chat without authorization.
- [x] Users cannot accept/reject requests addressed to another user.
- [x] Users cannot mark another user’s notifications.
- [x] SQL injection protections verified through ORM/parameterized queries.
- [x] Input validation exists.
- [x] XSS-risk content is handled safely.
- [x] CORS configured narrowly in production.
- [x] Rate limiting/abuse protections reviewed for auth and AI.
- [x] OTP has expiry.
- [x] OTP resend abuse protection considered.
- [x] Sensitive values are not written to logs.

---

# 9.8 RAG evaluation plan

Create a small CUET-specific evaluation dataset.

For each question store:

```text
Question
Expected source/document
Expected key facts
Whether answer should be possible
```

Test:

- [x] Correct source retrieval.
- [x] Relevant chunks ranked high enough.
- [x] Answer grounded in retrieved context.
- [x] Unsupported question handled safely.
- [x] Campus-unrelated question behavior.
- [x] Outdated information strategy.
- [x] Verify retrieval sources remain internal and are not rendered with answers.
- [x] Response latency.
- [x] External API error handling.

---

# 9.9 Performance/basic load checks

Focus on likely bottlenecks.

- [x] Home/directory list response.
- [x] Forum feed pagination.
- [x] Message history.
- [x] Transport schedule query.
- [x] Notifications list.
- [x] RAG query latency.
- [x] Database connection behavior.
- [x] Verify list endpoints use pagination where required.

---

# 9.10 Testing exit criteria

Before Dockerized production preparation:

- [x] All critical unit tests pass.
- [x] All API tests pass.
- [x] All required integration tests pass.
- [x] Critical E2E journeys pass.
- [x] No known critical/high-severity security defect.
- [x] Database migrations work from clean database.
- [x] RAG evaluation meets the team’s agreed quality criteria.
- [x] Test commands are documented.
- [x] CI-ready test commands exist for frontend and backend.

---

# PHASE 10 — DOCKERIZATION

Dockerization comes after the application is functionally integrated and tested.

# 10.1 Backend Docker image

- [x] Create backend `Dockerfile`.
- [x] Use production-appropriate Python base image.
- [x] Install dependencies reproducibly.
- [x] Copy application.
- [x] Run as non-root where practical.
- [x] Expose application port.
- [x] Add health-check strategy.
- [x] Configure production ASGI startup command.
- [x] Ensure secrets are passed at runtime, not baked into image.
- [x] Add `.dockerignore`.
- [x] Build image locally.
- [x] Run backend container locally.
- [x] Test `/health`.

Validated on 3 October 2026: `unicircle-backend:phase10.1` builds with a
digest-pinned Python 3.12 slim base and hash-locked production dependencies.
The repeatable `backend/scripts/verify_docker.ps1` check passed production
configuration rejection, HTTP/Docker health, non-root/read-only execution,
image exclusions, bundled migrations/snapshots, dependency consistency, and
graceful shutdown. The 19 health/configuration/authentication checks passed
both locally and inside Linux. Smoke settings are synthetic; database, SMTP,
and Ollama connectivity remain separate integration checks. See
`backend/README.md` for build, runtime environment, and migration commands.

---

# 10.2 Frontend Docker image

- [x] Create frontend `Dockerfile`.
- [x] Use a multi-stage production build where appropriate.
- [x] Install dependencies reproducibly.
- [x] Build Next.js production output.
- [x] Keep runtime image minimal.
- [x] Run as non-root where practical.
- [x] Add `.dockerignore`.
- [x] Pass only safe/public build variables appropriately.
- [x] Build locally.
- [x] Run frontend container locally.

Validated on 7 October 2026: `unicircle-frontend:phase10.2` builds using a
digest-pinned Node.js 22 slim base, `npm ci`, and Next.js standalone output.
The non-root runtime includes campus media/static assets, excludes local
secrets and development tools, and accepts server-only `BACKEND_API_URL` at
runtime; no public build variables are needed. Docker health and desktop/mobile
Home, media, login, registration validation, protected-route redirects, and
overflow checks passed using `frontend/scripts/verify_docker.mjs`.
All 21 frontend unit tests passed. Authenticated API journeys in the combined
Docker environment remain part of Phase 10.4. See `frontend/README.md`.

---

# 10.3 PostgreSQL for local Docker environment

- [x] Add PostgreSQL service to `compose.yaml`.
- [x] Configure database environment variables.
- [x] Add persistent development volume.
- [x] Add health check.
- [x] Ensure backend waits/retries appropriately for database readiness.
- [x] Do not use development database credentials in production.

Validated on 7 October 2026: the digest-pinned PostgreSQL 16 Alpine service
uses local-only `.env.compose` settings, a persistent named volume, loopback
port 55432, SCRAM authentication, and a health check. The updated backend image
(`unicircle-backend:phase10.3`) waits for authenticated PostgreSQL readiness
with bounded retries before starting Uvicorn; migrations remain explicit.
`scripts/verify_postgres_docker.ps1` passed database health, rejected-password,
container-recreation persistence, delayed database recovery, and graceful API
shutdown checks using isolated test resources, which were removed afterward.
All 109 backend tests (including the new readiness tests) and backend image
smoke checks passed. Production credentials must remain separate. See
`docs/docker/README.md`.

---

# 10.4 Docker Compose integration

Create services similar to:

```text
frontend
backend
postgres
```

Plus other infrastructure only if required by the finalized architecture.

- [x] Create shared network.
- [x] Configure service names.
- [x] Configure backend → PostgreSQL connection.
- [x] Configure frontend → backend URL.
- [x] Configure volumes.
- [x] Configure health checks.
- [x] Verify application starts from a clean clone using documented commands.
- [x] Apply database migrations in the Docker workflow.
- [x] Verify all main user flows in Docker environment.

The integrated stack includes frontend, backend, PostgreSQL and a one-shot
Alembic migration job with ordered health/startup dependencies. App traffic and
the internal database network are separated; no API host port is published.
Database data persists in a named volume. Clean-checkout builds and startup use
commit-tagged production images without native `.env`, virtual environments or
`node_modules`. Test configuration uses synthetic secrets/accounts and an
isolated TLS/authenticated mail-capture service, never the real database.

Automated Docker checks cover desktop/mobile public pages and campus media,
registration/OTP/login/logout, Secure/HttpOnly sessions, directory/explorer,
club/event administration and permissions, registration/interest/membership,
resource acceptance/private chat, forum moderation, announcements/notifications,
transport administration, authenticated pages, persistence and graceful shutdown.
The assistant empty-index fallback is tested. External SMTP-provider delivery
and populated-corpus model inference require separate environment acceptance;
the reachable host Ollama currently reports no installed model tags. Existing
native settings/data and global model configuration were not changed.
See `docs/docker/README.md` and `frontend/scripts/verify_compose.mjs`.

---

# 10.5 Production Docker hardening

- [x] Minimize image sizes.
- [x] Pin/reproduce dependencies.
- [x] Remove development-only tools from production image where possible.
- [x] Run containers as non-root where practical.
- [x] Configure production logging to stdout/stderr.
- [x] Configure graceful shutdown.
- [x] Verify health endpoints.
- [x] Verify no `.env`/secret file is copied into image.
- [x] Scan/review dependencies and images.
- [x] Tag images using commit SHA/version.

Digest-pinned multi-stage images contain only runtime artifacts/locked
dependencies; frontend npm/npx/Corepack/Yarn and development tools are excluded.
Available base-package fixes and a compatible `source-map-js` patch were applied.
All app/migration/database containers are non-root with read-only roots, dropped
capabilities, no-new-privileges and bounded writable tmpfs/PIDs. Logs are rotated
stdout/stderr; init-managed shutdown is verified, including API shutdown-complete
logs. Build helpers use commit-SHA/version tags and OCI revision labels; verified
clean-checkout images are tagged `ba42f16abe59`. The production preparation
overlay removes the database host port without choosing a hosting provider.
All 109 backend tests and 24 frontend tests pass, along with production builds,
image smoke checks and isolated database persistence/startup-recovery checks.

**Security review is complete, but production release is not approved.**
The high/critical image gate still fails: backend 55, frontend 49 and PostgreSQL
22 findings remain after available patches. No findings were suppressed or
accepted automatically. The production npm audit reports zero findings, while
development-toolchain findings are documented for a reviewed future upgrade.
Resolve remaining image findings or obtain explicit documented risk acceptance
before deployment. See `docs/docker/SECURITY_REVIEW.md` and
`scripts/scan_docker.ps1`. Production HTTPS, secrets, backups, resource policy and
real SMTP/RAG acceptance remain deployment prerequisites, not silently completed.

---

# PHASE 11 — CI PIPELINE WITH GITHUB ACTIONS

Create CI before automatic production deployment.

# 11.1 Pull-request CI

Trigger on pull requests.

Frontend job:

- [x] Install dependencies.
- [x] Lint.
- [x] Type-check.
- [x] Run frontend unit/component tests.
- [x] Build Next.js production bundle.

Backend job:

- [x] Install Python dependencies.
- [x] Lint/format check according to team standard.
- [x] Run backend unit tests.
- [x] Start test PostgreSQL service.
- [x] Run migration.
- [x] Run API/integration tests.

Docker job:

- [x] Build backend image.
- [x] Build frontend image.
- [x] Fail CI if Docker build fails.

Optional later:

- [ ] Dependency/security scan.
- [ ] Coverage report.
- [x] Upload test artifacts/reports.

Implemented in `.github/workflows/ci.yml` for pull requests to `main`, pushes to
`main`, and manual runs. PostgreSQL-specific tests use migrated, disposable
schemas and explicit test-only credentials; SMTP/LLM services are faked. Local
verification: 122 backend tests and 24 frontend tests passed, frontend lint,
type-check/build, backend lint/format and workflow validation passed. Full Linux
PostgreSQL/Docker validation passed in GitHub Actions, including all four real
PostgreSQL API integration tests and both production image builds:
https://github.com/anindya357/UniCircle/actions/runs/37803956482
See the CI workflow README. Optional scans and coverage are still deferred.

---

# 11.2 CI branch protection

- [x] Require CI before merge to `main`.
- [x] Require appropriate review.
- [x] Prevent direct production deployment from unreviewed feature branches.
- [x] Keep production secrets unavailable to pull requests from untrusted contexts.

Preserve the existing one-reviewer rule, stale-approval dismissal, conversation
resolution and owner/admin bypass for the requested direct `main` workflow.
GitHub branch protection now requires the stable `CI gate` check from GitHub
Actions and an up-to-date branch before PR merge, verified through the GitHub API.
Owner/admin bypass remains enabled; direct owner pushes run CI afterwards and
must be checked before release.
The workflow has read-only permissions, immutable action pins, no production
secrets, no image publishing and no deployment steps. Phase 12 is not started.

---

# PHASE 12 — CD PIPELINE

# 12.1 Decide release trigger

> Selected: push/merge to `main`, using the existing Vercel Git integration for both Services. A production-only Vercel Deployment Check requires the exact commit's GitHub `CI gate` before domain assignment. `.github/workflows/cd.yml` verifies the public release after promotion. See `docs/deployment/CD.md` for the complete migration, secrets, smoke-test and rollback runbook. No separate branch or registry is required.

Recommended options:

```text
Merge to main
or
Version tag / GitHub Release
```

Tasks:

- [x] Choose one release strategy: push/merge to `main`.
- [x] Document it in `docs/deployment/CD.md`.

---

## 12.2 CD workflow stages

> Platform adaptation: Vercel builds immutable Git-SHA-versioned frontend/backend artifacts, not published Docker images. CI still builds both SHA-tagged Docker images. Reviewed, backward-compatible migrations run as an explicit operator step before a schema-dependent release; no production secrets enter GitHub Actions. Live smoke tests run after promotion and fail CD without automatically rolling back user traffic/data.

```text
main/tag
→ CI validation
→ build production images/artifacts
→ publish image if registry is used
→ prepare database migration
→ deploy backend
→ deploy frontend
→ health checks
→ smoke tests
→ release complete
```

Tasks:

- [x] Store production secrets in Vercel production environment secret management; CD requires no production GitHub secrets.
- [x] Never place secrets directly in workflow YAML.
- [x] Build versioned Vercel artifacts and SHA-tagged Docker images in CI.
- [x] Registry publishing: not applicable to the selected native Vercel deployment.
- [x] Deploy backend through the connected Vercel Services project, gated by CI.
- [x] Run/apply Alembic migrations using a controlled strategy: `python -m app.db.release` preflight; explicit guarded apply after backup/review only. Current Neon head verified; no new migrations needed.
- [x] Deploy frontend atomically with backend through Vercel Services.
- [x] Verify backend liveness through `/api/health` and the private service binding.
- [x] Verify frontend availability for the exact deployed Git SHA.
- [x] Run post-deployment read-only smoke tests with `CD`; authenticated/OTP/AI manual checks remain separately tracked in Phase 13.
- [x] Define code rollback, schema compatibility, data-restoration approval and automatic-assignment recovery procedure.

---

# PHASE 13 — PRODUCTION DEPLOYMENT PLAN

> Selected: existing Neon project/branch plus one Vercel Services project for Next.js and FastAPI. Production: https://unicircle-cuet.vercel.app. Groq chat and bundled CPU FastEmbed embeddings remove the laptop/Ollama requirement. See `docs/deployment/README.md` for release evidence and remaining manual checks.

# 13.1 Production infrastructure

Prepare:

```text
Frontend hosting
Backend/container hosting
Managed PostgreSQL
Vector storage (if separate)
File/media storage (if required)
Domain/DNS
HTTPS
Secret management
Logging/monitoring
```

Tasks:

- [x] Create production project/account/resources.
- [x] Configure the user-selected production Neon PostgreSQL database.
- [ ] Configure backup policy.
- [x] Configure database SSL if required.
- [x] Configure production application secrets in Vercel Secret variables.
- [x] Configure SMTP production credentials (delivery smoke test still pending).
- [x] Configure Groq chat and bundle the CPU embedding model; no production Ollama server required.
- [x] Configure production vector storage in Neon and add a separate cloud knowledge index.
- [ ] Configure media/storage if used.
- [x] Configure frontend production URL.
- [x] Configure private backend service binding (`BACKEND_API_URL`).
- [x] Configure production CORS.
- [x] Configure HTTPS.
- [ ] Configure domain/DNS if using custom domain.

---

# 13.2 Production database release

- [x] Restore the initial schema and existing records through a controlled transactional copy, as explicitly requested.
- [x] Verify schema revision and every table's row count/content fingerprint after copying.
- [ ] Apply future migrations through a controlled release job/process.
- [ ] Seed only required base data.
- [ ] Create/configure Admin account through a secure method.
- [x] Verify required departments/base reference data were preserved.
- [ ] Review any development/test accounts in the user-requested existing-data copy before wider use; do not add automated-test accounts to production.

---

# 13.3 Production backend release

- [x] Deploy FastAPI through Vercel's native Python runtime (the existing Docker image remains an alternative).
- [x] Configure environment variables.
- [x] Verify database connectivity through the deployed authentication API.
- [ ] Verify SMTP connectivity.
- [x] Verify cloud RAG dependencies and bundled model availability during the production build.
- [x] Verify backend `/health` through the public `/api/health` frontend route.
- [ ] Verify logs.
- [ ] Verify Admin authentication.

---

# 13.4 Production frontend release

- [x] Deploy production Next.js application.
- [x] Configure correct private backend service binding.
- [x] Verify production services use API implementations, not mock mode.
- [ ] Verify no development secret is bundled.
- [ ] Verify static/media assets.
- [ ] Verify responsive UI.

> Public home/login, registration-field rendering and protected-route redirects passed browser checks with no runtime errors. Mobile welcome-banner text clips at 390 px and remains a follow-up; authenticated flows and OTP delivery are not yet marked complete. The release is live, but the complete production smoke checklist below still requires manual verification.

---

# 13.5 Production smoke test

General User:

- [ ] Registration.
- [ ] OTP.
- [ ] Login.
- [ ] Home.
- [ ] Directory.
- [ ] Campus Explorer.
- [ ] Clubs/Events.
- [ ] Interested/Going.
- [ ] Resource request.
- [ ] Chat.
- [ ] Transport.
- [ ] Forum.
- [ ] News.
- [ ] Notifications.
- [ ] AI Assistant.
- [ ] Logout.

Admin:

- [ ] Admin login.
- [ ] Admin route access.
- [ ] Update transport.
- [ ] Publish announcement.
- [ ] Verify notification.
- [ ] Moderate reported post.

---

# PHASE 14 — Production Observability and Maintenance

## 14.1 Logging

- [ ] Application startup/shutdown logs.
- [ ] Server errors.
- [ ] Database errors.
- [ ] SMTP errors.
- [ ] Authentication failures without leaking credentials.
- [ ] Admin-operation logs where appropriate.
- [ ] RAG/Ollama failures.
- [ ] Background/scheduled notification failures.

Do **not** log:

- [ ] Passwords.
- [ ] JWTs.
- [ ] OTP values in production.
- [ ] SMTP password.
- [ ] Private Ollama service endpoints or infrastructure credentials.
- [ ] Sensitive private-chat contents unless specifically required and approved.

---

## 14.2 Monitoring

- [ ] Frontend availability.
- [ ] Backend availability.
- [ ] HTTP 5xx rate.
- [ ] Backend latency.
- [ ] PostgreSQL availability.
- [ ] Storage/vector service availability.
- [ ] Ollama/RAG failures.
- [ ] CI failures.
- [ ] CD/deployment failures.

---

## 14.3 Backup and recovery

- [ ] Database backup plan.
- [ ] Restore test.
- [ ] Vector knowledge-base rebuild/backup strategy.
- [ ] File/media backup strategy if used.
- [ ] Rollback plan for application deployment.
- [ ] Rollback/forward-fix strategy for database migrations.

---

# PHASE 15 — Final Documentation and Release

## 15.1 README

Include:

- [ ] Project description.
- [ ] Main features.
- [ ] Technology stack.
- [ ] Architecture overview.
- [ ] Local setup.
- [ ] Environment variables.
- [ ] Running frontend.
- [ ] Running backend.
- [ ] Running with Docker.
- [ ] Database migration commands.
- [ ] Testing commands.
- [ ] CI/CD overview.
- [ ] Deployment overview.

---

## 15.2 Technical documentation

Complete:

- [x] System Architecture ([working HLD](docs/design/HLD.md)).
- [x] HLD ([working design](docs/design/HLD.md)).
- [x] LLD ([working design](docs/design/LLD.md); refine feature contracts during implementation).
- [x] DFDs ([logical data flows](docs/design/Data_Flow_Diagram.md)).
- [x] ERD ([working design](docs/design/ERD.md); refine through reviewed migrations).
- [x] Document flow diagram ([business and development records](docs/design/Document_Flow_Diagram.md)).
- [x] Sequence diagrams ([critical feature journeys](docs/design/Sequence_Diagram.md)).
- [x] Use-case diagrams ([actors and permissions](docs/design/Use_Case_Diagram.md)).
- [ ] API documentation.
- [x] Authentication flow ([sequence and LLD](docs/design/Sequence_Diagram.md#registration-verification-and-login)).
- [x] RAG flow ([assistant sequence](docs/design/Sequence_Diagram.md#campus-assistant-query); provider choices pending).
- [ ] Docker documentation.
- [ ] Testing strategy/results.
- [ ] CI/CD documentation.
- [ ] Deployment architecture.
- [ ] Known limitations.

---

# FINAL FEATURE-WISE IMPLEMENTATION ORDER

Use this as the main execution queue.

## A. Foundation

- [ ] Repository structure.
- [ ] Git workflow.
- [ ] Environment strategy.
- [ ] Next.js foundation.
- [ ] Shared frontend shell.
- [ ] Mock service architecture.

## B. Complete Frontend — Feature by Feature

1. [x] Authentication.
2. [x] Home.
3. [ ] Department & Faculty Directory.
4. [x] Campus Explorer.
5. [ ] Club & Event Hub.
6. [ ] Resource Sharing.
7. [ ] Chat UI.
8. [ ] Transport.
9. [ ] Community Discussion Forum.
10. [ ] Campus News & Announcements.
11. [ ] Campus AI Assistant.
12. [ ] Notifications.
13. [ ] Admin Page.
14. [ ] Full frontend walkthrough and cleanup.

## C. Backend Foundation

- [ ] FastAPI.
- [ ] PostgreSQL.
- [ ] SQLAlchemy.
- [ ] Alembic.
- [ ] Config.
- [ ] Logging.
- [ ] Errors.
- [ ] Auth/security utilities.
- [ ] SMTP foundation.
- [ ] Test foundation.

## D. Backend + Frontend Connection — Feature by Feature

1. [ ] Authentication + OTP + JWT → connect frontend.
2. [ ] Home content strategy/API → connect frontend if required.
3. [ ] Department & Faculty Directory → connect frontend.
4. [x] Campus Explorer → connect frontend.
5. [ ] Club & Event Hub → connect frontend.
6. [ ] Event Interested/Going + notifications → connect frontend.
7. [ ] Resource Requests → connect frontend.
8. [ ] User-to-user Chat → connect frontend.
9. [ ] Transport + Bus Drivers + Admin transport management → connect frontend.
10. [ ] Community Forum + Comments + Reports + Admin moderation → connect frontend.
11. [ ] Campus News/Announcements + notifications + Admin management → connect frontend.
12. [ ] Shared Notification system → finalize frontend connection.
13. [ ] Campus AI Assistant/RAG → connect frontend.
14. [ ] Admin authorization/integration review.
15. [ ] Remove production mock dependencies.
16. [ ] Full integration walkthrough.

## E. Testing

- [ ] Frontend unit/component tests.
- [ ] Backend unit tests.
- [ ] API tests.
- [ ] Database integration tests.
- [ ] Feature integration tests.
- [ ] E2E tests.
- [ ] Authentication/security tests.
- [ ] Authorization tests.
- [ ] RAG evaluation.
- [ ] Basic performance tests.
- [ ] Regression test pass.

## F. Docker

- [ ] Backend Dockerfile.
- [ ] Frontend Dockerfile.
- [ ] PostgreSQL Compose service.
- [ ] Full Docker Compose stack.
- [ ] Production image hardening.
- [ ] Docker smoke tests.

## G. CI/CD

- [ ] GitHub Actions frontend CI.
- [ ] GitHub Actions backend CI.
- [ ] Database/API CI tests.
- [ ] Docker build validation.
- [ ] Branch protection.
- [ ] Production CD workflow.
- [ ] Migration step.
- [ ] Health checks.
- [ ] Post-deployment smoke test.
- [ ] Rollback plan.

## H. Production

- [ ] Provision production services.
- [ ] Configure secrets.
- [ ] Configure PostgreSQL.
- [ ] Configure vector/RAG infrastructure.
- [ ] Configure SMTP.
- [ ] Deploy backend.
- [ ] Deploy frontend.
- [ ] Run migrations.
- [ ] Configure HTTPS/domain.
- [ ] Production smoke test.
- [ ] Monitoring/logging.
- [ ] Backup/recovery.
- [ ] Final documentation.
- [ ] Release.

---

# Definition of Done for Every Backend Feature

A backend-connected feature is not complete until:

- [ ] Requirement is implemented.
- [ ] Database migration exists where needed.
- [ ] Data model is reviewed.
- [ ] Pydantic/request-response schema is defined.
- [ ] Business logic is in the proper module/service.
- [ ] API route is implemented.
- [ ] Authentication is applied where required.
- [ ] Authorization is applied where required.
- [ ] Validation exists.
- [ ] Error cases are handled.
- [ ] Backend tests pass.
- [ ] API is manually/API-test verified.
- [ ] Frontend mock has been replaced.
- [ ] Loading/error/empty frontend states use real API behavior.
- [ ] Feature integration test passes.
- [ ] Documentation is updated.
- [ ] Pull request CI passes.

---

# Recommended Working Method With AI

For learning, do not ask AI to generate a whole feature in one request.

For each feature:

```text
1. Read the approved design yourself.
2. Decide the next small task.
3. Ask AI to explain the concept.
4. Implement the task yourself.
5. Ask AI to review your code.
6. Fix issues yourself.
7. Run tests.
8. Commit.
9. Move to the next small task.
```

Useful AI prompts:

```text
"Explain the responsibility of this component without writing the code."

"Review my implementation against this LLD. Point out problems but do not rewrite it."

"Explain why this FastAPI dependency is needed."

"Help me design the test cases before I implement the endpoint."

"Here is my error. Explain the root cause first, then show the smallest fix."

"Review this migration for data-integrity risks."

"Check whether this frontend component is mixing presentation and API responsibilities."
```

Avoid:

```text
"Build the entire UniCircle project for me."
```

The goal is to use AI as a **teacher, reviewer, pair programmer, and debugger** while keeping the architecture and implementation understandable to the project team.
