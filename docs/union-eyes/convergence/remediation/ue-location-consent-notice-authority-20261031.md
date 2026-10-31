# Union Eyes Gate 0 — location consent notice authority (engineering evidence)

Defect: `DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED`.

## Source corrections
- `lib/location/consent-notice.ts` requires institution-supplied `UE_LOCATION_CONSENT_NOTICE_VERSION` (at most 10 characters, matching the database) and `UE_LOCATION_CONSENT_NOTICE_TEXT` (nonempty, at most 4000 characters). There is deliberately no fabricated or implicitly approved notice.
- `GET /api/location/consent` exposes the exact configured notice and whether a grant is available. It does not grant consent and sends `Cache-Control: no-store`.
- `POST /api/location/consent` requires `noticeVersion`, `acknowledged: true`, and at least one of `allowedDuringStrike` or `allowedDuringEvents`. Client-provided purpose, description, consent text, user ID, unknown fields and non-boolean permissions are rejected. A stale version is a 409; absent notice is a 503, with no consent write.
- The service independently verifies the version, purpose, description and exact consent text before any database read/write, then persists the configured version instead of the former hard-coded `1.0`. The grant and audit remain in the same RLS transaction. The response projects a member receipt, not the complete stored audit metadata.
- Route and service regression tests cover forged text/version, missing acknowledgment, absent notice, permissions, member identity, server-only values, and audit failures.

## Verification state and activation prerequisites
Source changes and tests are committed; **no executable, native PostgreSQL 15/16, HTTP/browser or staging qualification is claimed by this record**. CI results must be inspected at the exact final SHA. The current institutionally approved wording and version have **not** been supplied or ratified by this agent; therefore POST intentionally refuses grants until they are configured. A member-facing form must display the GET notice and send the exact version plus explicit acknowledgment and scope choices. No production deployment or release GO is authorized.

The frozen 777-defect provenance remains unchanged. This is engineering remediation with outstanding institutional and runtime acceptance, not CLOSED.
