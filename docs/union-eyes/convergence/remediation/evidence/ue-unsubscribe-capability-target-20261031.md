# Union Eyes Gate 0 — unsubscribe capability target validation (unqualified source evidence)

**Scope:** DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC (supplemental authorization-input hardening; defect remains PARTIAL), DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE and DEF-0B5-UNSUBSCRIBE-NO-CONSENT-RECORD-WITHOUT-CAMPAIGN (no additional completion credit).

**Source:** `apps/union-eyes/app/api/communications/unsubscribe/[recipientId]/route.ts`.

**Tests authored:** `apps/union-eyes/app/api/__tests__/communications-unsubscribe.route.test.ts`.

**Source commits:** `22aa52454dfc9307624f47f23707959e639697cd` (schema validation), `8eab8a2aa706b5f7f349151dedb15ca07c3b0cff` (identifier regex correction).

**Test commit:** `5d8b62d3e0555e7cb1c2d4ad4433fbc4d1f0156e`.

## Change and risk addressed

The signed HMAC payload uses colon-separated campaign and recipient components. The GET confirmation and POST revocation paths now share Zod validation that refuses colon/control/whitespace/path-delimiter injection and oversized identifiers, requires exactly one of campaign-specific or separately signed global authority, and rejects duplicate `campaignId`, `scope` or `token` query parameters. This prevents conflicting URL parameter interpretation and ambiguous signed component boundaries before any system-context database work. The RFC 8058 POST body is not used as an authorization source; the URL's signed capability remains authoritative.

Three adversarial regression cases were authored: signed delimiter injection for recipient and campaign (GET and POST), duplicate authority parameters, and oversized identifiers. Existing campaign, global, scanner-safe GET and consent-transaction behavior are intended to remain unchanged.

## Verification and remaining gates

Source readback confirmed the schema, both route integrations and corrected regex. The new tests were **authored, not executed** by this run. The pre-change HEAD `680b712ee2de5769ae0c99ea1307829fc8632123` had App Floor Check, security regression, native PostgreSQL and governance attestation successes, but whole Vitest/contract and HTTP/browser failures. These older results **do not qualify** the new commits.

Still required: exact-HEAD focused test, full Vitest/contract, real PostgreSQL 15/16, HTTP/browser/staging and email-provider one-click acceptance; audit/consent transaction verification; independent reviewer, owner-persona ratification and institutional authority decisions. No defect is CLOSED, no institutional decision is inferred and no frozen artifact was modified.
