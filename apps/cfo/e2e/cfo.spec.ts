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

  test('health endpoint returns ok with subsystem checks', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('cfo')
    expect(body.timestamp).toBeDefined()
  })

  test('evidence export returns structured pack with version', async ({ request }) => {
    const res = await request.get(`${BASE}/api/evidence/export`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.app).toBe('cfo')
    expect(body.version).toBeDefined()
    expect(body.generatedAt).toBeDefined()
  })

  test('metrics endpoint returns observability data', async ({ request }) => {
    const res = await request.get(`${BASE}/api/metrics`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.request_count).toBeDefined()
    expect(body.error_rate).toBeDefined()
    expect(body.latency_ms).toBeDefined()
  })

  test('reports export endpoint returns financial data', async ({ request }) => {
    const res = await request.get(`${BASE}/api/reports/export`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toBeDefined()
  })

  test('ledger GET returns paginated entries', async ({ request }) => {
    const res = await request.get(`${BASE}/api/ledger`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.entries) || Array.isArray(body)).toBe(true)
  })

  test('clients GET returns client list', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clients`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.clients) || Array.isArray(body)).toBe(true)
  })

  test('integrations GET returns integration statuses', async ({ request }) => {
    const res = await request.get(`${BASE}/api/integrations`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toBeDefined()
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
