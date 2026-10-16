import { ProvisioningError } from './governed-provisioning'
import { replayDigest } from './post-w4p-replay'
import { Cursor as StructuralSourceCursor } from './replay-structural-effects'
import type { CatalogReader } from './platform-baseline-promotion'
export interface RlsPrimitiveObservation {
  state: 'ALREADY_COMPLETE' | 'REPLAY_REQUIRED' | 'DRIFTED' | 'PRECONDITION_MISSING'
  ownedStateDigest: string
  verificationDigest: string
}
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
function row(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_RLS_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
export function compileRlsToggle(source: string, sourceHash: string) {
  const cursor = new StructuralSourceCursor(source, sourceHash)
  cursor.word('ALTER')
  cursor.word('TABLE')
  const table = cursor.relation()
  let field: 'enabled' | 'forced', value: boolean
  if (cursor.optionalWord('ENABLE')) {
    field = 'enabled'
    value = true
  } else if (cursor.optionalWord('DISABLE')) {
    field = 'enabled'
    value = false
  } else if (cursor.optionalWord('NO')) {
    cursor.word('FORCE')
    field = 'forced'
    value = false
  } else {
    cursor.word('FORCE')
    field = 'forced'
    value = true
  }
  cursor.word('ROW')
  cursor.word('LEVEL')
  cursor.word('SECURITY')
  cursor.finish()
  const body = { schema: table.schema, table: table.name, field, value, sourceHash }
  return { ...body, contractDigest: replayDigest(body) }
}
export function compilePolicyDrop(source: string, sourceHash: string) {
  const cursor = new StructuralSourceCursor(source, sourceHash)
  cursor.word('DROP')
  cursor.word('POLICY')
  let guarded = false
  if (cursor.optionalWord('IF')) {
    cursor.word('EXISTS')
    guarded = true
  }
  const name = cursor.identifier()
  cursor.word('ON')
  const table = cursor.relation()
  cursor.finish()
  const body = { schema: table.schema, table: table.name, name, guarded, sourceHash }
  return { ...body, contractDigest: replayDigest(body) }
}
export const rlsPrimitiveQueries = {
  table: `SELECT c.relkind AS kind,c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced,
    NOT(c.relispartition OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid)) AS standalone
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`,
  policy: `SELECT p.polname AS name,p.polname=$3 AS name_matches FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2 AND p.polname=$3`,
}
function observation(
  state: RlsPrimitiveObservation['state'],
  contractDigest: string,
  data: unknown,
): RlsPrimitiveObservation {
  return {
    state,
    ownedStateDigest: replayDigest({ contractDigest, data }),
    verificationDigest: replayDigest({ contractDigest, state, data }),
  }
}
async function inspectTable(reader: CatalogReader, schema: string, table: string) {
  const rows = await reader.query(rlsPrimitiveQueries.table, [schema, table])
  requireCondition(rows.length <= 1, 'REPLAY_RLS_CATALOG_CARDINALITY_INVALID')
  if (!rows.length) return null
  const current = row(rows[0])
  requireCondition(
    typeof current.kind === 'string' &&
      typeof current.enabled === 'boolean' &&
      typeof current.forced === 'boolean' &&
      typeof current.standalone === 'boolean',
    'REPLAY_RLS_CATALOG_ROW_INVALID',
  )
  return current
}
export async function inspectRlsToggle(
  reader: CatalogReader,
  spec: ReturnType<typeof compileRlsToggle>,
) {
  const current = await inspectTable(reader, spec.schema, spec.table)
  if (!current) return observation('PRECONDITION_MISSING', spec.contractDigest, { table: null })
  if (current.kind !== 'r' || !current.standalone)
    return observation('DRIFTED', spec.contractDigest, { table: current })
  const owned = {
    schema: spec.schema,
    table: spec.table,
    field: spec.field,
    value: current[spec.field],
  }
  return observation(
    current[spec.field] === spec.value ? 'ALREADY_COMPLETE' : 'REPLAY_REQUIRED',
    spec.contractDigest,
    owned,
  )
}
export async function inspectPolicyDrop(
  reader: CatalogReader,
  spec: ReturnType<typeof compilePolicyDrop>,
) {
  const current = await inspectTable(reader, spec.schema, spec.table)
  if (!current) return observation('PRECONDITION_MISSING', spec.contractDigest, { table: null })
  if (current.kind !== 'r' || !current.standalone)
    return observation('DRIFTED', spec.contractDigest, { table: current })
  const rows = await reader.query(rlsPrimitiveQueries.policy, [spec.schema, spec.table, spec.name])
  requireCondition(rows.length <= 1, 'REPLAY_RLS_CATALOG_CARDINALITY_INVALID')
  if (!rows.length) return observation('ALREADY_COMPLETE', spec.contractDigest, { policy: null })
  const policy = row(rows[0])
  requireCondition(
    typeof policy.name === 'string' && typeof policy.name_matches === 'boolean',
    'REPLAY_RLS_CATALOG_ROW_INVALID',
  )
  if (!policy.name_matches) return observation('DRIFTED', spec.contractDigest, { policy })
  return observation('REPLAY_REQUIRED', spec.contractDigest, { policy })
}
