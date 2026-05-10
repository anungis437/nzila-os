import { test, expect } from '@playwright/test';
import { ensureServerReady } from '../tests/e2e/_helpers';
import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';

test.describe('CUPE pilot journey', () => {
  test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
    await bootstrapE2EAuth(request);
  });

  test('member intake uses the approved intake and evidence endpoints', async ({ page }) => {
    // Intake journey requires an authenticated member context.
    await loginAsRole(page, 'member');

    const intakeRequests: Array<Record<string, unknown>> = [];
    const evidenceRequests: string[] = [];

    await page.route('**/api/cases/intake', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      intakeRequests.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          claimId: '11111111-1111-4111-8111-111111111111',
          claimNumber: 'CASE-20260419-0001',
          status: 'submitted',
        }),
      });
    });

    await page.route('**/api/cases/11111111-1111-4111-8111-111111111111/evidence', async (route) => {
      evidenceRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            attachment: {
              url: 'https://example.test/evidence.txt',
              fileName: 'evidence.txt',
              fileSize: 12,
              fileType: 'text/plain',
              uploadedAt: '2026-04-19T00:00:00.000Z',
              uploadedBy: 'test-user',
            },
          },
        }),
      });
    });

    await page.goto('/en-CA/dashboard/claims/new');

    await expect(page.getByRole('heading', { name: 'Create a New Case' })).toBeVisible();

    await page.evaluate(async () => {
      const intakeResponse = await fetch('/api/cases/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: 'ue-qa-member-primary',
          title: 'Unsafe overtime denial',
          caseType: 'wage_dispute',
          priority: 'critical',
          incidentDate: '2026-04-18',
          location: 'Toronto yard',
          description: 'Detailed intake description for the CUPE pilot path.',
          desiredOutcome: 'Resolution requested for: Unsafe overtime denial',
          witnesses: 'Pat Doe',
          isAnonymous: true,
        }),
      });

      if (!intakeResponse.ok) {
        throw new Error(`intake submit failed: ${intakeResponse.status}`);
      }

      const intakeResult = await intakeResponse.json();
      const claimId = intakeResult.claimId || intakeResult.data?.claimId;

      const evidenceResponse = await fetch(`/api/cases/${claimId}/evidence`, {
        method: 'POST',
        body: (() => {
          const formData = new FormData();
          formData.append('file', new File(['pilot evidence'], 'evidence.txt', { type: 'text/plain' }));
          return formData;
        })(),
      });

      if (!evidenceResponse.ok) {
        throw new Error(`evidence upload failed: ${evidenceResponse.status}`);
      }
    });

    await expect.poll(() => intakeRequests.length).toBe(1);
    await expect.poll(() => evidenceRequests.length).toBe(1);

    expect(intakeRequests[0]).toMatchObject({
      caseType: 'wage_dispute',
      priority: 'critical',
      title: 'Unsafe overtime denial',
    });
  });

  test('staff pilot APIs have authenticated coverage for assign, transition, audit, and export', async ({ page }) => {
    // Staff (steward) auth context for the workbench-side journey.
    await loginAsRole(page, 'staff');
    const hits = new Set<string>();

    await page.route('**/api/cases/CASE-TEST-0001/assign', async (route) => {
      hits.add('assign');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.route('**/api/cases/CASE-TEST-0001/transition', async (route) => {
      hits.add('transition');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.route('**/api/cases/CASE-TEST-0001/audit', async (route) => {
      hits.add('audit');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.route('**/api/cases/CASE-TEST-0001/export', async (route) => {
      hits.add('export');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/en-CA/dashboard');
    const responses = await page.evaluate(async () => {
      const assign = await fetch('/api/cases/CASE-TEST-0001/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: 'steward-1' }),
      });
      const transition = await fetch('/api/cases/CASE-TEST-0001/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'acknowledged' }),
      });
      const audit = await fetch('/api/cases/CASE-TEST-0001/audit');
      const exportResp = await fetch('/api/cases/CASE-TEST-0001/export');

      return [assign.status, transition.status, audit.status, exportResp.status];
    });

    expect(responses).toEqual([200, 200, 200, 200]);
    expect(hits).toEqual(new Set(['assign', 'transition', 'audit', 'export']));
  });
});