# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\negative-workflow-transitions.spec.ts >> UE E2E — negative workflow transitions (FSM invariant) >> triage → resolved is blocked — must go via under_review (NEG-FSM-TRIAGE-DIRECT-RESOLVE)
- Location: tests\e2e\negative-workflow-transitions.spec.ts:36:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * UE E2E — Negative Workflow Transition Tests
  3   |  *
  4   |  * Validates that invalid FSM transitions are structurally blocked,
  5   |  * not just UI-gated. Covers:
  6   |  *   - triage → resolved (must go via under_review first)
  7   |  *   - closed → investigation (must go via explicit reopen)
  8   |  *   - arbitration bypass (member cannot self-advance to arbitration)
  9   |  *   - member cannot resolve a case directly
  10  |  *   - re-submit a closed case (must be rejected)
  11  |  *
  12  |  * Acceptance: server returns 409/422 for every invalid transition attempt.
  13  |  *
  14  |  * @tags negative-path, fsm, workflow-invariant
  15  |  */
  16  | import { expect, test } from '@playwright/test'
  17  | import {
  18  |   assertPermissionDenied,
  19  |   cleanupDatabaseConnections,
  20  |   ensureServerReady,
  21  |   loginAsTestUser,
  22  |   seedOrVerifyTestState,
  23  |   UE_E2E_USERS,
  24  | } from './_helpers'
  25  | 
  26  | test.describe('UE E2E — negative workflow transitions (FSM invariant)', () => {
> 27  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  28  |     await ensureServerReady(request)
  29  |     await seedOrVerifyTestState(request)
  30  |   })
  31  | 
  32  |   test.afterEach(async ({ request }) => {
  33  |     await cleanupDatabaseConnections(request)
  34  |   })
  35  | 
  36  |   test('triage → resolved is blocked — must go via under_review (NEG-FSM-TRIAGE-DIRECT-RESOLVE)', async ({
  37  |     request,
  38  |   }) => {
  39  |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  40  | 
  41  |     // Attempt to jump from triage directly to resolved (skipping under_review)
  42  |     const skip = await request.post('/api/workflow/transition', {
  43  |       data: {
  44  |         claimNumber: 'UE-QA-0001',
  45  |         targetStatus: 'resolved',
  46  |         notes: 'Attempted triage-to-resolved bypass',
  47  |       },
  48  |     })
  49  | 
  50  |     // Server MUST reject this invalid transition
  51  |     expect(
  52  |       [400, 409, 422],
  53  |       `Expected FSM rejection (409/422) but got ${skip.status()}`,
  54  |     ).toContain(skip.status())
  55  |   })
  56  | 
  57  |   test('closed → investigation is blocked without explicit reopen (NEG-FSM-CLOSED-NO-INVESTIGATION)', async ({
  58  |     request,
  59  |   }) => {
  60  |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  61  | 
  62  |     // Close a case first (may already be closed — 409 is acceptable)
  63  |     await request.post('/api/workflow/transition', {
  64  |       data: {
  65  |         claimNumber: 'UE-QA-0003',
  66  |         targetStatus: 'resolved',
  67  |       },
  68  |     })
  69  | 
  70  |     // Attempt to move directly from resolved/closed to investigation without reopen step
  71  |     const directInvestigation = await request.post('/api/workflow/transition', {
  72  |       data: {
  73  |         claimNumber: 'UE-QA-0003',
  74  |         targetStatus: 'under_investigation',
  75  |       },
  76  |     })
  77  | 
  78  |     expect(
  79  |       [400, 409, 422],
  80  |       `Closed→investigation bypass must be rejected; got ${directInvestigation.status()}`,
  81  |     ).toContain(directInvestigation.status())
  82  |   })
  83  | 
  84  |   test('member cannot self-advance case to arbitration (NEG-FSM-ARBITRATION-BYPASS)', async ({
  85  |     request,
  86  |   }) => {
  87  |     await loginAsTestUser(request, UE_E2E_USERS.member)
  88  | 
  89  |     const arbitrationAttempt = await request.post('/api/workflow/transition', {
  90  |       data: {
  91  |         claimNumber: 'UE-QA-0001',
  92  |         targetStatus: 'arbitration',
  93  |         notes: 'Member bypass attempt',
  94  |       },
  95  |     })
  96  | 
  97  |     // Either permission-denied (403) or FSM rejection (409/422)
  98  |     expect(
  99  |       [400, 401, 403, 409, 422],
  100 |       `Member arbitration bypass must be blocked; got ${arbitrationAttempt.status()}`,
  101 |     ).toContain(arbitrationAttempt.status())
  102 |   })
  103 | 
  104 |   test('member cannot directly resolve a case (NEG-FSM-MEMBER-DIRECT-RESOLVE)', async ({
  105 |     request,
  106 |   }) => {
  107 |     await loginAsTestUser(request, UE_E2E_USERS.member)
  108 | 
  109 |     const resolve = await request.post('/api/workflow/transition', {
  110 |       data: {
  111 |         claimNumber: 'UE-QA-0001',
  112 |         targetStatus: 'resolved',
  113 |       },
  114 |     })
  115 | 
  116 |     // Must be permission-denied or FSM-rejected
  117 |     expect(
  118 |       [400, 401, 403, 409, 422],
  119 |       `Member direct resolve must be blocked; got ${resolve.status()}`,
  120 |     ).toContain(resolve.status())
  121 |   })
  122 | 
  123 |   test('re-submitting a resolved case without reopen is rejected (NEG-FSM-RESUBMIT-CLOSED)', async ({
  124 |     request,
  125 |   }) => {
  126 |     await loginAsTestUser(request, UE_E2E_USERS.admin)
  127 | 
```