/** The old audit store is retained as history. The current canonical contract
 * withdraws its legacy runtime SELECT/INSERT; no new reader is granted. */
import assert from 'node:assert/strict'
import type { UpgradeObject, UpgradeStatement } from './ue-v2-forward-upgrade'

export const RETAINED_AUDIT_CATALOG_QUERY = `SELECT 'retained_audit_acl' AS kind,
  'audit_security.audit_logs' AS id,jsonb_build_object(
    'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,
    'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
    'acl',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
      ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
      FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a),'[]'::jsonb),
    'columnAcls',COALESCE((SELECT jsonb_agg(jsonb_build_object('column',a.attname,'acl',a.attacl)
      ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0
      AND NOT a.attisdropped AND a.attacl IS NOT NULL),'[]'::jsonb)
  ) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='audit_security' AND c.relname='audit_logs'`

type Acl = { grantee: string; grantor: string; privilege: string; grantable: boolean }

export function retainedAuditTarget(
  before: UpgradeObject,
  approved: { runtime: string[]; system: string[] },
): UpgradeObject {
  assert(
    before.kind === 'retained_audit_acl' && before.id === 'audit_security.audit_logs',
    'UE_UPGRADE_LEGACY_AUDIT_IDENTITY_REFUSED',
  )
  assert(
    approved.runtime.length === 0 && approved.system.length === 0,
    'UE_UPGRADE_LEGACY_AUDIT_GRANT_REFUSED',
  )
  assert(
    before.definition.kind === 'r' &&
      ['uev2admin', 'ue_v2_owner'].includes(String(before.definition.owner)),
    'UE_UPGRADE_LEGACY_AUDIT_OWNER_REFUSED',
  )
  assert(
    Array.isArray(before.definition.acl) && Array.isArray(before.definition.columnAcls),
    'UE_UPGRADE_LEGACY_AUDIT_ACL_REQUIRED',
  )
  // A new column-level grant or broader legacy privilege needs its own explicit
  // reconciliation; never erase it silently or treat it as equivalent.
  assert(before.definition.columnAcls.length === 0, 'UE_UPGRADE_LEGACY_AUDIT_COLUMN_ACL_REFUSED')
  const acl = before.definition.acl as Acl[]
  assert(
    acl.every(
      (entry) =>
        entry.grantee !== 'PUBLIC' &&
        entry.grantee !== 'union_eyes_system' &&
        (entry.grantee !== 'union_eyes_runtime' ||
          (['SELECT', 'INSERT'].includes(entry.privilege) &&
            !entry.grantable &&
            entry.grantor === before.definition.owner)),
    ),
    'UE_UPGRADE_LEGACY_AUDIT_PRIVILEGE_REFUSED',
  )
  return {
    ...structuredClone(before),
    definition: {
      ...structuredClone(before.definition),
      acl: acl.filter((entry) => entry.grantee !== 'union_eyes_runtime'),
    },
  }
}

export function retainedAuditRetirement(
  before: UpgradeObject,
  target: UpgradeObject,
): UpgradeStatement | undefined {
  const expected = retainedAuditTarget(before, { runtime: [], system: [] })
  assert.deepEqual(target, expected, 'UE_UPGRADE_LEGACY_AUDIT_TARGET_CHANGED')
  if (JSON.stringify(before) === JSON.stringify(target)) return undefined
  return {
    phase: 'retained-audit-acl',
    object: before.id,
    role: String(before.definition.owner),
    sql: 'REVOKE SELECT, INSERT ON TABLE audit_security.audit_logs FROM union_eyes_runtime',
  }
}
