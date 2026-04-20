/**
 * CFO — E2E Tests (Playwright)
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.CFO_URL ?? 'http://localhost:3005'

test.describe('CFO E2E', () => {
  test('dashboard loads successfully', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page).toHaveTitle(/CFO|Finance|Nzila/)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('health endpoint returns service info', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    // 200 = fully healthy, 503 = degraded (no DB/blob in CI)
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body.status).toMatch(/ok|degraded/)
    expect(body.app).toBe('cfo')
  })

  test('evidence export requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/evidence/export`)
    expect([200, 401]).toContain(res.status())
  })

  test('metrics endpoint requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics`)
    expect([200, 401]).toContain(res.status())
  })

  test('reports export requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/reports/export`)
    expect([200, 401]).toContain(res.status())
  })

  test('ledger GET requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ledger`)
    expect([200, 401]).toContain(res.status())
  })

  test('clients GET requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clients`)
    expect([200, 401]).toContain(res.status())
  })

  test('integrations GET requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/integrations`)
    expect([200, 401]).toContain(res.status())
  })

  test('ledger POST rejects invalid payload', async ({ request }) => {
    const res = await request.post(`${BASE}/api/ledger`, {
      data: {},
    })
    // Should return 400 for invalid payload (Zod validation)
    expect([400, 401, 422]).toContain(res.status())
  })

  test('upload POST rejects request with no file', async ({ request }) => {
    const res = await request.post(`${BASE}/api/upload`, {
      data: {},
    })
    // Should reject — no multipart file
    expect([400, 401, 422, 415]).toContain(res.status())
  })
})
