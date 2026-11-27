import assert from 'node:assert/strict'
import test from 'node:test'
import { retainedAuditTarget, retainedAuditRetirement } from './ue-v2-retained-audit-acl'
import type { UpgradeObject } from './ue-v2-forward-upgrade'

const owner = 'ue_v2_owner'
const before: UpgradeObject = {
  kind: 'retained_audit_acl',
  id: 'audit_security.audit_logs',
  definition: {
    owner,
    kind: 'r',
    rls: true,
    force: true,
    columnAcls: [],
    acl: [
      { grantee: owner, grantor: owner, privilege: 'SELECT', grantable: false },
      { grantee: 'union_eyes_runtime', grantor: owner, privilege: 'SELECT', grantable: false },
      { grantee: 'union_eyes_runtime', grantor: owner, privilege: 'INSERT', grantable: false },
      { grantee: 'original_history_reader', grantor: owner, privilege: 'SELECT', grantable: false },
    ],
  },
}
const approved = { runtime: [], system: [] }

test('withdraws only the named legacy grant and preserves owner, RLS and all other ACLs', () => {
  const target = retainedAuditTarget(before, approved)
  assert.deepEqual(target.definition, {
    ...before.definition,
    acl: (before.definition.acl as { grantee: string }[]).filter(
      (entry) => entry.grantee !== 'union_eyes_runtime',
    ),
  })
  assert.deepEqual(retainedAuditRetirement(before, target), {
    phase: 'retained-audit-acl',
    object: before.id,
    role: owner,
    sql: 'REVOKE SELECT, INSERT ON TABLE audit_security.audit_logs FROM union_eyes_runtime',
  })
  assert.equal(retainedAuditRetirement(target, target), undefined)
})

test('refuses a grant, unknown table, changed owner/RLS or changed unrelated ACL', () => {
  assert.throws(() => retainedAuditTarget(before, { runtime: ['SELECT'], system: [] }))
  assert.throws(() => retainedAuditTarget({ ...before, id: 'audit_security.other' }, approved))
  assert.throws(() =>
    retainedAuditTarget(
      { ...before, definition: { ...before.definition, owner: 'unknown' } },
      approved,
    ),
  )
  for (const changes of [{ force: false }, { owner: 'uev2admin' }, { acl: [] }]) {
    const target = retainedAuditTarget(before, approved)
    assert.throws(() =>
      retainedAuditRetirement(before, {
        ...target,
        definition: { ...target.definition, ...changes },
      }),
    )
  }
})

test('refuses unknown, PUBLIC, system, grant-option or column-level historical access', () => {
  for (const entry of [
    { grantee: 'PUBLIC', privilege: 'SELECT' },
    { grantee: 'union_eyes_system', privilege: 'SELECT' },
    { grantee: 'union_eyes_runtime', privilege: 'DELETE' },
    { grantee: 'union_eyes_runtime', privilege: 'SELECT', grantable: true },
    { grantee: 'union_eyes_runtime', privilege: 'SELECT', grantor: 'other' },
  ]) {
    assert.throws(() =>
      retainedAuditTarget(
        {
          ...before,
          definition: {
            ...before.definition,
            acl: [{ grantor: owner, grantable: false, ...entry }],
          },
        },
        approved,
      ),
    )
  }
  assert.throws(() =>
    retainedAuditTarget(
      {
        ...before,
        definition: {
          ...before.definition,
          columnAcls: [{ column: 'payload', acl: ['unexpected'] }],
        },
      },
      approved,
    ),
  )
})
