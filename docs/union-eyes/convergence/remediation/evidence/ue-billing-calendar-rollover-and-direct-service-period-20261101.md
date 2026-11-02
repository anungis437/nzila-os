# UE billing calendar rollover and direct-service period integrity — 2026-11-01

Status: SOURCE_CHANGED; exact-HEAD executable, native PostgreSQL, HTTP/browser, and staging qualification are not established by this document. No defect independently CLOSED.

## Root causes

1. The default monthly billing interval computed its last day by incrementing the month while retaining the reference day. On January 31 this can normalize into March before `setDate(0)`, producing a February date for a January cycle.
2. The quarterly interval set its quarter-start month before setting the day to 1. On May 31 this normalizes April 31 to May 1, omitting April from Q2.
3. The next billing date advanced monthly, quarterly and annual anniversaries using unbounded `setMonth` / `setFullYear`, which skips the intended target month for month-end anchors and leap days.
4. Direct service and scheduler callers of `generateBillingCycle` did not reject reversed or invalid Date instances before opening the transaction, even though the HTTP routes have a separate parser.

## Source corrections

The monthly and quarterly boundary calculations now set day 1 before advancing the calendar month. Monthly, quarterly and annual next-billing calculations clamp to the last valid day of the target month. Unsupported frequency and invalid reference/last-billing dates are explicitly refused. The billing service rejects invalid or reversed periods before logging or accessing the financial database transaction.

## Regression coverage

`apps/union-eyes/lib/__tests__/billing-cycle-service.test.ts` adds Jan 31 monthly interval, May 31 Q2, Dec 31 Q4, Jan 31 -> Feb 28/29, quarterly Jan 31 -> Apr 30, leap-day anniversary, and invalid-input cases.

`apps/union-eyes/lib/services/__tests__/billing-cycle-service.test.ts` adds direct-service invalid/reversed-period refusal with no transaction or mandate call.

## Qualification boundaries

The change does not establish exactly-once billing, an authoritative persisted recurrence anchor, financial allocation mandate, atomic intent/outcome audit, provider reconciliation, or institutional approval. Repeated monthly execution from a clamped February 28 date will not automatically restore an original January 31 end-of-month anchor; a governed schedule anchor is a separate obligation. These source tests do not prove deployed native rollback, real-login behavior, or end-to-end accounting. Frozen 777-defect registers and Gate 0C.4 decisions remain unchanged. **Defect-completion credit: 0. CLOSED credit: 0.**
