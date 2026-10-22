import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { planExactPublicPrivileges } from './union-eyes-catalog-authority.mjs'
import { catalogContractDigest } from '../../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'
const contract = JSON.parse(fs.readFileSync(new URL('../../../apps/union-eyes/lib/operations/catalog-authority-contract.json', import.meta.url)))

test('plans source-exact public grants while contained and absent tables get no grant', () => {
  const selected = ['ab_test_assignments', 'grievances', 'organization_members', 'platform_identity_bindings']
  const statements = planExactPublicPrivileges(contract, selected)
  assert.equal(statements.length >= 3, true)
  assert.equal(statements.some(sql => sql.startsWith('GRANT') && sql.includes('ab_test_assignments')), false)
  assert.equal(statements.some(sql => sql.startsWith('GRANT') && sql.includes('platform_identity_bindings')), false)
  for (const sql of statements.filter(sql => sql.startsWith('GRANT'))) {
    assert.match(sql, /^GRANT (SELECT|INSERT|UPDATE|DELETE)(,(SELECT|INSERT|UPDATE|DELETE))* ON TABLE public\."(grievances|organization_members)" TO union_eyes_(runtime|system)$/)
  }
  assert.equal(statements.some(sql => /user_management|nzila_auth|ALTER ROLE|COMMIT|ROW LEVEL/.test(sql)), false)
  assert.equal(statements[0], 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime,union_eyes_system,PUBLIC')
})

test('refuses corrupt contracts, unresolved grants, duplicate tables and identifiers', () => {
  assert.throws(() => planExactPublicPrivileges({ ...contract, digest: '0'.repeat(64) }, []))
  for (const mutate of [
    payload => { payload.entries[0].runtime = 'TBD' },
    payload => { payload.entries[0].runtime = ['TRUNCATE'] },
    payload => { payload.entries[0].runtime = ['SELECT', 'SELECT'] },
    payload => { payload.entries[0].table = 'users; RESET ROLE' },
    payload => { payload.entries.push(payload.entries[0]) },
  ]) {
    const payload = structuredClone(contract.payload)
    mutate(payload)
    assert.throws(() => planExactPublicPrivileges({ payload, digest: catalogContractDigest(payload) }, []))
  }
})
