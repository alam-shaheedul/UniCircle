# Resource sharing

`/resources` and `/chat` use the authenticated backend through the Next.js
resource-sharing proxy. Students choose whether their resource profile appears
in discovery and which categories they may share. Other students can request
a resource; only the recipient can accept or reject. Accepted requests open
a private conversation for those two users. Requests and discovery refresh
every 15 seconds; the selected chat refreshes every 5 seconds while visible.
Older messages can be loaded on demand.

There is no seeded demo data. Discovery is empty until another registered,
verified student opts in. Neither profile data nor messages are end-to-end
encrypted; deploy behind HTTPS. Server API details are in `backend/README.md`.
