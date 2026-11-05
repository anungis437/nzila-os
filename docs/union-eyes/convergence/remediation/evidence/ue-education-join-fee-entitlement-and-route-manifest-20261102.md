# Union Eyes — education join fee entitlement and route manifest reconciliation (2026-11-02)

**Disposition: SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED.** No defect closure, release acceptance, payment mandate or production authorization is claimed.

## Starting point and failure evidence

Starting branch HEAD: `fc5614701e479ed0867ad070da3c55e969a782f4`.
At that SHA, App Floor Check, governance attestation, security regression, native PostgreSQL acceptance and disposable HTTP/browser acceptance passed. Full regression **failed**: whole-application Vitest reported 1,812 passing files, 1 failing file (2 failing tests), 4 skipped files. Both failures were the UE-CONV-K-008 route-coverage manifest and aggregate summary drifting after the new `education/registrations/join/route.ts` was introduced. The whole-contract job passed. These are exact **starting-HEAD** results, not proof of the repairs.

## Permanent engineering correction

1. The registration-scoped `GET /api/education/registrations/join` query now reads the **stored** registration fee, payment and waiver flags from the same authenticated tenant transaction. A paid registration with neither recorded payment nor recorded waiver cannot receive a joining URL or access code. Unknown, malformed and negative fee values also refuse disclosure. A zero-fee registration remains eligible. The response remains limited to `sessionId`, `joinUrl` and `accessCode`; no payment or waiver details are disclosed or placed in the audit payload.
2. Added adversarial route tests for unpaid paid registrations, missing/malformed/negative fees, and positive paid, waived and free cases. Existing owner, organization, approval, date, URL and mandatory atomic-audit tests remain.
3. Reconciled the generated route-coverage manifest by adding the one new route as authenticated `WITH_API`, tenant transaction `TENANT_TX`, `READ_ONLY` and `GET`. The manifest now records 1,011 routes (previously 1,010); mutating routes remain 682, kernel routes remain 60, and the `WITH_API` guard count increases from 293 to 294. Frozen Gate 0 defect classification, baselines and historical acceptance evidence were not rewritten.

## Limits and follow-up

The registration record's `feePaid` and `feeWaived` flags are not proof of an approved settlement/waiver mandate. Their upstream mutation authority and payment reconciliation must be independently qualified before financial acceptance. Registration creation itself does **not** charge or settle money. The route's new tests and route-manifest correction need exact-HEAD full Vitest/contract and native PG15/16, HTTP/browser and staging qualification. The scanner is textual classification, not independent authorization proof. Complete member/steward/officer/financial/WorkAid journeys and all 777 frozen defects remain in scope.

**Defect completion credit: 0. CLOSED credit: 0.** Independent reviewer, owner-persona ratification and institutional authority decisions remain outstanding.
