import assert from 'node:assert/strict'
import { sqlTokens } from './close-w4t-named-types'
import { frozenStatements } from './close-w5a-replay-graph'
import {
  replayDigest,
  replayHash,
  replayObject,
  replayRecords,
  replayText,
  type FrozenReplay,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'
import { proveMissingPolicyParent } from '../../apps/union-eyes/scripts/provisioning/original-boundary-inspection'

export const payloadFile =
  'docs/union-eyes/reality-remediation/UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json'
export const payloadHash = '6f81fde1377714e0fb63177cd976a010ec6db197bb8365ad340b8b40d4629e2b'
type Token = ReturnType<typeof sqlTokens>[number]
const value = (token: Token) => (token.kind === 'WORD' ? token.value.toLowerCase() : token.value)
export function tableDefinition(sql: string) {
  const tokens = sqlTokens(sql)
  if (tokens[0]?.value.toUpperCase() !== 'CREATE' || tokens[1]?.value.toUpperCase() !== 'TABLE')
    return null
  let at = 2
  const guarded = tokens[at]?.value.toUpperCase() === 'IF'
  if (guarded) {
    assert.equal(tokens[at + 1]?.value.toUpperCase(), 'NOT')
    assert.equal(tokens[at + 2]?.value.toUpperCase(), 'EXISTS')
    at += 3
  }
  const first = tokens[at++]
  assert(first && ['WORD', 'IDENTIFIER'].includes(first.kind), 'TABLE_IDENTIFIER_REQUIRED')
  let schema = 'public',
    name = value(first)
  if (tokens[at]?.value === '.') {
    schema = name
    at++
    const last = tokens[at++]
    assert(last && ['WORD', 'IDENTIFIER'].includes(last.kind), 'TABLE_NAME_REQUIRED')
    name = value(last)
  }
  assert.equal(tokens[at++]?.value, '(', 'TABLE_DEFINITION_REQUIRED')
  const fields: { name: string; definition: string }[] = []
  const constraints: string[] = []
  let start = at,
    depth = 1
  const field = (end: number) => {
    const first = tokens[start]
    assert(first, 'EMPTY_TABLE_FIELD')
    const text = sql.slice(first.start, tokens[end - 1].end)
    if (
      first.kind === 'WORD' &&
      ['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'CHECK', 'UNIQUE', 'EXCLUDE'].includes(
        first.value.toUpperCase(),
      )
    )
      constraints.push(text)
    else {
      assert(['WORD', 'IDENTIFIER'].includes(first.kind), 'COLUMN_IDENTIFIER_REQUIRED')
      fields.push({ name: value(first), definition: text })
    }
  }
  for (; at < tokens.length; at++) {
    if (tokens[at].kind === 'SYMBOL' && tokens[at].value === '(') depth++
    else if (tokens[at].kind === 'SYMBOL' && tokens[at].value === ')') {
      depth--
      if (!depth) {
        field(at)
        break
      }
    } else if (tokens[at].kind === 'SYMBOL' && tokens[at].value === ',' && depth === 1) {
      field(at)
      start = at + 1
    }
  }
  assert.equal(depth, 0, 'UNCLOSED_TABLE_DEFINITION')
  assert.equal(new Set(fields.map((entry) => entry.name)).size, fields.length, 'DUPLICATE_COLUMN')
  return { schema, name, guarded, fields, constraints }
}

export function effectClass(sql: string) {
  const words = sqlTokens(sql)
    .filter((token) => token.kind !== 'STRING')
    .map((token) => token.value.toUpperCase())
  const prefix = words.slice(0, 5).join(' ')
  if (words[0] === 'DO') return 'DO_OR_PROCEDURAL_BLOCK'
  if (words[0] === 'SELECT' && words[1]?.startsWith('UE_CREATE_')) return 'POLICY_OR_RLS'
  if (/^(CREATE|DROP) (OR REPLACE )?FUNCTION/.test(prefix)) return 'FUNCTION_OR_PROCEDURE'
  if (/^(CREATE|DROP) POLICY/.test(prefix) || (words[0] === 'ALTER' && words.includes('SECURITY')))
    return 'POLICY_OR_RLS'
  if (
    words[0] === 'GRANT' ||
    words[0] === 'REVOKE' ||
    prefix.startsWith('ALTER DEFAULT PRIVILEGES')
  )
    return 'ACL_CHANGE'
  if (/^(CREATE|DROP) (UNIQUE )?INDEX/.test(prefix)) return 'INDEX_DDL'
  if (/^(CREATE|ALTER|DROP) SCHEMA/.test(prefix) || tableDefinition(sql)) return 'RELATION_DDL'
  if (words[0] === 'ALTER' && words.includes('CONSTRAINT')) return 'CONSTRAINT_DDL'
  if (words[0] === 'ALTER' && (words.includes('DEFAULT') || words.includes('NULL')))
    return 'DEFAULT_OR_NULLABILITY_CHANGE'
  if (words[0] === 'ALTER' && words.includes('COLUMN')) return 'COLUMN_DDL'
  if (words[0] === 'UPDATE') return 'DATA_BACKFILL'
  throw new Error(`UNCLASSIFIED_EXECUTABLE_EFFECT:${prefix}`)
}

const evidenceSurfaces: Record<string, string[]> = {
  RELATION_DDL: [
    'pg_namespace',
    'pg_class.relkind',
    'pg_attribute:ordered types/nullability/defaults/identity/generated',
    'pg_constraint:all inline keys/checks',
  ],
  COLUMN_DDL: ['pg_attribute', 'pg_attrdef + pg_get_expr', 'pg_constraint for inline REFERENCES'],
  CONSTRAINT_DDL: [
    'pg_constraint + pg_get_constraintdef:definition/actions/deferrability/validation',
  ],
  INDEX_DDL: [
    'pg_index:indisvalid/indisready/indislive',
    'pg_get_indexdef:ordered keys/expressions/predicate/uniqueness',
  ],
  FUNCTION_OR_PROCEDURE: [
    'pg_proc:identity arguments/result/language/volatility/security/config/owner',
    'pg_get_functiondef:normalized exact body',
  ],
  POLICY_OR_RLS: [
    'pg_class.relrowsecurity/relforcerowsecurity',
    'pg_policy:cmd/permissive/roles/qual/with_check + pg_get_expr',
    'pg_proc:called helper definition and exact literal arguments',
  ],
  ACL_CHANGE: [
    'pg_namespace/pg_class/pg_database ACL + aclexplode',
    'pg_default_acl:grantor/schema/object-kind',
    'pg_auth_members:effective inherited privileges/grant options',
  ],
  DEFAULT_OR_NULLABILITY_CHANGE: ['pg_attribute.attnotnull', 'pg_attrdef + pg_get_expr'],
  DATA_BACKFILL: [
    'read-only predicate over the exact UPDATE target and WHERE domain',
    'pre-image row keys and expression-input digest for immediate verification',
    'verified receipt after successor/data changes',
  ],
  DO_OR_PROCEDURAL_BLOCK: [
    'source-bound branch predicates/read-only catalog or row snapshot',
    'exact exception outcomes and skipped-target set',
    'all branch-specific DDL/ACL/data postconditions',
    'verified receipt for historical branch attribution',
  ],
}
const comparatorClasses: Record<string, string> = {
  RELATION_DDL: 'CATALOG_EXACT',
  COLUMN_DDL: 'CATALOG_EXACT',
  CONSTRAINT_DDL: 'CONSTRAINT_EXACT',
  INDEX_DDL: 'INDEX_DEFINITION_EXACT',
  FUNCTION_OR_PROCEDURE: 'FUNCTION_DEFINITION_EXACT',
  POLICY_OR_RLS: 'POLICY_DEFINITION_EXACT',
  ACL_CHANGE: 'ACL_EXACT',
  DEFAULT_OR_NULLABILITY_CHANGE: 'CATALOG_EXACT',
  DATA_BACKFILL: 'DATA_PREDICATE_EXACT',
  DO_OR_PROCEDURAL_BLOCK: 'COMPOSITE_EXACT',
}
function comparator(sql: string, category: string) {
  const tokens = sqlTokens(sql)
  const table = tableDefinition(sql)
  const enumOnly =
    category === 'DO_OR_PROCEDURAL_BLOCK' &&
    tokens
      .filter((token) => token.kind !== 'STRING')
      .map((token) => (token.kind === 'WORD' ? token.value.toUpperCase() : token.value))
      .join(' ')
      .match(
        /^DO BEGIN CREATE TYPE (?:PUBLIC \. )?[A-Z_a-z][A-Z_a-z0-9]* AS ENUM \([^;]*\) ; EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL ; END ;?$/,
      ) !== null
  const historical =
    category === 'DATA_BACKFILL' ||
    (category === 'DO_OR_PROCEDURAL_BLOCK' && !enumOnly) ||
    category === 'ACL_CHANGE'
  return {
    CLASS: enumOnly ? 'DEFINITION_EXACT' : comparatorClasses[category],
    READ_ONLY_EVIDENCE_PLAN: enumOnly
      ? [
          'pg_type.typtype',
          'pg_enum:enumlabel ordered by enumsortorder;exact members,no extras/reordering',
        ]
      : evidenceSurfaces[category],
    EXACT_SOURCE_SEMANTICS: sql,
    EXPECTED_RELATION_DEFINITION: table,
    LITERAL_ARGUMENTS: tokens
      .filter((token) => token.kind === 'STRING')
      .map((token) => token.value),
    OWNED_POSTCONDITION: enumOnly
      ? 'The source-bound enum has exactly the ordered labels and enum kind;duplicate_object does not certify a wrong or partially populated same-name enum.'
      : category === 'DATA_BACKFILL'
        ? 'For the pre-image keys satisfying the exact WHERE clause,the immediate new row values equal the frozen SET expressions evaluated over that same pre-image;unselected values are not changed. Final no-NULL predicates alone are necessary,not proof of historical attribution.'
        : category === 'DO_OR_PROCEDURAL_BLOCK'
          ? 'Preserve the whole source block. Record the selected source branches,exception/NOTICE/RETURN outcomes and exact DDL/DML/ACL changes;verify their immediate composite postconditions,not just existence. Historical branch attribution requires a verified receipt.'
          : 'Exact owned definition/security state derived from the unchanged source operation,including all parameters,expressions and clauses;not name existence. DROP then CREATE in the same boundary is verified as its final composite definition,not contradictory simultaneous absence/presence.',
    COMPLETION_OBSERVABILITY: historical ? 'RECEIPT_REQUIRED' : 'CATALOG_EXACT',
    VERIFICATION_WINDOW: historical
      ? 'RECEIPT_REQUIRED_AFTER_SUCCESSOR'
      : 'IMMEDIATE_PRE_SUCCESSOR',
    POST_EXECUTION_WINDOW: 'IMMEDIATE_PRE_SUCCESSOR',
    NO_RECEIPT_NON_MONOTONIC_STATE: 'PARTIAL_OR_AMBIGUOUS',
    IMPLEMENTATION_STATUS: 'SOURCE_BOUND_INSPECTION_PLAN_ONLY_NOT_FULL_COMPARATOR',
  }
}
export function transactionInventory(sql: string) {
  const tokens = sqlTokens(sql)
  const prohibited = new Set([
    'COMMIT',
    'ROLLBACK',
    'VACUUM',
    'CONCURRENTLY',
    'NEXTVAL',
    'SETVAL',
    'DBLINK',
    'LO_IMPORT',
    'COPY',
  ])
  const forbidden = tokens.filter(
    (token) => token.kind === 'WORD' && prohibited.has(token.value.toUpperCase()),
  )
  assert.equal(forbidden.length, 0, 'UNPROVEN_NONTRANSACTIONAL_SOURCE_EFFECT')
  for (const token of tokens.filter(
    (token) => token.kind === 'STRING' && /^(ALTER|CREATE|DROP|GRANT|REVOKE)\s/i.test(token.value),
  )) {
    assert(
      !/\b(CONCURRENTLY|COMMIT|ROLLBACK|NEXTVAL|SETVAL|COPY|VACUUM)\b/i.test(token.value),
      'UNPROVEN_DYNAMIC_TRANSACTION_EFFECT',
    )
  }
  return {
    CLASS: 'TRANSACTION_COMPATIBLE',
    TOP_LEVEL_OPERATION: tokens[0]?.value.toUpperCase(),
    FORBIDDEN_COMMANDS_OR_SEQUENCE_MUTATIONS: [],
    INTERNAL_TRANSACTION_CONTROL:
      'NONE;PL/pgSQL BEGIN/EXCEPTION is block/subtransaction control,not SQL BEGIN/COMMIT',
    RUNTIME_PREFLIGHT_REQUIRED:
      'Bind target functions,triggers/event triggers and extension effects to qualified transactional definitions;unknown side effects deny future execution. No runtime qualification performed.',
    ROLLBACK_PROOF: 'NOT_EXECUTED',
  }
}

export function buildBoundaryClosure(
  frozen: FrozenReplay,
  sourceBytes: Record<string, string>,
  payloadBytes: string,
) {
  assert.equal(replayHash(payloadBytes), payloadHash, 'W4P_PAYLOAD_SOURCE_DRIFT')
  const payloads = replayRecords(replayObject(JSON.parse(payloadBytes)).RELATION_CREATE_PAYLOADS)
  const mandatory = payloads.map((payload) => {
    const sql = replayText(payload.SQL)
    assert.equal(replayHash(sql), payload.SQL_SHA256, 'W4P_SQL_DIGEST_DRIFT')
    const table = tableDefinition(sql)
    assert(table, 'BASELINE_CREATE_TABLE_REQUIRED')
    const accepted = replayRecords(frozen.input.promotionImplementation.registry).find(
      (entry) => entry.PAYLOAD_ID === payload.PAYLOAD_ID,
    )
    assert(
      accepted && accepted.SQL_SHA256 === payload.SQL_SHA256,
      'W4P_IMPLEMENTED_PAYLOAD_BINDING_REQUIRED',
    )
    return { payload, table }
  })
  const helpers = new Map<string, { sql: string; hash: string }>()
  const executableSourceInventory = Object.entries(sourceBytes).map(([file, source]) => ({
    SOURCE_PATH: file,
    SOURCE_SHA256: replayHash(source),
    EXECUTABLE_STATEMENTS: frozenStatements(source).map((statement) => statement.TEXT),
  }))
  const boundaries = frozen.order
    .filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT')
    .map((node) => {
      const file = replayText(node.SOURCE_FILE),
        source = sourceBytes[file]
      assert.equal(replayHash(source), node.SOURCE_SHA256, `BOUNDARY_SOURCE_DRIFT:${file}`)
      const bytes = Buffer.from(source, 'utf8')
      const statements = frozenStatements(source)
      const effects = statements.map((statement, index) => {
        const category = effectClass(statement.TEXT)
        const tokens = sqlTokens(statement.TEXT)
        const effectId = `${node.REPLAY_UNIT_ID}:E${String(index + 1).padStart(3, '0')}`
        const begin = Buffer.byteLength(source.slice(0, statement.START), 'utf8'),
          end = Buffer.byteLength(source.slice(0, statement.END), 'utf8')
        assert.equal(
          bytes.subarray(begin, end).toString('utf8'),
          statement.TEXT,
          'EFFECT_BYTE_BINDING_FAILED',
        )
        if (category === 'FUNCTION_OR_PROCEDURE' && tokens[0].value.toUpperCase() === 'CREATE') {
          const functionAt = tokens.findIndex((token) => token.value.toUpperCase() === 'FUNCTION')
          helpers.set(value(tokens[functionAt + 1]), {
            sql: statement.TEXT,
            hash: statement.SHA256,
          })
        }
        const helper =
          tokens[0]?.value.toUpperCase() === 'SELECT' ? helpers.get(value(tokens[1])) : undefined
        if (tokens[0]?.value.toUpperCase() === 'SELECT')
          assert(helper, 'UNBOUND_POLICY_HELPER_BODY')
        const inspection = comparator(statement.TEXT, category)
        return {
          EFFECT_ID: effectId,
          BOUNDARY_ID: replayText(node.REPLAY_UNIT_ID),
          SOURCE_ORDINAL: index + 1,
          SOURCE_BYTE_RANGE: [begin, end],
          SOURCE_LINE_RANGE: [
            source.slice(0, statement.START).split('\n').length,
            source.slice(0, statement.END).split('\n').length,
          ],
          EXACT_EFFECT_SHA256: statement.SHA256,
          EFFECT_CLASS: category,
          INDIVISIBLE:
            category === 'DO_OR_PROCEDURAL_BLOCK' || category === 'FUNCTION_OR_PROCEDURE',
          COMPARATOR: inspection,
          OWNED_POSTCONDITION: inspection.OWNED_POSTCONDITION,
          COMPLETION_OBSERVABILITY: inspection.COMPLETION_OBSERVABILITY,
          VERIFICATION_WINDOW: inspection.VERIFICATION_WINDOW,
          HELPER_DEFINITION: helper ?? null,
          TRANSACTION_RELEVANCE:
            'PostgreSQL transactional DDL/ACL/DML or PL/pgSQL subtransaction;source contains no top-level transaction control,prohibited command or sequence-state mutation. Defined helper calls are bound to their frozen transactional DDL bodies.',
          TRANSACTION_CLASS: 'TRANSACTION_COMPATIBLE',
          TRANSACTION_INVENTORY: transactionInventory(statement.TEXT),
        }
      })
      let end = 0
      const ownership: { RANGE: number[]; OWNER: string; SHA256: string }[] = []
      for (const effect of effects) {
        const [start, stop] = effect.SOURCE_BYTE_RANGE
        if (start > end) {
          const trivia = bytes.subarray(end, start).toString('utf8')
          assert.equal(sqlTokens(trivia).length, 0, 'UNACCOUNTED_EXECUTABLE_GAP')
          ownership.push({
            RANGE: [end, start],
            OWNER: 'NON_EXECUTABLE_TRIVIA',
            SHA256: replayHash(trivia),
          })
        }
        ownership.push({
          RANGE: [start, stop],
          OWNER: effect.EFFECT_ID,
          SHA256: effect.EXACT_EFFECT_SHA256,
        })
        end = stop
      }
      if (end < bytes.length) {
        const trivia = bytes.subarray(end).toString('utf8')
        assert.equal(sqlTokens(trivia).length, 0, 'UNACCOUNTED_EXECUTABLE_TAIL')
        ownership.push({
          RANGE: [end, bytes.length],
          OWNER: 'NON_EXECUTABLE_TRIVIA',
          SHA256: replayHash(trivia),
        })
      }
      const counterexamples = effects.flatMap((effect) => {
        const tokens = sqlTokens(effect.COMPARATOR.EXACT_SOURCE_SEMANTICS)
        if (
          tokens[0]?.value.toUpperCase() !== 'SELECT' ||
          tokens[1]?.value.toLowerCase() !== 'ue_create_parent_owned_rls_policy_v2'
        )
          return []
        const [target, fk, parent, parentOrg = 'organization_id'] =
          effect.COMPARATOR.LITERAL_ARGUMENTS
        assert(target && fk && parent, 'EXACT_POLICY_HELPER_ARGUMENTS_REQUIRED')
        const baseline = mandatory.find(
          (entry) => entry.table.schema === 'public' && entry.table.name === parent,
        )
        if (!baseline) return []
        assert(
          effect.HELPER_DEFINITION?.sql.includes('parent.id = %I.%I'),
          'PARENT_ID_REFERENCE_NOT_PROVEN',
        )
        const missing = ['id', parentOrg].filter(
          (name) => !baseline.table.fields.some((field) => field.name === name),
        )
        if (!missing.length) return []
        const downstream = replayRecords(frozen.register.UNRESOLVED_OPERAND_BINDINGS).map(
          (entry) => entry.PHYSICAL_OPERAND_IDENTITY,
        )
        assert(
          missing.every(
            (column) => !downstream.includes(`union-eyes::COLUMN::public.${parent}.${column}`),
          ),
          'DOWNSTREAM_OPERAND_MUST_NOT_BECOME_BLOCKER',
        )
        const executableWriters = executableSourceInventory.flatMap((entry) =>
          entry.EXECUTABLE_STATEMENTS.filter((sql) => {
            const definition = tableDefinition(sql)
            if (
              definition?.schema === 'public' &&
              definition.name === parent &&
              definition.fields.some((field) => missing.includes(field.name))
            )
              return true
            const t = sqlTokens(sql)
            return t.some(
              (token, i) =>
                token.value.toUpperCase() === 'ALTER' &&
                t[i + 1]?.value.toUpperCase() === 'TABLE' &&
                [t[i + 2]?.value, t[i + 4]?.value].includes(parent) &&
                t
                  .slice(i + 2)
                  .some(
                    (value, j, array) =>
                      value.value.toUpperCase() === 'COLUMN' &&
                      array.slice(j + 1, j + 5).some((v) => missing.includes(v.value)),
                  ),
            )
          }).map((sql) => ({ SOURCE_PATH: entry.SOURCE_PATH, SQL_SHA256: replayHash(sql) })),
        )
        assert.equal(
          executableWriters.length,
          0,
          `PARENT_COLUMN_WRITER_INVALIDATES_COUNTEREXAMPLE:${parent}`,
        )
        const otherBaselineWriters = replayRecords(
          replayObject(JSON.parse(payloadBytes)).ADD_COLUMN_PAYLOADS,
        ).filter(
          (payload) =>
            replayRecords(frozen.input.promotionImplementation.registry).some(
              (entry) => entry.PAYLOAD_ID === payload.PAYLOAD_ID,
            ) &&
            missing.some((column) =>
              JSON.stringify(payload.PHYSICAL_IDENTITIES_PRODUCED).includes(
                `public.${parent}.${column}`,
              ),
            ),
        )
        assert.equal(otherBaselineWriters.length, 0, 'W4P_COLUMN_WRITER_INVALIDATES_COUNTEREXAMPLE')
        return [
          {
            EFFECT_ID: effect.EFFECT_ID,
            BOUNDARY_ID: effect.BOUNDARY_ID,
            SOURCE_PATH: file,
            SOURCE_SHA256: node.SOURCE_SHA256,
            EXACT_EFFECT_SHA256: effect.EXACT_EFFECT_SHA256,
            SOURCE_BYTE_RANGE: effect.SOURCE_BYTE_RANGE,
            PHYSICAL_IDENTITY: `public.${parent}`,
            TARGET_RELATION: `public.${target}`,
            TARGET_FOREIGN_KEY_COLUMN: fk,
            W4P_PAYLOAD_ID: baseline.payload.PAYLOAD_ID,
            W4P_SQL: baseline.payload.SQL,
            W4P_SQL_SHA256: baseline.payload.SQL_SHA256,
            HELPER_SOURCE_DEFINITION: effect.HELPER_DEFINITION,
            SOURCE_REQUIRED_PARENT_COLUMNS: ['id', parentOrg],
            EXECUTABLE_PARENT_COLUMN_WRITERS: executableWriters,
            SOURCE_UNIVERSE_COLUMN_WRITER_SCAN:
              'All23 bound executable sources,excluding commented introspection design DDL;no new producer search',
            W4P_ADD_COLUMN_WRITERS: otherBaselineWriters,
            ...proveMissingPolicyParent({
              requiredColumns: ['id', parentOrg],
              baselineColumns: baseline.table.fields.map((field) => field.name),
            }),
            WHY_NO_COMPLETION_COMPARATOR_EXISTS:
              'A catalog prerequisite comparator DOES exist and reports the missing parent column. No valid expected completed policy can be materialized/verified on that parent shape:its frozen expression references parent.id. This is a source-execution prerequisite contradiction,not missing comparator annotations.',
            WHY_NO_SAFE_REPLAY_ELIGIBILITY_EXISTS:
              'A fresh compliant W4P baseline creates this parent with only the recorded fields. The frozen helper resolves parent.id in CREATE POLICY;the original boundary cannot produce it. No executable statement in the closed23-source universe produces the missing parent column. Denial is safe but the required fresh complete replay cannot be represented using this authority.',
            NEW_AUTHORITY_OR_RUNTIME_PROOF_REQUIRED:
              'New explicit human authority for an exact parent-key producer and its definition/order before the RLS boundary,or separately authorized runtime proof of a compatible pre-existing parent key. No key type/uniqueness/default is invented;no source,graph,baseline or producer change is authorized here.',
            TRANSACTION_CLASS: 'TRANSACTION_COMPATIBLE',
          },
        ]
      })
      return {
        BOUNDARY_ID: replayText(node.REPLAY_UNIT_ID),
        SOURCE_PATH: file,
        SOURCE_SHA256: replayText(node.SOURCE_SHA256),
        FROZEN_POSITION: node.HISTORICAL_POSITION,
        DATABASE_SCOPE: node.DATABASE_SCOPE,
        EXACT_BYTE_RANGE: [0, bytes.length],
        STATEMENT_COUNT: effects.length,
        EFFECT_COUNT: effects.length,
        BYTE_OWNERSHIP: ownership,
        EFFECTS: effects,
        COUNTEREXAMPLES: counterexamples,
      }
    })
  assert.equal(boundaries.length, 23)
  const blockers = boundaries.flatMap((entry) => entry.COUNTEREXAMPLES)
  assert(blockers.length > 0, 'FINAL_STATIC_BLOCKED_REQUIRES_EXACT_IRREDUCIBLE_EFFECT')
  const rows = boundaries.map((boundary) => ({
    BOUNDARY_ID: boundary.BOUNDARY_ID,
    SOURCE: boundary.SOURCE_PATH,
    EFFECT_COUNT: boundary.EFFECT_COUNT,
    COMPARATOR_COUNT: boundary.EFFECTS.length,
    ALL_EFFECTS_OBSERVABLE: boundary.EFFECTS.every(
      (effect) => effect.COMPARATOR.COMPLETION_OBSERVABILITY !== 'RECEIPT_REQUIRED',
    )
      ? 'CATALOG_PLAN_ONLY'
      : 'CATALOG_PLUS_VERIFIED_RECEIPT_PLAN',
    RECEIPT_DEPENDENCIES: boundary.EFFECTS.filter(
      (effect) => effect.COMPARATOR.COMPLETION_OBSERVABILITY === 'RECEIPT_REQUIRED',
    ).map((effect) => effect.EFFECT_ID),
    TRANSACTION_CLASS: 'TRANSACTION_COMPATIBLE',
    REPLAY_REQUIRED_INSPECTOR_COMPLETE: 'NO',
    ALREADY_COMPLETE_INSPECTOR_COMPLETE:
      boundary.EFFECT_COUNT === 0 ? 'VACUOUS_NO_EXECUTABLE_EFFECTS' : 'NO',
    POST_EXECUTION_VERIFIER_COMPLETE: 'NO',
    FAIL_CLOSED_PATH_COMPLETE: 'YES_OFFLINE_DENIAL_ONLY',
    STATUS: boundary.COUNTEREXAMPLES.length ? 'IRREDUCIBLE_BLOCKER' : 'IMPLEMENTABLE',
    STATUS_CEILING:
      'IMPLEMENTABLE denotes source-representability only,not an implemented inspector/verifier. Remaining handlers are not implemented because this final attempt has proven irreducible whole-graph counterexamples.',
    EXACT_BLOCKING_EFFECT_IDS: boundary.COUNTEREXAMPLES.map((entry) => entry.EFFECT_ID),
  }))
  return {
    ledger: {
      PHASE: 'PHASE_1B_3C_A1I_W5B_C',
      BYTE_RANGE_CONVENTION:
        'UTF8_ZERO_BASED_HALF_OPEN;comments/trivia retained,DO bodies indivisible',
      BOUNDARY_COUNT: boundaries.length,
      EFFECT_COUNT: boundaries.reduce((sum, boundary) => sum + boundary.EFFECT_COUNT, 0),
      UNACCOUNTED_EXECUTABLE_EFFECTS: 0,
      W5A_GRAPH_RECOMPUTED_SEMANTICALLY: 'NO',
      BOUNDARIES: boundaries,
    },
    closure: {
      PHASE: 'PHASE_1B_3C_A1I_W5B_C',
      FINAL_STATIC_W5B_CEILING: 'BLOCKED_REQUIRES_NEW_AUTHORITY_NOT_ANOTHER_DISCOVERY_PHASE',
      IRREDUCIBLE_BOUNDARY_COUNT: rows.filter((row) => row.STATUS === 'IRREDUCIBLE_BLOCKER').length,
      IRREDUCIBLE_EFFECT_COUNT: blockers.length,
      TRANSACTION_ASSIGNMENTS_PROVEN: 23,
      TRANSACTION_ASSIGNMENT_GAPS: 0,
      TRANSACTION_EVIDENCE_CEILING:
        'Source-native PostgreSQL semantics only;no live transaction/extension/event-trigger proof and no rollback implementation claimed.',
      COMPLETION_COMPARATOR_CEILING:
        'All executable effects have exact source-bound future read-only evidence plans;these are not full implemented comparators. Specific mandatory-W4P partial-state counterexamples end this attempt.',
      ROWS: rows,
      IRREDUCIBLE_BLOCKERS: blockers,
      LEDGER_DIGEST: replayDigest(boundaries),
      RECEIPT_BINDINGS: [
        'BOUNDARY_ID',
        'SOURCE_SHA256',
        'GRAPH_DIGEST',
        'PLAN_DIGEST',
        'DATABASE_SCOPE',
        'W4P_VERIFICATION_DIGEST',
        'PREDECESSOR_STATE_DIGEST',
        'EXECUTION_RESULT_DIGEST',
        'POSTCONDITION_VERIFICATION_DIGEST',
      ],
      RECEIPT_STORAGE:
        'ADAPTER_INTERFACE_ONLY;external future authority,no persistence table invented',
      REPLAY_NOOP: 'NOT_ESTABLISHED_0_OF_107_HANDLERS',
      FRESH_REPLAY: 'DENIED_MANDATORY_W4P_MISSING_POLICY_PARENT_KEY_COUNTEREXAMPLE',
      FAKE_ROLLBACK: 'NOT_IMPLEMENTED_NOT_PROVEN',
      DATABASE_CONNECTIONS: 0,
      SQL_EXECUTED: 0,
    },
  }
}
