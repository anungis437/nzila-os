/** Forward-only, schema-only upgrade between two qualified canonical exports.
 * Existing relations, columns, rows, sequences and migration receipts are retained.
 * This planner emits no transaction control or business DML. Its caller owns the
 * transaction, locks, preimage check, row preservation proof and final admission.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { parseSql } from '../../../apps/union-eyes/scripts/lib/sql-census/parse'
import { canonicalCatalogObject } from '../../../apps/union-eyes/scripts/bootstrap-v2/catalog-normalization'
import {
  currentDeadlineGuardBody,
  LEGACY_DEADLINE_GUARD_BODY,
} from '../../../apps/union-eyes/db/auth/business-session-event-guard'
import {
  BUSINESS_SESSION_POLICY,
  BUSINESS_SESSION_CATALOG_PREDICATE,
} from '../../../apps/union-eyes/db/auth/business-session-policy'
import { canonicalCatalogContract } from '../../../apps/union-eyes/lib/operations/canonical-catalog-admission'

export interface UpgradeObject {
  kind: string
  id: string
  definition: Record<string, unknown>
}
export interface DumpSection {
  name: string
  type: string
  schema: string
  owner: string
  sql: string
}
export interface UpgradeStatement {
  phase: string
  object: string
  sql: string
  role?: string
}

/** Historical migrations left zero-argument guard functions with the original
 * administrator. Transfer only an existing, target-declared function to its
 * qualified canonical owner before replacing its body as that owner. No
 * application code is ever executed as the administrator by this handoff. */
export function canonicalFunctionOwnerHandoff(
  previous: UpgradeObject,
  target: UpgradeObject,
): UpgradeStatement | undefined {
  assert(
    previous.kind === 'function' && target.kind === 'function' && previous.id === target.id,
    'UE_UPGRADE_FUNCTION_OWNER_IDENTITY_REFUSED',
  )
  if (previous.definition.owner === target.definition.owner) return undefined
  assert(
    previous.definition.owner === 'uev2admin' && target.definition.owner === 'ue_v2_owner',
    'UE_UPGRADE_FUNCTION_OWNER_TRANSITION_REFUSED',
  )
  assert(
    /^(?:(?:public|user_management)\.)?[a-z_][a-z0-9_]*\(\)$/.test(previous.id),
    'UE_UPGRADE_FUNCTION_OWNER_SIGNATURE_REFUSED',
  )
  const identity = /^(public|user_management)\./.test(previous.id)
    ? previous.id
    : `public.${previous.id}`
  return {
    phase: 'canonical-function-owner',
    object: previous.id,
    sql: `ALTER FUNCTION ${identity} OWNER TO ue_v2_owner`,
    role: 'uev2admin',
  }
}
const ident = /^[a-z_][a-z0-9_]{0,62}$/
export const quoteUpgradeIdentifier = (s: string) => {
  assert(ident.test(s), 'UE_UPGRADE_IDENTIFIER_REFUSED')
  return `"${s}"`
}
const q = quoteUpgradeIdentifier
const qualified = (s: string) => s.split('.').map(q).join('.')
const key = (o: UpgradeObject) => `${o.kind}|${o.id}`
const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, stable(x)]),
        )
      : v
export const upgradeDigest = (v: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(v)) ?? 'undefined')
    .digest('hex')
const tableId = (schema: string, name: string) => (schema === 'public' ? name : `${schema}.${name}`)
const functionId = (schema: string, name: string) =>
  `${schema === 'public' ? '' : schema + '.'}${name.replace(/,\s+/g, ',')}`
const sameObject = (a: UpgradeObject, b: UpgradeObject) =>
  upgradeDigest(canonicalCatalogObject(a)) === upgradeDigest(canonicalCatalogObject(b))

/** These are retained, security-invoker migration helpers, not new application
 * entry points. Their bodies/owners are pinned by the complete live preimage.
 * PUBLIC and application EXECUTE are removed; the workbook helper's sole
 * application caller is the existing current-security installer's declaration.
 */
const retainedFunctions = new Set([
  'ue_create_direct_org_rls_policy(text,text,boolean)',
  'ue_create_parent_owned_rls_policy(text,text)',
  'ue_create_user_self_rls_policy(text,text,text)',
  'ue_create_mixed_global_tenant_rls_policy(text,text)',
  'ue_create_multi_party_rls_policy(text,text,text)',
  'ue_create_parent_owned_rls_policy_v2(text,text,text,text,boolean)',
  'ue_create_user_rls_policy(text,text)',
  'ue_create_parent_owned_via_user_rls_policy_v2(text,text,text,text)',
  'ue_create_shared_library_rls_policy(text,text,text,text)',
  'ue_create_shared_library_child_rls_policy(text,text)',
  'ue_is_workbook_system_principal()',
  'ue_enforce_workbook_credential_authority()',
  'ue_guard_deadline_reassignment_convergence_policy()',
])

export function retainedForwardProfile(
  before: UpgradeObject[],
  fresh: UpgradeObject[],
  dump: string,
) {
  const target = structuredClone(fresh)
  const old = new Map(before.map((o) => [key(o), o]))
  const freshKeys = new Set(fresh.map(key))
  const prefix: UpgradeStatement[] = [],
    suffix: UpgradeStatement[] = []
  const authority = canonicalCatalogContract().payload.entries
  for (const o of before.filter((o) => o.kind === 'relation' && !freshKeys.has(key(o)))) {
    assert(o.id.startsWith('public.'), 'UE_UPGRADE_RETAINED_RELATION_SCHEMA_REFUSED')
    const entry = authority.find((e) => e.table === o.id.slice('public.'.length))
    assert(
      entry &&
        entry.classification === 'CONTAINED_NO_AUTHORITY' &&
        Array.isArray(entry.runtime) &&
        entry.runtime.length === 0 &&
        Array.isArray(entry.system) &&
        entry.system.length === 0,
      `UE_UPGRADE_RETAINED_RELATION_AUTHORITY_UNKNOWN:${o.id}`,
    )
    const retained = structuredClone(o)
    retained.definition.acl = null
    target.push(retained)
    for (const column of before.filter((c) => c.kind === 'column' && c.id.startsWith(o.id + '.'))) {
      const retainedColumn = structuredClone(column)
      retainedColumn.definition.acl = null
      target.push(retainedColumn)
    }
  }
  // Retain this immutable migration's transaction-clock spelling. Both defaults
  // are declared built-in transaction timestamps; no stored value is rewritten.
  const timestamp = target.find(
    (o) => o.kind === 'column' && o.id === 'public.in_app_notifications.updated_at',
  )
  const oldTimestamp = old.get('column|public.in_app_notifications.updated_at')
  if (
    timestamp?.definition.default === 'CURRENT_TIMESTAMP' &&
    oldTimestamp?.definition.default === 'now()'
  ) {
    assert(
      !before.some((o) => o.kind === 'function' && o.id === 'now()'),
      'UE_UPGRADE_TIMESTAMP_SHADOW_REFUSED',
    )
    timestamp.definition.default = 'now()'
    const value = target.find((o) => o.kind === 'column_default' && o.id === timestamp.id)
    assert(
      value?.definition.expression === 'CURRENT_TIMESTAMP',
      'UE_UPGRADE_TIMESTAMP_DEFAULT_REFUSED',
    )
    value.definition.expression = 'now()'
  }
  let deadlineGuard = false
  for (const o of before.filter((o) => o.kind === 'function' && !freshKeys.has(key(o)))) {
    if (/^ue_v2_visible_parent_[a-f0-9]{16}\(uuid\)$/.test(o.id)) continue
    assert(retainedFunctions.has(o.id), `UE_UPGRADE_RETAINED_FUNCTION_UNKNOWN:${o.id}`)
    assert(
      o.definition.owner === 'uev2admin' && o.definition.definer === false,
      'UE_UPGRADE_RETAINED_FUNCTION_AUTHORITY_REFUSED',
    )
    const expected = structuredClone(o)
    expected.definition.acl = '{uev2admin=X/uev2admin}'
    if (o.id === 'ue_is_workbook_system_principal()') {
      const body = /\$function\$([\s\S]*)\$function\$/
        .exec(String(o.definition.definition))?.[1]
        .trim()
      assert.equal(
        body,
        "SELECT current_user = 'union_eyes_system';",
        'UE_UPGRADE_WORKBOOK_PRINCIPAL_BODY_REFUSED',
      )
      expected.definition.acl = '{uev2admin=X/uev2admin,union_eyes_system=X/uev2admin}'
      suffix.push({
        phase: 'retained-helper-acl',
        object: o.id,
        role: 'uev2admin',
        sql: 'GRANT EXECUTE ON FUNCTION public.ue_is_workbook_system_principal() TO union_eyes_system',
      })
    }
    if (o.id === 'ue_guard_deadline_reassignment_convergence_policy()') {
      const previousBody = /\$function\$([\s\S]*)\$function\$/.exec(
        String(o.definition.definition),
      )?.[1]
      const priorPredicate =
        "user_management.auth_business_org_authorized((NULLIF(current_setting('app.current_org_id'::text, true), ''::text))::uuid, NULL::text[])"
      const body = currentDeadlineGuardBody(
        BUSINESS_SESSION_POLICY,
        BUSINESS_SESSION_CATALOG_PREDICATE,
      )
      assert(
        previousBody === LEGACY_DEADLINE_GUARD_BODY ||
          previousBody === currentDeadlineGuardBody(BUSINESS_SESSION_POLICY, priorPredicate) ||
          previousBody === body,
        'UE_UPGRADE_DEADLINE_GUARD_PREIMAGE_REFUSED',
      )
      expected.definition.definition = String(o.definition.definition).replace(previousBody, body)
      prefix.push({
        phase: 'retained-deadline-guard',
        object: o.id,
        role: 'uev2admin',
        sql: `CREATE OR REPLACE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() RETURNS event_trigger LANGUAGE plpgsql AS $ue_session_guard$${body}$ue_session_guard$`,
      })
      deadlineGuard = true
    }
    target.push(expected)
  }
  let translatedDump = dump
  if (deadlineGuard) {
    const table = 'public.deadline_reassignment_convergence'
    const system = old.get(`policy|${table}.ue_system_full_access`)
    assert(
      system &&
        system.definition.command === 'ALL' &&
        system.definition.permissive === 'PERMISSIVE' &&
        upgradeDigest(system.definition.roles) === upgradeDigest(['union_eyes_system']) &&
        system.definition.using === 'true' &&
        system.definition.check === 'true',
      'UE_UPGRADE_DEADLINE_SYSTEM_CLOSURE_REFUSED',
    )
    for (let i = target.length - 1; i >= 0; i--)
      if (
        target[i].kind === 'policy' &&
        [`${table}.ue_v2_system_select`, `${table}.ue_v2_system_update`].includes(target[i].id)
      )
        target.splice(i, 1)
    target.push(structuredClone(system))
    for (const operation of ['select', 'insert']) {
      const p = target.find((o) => o.kind === 'policy' && o.id === `${table}.ue_v2_${operation}`)
      assert(p, 'UE_UPGRADE_DEADLINE_SOURCE_POLICY_MISSING')
      p.id = `${table}.ue_org_isolation_${operation}`
    }
    const sections = splitUpgradeDump(dump).filter(
      (s) =>
        !(
          s.type === 'POLICY' &&
          s.schema === 'public' &&
          [
            'deadline_reassignment_convergence ue_v2_system_select',
            'deadline_reassignment_convergence ue_v2_system_update',
          ].includes(s.name)
        ),
    )
    for (const section of sections)
      for (const operation of ['select', 'insert']) {
        if (
          section.type !== 'POLICY' ||
          section.name !== `deadline_reassignment_convergence ue_v2_${operation}`
        )
          continue
        section.name = `deadline_reassignment_convergence ue_org_isolation_${operation}`
        section.sql = section.sql.replace(
          `CREATE POLICY ue_v2_${operation} ON`,
          `CREATE POLICY ue_org_isolation_${operation} ON`,
        )
      }
    translatedDump = sections
      .map(
        (s) =>
          `-- Name: ${s.name}; Type: ${s.type}; Schema: ${s.schema}; Owner: ${s.owner}\n${s.sql}`,
      )
      .join('\n')
  }
  return { target, dump: translatedDump, prefix, suffix }
}

/** pg_dump TOC delimiters are accepted only outside SQL quoted atoms. A function
 * body cannot impersonate a TOC record and smuggle a second selected section. */
export function splitUpgradeDump(dump: string): DumpSection[] {
  assert(!dump.includes('\r'), 'UE_UPGRADE_DUMP_LF_REQUIRED')
  let dollar: string | undefined,
    single = false,
    double = false,
    block = 0
  const sections: DumpSection[] = []
  for (const line of dump.split('\n')) {
    const header =
      !dollar && !single && !double && !block
        ? /^-- Name: (.*); Type: ([A-Z ]+); Schema: ([^;]+); Owner: ([^;]+)$/.exec(line)
        : null
    if (header) {
      const [, name, type, schema, owner] = header
      assert(
        schema === '-' || ['public', 'user_management'].includes(schema),
        'UE_UPGRADE_DUMP_SCHEMA_REFUSED',
      )
      sections.push({ name, type, schema, owner, sql: '' })
      continue
    }
    if (!dollar && !single && !double && !block && /^\\(?:un)?restrict \S+$/.test(line)) continue
    if (sections.length) sections[sections.length - 1].sql += line + '\n'
    for (let i = 0; i < line.length; i++) {
      const c = line[i],
        n = line[i + 1]
      if (dollar) {
        if (line.startsWith(dollar, i)) {
          i += dollar.length - 1
          dollar = undefined
        }
        continue
      }
      if (block) {
        if (c === '/' && n === '*') {
          block++
          i++
        } else if (c === '*' && n === '/') {
          block--
          i++
        }
        continue
      }
      if (single) {
        if (c === "'" && n === "'") i++
        else if (c === "'") single = false
        continue
      }
      if (double) {
        if (c === '"' && n === '"') i++
        else if (c === '"') double = false
        continue
      }
      if (c === '-' && n === '-') break
      if (c === '/' && n === '*') {
        block++
        i++
        continue
      }
      if (c === "'") {
        assert(
          !(i > 0 && /[eE]/.test(line[i - 1]) && (i < 2 || !/[a-zA-Z0-9_]/.test(line[i - 2]))),
          'UE_UPGRADE_ESCAPE_LITERAL_REFUSED',
        )
        single = true
        continue
      }
      if (c === '"') {
        double = true
        continue
      }
      if (c === '$') {
        const m = /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(line.slice(i))
        if (m) {
          dollar = m[0]
          i += dollar.length - 1
        }
      }
    }
  }
  assert(!dollar && !single && !double && !block, 'UE_UPGRADE_DUMP_UNTERMINATED_ATOM')
  assert(sections.length > 0, 'UE_UPGRADE_DUMP_NO_OBJECTS')
  return sections
}

/** Reject changes to stored shape rather than guessing a conversion/backfill. */
export function assertStoredShapePreserved(before: UpgradeObject[], after: UpgradeObject[]) {
  const target = new Map(after.map((o) => [key(o), o]))
  for (const o of before) {
    if (!['relation', 'column', 'sequence', 'enum'].includes(o.kind)) continue
    const next = target.get(key(o))
    // A separately verified retained object may be absent from the new export.
    // The caller keeps it; this planner never emits a drop for it.
    if (!next) {
      if (o.kind === 'column')
        assert(
          !target.has(`relation|${o.id.split('.').slice(0, 2).join('.')}`),
          `UE_UPGRADE_COLUMN_REMOVAL_REFUSED:${o.id}`,
        )
      continue
    }
    const fields =
      o.kind === 'column'
        ? ['type', 'notnull', 'identity', 'generated', 'collation', 'default']
        : o.kind === 'relation'
          ? ['kind']
          : o.kind === 'enum'
            ? ['labels']
            : ['type', 'start', 'increment', 'minimum', 'maximum', 'cache', 'cycle', 'owned_by']
    for (const field of fields)
      assert.equal(
        upgradeDigest(o.definition[field]),
        upgradeDigest(next.definition[field]),
        `UE_UPGRADE_STORED_SHAPE_CHANGED:${o.id}:${field}`,
      )
  }
  const old = new Set(before.map(key))
  for (const o of after.filter((o) => o.kind === 'column' && !old.has(key(o)))) {
    if (!old.has(`relation|${o.id.split('.').slice(0, 2).join('.')}`)) continue
    assert(
      o.definition.notnull === false &&
        o.definition.default === null &&
        o.definition.identity === '' &&
        o.definition.generated === '',
      `UE_UPGRADE_COLUMN_BACKFILL_REFUSED:${o.id}`,
    )
  }
}

/** Only declarations from the hash-bound target dump may create/replace code.
 * Deletions are limited to obsolete policies/functions, never stored data. */
export async function planCanonicalForwardUpgrade(input: {
  before: UpgradeObject[]
  after: UpgradeObject[]
  dump: string
}): Promise<UpgradeStatement[]> {
  const { before, after, dump } = input
  assertStoredShapePreserved(before, after)
  const old = new Map(before.map((o) => [key(o), o])),
    target = new Map(after.map((o) => [key(o), o]))
  assert.equal(old.size, before.length, 'UE_UPGRADE_DUPLICATE_PREIMAGE')
  assert.equal(target.size, after.length, 'UE_UPGRADE_DUPLICATE_TARGET')
  const result: UpgradeStatement[] = []
  const add = (phase: string, object: string, sql: string) => result.push({ phase, object, sql })
  for (const o of after.filter(
    (o) =>
      o.kind === 'column' &&
      !old.has(key(o)) &&
      old.has(`relation|${o.id.split('.').slice(0, 2).join('.')}`),
  )) {
    const [schema, table, column] = o.id.split('.')
    const sql = `ALTER TABLE ${q(schema)}.${q(table)} ADD COLUMN ${q(column)} ${String(o.definition.type)}`
    const parsed = await parseSql(sql)
    assert(
      parsed.ok &&
        parsed.statements.length === 1 &&
        parsed.statements[0].AlterTableStmt?.cmds.length === 1 &&
        parsed.statements[0].AlterTableStmt.cmds[0].AlterTableCmd?.subtype === 'AT_AddColumn',
      'UE_UPGRADE_ADDITIVE_COLUMN_REFUSED',
    )
    add('nullable-column', o.id, sql)
  }
  for (const o of before) {
    if (o.kind === 'policy' && !target.has(key(o))) {
      const [schema, table, policy] = o.id.split('.')
      add('retire-policy', o.id, `DROP POLICY ${q(policy)} ON ${q(schema)}.${q(table)}`)
    }
  }
  const sections = splitUpgradeDump(dump)
  const separatelyDumpedChecks = new Set(
    sections
      .filter((s) => s.type === 'CONSTRAINT')
      .map((s) => {
        const [table, constraint] = s.name.split(' ')
        return `${tableId(s.schema, table)}.${constraint}`
      }),
  )
  const acl: UpgradeStatement[] = []
  const deferredOwners: UpgradeStatement[] = []
  for (const section of sections) {
    const parsed = await parseSql(section.sql)
    assert(parsed.ok, `UE_UPGRADE_SECTION_PARSE:${section.type}:${section.name}`)
    const { type, name, schema } = section
    let id: string | undefined, kind: string | undefined
    if (type === 'FUNCTION') {
      kind = 'function'
      id = functionId(schema, name)
    } else if (type === 'TABLE') {
      kind = 'relation'
      id = `${schema}.${name}`
    } else if (type === 'INDEX') {
      kind = 'index'
      id = `${schema}.${name}`
    } else if (['CONSTRAINT', 'FK CONSTRAINT', 'TRIGGER', 'POLICY'].includes(type)) {
      const parts = name.split(' ')
      assert.equal(parts.length, 2, 'UE_UPGRADE_OBJECT_NAME_REFUSED')
      const [table, object] = parts
      kind = type === 'POLICY' ? 'policy' : type === 'TRIGGER' ? 'trigger' : 'constraint'
      id =
        type === 'POLICY' ? `${schema}.${table}.${object}` : `${tableId(schema, table)}.${object}`
    }
    const previous = kind && id ? old.get(`${kind}|${id}`) : undefined
    const wanted = kind && id ? target.get(`${kind}|${id}`) : undefined
    if (kind && id) assert(wanted, `UE_UPGRADE_TARGET_OBJECT_MISSING:${kind}:${id}`)
    const changed = !previous || !sameObject(previous, wanted!)
    if (
      ['CONSTRAINT', 'FK CONSTRAINT', 'INDEX', 'TRIGGER', 'POLICY', 'FUNCTION'].includes(type) &&
      !changed
    )
      continue
    if (previous && changed && kind === 'constraint') {
      assert.equal(previous.definition.type, 'c', 'UE_UPGRADE_ONLY_CHECK_REPLACEMENT_ALLOWED')
      assert.equal(wanted?.definition.type, 'c', 'UE_UPGRADE_ONLY_CHECK_REPLACEMENT_ALLOWED')
      const [table, constraint] = name.split(' ')
      add(
        'replace-check',
        id!,
        `ALTER TABLE ${q(schema)}.${q(table)} DROP CONSTRAINT ${q(constraint)}`,
      )
    }
    if (previous && changed && kind === 'policy') {
      const [table, policy] = name.split(' ')
      add('replace-policy', id!, `DROP POLICY ${q(policy)} ON ${q(schema)}.${q(table)}`)
    }
    if (previous && changed && kind === 'trigger') {
      const [table, trigger] = name.split(' ')
      add('replace-trigger', id!, `DROP TRIGGER ${q(trigger)} ON ${q(schema)}.${q(table)}`)
    }
    if (previous && changed && kind === 'index')
      assert.fail(`UE_UPGRADE_INDEX_REPLACEMENT_REFUSED:${id}`)
    if (previous && changed && kind === 'function') {
      const handoff = canonicalFunctionOwnerHandoff(previous, wanted!)
      if (handoff) result.push(handoff)
    }
    for (const [i, node] of parsed.statements.entries()) {
      let sql = parsed.texts[i]
      const tag = Object.keys(node)[0]
      if (node.VariableSetStmt) {
        const set = node.VariableSetStmt
        const value = set.args?.[0]?.A_Const?.sval?.sval
        assert(
          set.kind === 'VAR_SET_VALUE' &&
            !set.is_local &&
            set.args?.length === 1 &&
            ((set.name === 'default_tablespace' && value === '') ||
              (set.name === 'default_table_access_method' && value === 'heap')),
          'UE_UPGRADE_DUMP_SETTING_REFUSED',
        )
        continue
      }
      if (type === 'TABLE' && previous && tag === 'CreateStmt') continue
      if (type === 'SCHEMA' && tag === 'CreateSchemaStmt') continue
      if (['TYPE', 'SEQUENCE'].includes(type)) {
        // No new types or sequences are needed by this bounded upgrade. Refuse
        // extension to a shape-changing migration until separately implemented.
        const lookup = type === 'TYPE' ? `enum|${schema}.${name}` : `relation|${schema}.${name}`
        assert(old.has(lookup), `UE_UPGRADE_NEW_TYPE_OR_SEQUENCE_REFUSED:${name}`)
        continue
      }
      if (type === 'FUNCTION' && previous && tag === 'CreateFunctionStmt')
        sql = sql.replace(/\bCREATE FUNCTION\b/, 'CREATE OR REPLACE FUNCTION')
      if (
        type === 'FUNCTION' &&
        !previous &&
        wanted?.definition.owner === 'ue_external_read_reader' &&
        tag === 'AlterOwnerStmt'
      ) {
        // The isolated role's SET-only bridge deliberately confers no EXECUTE
        // on the table owner. As in the canonical installer, attach all triggers
        // while their new functions are still table-owner-owned, then hand off.
        deferredOwners.push({ phase: 'isolated-owner-handoff', object: id!, sql })
        continue
      }
      if (type === 'ACL' || type === 'DEFAULT ACL') {
        assert(
          tag === 'GrantStmt' || tag === 'AlterDefaultPrivilegesStmt',
          'UE_UPGRADE_ACL_STATEMENT_REFUSED',
        )
        acl.push({
          phase: 'target-acl',
          object: `${schema}.${name}`,
          sql,
          role: section.owner === 'pg_database_owner' ? 'ue_v2_owner' : section.owner,
        })
        continue
      }
      assert(
        [
          'CreateStmt',
          'CreateFunctionStmt',
          'AlterFunctionStmt',
          'AlterOwnerStmt',
          'AlterTableStmt',
          'IndexStmt',
          'CreateTrigStmt',
          'CreatePolicyStmt',
        ].includes(tag),
        `UE_UPGRADE_DDL_KIND_REFUSED:${tag}`,
      )
      if (node.AlterTableStmt)
        for (const cmd of node.AlterTableStmt.cmds ?? [])
          assert(
            [
              'AT_ChangeOwner',
              'AT_AddConstraint',
              'AT_EnableRowSecurity',
              'AT_ForceRowSecurity',
            ].includes(cmd.AlterTableCmd?.subtype),
            'UE_UPGRADE_ALTER_TABLE_REFUSED',
          )
      add(type.toLowerCase(), id ?? `${schema}.${name}`, sql)
    }
  }
  // pg_dump puts ordinary CHECKs inside CREATE TABLE. Existing tables keep
  // their CREATE statement skipped, so their new/changed checks need explicit
  // forward declarations from the qualified native target catalog.
  for (const o of after.filter(
    (o) =>
      o.kind === 'constraint' && o.definition.type === 'c' && !separatelyDumpedChecks.has(o.id),
  )) {
    const previous = old.get(key(o))
    if (previous && sameObject(previous, o)) continue
    const parts = o.id.split('.'),
      constraint = parts.pop()!,
      table = parts.pop()!,
      schema = parts.pop() ?? 'public'
    if (!old.has(`relation|${schema}.${table}`)) continue
    if (previous) {
      assert.equal(previous.definition.type, 'c', 'UE_UPGRADE_ONLY_CHECK_REPLACEMENT_ALLOWED')
      add(
        'replace-check',
        o.id,
        `ALTER TABLE ${q(schema)}.${q(table)} DROP CONSTRAINT ${q(constraint)}`,
      )
    }
    const sql = `ALTER TABLE ${q(schema)}.${q(table)} ADD CONSTRAINT ${q(constraint)} ${String(o.definition.definition)}`
    const parsed = await parseSql(sql)
    assert(
      parsed.ok &&
        parsed.statements.length === 1 &&
        parsed.statements[0].AlterTableStmt?.cmds.length === 1 &&
        parsed.statements[0].AlterTableStmt.cmds[0].AlterTableCmd?.subtype === 'AT_AddConstraint' &&
        parsed.statements[0].AlterTableStmt.cmds[0].AlterTableCmd.def?.Constraint?.contype ===
          'CONSTR_CHECK',
      'UE_UPGRADE_CHECK_DECLARATION_REFUSED',
    )
    add('inline-check', o.id, sql)
  }
  result.push(...deferredOwners)
  // Old table/column grants must be explicitly removed even when the new dump
  // has no ACL section for an owner-only object. Never depend on additive GRANTs.
  const roles = after.filter((o) => o.kind === 'role' && o.id !== 'ue_v2_owner').map((o) => q(o.id))
  assert(roles.length > 0, 'UE_UPGRADE_ROLE_REFERENCE_REQUIRED')
  const recipients = ['PUBLIC', ...roles].join(',')
  for (const o of after.filter((o) => o.kind === 'relation' && o.definition.kind === 'r')) {
    const tableRecipients = [
      'PUBLIC',
      ...after.filter((r) => r.kind === 'role' && r.id !== o.definition.owner).map((r) => q(r.id)),
    ].join(',')
    result.push({
      phase: 'reset-table-acl',
      object: o.id,
      sql: `REVOKE ALL ON TABLE ${qualified(o.id)} FROM ${tableRecipients}`,
      role: String(o.definition.owner),
    })
  }
  for (const o of before.filter((o) => o.kind === 'column' && o.definition.acl)) {
    const parts = o.id.split('.')
    assert.equal(parts.length, 3)
    const owner = old.get(`relation|${parts[0]}.${parts[1]}`)?.definition.owner
    assert(typeof owner === 'string', 'UE_UPGRADE_COLUMN_OWNER_REQUIRED')
    const columnRecipients = [
      'PUBLIC',
      ...after.filter((r) => r.kind === 'role' && r.id !== owner).map((r) => q(r.id)),
    ].join(',')
    result.push({
      phase: 'reset-column-acl',
      object: o.id,
      sql: `REVOKE ALL (${q(parts[2])}) ON TABLE ${q(parts[0])}.${q(parts[1])} FROM ${columnRecipients}`,
      role: owner,
    })
  }
  for (const o of after.filter((o) => o.kind === 'function')) {
    const recipients = [
      'PUBLIC',
      ...after.filter((r) => r.kind === 'role' && r.id !== o.definition.owner).map((r) => q(r.id)),
    ].join(',')
    // Function identities are PostgreSQL-generated, not caller-supplied SQL.
    assert(/^[a-z_][a-z0-9_.]*\([^;]*\)$/.test(o.id), 'UE_UPGRADE_FUNCTION_IDENTITY_REFUSED')
    result.push({
      phase: 'reset-function-acl',
      object: o.id,
      sql: `REVOKE ALL ON FUNCTION ${o.id} FROM ${recipients}`,
      role: String(o.definition.owner),
    })
  }
  for (const schema of ['public', 'user_management'])
    add('reset-schema-acl', schema, `REVOKE ALL ON SCHEMA ${q(schema)} FROM ${recipients}`)
  result.push(...acl)
  for (const o of before.filter((o) => o.kind === 'function' && !target.has(key(o)))) {
    assert(
      /^ue_v2_visible_parent_[a-f0-9]{16}\(uuid\)$/.test(o.id),
      'UE_UPGRADE_OBSOLETE_FUNCTION_REFUSED',
    )
    add('retire-function', o.id, `DROP FUNCTION public.${o.id}`)
  }
  assert(result.length > 0, 'UE_UPGRADE_EMPTY_PLAN')
  return result
}
