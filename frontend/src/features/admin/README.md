# Admin feature

The Admin workspace is a role-protected frontend for the responsibilities
defined in the project workflow:

- Transport schedules, recurring service windows, routes, and drivers.
- Campus news, updates, announcements, drafts, and publication state.
- Reported community posts with resolve and remove-post actions.
- Club-creation requests with pending and reviewed history.

Transport, campus publishing, forum moderation, and club-request review use
authenticated FastAPI APIs with server-side App Admin authorization. The
frontend role guard remains only a user-experience boundary and is never the
security control.
