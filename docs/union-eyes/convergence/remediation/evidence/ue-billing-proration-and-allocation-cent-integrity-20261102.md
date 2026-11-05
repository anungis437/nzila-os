# UE billing calendar proration and fund-allocation cent integrity — engineering evidence

Date: 2026-11-02 UTC
Branch: `agents/ue-cursor-final-closure`
Pre-change baseline: `5dfbd44677d7880453534182f73b1eb3043e79e1`
Source change: `e2e0a3b9101200d604db5852f30dfd478eef1ed1`
Adversarial regression change: `2ac3fd483e346e18cfbfe76b4f37eeeec3700701`

## Defect mechanism and permanent correction

`BillingCycleService.calculateProRatedAmount` previously divided elapsed milliseconds by 24-hour days and used a ceiling on the difference between period end and join date. The persisted billing periods use UTC calendar dates, with API period ends potentially at 23:59:59.999. A member joining on the final eligible calendar day could be undercharged or counted inconsistently across DST, and an inclusive March period could have an incorrect denominator. The source now derives UTC calendar-day ordinals and counts both period endpoints and the join day. Invalid or reversed calendar dates refuse instead of returning NaN.

`BillingCycleService.allocateDuesBreakdown` independently rounded four floating-point allocations, allowing allocated components to differ from the charged amount by cents. It now allocates in integer cents, assigns the residual to regular dues, and rejects negative, non-finite and unsafe-integer monetary inputs. The existing 85/10/3/2 default allocation is **not** an institutionally approved allocation mandate; this change reconciles arithmetic but does not authorize the policy.

## Evidence and qualification boundary

Source: `apps/union-eyes/lib/services/billing-cycle-service.ts`.
Adversarial unit tests: `apps/union-eyes/lib/__tests__/billing-cycle-service.test.ts` (final-day join, inclusive 31-day period, leap day, spring DST, invalid dates, sub-dollar and multi-dollar exact-cent reconciliation, negative/nonfinite/unsafe amount refusal).

These are source changes and authored tests, **not** proof that the new HEAD passed tests. The prior baseline `5dfbd44677d7880453534182f73b1eb3043e79e1` passed all seven substantive CI workflows before this change, but its results cannot be transferred to this HEAD. New exact-HEAD Vitest/contract, security, native PostgreSQL 15/16 and HTTP/browser workflows must be inspected after completion. No staging acceptance or independent qualification is claimed here.

## Outstanding obligations

Prove persisted charges and fund components reconcile under native PG15/16 and real HTTP, verify all billing cycle transaction/audit atomicity, exactly-once generation, approved allocation mandates and recurrence-anchor semantics. Validate full member/officer/finance journeys. Institutional authority, owner-persona ratification and independent reviewer sign-off remain outstanding. Frozen 777-defect provenance is unchanged. **Defect implementation credit: 0; independent CLOSED credit: 0; GO: NO.**
