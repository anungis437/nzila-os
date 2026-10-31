# Union Eyes Gate 0 — push-device registration hardening (source-only)

**Frozen defect family:** `DEF-0B9-MOB-PUSH-DEVICE-REGISTRATION-REQUIRES…` (mobile-device registration in the original 777-defect population). This is an additive engineering record, **not** a change to the frozen classification or an institutional disposition.

**Code commits:** `fe30fa92322a333e6500603f44f94d04825232fe`, `ef346790cd4a58a56fce1d3129ebe8cb1ebacea6`, `cb55be0120c372d8dd4b9e7a1c448ca58389b475`, `d08d6b26e3cebf8cde3a021684e39ac5e093fee7`.

**Source change:** `apps/union-eyes/app/api/mobile/devices/route.ts` now rejects missing authenticated user IDs, empty tokens, unsupported platform values, invalid HH:mm preferences, malformed enabled flags, overlong device metadata, and invalid IANA time zones before inserting. It also queries the authenticated caller's existing `profiles.user_id` under an organization-bound RLS transaction and refuses registration with a documented 409 if that profile is not provisioned. It does not fabricate a profile or silently register a device. The preflight respects the actual foreign key `push_devices.profile_id → profiles.user_id`. The factory continues to enforce owner and organization scope and redact delivery tokens.

**Regression source:** `apps/union-eyes/app/api/mobile/devices/__tests__/route.test.ts` now covers malformed values, valid preferences, absent subject, and the missing-profile precondition. These tests are committed but their executable results are not asserted here.

**Remaining acceptance:** run the focused Vitest file, complete application/contract/security suites, and native PG15/16 cases for an authenticated member with and without a profile, a foreign-tenant member, duplicate token, and profile provisioned concurrently. Confirm actual HTTP 409 vs 500 behavior, token redaction, owner-scoped GET/DELETE, and end-to-end registration/notification delivery. The two device tables and missing sender integration remain separate, explicitly unresolved work. Any database outage must remain a failure, not an empty-success result.

**Qualification:** SOURCE PATCH COMMITTED; UNIT/NATIVE/HTTP/STAGING UNVERIFIED at creation. **Defect remains PARTIAL, not CLOSED.** No reviewer, persona owner or institutional authority sign-off is inferred. Original 777-defect provenance and frozen evidence remain unchanged.
