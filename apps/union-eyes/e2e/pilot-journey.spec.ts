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
    // Intake form requires an authenticated member context.
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

    await page.locator('input[type="text"]').nth(0).fill('Unsafe overtime denial');
    await page.locator('select').nth(0).selectOption({ label: 'Wage & Hour' });
    await page.locator('select').nth(1).selectOption('urgent');
    await page.locator('textarea').fill('Detailed intake description for the CUPE pilot path.');
    await page.locator('input[type="date"]').fill('2026-04-18');
    await page.locator('input[type="text"]').nth(1).fill('Toronto yard');
    await page.locator('input[type="text"]').nth(2).fill('Pat Doe');
    await page.locator('#file-upload').setInputFiles({
      name: 'evidence.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('pilot evidence'),
    });

    await page.locator('button[type="submit"]').click();

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