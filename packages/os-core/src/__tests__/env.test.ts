/**
 * @nzila/os-core — Environment Validation Tests
 *
 * Verifies Zod schemas for each app and the validateEnv() function.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '../config/env'

const VALID_BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://localhost:5432/nzila',
}

const AUTH_ENV: Record<string, string> = {
  AUTH_SECRET: 'test_auth_secret_32chars_xxxxxxxxxxxx',
  AZURE_AD_CLIENT_ID: 'test-client-id',
  AZURE_AD_CLIENT_SECRET: 'test-client-secret',
  AZURE_AD_TENANT_ID: 'test-tenant-id',
}

describe('validateEnv', () => {
  let savedEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    savedEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = savedEnv
  })

  it('validates base schema with minimal env', () => {
    Object.assign(process.env, VALID_BASE_ENV)
    const env = validateEnv('base')
    expect(env.NODE_ENV).toBe('test')
    expect(env.DATABASE_URL).toBe('postgres://localhost:5432/nzila')
    expect(env.RATE_LIMIT_MAX).toBe(120) // default
  })

  it('throws for unknown app name', () => {
    expect(() => validateEnv('nonexistent-app' as any)).toThrow('Unknown app name')
  })

  it('validates console schema requires auth keys', () => {
    Object.assign(process.env, VALID_BASE_ENV, AUTH_ENV, {
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
    })
    const env = validateEnv('console')
    expect(env.AUTH_SECRET).toBe('test_auth_secret_32chars_xxxxxxxxxxxx')
  })

  it('validates web schema (no auth keys required)', () => {
    Object.assign(process.env, VALID_BASE_ENV)
    const env = validateEnv('web')
    expect(env.NODE_ENV).toBe('test')
  })

  it('validates union-eyes schema (auth keys required, matches authMixin)', () => {
    Object.assign(process.env, VALID_BASE_ENV, AUTH_ENV)
    const env = validateEnv('union-eyes')
    expect(env.NODE_ENV).toBe('test')
    expect(env.AUTH_SECRET).toBe('test_auth_secret_32chars_xxxxxxxxxxxx')
  })

  it('validates all 15 app schemas have entries', () => {
    const ALL_APPS = [
      'console', 'partners', 'web', 'union-eyes', 'cfo',
      'nacp-exams', 'zonga', 'abr', 'orchestrator-api', 'mobility',
      'mobility-client-portal', 'agrimo', 'cora', 'trade', 'platform-admin',
    ] as const

    // Each should resolve a schema without throwing "Unknown app name"
    for (const app of ALL_APPS) {
      Object.assign(process.env, VALID_BASE_ENV, AUTH_ENV, {
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      })
      expect(() => validateEnv(app)).not.toThrow('Unknown app name')
    }
  })

  it('includes rate limit defaults', () => {
    Object.assign(process.env, VALID_BASE_ENV)
    const env = validateEnv('base')
    expect(env.RATE_LIMIT_MAX).toBe(120)
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60_000)
  })
})
