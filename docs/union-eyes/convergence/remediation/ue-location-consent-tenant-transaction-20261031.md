# Union Eyes Gate 0 — location consent tenant-bound read hardening

**Date:** 2026-10-31  
**Qualification:** SOURCE_IMPLEMENTED / EXECUTABLE_PENDING / NATIVE_PENDING / HTTP_PENDING / INSTITUTIONAL_PENDING

## Root cause and repair

The consent-status GET handler called `GeofencePrivacyService.hasValidConsent` without passing the tenant-bound database transaction. The service read through its default database handle. The location tracking writer similarly checked consent without forwarding the transaction already used for the location write.

The GET handler now resolves the authenticated member's organization and calls `hasValidConsent(userId, context, tx)` inside `withRLSContext({ organizationId }, ...)`. The service accepts an optional transaction for backward compatibility and uses that transaction for the consent read. The location writer forwards its transaction to the consent check. Database refusal is not converted into `hasConsent: false` or a successful location write.

## Regression evidence authored

- `apps/union-eyes/app/api/__tests__/location-consent.route.test.ts`: verifies the GET uses the authenticated member, resolves their organization, forwards the transaction, and fails closed on organization resolution or tenant-bound read errors.
- `apps/union-eyes/db/__tests__/location-consent-tenant-read.pglite.test.ts`: PGlite runtime-role SELECT policy denies another member's consent, respects strike/event flags and expiry, and does not mutate consent during a read.

**No completed executable, PostgreSQL 15/16, HTTP/browser, or staging qualification is claimed in this record.** Exact-HEAD CI and native acceptance must be inspected independently. This is an additive source-hardening record, not a new frozen defect, not a defect closure, and not an independent ratification.

## Remaining institutional and product work

The separate Gate 0 defect concerning client-supplied consent text and purpose remains PARTIAL: the platform still needs a server-owned versioned consent notice and a member acknowledgment UI. No client-supplied consent text is endorsed by this change. Cross-organization authorization and canonical deployment RLS must be verified with the real PG15/16 runtime role, and member GET/track journeys over HTTP/browser must be exercised.
