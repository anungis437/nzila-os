# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\pilot-journey.spec.ts >> Union pilot journey >> member intake uses the approved intake and evidence endpoints
- Location: e2e\pilot-journey.spec.ts:15:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { ensureServerReady } from '../tests/e2e/_helpers';
  3   | import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';
  4   | 
  5   | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
  6   | 
  7   | test.describe('Union pilot journey', () => {
  8   |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  9   | 
> 10  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  11  |     await ensureServerReady(request);
  12  |     await bootstrapE2EAuth(request);
  13  |   });
  14  | 
  15  |   test('member intake uses the approved intake and evidence endpoints', async ({ page }) => {
  16  |     // Intake journey requires an authenticated member context.
  17  |     await loginAsRole(page, 'member');
  18  | 
  19  |     const intakeRequests: Array<Record<string, unknown>> = [];
  20  |     const evidenceRequests: string[] = [];
  21  | 
  22  |     await page.route('**/api/cases/intake', async (route) => {
  23  |       const body = route.request().postDataJSON() as Record<string, unknown>;
  24  |       intakeRequests.push(body);
  25  |       await route.fulfill({
  26  |         status: 201,
  27  |         contentType: 'application/json',
  28  |         body: JSON.stringify({
  29  |           success: true,
  30  |           claimId: '11111111-1111-4111-8111-111111111111',
  31  |           claimNumber: 'CASE-20260419-0001',
  32  |           status: 'submitted',
  33  |         }),
  34  |       });
  35  |     });
  36  | 
  37  |     await page.route('**/api/cases/11111111-1111-4111-8111-111111111111/evidence', async (route) => {
  38  |       evidenceRequests.push(route.request().url());
  39  |       await route.fulfill({
  40  |         status: 200,
  41  |         contentType: 'application/json',
  42  |         body: JSON.stringify({
  43  |           success: true,
  44  |           data: {
  45  |             attachment: {
  46  |               url: 'https://example.test/evidence.txt',
  47  |               fileName: 'evidence.txt',
  48  |               fileSize: 12,
  49  |               fileType: 'text/plain',
  50  |               uploadedAt: '2026-04-19T00:00:00.000Z',
  51  |               uploadedBy: 'test-user',
  52  |             },
  53  |           },
  54  |         }),
  55  |       });
  56  |     });
  57  | 
  58  |     await page.goto('/en-CA/dashboard/claims/new');
  59  | 
  60  |     await expect(page.getByRole('heading', { name: 'Create a New Case' })).toBeVisible();
  61  | 
  62  |     await page.evaluate(async () => {
  63  |       const intakeResponse = await fetch('/api/cases/intake', {
  64  |         method: 'POST',
  65  |         headers: { 'Content-Type': 'application/json' },
  66  |         body: JSON.stringify({
  67  |           memberId: 'ue-qa-member-primary',
  68  |           title: 'Unsafe overtime denial',
  69  |           caseType: 'wage_dispute',
  70  |           priority: 'critical',
  71  |           incidentDate: '2026-04-18',
  72  |           location: 'Toronto yard',
  73  |           description: 'Detailed intake description for the union pilot path.',
  74  |           desiredOutcome: 'Resolution requested for: Unsafe overtime denial',
  75  |           witnesses: 'Pat Doe',
  76  |           isAnonymous: true,
  77  |         }),
  78  |       });
  79  | 
  80  |       if (!intakeResponse.ok) {
  81  |         throw new Error(`intake submit failed: ${intakeResponse.status}`);
  82  |       }
  83  | 
  84  |       const intakeResult = await intakeResponse.json();
  85  |       const claimId = intakeResult.claimId || intakeResult.data?.claimId;
  86  | 
  87  |       const evidenceResponse = await fetch(`/api/cases/${claimId}/evidence`, {
  88  |         method: 'POST',
  89  |         body: (() => {
  90  |           const formData = new FormData();
  91  |           formData.append('file', new File(['pilot evidence'], 'evidence.txt', { type: 'text/plain' }));
  92  |           return formData;
  93  |         })(),
  94  |       });
  95  | 
  96  |       if (!evidenceResponse.ok) {
  97  |         throw new Error(`evidence upload failed: ${evidenceResponse.status}`);
  98  |       }
  99  |     });
  100 | 
  101 |     await expect.poll(() => intakeRequests.length).toBe(1);
  102 |     await expect.poll(() => evidenceRequests.length).toBe(1);
  103 | 
  104 |     expect(intakeRequests[0]).toMatchObject({
  105 |       caseType: 'wage_dispute',
  106 |       priority: 'critical',
  107 |       title: 'Unsafe overtime denial',
  108 |     });
  109 |   });
  110 | 
```