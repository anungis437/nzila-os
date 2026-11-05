# UE Gate 0 — education reminder replay containment (2026-10-31)

Defect: `DEF-0B6-EDU-CRON-REMINDERS-IGNORE-OPT-OUT-AND-HAVE-NO-SENT-MARKER`.

Source: Both education cron queries already honor `communication_preferences.email_enabled` and `training_reminders`. This patch supplies organization, user, source registration/certification and tier to a durable delivery marker. Before the provider call, the sender claims a unique `in_app_notifications.data.dedupeKey` row using the deployed `20261103_in_app_notifications_dedupe_key.sql` unique index. A repeated/overlapping run cannot claim the same recipient/source/tier. Definitive provider refusals release the marker; unexpected exceptions retain it for manual reconciliation rather than risk replay. No delivery occurs if the marker cannot be written. Error arrays no longer contain member email addresses.

Regression source: `lib/education/__tests__/reminder-delivery.pglite.test.ts`, `lib/education/__tests__/reminder-queries.pglite.test.ts`, and `app/api/__tests__/cron-education-reminders.route.test.ts`.

Qualification: SOURCE IMPLEMENTED, not CLOSED. The newly added native-like PGlite tests and whole-app regression are not asserted passing until CI reports exact-HEAD outcomes. Real PostgreSQL 15/16, HTTP/browser and staging remain separately required. No independent reviewer or institutional decision is asserted. An in-flight provider call interrupted after acceptance remains an operational reconciliation case; it is not automatically retried.
