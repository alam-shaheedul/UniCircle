# Notifications feature

Owns the notification dropdown, full-page list, typed notification model, timestamp
formatting, and persistent read-state behavior. A provider in the authenticated shell keeps
the navbar dropdown and notification page synchronized. The components depend on the
notification service contract backed by the authenticated API.

Campus Update and Announcement notifications are created by the backend when an App
Admin publishes an eligible item. Event and club-membership notifications share the
same list and read endpoints.
