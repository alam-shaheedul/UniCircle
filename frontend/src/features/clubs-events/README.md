# Clubs and events feature

Feature 5 provides two connected authenticated views:

- `/clubs` displays the complete club directory as rectangular navigation cards.
- `/clubs/[clubId]` gives each club its own page with club information, leadership,
  activities, and events grouped by lifecycle state.
- `/events` provides a campus-wide event feed with persisted status filters and
  `Interested`/`Going` state.

The route reads backend-managed club and event records through `ClubEventService`.
Event-start and event-finish notification records deep-link from the global
notification interface to matching event cards.
