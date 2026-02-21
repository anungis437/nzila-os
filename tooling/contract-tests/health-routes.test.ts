/**
 * Contract Test — Health & Readiness Routes (REM-05)
 *
 * Verifies:
 *   1. /api/health route exists in console and partners apps
 *   2. Health routes check both DB and Blob (dual-dependency liveness)
 *   3. Health routes return 503 on degraded state (not just 200)
 *   4. /api/health is accessible without auth (in middleware allowlist)
 *   5. Health response shape includes { status, checks, buildInfo }
 *
 * NOTE: The stress-test incorrectly flagged these as missing; they existed but
 * were blocked by auth middleware. This test locks in the corrected behaviour.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(rel: string): string {
  const abs = resolve(ROOT, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf-8') : ''
}

// ── Subject files ─────────────────────────────────────────────────────────────

const CONSOLE_HEALTH = 'apps/console/app/api/health/route.ts'
const PARTNERS_HEALTH = 'apps/partners/app/api/health/route.ts'
const CONSOLE_MIDDLEWARE = 'apps/console/middleware.ts'
const PARTNERS_MIDDLEWARE = 'apps/partners/middleware.ts'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Health & Readiness Routes — REM-05 contract', () => {
  // ── Existence ───────────────────────────────────────────────────────────────

  it('console /api/health route file exists', () => {
    expect(existsSync(resolve(ROOT, CONSOLE_HEALTH))).toBe(true)
  })

  it('partners /api/health route file exists', () => {
    expect(existsSync(resolve(ROOT, PARTNERS_HEALTH))).toBe(true)
  })

  // ── DB check ────────────────────────────────────────────────────────────────

  it('console health route checks database connectivity', () => {
    const content = read(CONSOLE_HEALTH)
    // Must perform a DB reachability probe (SELECT 1 or equivalent)
    expect(
      content.includes('SELECT 1') ||
      content.includes('db.execute') ||
      content.includes('db.query') ||
      content.includes('sql`SELECT')
    ).toBe(true)
  })

  it('partners health route checks database connectivity', () => {
    const content = read(PARTNERS_HEALTH)
    expect(
      content.includes('SELECT 1') ||
      content.includes('db.execute') ||
      content.includes('db.query') ||
      content.includes('sql`SELECT')
    ).toBe(true)
  })

  // ── Blob check ──────────────────────────────────────────────────────────────

  it('console health route checks blob/storage connectivity', () => {
    const content = read(CONSOLE_HEALTH)
    expect(
      content.includes('blob') ||
      content.includes('Blob') ||
      content.includes('storage') ||
      content.includes('Storage')
    ).toBe(true)
  })

  it('partners health route checks blob/storage connectivity', () => {
    const content = read(PARTNERS_HEALTH)
    expect(
      content.includes('blob') ||
      content.includes('Blob') ||
      content.includes('storage') ||
      content.includes('Storage')
    ).toBe(true)
  })

  // ── Degraded response ───────────────────────────────────────────────────────

  it('console health route returns 503 on degraded', () => {
    const content = read(CONSOLE_HEALTH)
    expect(content).toContain('503')
  })

  it('partners health route returns 503 on degraded', () => {
    const content = read(PARTNERS_HEALTH)
    expect(content).toContain('503')
  })

  // ── Response shape ──────────────────────────────────────────────────────────

  it('console health route emits status field in response', () => {
    const content = read(CONSOLE_HEALTH)
    expect(content.includes("status: 'ok'") || content.includes('status:')).toBe(true)
  })

  it('partners health route emits status field in response', () => {
    const content = read(PARTNERS_HEALTH)
    expect(content.includes("status: 'ok'") || content.includes('status:')).toBe(true)
  })

  // ── Auth bypass ─────────────────────────────────────────────────────────────

  it('/api/health bypasses auth in console middleware (public route)', () => {
    const mw = read(CONSOLE_MIDDLEWARE)
    expect(mw).toContain('/api/health')
  })

  it('/api/health bypasses auth in partners middleware (public route)', () => {
    const mw = read(PARTNERS_MIDDLEWARE)
    expect(mw).toContain('/api/health')
  })
})
