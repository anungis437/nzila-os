import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

export type E2ENormalizedEnv = {
  AUTH_SECRET: string
  VOTING_SECRET: string
  QA_TEST_ENV: 'true'
  NODE_ENV: 'test'
  DATABASE_URL: string
  PLAYWRIGHT_BASE_URL: string
}

const DETERMINISTIC_DEFAULTS: E2ENormalizedEnv = {
  AUTH_SECRET: 'test-auth-secret',
  VOTING_SECRET: 'test-voting-secret-0123456789abcdef',
  QA_TEST_ENV: 'true',
  NODE_ENV: 'test',
  DATABASE_URL: '',
  PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3002',
}

let cached: E2ENormalizedEnv | null = null

function loadScopedEnvFiles(e2eDir: string): void {
  const candidates = [
    path.join(e2eDir, '.env.test.local'),
    path.join(e2eDir, '.env.test'),
  ]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue
    }

    dotenv.config({
      path: filePath,
      override: false,
    })
  }
}

function normalizeValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : fallback
}

function assertRequired(name: keyof E2ENormalizedEnv, value: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `[ue:e2e] Missing required E2E environment variable ${name}. Add it to tests/e2e/.env.test or export it in your shell.`,
    )
  }
}

function readDatabaseUrlFromAppEnv(e2eDir: string): string | null {
  const appRoot = path.resolve(e2eDir, '..', '..')
  const candidates = [
    path.join(appRoot, '.env.local'),
    path.join(appRoot, '.env'),
  ]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue
    }
    const content = fs.readFileSync(filePath, 'utf8')
    const match = content.match(/^DATABASE_URL=(.+)$/m)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return null
}

export function getE2EEnv(): E2ENormalizedEnv {
  if (cached) {
    return cached
  }

  const e2eDir = path.resolve(__dirname)
  loadScopedEnvFiles(e2eDir)

  const resolved: E2ENormalizedEnv = {
    AUTH_SECRET: normalizeValue(process.env.AUTH_SECRET, DETERMINISTIC_DEFAULTS.AUTH_SECRET),
    VOTING_SECRET: normalizeValue(process.env.VOTING_SECRET, DETERMINISTIC_DEFAULTS.VOTING_SECRET),
    QA_TEST_ENV: 'true',
    NODE_ENV: 'test',
    DATABASE_URL: normalizeValue(process.env.DATABASE_URL, readDatabaseUrlFromAppEnv(e2eDir) ?? DETERMINISTIC_DEFAULTS.DATABASE_URL),
    PLAYWRIGHT_BASE_URL: normalizeValue(process.env.PLAYWRIGHT_BASE_URL, DETERMINISTIC_DEFAULTS.PLAYWRIGHT_BASE_URL),
  }

  assertRequired('AUTH_SECRET', resolved.AUTH_SECRET)
  assertRequired('VOTING_SECRET', resolved.VOTING_SECRET)
  assertRequired('DATABASE_URL', resolved.DATABASE_URL)
  assertRequired('PLAYWRIGHT_BASE_URL', resolved.PLAYWRIGHT_BASE_URL)

  cached = resolved
  return resolved
}
