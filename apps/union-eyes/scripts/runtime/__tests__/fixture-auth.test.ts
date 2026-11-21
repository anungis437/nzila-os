import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import {
  createRuntimeFixtureAuth,
  readRuntimeFixtureAuth,
  writeRuntimeFixtureAuth,
  runtimeFixtureAuthPath,
  runtimeFixtureAuthorityContext,
} from '../fixture-auth'

const database = 'postgresql://uev2admin@127.0.0.1:55516/ue_runtime'
describe('private owned runtime auth fixtures', () => {
  it('keeps opaque bearers and MFA private and refuses another database namespace', () => {
    const state = mkdtempSync(path.join(tmpdir(), 'ue-fixture-auth-'))
    try {
      const people = [
        {
          userId: 'non-uuid-principal',
          email: 'fixture@example.invalid',
          orgId: '10000000-0000-4000-8000-000000000001',
        },
      ]
      const doc = createRuntimeFixtureAuth(database, people)
      expect(doc.users[people[0].userId].sessionToken).not.toMatch(/^ue-seed-session-/)
      expect(doc.users[people[0].userId].mfaSecret).toMatch(/^[A-Z2-7]{32}$/)
      writeRuntimeFixtureAuth(doc, state)
      expect(statSync(runtimeFixtureAuthPath(state)).mode & 0o777).toBe(0o600)
      const before = readFileSync(runtimeFixtureAuthPath(state), 'utf8')
      expect(readRuntimeFixtureAuth(database, state)).toEqual(doc)
      expect(readFileSync(runtimeFixtureAuthPath(state), 'utf8')).toBe(before)
      expect(() => readRuntimeFixtureAuth(database.replace('55516', '55515'), state)).toThrow(
        /provenance/,
      )
      chmodSync(runtimeFixtureAuthPath(state), 0o644)
      expect(() => readRuntimeFixtureAuth(database, state)).toThrow(/private/)
    } finally {
      rmSync(state, { recursive: true, force: true })
    }
  })
  it('rejects malformed bearer data without accepting a deterministic cookie or external target', () => {
    const state = mkdtempSync(path.join(tmpdir(), 'ue-fixture-auth-'))
    try {
      const doc = createRuntimeFixtureAuth(database, [
        {
          userId: 'fixture',
          email: 'fixture@example.invalid',
          orgId: '10000000-0000-4000-8000-000000000001',
        },
      ])
      doc.users.fixture.sessionToken = 'ue-seed-session-' + 'a'.repeat(27)
      writeFileSync(runtimeFixtureAuthPath(state), JSON.stringify(doc), { mode: 0o600 })
      expect(() => readRuntimeFixtureAuth(database, state)).toThrow(/malformed/)
      expect(() =>
        createRuntimeFixtureAuth(database.replace('127.0.0.1', 'external.invalid'), []),
      ).toThrow(/Owned/)
    } finally {
      rmSync(state, { recursive: true, force: true })
    }
  })
  it('requires the operator and restricted runtime to name the same private fixture database', () => {
    const state = mkdtempSync(path.join(tmpdir(), 'ue-fixture-auth-'))
    try {
      writeRuntimeFixtureAuth(createRuntimeFixtureAuth(database, []), state)
      vi.stubEnv('QA_TEST_ENV', 'true')
      vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
      vi.stubEnv('UE_RUNTIME_STATE_DIR', state)
      vi.stubEnv('UE_RUNTIME_OPERATOR_DATABASE_URL', database)
      vi.stubEnv('UE_RUNTIME_DATABASE_URL', database.replace('uev2admin', 'ue_runtime_web'))
      expect(runtimeFixtureAuthorityContext().runtimeUrl).toContain('ue_runtime_web')
      vi.stubEnv(
        'UE_RUNTIME_DATABASE_URL',
        database.replace('uev2admin', 'ue_runtime_web').replace('55516', '55515'),
      )
      expect(() => runtimeFixtureAuthorityContext()).toThrow(
        'Restricted fixture runtime credential',
      )
    } finally {
      vi.unstubAllEnvs()
      rmSync(state, { recursive: true, force: true })
    }
  })
})
