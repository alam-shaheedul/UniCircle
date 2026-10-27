# Community forum feature

Feature 8 provides the `/forum` community discussion experience.

- The server route reads authenticated posts, comments, authors, and report state
  through `ForumService`.
- The client feed persists text-only post and comment creation with validation,
  pending, and error states.
- Posts expose a confirmation step before they are reported to an App Admin.
- A report is persisted once per user/post and appears in the App Admin queue.
- Admins can dismiss a report or soft-remove its post; removed posts and comments
  disappear from the user feed.
- No reaction controls or image/video upload controls are included by design.

The same-origin `/api/forum/*` handler keeps the access token out of browser
JavaScript and performs origin/CSRF checks for every mutation.
