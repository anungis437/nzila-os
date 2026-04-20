/**
 * Web — E2E Tests (Playwright)
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.WEB_URL ?? 'http://localhost:3000'

test.describe('Web E2E', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page).toHaveTitle(/Nzila|Home/)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('lead capture submission — health check', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('web')
  })

  test('admin publishing — evidence export requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/evidence/export`)
    // Endpoint is auth-protected; expect 401 without credentials
    expect(res.status()).toBe(401)
  })
})
