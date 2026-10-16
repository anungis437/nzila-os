import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = 'docs/union-eyes/reality-remediation/'
const outputName = 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE'
const absolute = (file) => path.resolve(root, ...file.split('/'))
const hash = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => hash(JSON.stringify(value))
const id = (kind, key) => `UE-1B3CA1-${kind}-${hash(key).slice(0, 16)}`
const unique = (values) => [...new Set(values)].sort()
const frozenNames = {
  B3A: 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS',
  B3B: 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION',
  CA: 'PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT',
}
const frozenHashes = {
  B3A: '5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883',
  B3B: 'd65dea976c169acb795c71e5c3491d6478d4dbe0859e9b3b17c6be4691c7f84b',
  CA: 'bf6a6e2c1f73f3d56b035b3b1705f298d34d7ff738095eefff8249c6bd6144d0',
}
const frozen = Object.fromEntries(
  Object.entries(frozenNames).map(([key, name]) => {
    const bytes = readFileSync(absolute(`${base}${name}.json`))
    assert.equal(hash(bytes), frozenHashes[key], `FAIL_EVIDENCE_DRIFT: ${key}`)
    return [key, JSON.parse(bytes)]
  }),
)
const { B3A: a, B3B: b, CA: ca } = frozen
assert.equal(a.metadata.MIGRATION_MANIFEST.length, 23)
const manifest = a.metadata.MIGRATION_MANIFEST.map((entry, index) => {
  assert.equal(
    hash(readFileSync(absolute(entry.FILE))),
    entry.SHA256,
    `FAIL_EVIDENCE_DRIFT: ${entry.FILE}`,
  )
  return {
    ...entry,
    FROZEN_POSITION: index,
    MIGRATION_NODE_ID: id('MIGRATION', entry.FILE),
    DATABASE_SCOPE: entry.FILE.includes('/financial-service/') ? 'financial-service' : 'union-eyes',
  }
})
assert.equal(b.fixedB3CRuntimeProofPacket.ITEMS.length, 3124)
assert.equal(b.entryBoundarySourceRegistry.length, 1910)
assert.equal(b.sourceCeilings.length, 2656)
assert.deepEqual(ca.summary.CATALOG_PARENT_RESOLUTION, {
  LOCAL_CATALOG_MISMATCH: 603,
  RESOLVED_BY_LOCAL_CATALOG: 9,
  LOCAL_CATALOG_STILL_UNRESOLVED: 28,
})

// Uses the census's lexical convention: comments, strings and dollar bodies remain distinct.
function lex(sql, offset = 0) {
  const tokens = []
  let i = 0
  while (i < sql.length) {
    if (/\s/.test(sql[i])) {
      i++
      continue
    }
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i)
      i = end < 0 ? sql.length : end
      continue
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1
      i += 2
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) {
          depth++
          i += 2
        } else if (sql.startsWith('*/', i)) {
          depth--
          i += 2
        } else i++
      }
      assert.equal(depth, 0, 'Unterminated SQL comment')
      continue
    }
    const start = i
    const dollar = sql.slice(i).match(/^\$(?:[A-Za-z_]\w*)?\$/)?.[0]
    if (dollar) {
      const end = sql.indexOf(dollar, i + dollar.length)
      assert.ok(end >= 0, 'Unterminated SQL body')
      tokens.push({
        kind: 'body',
        value: sql.slice(i + dollar.length, end),
        start: offset + i,
        end: offset + end + dollar.length,
        bodyStart: offset + i + dollar.length,
      })
      i = end + dollar.length
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++]
      let value = ''
      let closed = false
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            value += quote
            i += 2
            continue
          }
          i++
          closed = true
          break
        }
        value += sql[i++]
      }
      assert.ok(closed, 'Unterminated SQL quoted token')
      tokens.push({
        kind: quote === "'" ? 'string' : 'identifier',
        value,
        start: offset + start,
        end: offset + i,
      })
    } else {
      const word = sql.slice(i).match(/^[A-Za-z_][\w$]*/)?.[0]
      const value = word ?? sql.slice(i).match(/^(?:::|\|\||:=|<=|>=|<>|!=)/)?.[0] ?? sql[i]
      i += value.length
      tokens.push({ kind: word ? 'word' : 'punct', value, start: offset + start, end: offset + i })
    }
  }
  return tokens
}
const is = (token, value) => token?.kind === 'word' && token.value.toUpperCase() === value
function nameAt(tokens, start) {
  const token = tokens[start]
  if (!token || !['word', 'identifier'].includes(token.kind)) return null
  const parts = [token.kind === 'identifier' ? token.value : token.value.toLowerCase()]
  let end = start + 1
  while (tokens[end]?.value === '.' && ['word', 'identifier'].includes(tokens[end + 1]?.kind)) {
    parts.push(
      tokens[end + 1].kind === 'identifier'
        ? tokens[end + 1].value
        : tokens[end + 1].value.toLowerCase(),
    )
    end += 2
  }
  return { name: parts.join('.'), end, parts }
}
function close(tokens, start) {
  assert.equal(tokens[start]?.value, '(')
  let depth = 0
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].kind !== 'punct') continue
    if (tokens[i].value === '(') depth++
    if (tokens[i].value === ')' && --depth === 0) return i
  }
  assert.fail('Unbalanced parentheses')
}
function argsOf(tokens, start, end) {
  const groups = [[]]
  let depth = 0
  for (const token of tokens.slice(start, end)) {
    if (token.kind === 'punct' && token.value === '(') depth++
    if (token.kind === 'punct' && token.value === ')') depth--
    if (token.value === ',' && token.kind === 'punct' && depth === 0) groups.push([])
    else groups.at(-1).push(token)
  }
  return groups
}
const types = new Set(
  'uuid text varchar character char boolean bool numeric decimal integer int int2 int4 int8 bigint smallint serial bigserial smallserial real float float4 float8 double money date time timestamp timestamptz timetz interval json jsonb bytea oid regclass regtype regproc name record void trigger event_trigger anyelement anyarray inet cidr macaddr tsvector tsquery bit varbit'.split(
    ' ',
  ),
)
const builtinFunctions = new Set(
  'gen_random_uuid now current_setting set_config format quote_ident quote_literal quote_nullable to_regclass to_regtype pg_get_userbyid pg_has_role has_table_privilege has_schema_privilege has_function_privilege count exists coalesce nullif greatest least lower upper length substring substr replace split_part array_length cardinality array_append unnest array_agg json_agg jsonb_agg json_build_object jsonb_build_object jsonb_array_elements jsonb_array_elements_text jsonb_typeof jsonb_path_exists string_agg extract date_part date_trunc make_interval current_database current_user session_user version pg_backend_pid pg_advisory_xact_lock pg_advisory_lock pg_advisory_unlock pg_notify pg_get_functiondef pg_get_expr pg_relation_size pg_total_relation_size avg sum min max round abs ceil floor md5 encode decode concat concat_ws row_number rank dense_rank lag lead trim btrim ltrim rtrim regexp_replace regexp_match regexp_matches array_position array_remove bool_or bool_and jsonb_set jsonb_each_text position octet_length generate_series num_nonnulls num_nulls'.split(
    ' ',
  ),
)
const syntaxCalls = new Set(
  'values in any all array row over partition using check primary unique references constraint enum if elsif loop select from where with exception as case and or not on returns table do begin raise execute foreach when then public security definer invoker language alter add column index include filter default cast'.split(
    ' ',
  ),
)
const pgRelations = new Set(
  'pg_roles pg_user pg_authid pg_class pg_namespace pg_attribute pg_policy pg_policies pg_tables pg_indexes pg_proc pg_constraint pg_type pg_extension pg_trigger pg_database pg_default_acl pg_depend'.split(
    ' ',
  ),
)
function identity(scope, kind, name) {
  if (['RELATION', 'TYPE', 'FUNCTION'].includes(kind) && !name.includes('.'))
    name = `${pgRelations.has(name) ? 'pg_catalog' : 'public'}.${name}`
  if (kind === 'COLUMN' && name.split('.').length === 2) name = `public.${name}`
  return `${scope}::${kind}::${name}`
}
function sqlDependencies(text) {
  const requirements = []
  const creations = []
  const opaque = []
  const add = (kind, name, token, reason, extra = {}) => {
    if (!name) return
    requirements.push({ KIND: kind, NAME: name, OFFSET: token.start, REASON: reason, ...extra })
  }
  function walk(tokens, body = false) {
    const relationNameOffsets = new Set()
    let grantStatement = false
    const ctes = new Set()
    for (let i = 0; i < tokens.length; i++) {
      if (
        is(tokens[i + 1], 'AS') &&
        tokens[i + 2]?.value === '(' &&
        ['word', 'identifier'].includes(tokens[i].kind)
      )
        ctes.add(tokens[i].value.toLowerCase())
    }
    const relation = (start, token, reason) => {
      const target = nameAt(tokens, start)
      if (
        target &&
        !ctes.has(target.name.toLowerCase()) &&
        ![
          'if',
          'only',
          'select',
          'set',
          'array',
          'unnest',
          'format',
          'new',
          'old',
          'on',
          'to',
          'for',
          'cascade',
          'restrict',
          'no',
          'action',
          'null',
        ].includes(target.name.toLowerCase()) &&
        !target.name.toLowerCase().startsWith('old.') &&
        !target.name.toLowerCase().startsWith('new.') &&
        (tokens[target.end]?.value !== '(' || reason !== 'QUERY_OR_DML_RELATION')
      )
        add('RELATION', target.name, token, reason)
      if (target) relationNameOffsets.add(tokens[start].start)
      return target
    }
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.value === ';' && token.kind === 'punct') {
        grantStatement = false
      }
      if (is(token, 'GRANT') || is(token, 'REVOKE')) grantStatement = true
      if (token.kind === 'body') {
        walk(lex(token.value, token.bodyStart), true)
        continue
      }
      if (is(token, 'CREATE')) {
        let j = i + 1
        if (is(tokens[j], 'OR') && is(tokens[j + 1], 'REPLACE')) j += 2
        if (is(tokens[j], 'UNLOGGED') || is(tokens[j], 'TEMP') || is(tokens[j], 'TEMPORARY')) j++
        const kind = [
          'TABLE',
          'VIEW',
          'MATERIALIZED',
          'SCHEMA',
          'TYPE',
          'FUNCTION',
          'PROCEDURE',
          'EXTENSION',
          'ROLE',
          'USER',
        ].find((kind) => is(tokens[j], kind))
        if (kind) {
          const normalized = {
            TABLE: 'RELATION',
            VIEW: 'RELATION',
            MATERIALIZED: 'RELATION',
            SCHEMA: 'SCHEMA',
            TYPE: 'TYPE',
            FUNCTION: 'FUNCTION',
            PROCEDURE: 'FUNCTION',
            EXTENSION: 'EXTENSION',
            ROLE: 'ROLE',
            USER: 'ROLE',
          }[kind]
          j++
          if (kind === 'MATERIALIZED') j++
          if (is(tokens[j], 'IF')) j += 3
          const name = nameAt(tokens, j)
          if (name) {
            if (normalized === 'RELATION') relationNameOffsets.add(tokens[j].start)
            const creation = {
              KIND: normalized,
              NAME: name.name,
              OFFSET: token.start,
              BODY_DECLARATION: body,
              COLUMN_NAMES: [],
            }
            creations.push(creation)
            if (name.parts.length === 2) add('SCHEMA', name.parts[0], token, 'CREATE_IN_SCHEMA')
            if (kind === 'TABLE' && tokens[name.end]?.value === '(') {
              const end = close(tokens, name.end)
              for (const group of argsOf(tokens, name.end + 1, end)) {
                const column = nameAt(group, 0)
                if (
                  !column ||
                  [
                    'constraint',
                    'primary',
                    'foreign',
                    'unique',
                    'check',
                    'exclude',
                    'like',
                  ].includes(column.name)
                )
                  continue
                creation.COLUMN_NAMES.push(column.name)
                const type = nameAt(group, column.end)
                if (type && !types.has(type.name))
                  add('TYPE', type.name, group[column.end], 'COLUMN_DECLARED_TYPE', {
                    COLUMN: column.name,
                    RELATION: name.name,
                  })
              }
            }
            if (kind === 'FUNCTION' || kind === 'PROCEDURE') {
              if (tokens[name.end]?.value === '(') {
                for (const group of argsOf(tokens, name.end + 1, close(tokens, name.end))) {
                  const candidates = group.filter((part) =>
                    ['word', 'identifier'].includes(part.kind),
                  )
                  const type = candidates[1] ?? candidates[0]
                  if (
                    type &&
                    !types.has(type.value.toLowerCase()) &&
                    !['in', 'out', 'inout', 'variadic'].includes(type.value.toLowerCase())
                  )
                    add('TYPE', type.value, type, 'FUNCTION_ARGUMENT_TYPE')
                }
              }
            }
          }
        }
      }
      if (is(token, 'REFERENCES')) {
        const target = nameAt(tokens, i + 1)
        if (target) {
          relationNameOffsets.add(tokens[i + 1].start)
          add('RELATION', target.name, token, 'FOREIGN_KEY_TARGET')
          if (tokens[target.end]?.value === '(')
            for (const group of argsOf(tokens, target.end + 1, close(tokens, target.end))) {
              const column = nameAt(group, 0)
              if (column)
                add(
                  'COLUMN',
                  `${target.name}.${column.name}`,
                  group[0],
                  'FOREIGN_KEY_TARGET_COLUMN',
                  { RELATION: target.name, COLUMN: column.name },
                )
            }
        }
      }
      if (
        is(token, 'ALTER') &&
        ['TABLE', 'VIEW', 'TYPE', 'SCHEMA', 'FUNCTION', 'ROLE', 'USER'].some((kind) =>
          is(tokens[i + 1], kind),
        )
      ) {
        const kind = {
          TABLE: 'RELATION',
          VIEW: 'RELATION',
          TYPE: 'TYPE',
          SCHEMA: 'SCHEMA',
          FUNCTION: 'FUNCTION',
          ROLE: 'ROLE',
          USER: 'ROLE',
        }[tokens[i + 1].value.toUpperCase()]
        let start = i + 2
        if (is(tokens[start], 'IF')) start += 2
        if (is(tokens[start], 'ONLY')) start++
        const target = nameAt(tokens, start)
        if (target) {
          add(kind, target.name, token, 'ALTER_TARGET')
          if (
            kind === 'RELATION' &&
            is(tokens[target.end], 'ALTER') &&
            is(tokens[target.end + 1], 'COLUMN')
          ) {
            const col = nameAt(tokens, target.end + 2)
            if (col)
              add(
                'COLUMN',
                `${target.name}.${col.name}`,
                tokens[target.end + 2],
                'ALTER_EXISTING_COLUMN',
                { RELATION: target.name, COLUMN: col.name },
              )
          }
          if (kind === 'RELATION' && is(tokens[target.end], 'ADD')) {
            let j = target.end + 1
            if (is(tokens[j], 'COLUMN')) j++
            if (is(tokens[j], 'IF')) j += 3
            const column = nameAt(tokens, j)
            if (
              column &&
              !['constraint', 'primary', 'foreign', 'unique', 'check'].includes(column.name)
            )
              creations.push({
                KIND: 'COLUMN',
                NAME: `${target.name}.${column.name}`,
                OFFSET: token.start,
                BODY_DECLARATION: body,
                RELATION: target.name,
                COLUMN: column.name,
                COLUMN_NAMES: [],
              })
          }
          if (is(tokens[target.end], 'OWNER') && is(tokens[target.end + 1], 'TO')) {
            const owner = nameAt(tokens, target.end + 2)
            if (owner) add('ROLE', owner.name, token, 'OBJECT_OWNER_ROLE')
          }
        }
      }
      if (
        (is(token, 'FROM') && !is(tokens[i - 1], 'DISTINCT') && !grantStatement) ||
        is(token, 'JOIN') ||
        (is(token, 'UPDATE') &&
          !grantStatement &&
          !['FOR', 'ON', 'OR', 'AFTER', 'BEFORE'].some((keyword) => is(tokens[i - 1], keyword))) ||
        (is(token, 'INTO') && is(tokens[i - 1], 'INSERT'))
      )
        relation(i + 1, token, 'QUERY_OR_DML_RELATION')
      if (is(token, 'ON')) {
        const previous = tokens.slice(Math.max(0, i - 12), i)
        if (
          previous.some((part) => is(part, 'POLICY') || is(part, 'INDEX') || is(part, 'TRIGGER'))
        ) {
          const target = relation(i + 1, token, 'POLICY_INDEX_TRIGGER_TARGET')
          if (target && previous.some((part) => is(part, 'INDEX'))) {
            let j = target.end
            if (is(tokens[j], 'USING')) j += 2
            if (tokens[j]?.value === '(')
              for (const group of argsOf(tokens, j + 1, close(tokens, j))) {
                const column = nameAt(group, 0)
                if (column && group.length === 1)
                  add('COLUMN', `${target.name}.${column.name}`, group[0], 'INDEX_TARGET_COLUMN', {
                    RELATION: target.name,
                    COLUMN: column.name,
                  })
                else if (column)
                  opaque.push({
                    OFFSET: group[0].start,
                    KIND: 'INDEX_EXPRESSION_BINDING',
                    REASON: 'INDEX_EXPRESSION_COLUMNS_AND_OPERATOR_CLASS_REQUIRE_SEMANTIC_BINDING',
                  })
              }
          }
        }
      }
      if (is(token, 'GRANT') || is(token, 'REVOKE')) {
        let end = i + 1
        while (end < tokens.length && tokens[end].value !== ';') end++
        const on = tokens.findIndex((part, index) => index > i && index < end && is(part, 'ON'))
        if (on >= 0) {
          let j = on + 1
          const objectKind = [
            'TABLE',
            'SEQUENCE',
            'SCHEMA',
            'FUNCTION',
            'PROCEDURE',
            'DATABASE',
          ].find((k) => is(tokens[j], k))
          if (objectKind) j++
          if (['ALL', 'TABLES', 'SEQUENCES', 'FUNCTIONS'].some((kind) => is(tokens[j], kind))) {
            opaque.push({
              OFFSET: token.start,
              KIND: 'GRANT_SCOPE',
              REASON: 'ALL_OBJECTS_IN_SCHEMA_EXECUTION_SET_REQUIRES_CANONICAL_CATALOG',
            })
          } else {
            while (j < end && !is(tokens[j], 'TO') && !is(tokens[j], 'FROM')) {
              const target = nameAt(tokens, j)
              if (!target) break
              add(
                objectKind === 'SCHEMA'
                  ? 'SCHEMA'
                  : objectKind === 'FUNCTION' || objectKind === 'PROCEDURE'
                    ? 'FUNCTION'
                    : objectKind === 'DATABASE'
                      ? 'DATABASE'
                      : 'RELATION',
                target.name,
                token,
                'GRANT_REVOKE_TARGET',
              )
              j = target.end
              if (tokens[j]?.value === '(') j = close(tokens, j) + 1
              if (tokens[j]?.value !== ',') break
              j++
            }
          }
        }
        const to = tokens.findIndex(
          (part, index) => index > i && index < end && (is(part, 'TO') || is(part, 'FROM')),
        )
        if (to >= 0) {
          let j = to + 1
          while (j < end) {
            const role = nameAt(tokens, j)
            if (!role) break
            add('ROLE', role.name, token, 'GRANT_REVOKE_GRANTEE')
            j = role.end
            if (tokens[j]?.value !== ',') break
            j++
          }
        }
      }
      if (token.value === '::') {
        const type = nameAt(tokens, i + 1)
        if (type && !types.has(type.name)) add('TYPE', type.name, token, 'CAST_TYPE')
      }
      if (is(token, 'RETURNS')) {
        const type = nameAt(tokens, i + 1)
        if (type && !types.has(type.name) && type.name !== 'table' && type.name !== 'setof')
          add('TYPE', type.name, token, 'FUNCTION_RETURN_TYPE')
      }
      if (is(token, 'EXECUTE') && !is(tokens[i - 1], 'GRANT') && !is(tokens[i - 1], 'REVOKE')) {
        if (is(tokens[i + 1], 'FUNCTION') || is(tokens[i + 1], 'PROCEDURE')) {
          const fn = nameAt(tokens, i + 2)
          if (fn) add('FUNCTION', fn.name, token, 'TRIGGER_EXECUTE_FUNCTION_TARGET')
        } else
          opaque.push({
            OFFSET: token.start,
            KIND: 'DYNAMIC_SQL',
            REASON:
              'EXECUTE_GENERATED_SQL_BINDING_AND_CONDITIONAL_EFFECTS_REQUIRE_CANONICAL_LINEAGE',
          })
      }
      const call = nameAt(tokens, i)
      if (
        call &&
        !relationNameOffsets.has(token.start) &&
        tokens[call.end]?.value === '(' &&
        (i === 0 || tokens[i - 1].value !== '.') &&
        !syntaxCalls.has(call.name.toLowerCase()) &&
        !types.has(call.name.toLowerCase()) &&
        !['btree', 'gin', 'gist', 'hash', 'brin', 'spgist'].includes(call.name.toLowerCase())
      ) {
        const prior = tokens.slice(Math.max(0, i - 4), i)
        const declaration = prior.some((part) =>
          [
            'CREATE',
            'TABLE',
            'INDEX',
            'POLICY',
            'FUNCTION',
            'PROCEDURE',
            'REFERENCES',
            'CONSTRAINT',
          ].some((k) => is(part, k)),
        )
        if (!declaration) {
          const fn = call.name.startsWith('pg_catalog.') ? call.name.slice(11) : call.name
          if (!builtinFunctions.has(fn))
            add('FUNCTION', call.name, token, 'FUNCTION_CALL_IDENTITY_OVERLOAD_NOT_EXECUTED')
          if (fn === 'uuid_generate_v4')
            add('EXTENSION', 'uuid-ossp', token, 'EXTENSION_OWNED_FUNCTION')
          if (['to_regclass', 'to_regtype'].includes(fn)) {
            const arg = tokens[call.end + 1]
            if (
              arg?.kind === 'string' &&
              /^(?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*$/.test(arg.value.replaceAll('"', '')) &&
              tokens[call.end + 2]?.value !== '||'
            )
              add(
                fn === 'to_regclass' ? 'RELATION' : 'TYPE',
                arg.value.replaceAll('"', ''),
                arg,
                'CATALOG_EXISTENCE_GUARD',
              )
          }
        }
      }
      if (
        token.kind === 'word' &&
        token.value.endsWith('_tables') &&
        tokens[i + 1]?.value === 'TEXT'
      ) {
        const array = tokens.findIndex(
          (part, index) => index > i && index < i + 8 && is(part, 'ARRAY'),
        )
        if (array >= 0 && tokens[array + 1]?.value === '[') {
          let j = array + 2
          while (j < tokens.length && tokens[j].value !== ']') {
            if (tokens[j].kind === 'string')
              add(
                'RELATION',
                tokens[j].value,
                tokens[j],
                'FINITE_TABLE_ARRAY_GUARD_OR_HELPER_INPUT',
              )
            j++
          }
        }
      }
    }
  }
  walk(lex(text))
  for (const requirement of [...requirements]) {
    if (
      ['RELATION', 'TYPE', 'FUNCTION'].includes(requirement.KIND) &&
      requirement.NAME.split('.').length === 2
    )
      requirements.push({
        KIND: 'SCHEMA',
        NAME: requirement.NAME.split('.')[0],
        OFFSET: requirement.OFFSET,
        REASON: 'QUALIFIED_OBJECT_NAMESPACE',
      })
  }
  return { requirements, creations, opaque }
}

const sourceRegister = new Map()
function source(file) {
  const existing = sourceRegister.get(file)
  if (existing) return existing
  const bytes = readFileSync(absolute(file))
  const result = { FILE: file, SHA256: hash(bytes), text: bytes.toString('utf8') }
  sourceRegister.set(file, result)
  return result
}
function evidence(file, offset = 0) {
  const item = source(file)
  return {
    FILE: file,
    LINE: 1 + item.text.slice(0, offset).split('\n').length - 1,
    FILE_SHA256: item.SHA256,
  }
}
function list(dir, predicate) {
  if (!existsSync(absolute(dir))) return []
  const result = []
  for (const entry of readdirSync(absolute(dir), { withFileTypes: true }).sort((x, y) =>
    x.name.localeCompare(y.name),
  )) {
    if (['node_modules', '.next', '__pycache__', '.venv', 'venv'].includes(entry.name)) continue
    const file = `${dir}/${entry.name}`
    if (entry.isDirectory()) result.push(...list(file, predicate))
    else if (entry.isFile() && predicate(file)) result.push(file)
  }
  return result
}
const governance = 'docs/categories/platform-and-operations/architecture/orm-governance/'
const authorityFiles = [
  'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs',
  'tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs',
  'tooling/scripts/run-union-eyes-drizzle-migrate.mjs',
  'tooling/scripts/restore-union-eyes-snapshot.mjs',
  'tooling/scripts/lib/union-eyes-scoped-migrations.mjs',
  'tooling/scripts/lib/union-eyes-platform-migrations.mjs',
  'tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs',
  'apps/union-eyes/drizzle.config.ts',
  'apps/union-eyes/services/financial-service/drizzle.config.ts',
  'apps/union-eyes/services/financial-service/drizzle/schema.ts',
  'apps/union-eyes/package.json',
  'apps/union-eyes/db/migrations/.lineage-frozen',
  'apps/union-eyes/db/migrations/LINEAGE-FROZEN.md',
  'apps/union-eyes/backend/config/settings.py',
  'apps/union-eyes/backend/docker-compose.yml',
  'packages/db/package.json',
  'packages/db/drizzle.config.ts',
  'docker-compose.platform-authz-acceptance.yml',
  ...[
    'orm-authority-governance',
    'environment-bootstrap-strategy',
    'fresh-database-bootstrap-reference-implementation',
    'historical-migration-lineage-governance',
  ].map((name) => `${governance}${name}.md`),
]
for (const file of authorityFiles) source(file)
const bootstrapAuthorities = [
  {
    key: 'UE_BOOTSTRAP',
    COMMAND_OR_SCRIPT: 'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs',
    DATABASE_SCOPE: 'union-eyes',
    AUTHORITY_CLASS: 'CANONICAL_ACTIVE_BOOTSTRAP',
    INPUT_MIGRATION_SET: [
      'apps/union-eyes/db/migrations-cache/meta/_journal.json',
      'apps/union-eyes/db/migrations-platform/meta/_journal.json',
    ],
    OBJECTS_ESTABLISHED: [
      'PostgreSQL extensions',
      'active scoped/platform DDL',
      'bootstrap attestation',
    ],
    ORDERING_GUARANTEES:
      'extensions -> optional snapshot/baseline -> scoped journal -> platform journal; never default historical replay',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON: 'Loads ambient DATABASE_URL/.env; not itself an isolated container lifecycle.',
    CANONICALITY_EVIDENCE: [
      evidence('tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'),
      evidence(`${governance}fresh-database-bootstrap-reference-implementation.md`),
    ],
    LIMITATIONS: [
      'Snapshot identity is operator-selected, not a repository-pinned schema input.',
      'Snapshot path baselines all scoped hashes instead of executing all 23 frozen files.',
      'QA baseline source is referenced outside this mission source allowlist; not promoted to canonical prerequisite.',
      'Scoped-before-platform ordering cannot assume later platform relations exist for 0014.',
    ],
  },
  {
    key: 'DJANGO',
    COMMAND_OR_SCRIPT: 'apps/union-eyes/backend/manage.py migrate --noinput',
    DATABASE_SCOPE: 'union-eyes',
    AUTHORITY_CLASS: 'ACTIVE_BACKEND_PREREQUISITE',
    INPUT_MIGRATION_SET: ['apps/union-eyes/backend/<installed-app>/migrations/'],
    OBJECTS_ESTABLISHED: ['Django operational model tables including public.organizations'],
    ORDERING_GUARANTEES:
      'Django dependency ordering; governance places local Django before db:bootstrap.',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON:
      'PG* environment binding; no proved isolated adapter or Drizzle DATABASE_URL equivalence.',
    CANONICALITY_EVIDENCE: [
      evidence(`${governance}orm-authority-governance.md`),
      evidence(`${governance}environment-bootstrap-strategy.md`),
      evidence('apps/union-eyes/backend/config/settings.py'),
    ],
    LIMITATIONS: [
      'Canonical owner/creation source established; complete physical binding and transitive prerequisite/type/column compatibility remain source ceilings.',
    ],
  },
  {
    key: 'SNAPSHOT',
    COMMAND_OR_SCRIPT: 'tooling/scripts/restore-union-eyes-snapshot.mjs',
    DATABASE_SCOPE: 'union-eyes',
    AUTHORITY_CLASS: 'CANONICAL_ACTIVE_BOOTSTRAP',
    INPUT_MIGRATION_SET: ['Operator-provided UE_DB_RESTORE_SNAPSHOT_URL'],
    OBJECTS_ESTABLISHED: [
      'Unknown until an accepted content-digested canonical snapshot is supplied',
    ],
    ORDERING_GUARANTEES: 'Restore precedes scoped application/baselining',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON: 'External download/target binding; not executed.',
    CANONICALITY_EVIDENCE: [evidence('tooling/scripts/restore-union-eyes-snapshot.mjs')],
    LIMITATIONS: [
      'Restore is implemented in source despite older reference documentation saying interface-only.',
      'No pinned local snapshot bytes, migration level or required-column contract established.',
    ],
  },
  {
    key: 'CLEANROOM',
    COMMAND_OR_SCRIPT: 'tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs',
    DATABASE_SCOPE: 'union-eyes',
    AUTHORITY_CLASS: 'SOURCE_CEILING_AUTHORITY',
    INPUT_MIGRATION_SET: [
      'External reports/union-eyes/runtime-schema-lineage/SCHEMA_LINEAGE_MANIFEST.json',
      'Django',
      'historical/platform/scoped SQL',
    ],
    OBJECTS_ESTABLISHED: ['Not accepted as faithful prerequisite source'],
    ORDERING_GUARANTEES:
      'Django -> generated foundation shims -> reordered historical creation -> platform -> scoped',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON:
      'Defaults to named existing container/database; reset and tolerant SQL execution, not owned isolated lifecycle.',
    CANONICALITY_EVIDENCE: [
      evidence('tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs'),
    ],
    LIMITATIONS: [
      'Generates enum/unique-key shims, strips transaction boundaries, suppresses missing relation/type/column errors.',
      'Changes SQL execution and revives historical creation; disqualified for this mission, not run.',
    ],
  },
  {
    key: 'HISTORICAL_RUNNER',
    COMMAND_OR_SCRIPT: 'tooling/scripts/run-union-eyes-drizzle-migrate.mjs',
    DATABASE_SCOPE: 'union-eyes',
    AUTHORITY_CLASS: 'HISTORICAL_FROZEN_LINEAGE_ONLY',
    INPUT_MIGRATION_SET: ['apps/union-eyes/db/migrations/meta/_journal.json'],
    OBJECTS_ESTABLISHED: ['Historical tables, not current prerequisite authority'],
    ORDERING_GUARANTEES: 'Historical journal with fault-tolerant SQL rewrites',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON: 'Ambient target and transformed historical SQL.',
    CANONICALITY_EVIDENCE: [
      evidence('tooling/scripts/run-union-eyes-drizzle-migrate.mjs'),
      evidence('apps/union-eyes/db/migrations/LINEAGE-FROZEN.md'),
    ],
    LIMITATIONS: [
      'Presence of a legacy executable is not active replay authority; governed freeze controls.',
    ],
  },
  {
    key: 'SHARED_PLATFORM',
    COMMAND_OR_SCRIPT: 'pnpm --filter @nzila/db db:migrate',
    DATABASE_SCOPE: 'shared-platform',
    AUTHORITY_CLASS: 'CANONICAL_SHARED_PLATFORM_PREREQUISITE',
    INPUT_MIGRATION_SET: ['packages/db/drizzle/'],
    OBJECTS_ESTABLISHED: ['Shared platform migrations only; UE physical scope binding not proven'],
    ORDERING_GUARANTEES: 'Drizzle package config; no source-backed ordering before UE 0006',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON: 'Ambient DATABASE_URL; not executed or merged with UE scope.',
    CANONICALITY_EVIDENCE: [
      evidence('packages/db/package.json'),
      evidence('packages/db/drizzle.config.ts'),
    ],
    LIMITATIONS: [
      'Shared dependency names do not establish one physical database or canonical UE prerequisite sequence.',
    ],
  },
  {
    key: 'ROLE_COMMAND',
    COMMAND_OR_SCRIPT: JSON.parse(source('apps/union-eyes/package.json').text).scripts[
      'db:provision-roles'
    ],
    DATABASE_SCOPE: 'union-eyes',
    AUTHORITY_CLASS: 'DOCUMENTATION_ONLY',
    INPUT_MIGRATION_SET: [
      'Command declaration only; implementation outside bounded source allowlist',
    ],
    OBJECTS_ESTABLISHED: [
      'Runtime/system role creation not established by a package command alone',
    ],
    ORDERING_GUARANTEES: 'No accepted prerequisite ordering before frozen policy/grant consumers',
    DESTRUCTIVE: 'YES',
    DISPOSABLE_ENVIRONMENT_SAFE: 'NO',
    SAFETY_REASON: 'No owned isolated target/role bootstrap contract proven; command not executed.',
    CANONICALITY_EVIDENCE: [evidence('apps/union-eyes/package.json')],
    LIMITATIONS: [
      'Role attributes and privilege/ownership compatibility remain prerequisite authority ceilings.',
    ],
  },
].map(({ key, ...record }) => ({ BOOTSTRAP_ID: id('BOOTSTRAP', key), ...record }))

const candidates = []
function candidate(file, kind, name, offset, sourceKind, authorityClass, extra = {}) {
  const scope = file.startsWith('packages/db/')
    ? 'shared-platform'
    : file.includes('/financial-service/')
      ? 'financial-service'
      : 'union-eyes'
  candidates.push({
    CANDIDATE_ID: id('CANDIDATE', `${file}|${kind}|${name}|${offset}`),
    SOURCE_FILE: file,
    SOURCE_KIND: sourceKind,
    DATABASE_SCOPE: scope,
    PREREQUISITE_KIND: kind,
    PHYSICAL_OBJECT: ['SCHEMA', 'ROLE', 'EXTENSION'].includes(kind)
      ? name
      : name.includes('.')
        ? name
        : `public.${name}`,
    SCHEMA: ['SCHEMA', 'ROLE', 'EXTENSION'].includes(kind)
      ? null
      : name.includes('.')
        ? name.split('.')[0]
        : 'public',
    CREATES_OBJECT: sourceKind === 'DRIZZLE_SCHEMA' ? 'NO' : 'YES',
    EXECUTION_PATH_ESTABLISHED:
      authorityClass === 'ACTIVE_BACKEND_PREREQUISITE'
        ? 'YES'
        : authorityClass === 'CANONICAL_ACTIVE_PREDECESSOR_MIGRATION'
          ? 'YES'
          : 'SOURCE_CEILING',
    AUTHORITY_CLASS: authorityClass,
    SOURCE_EVIDENCE: evidence(file, offset),
    PRECEDENCE_RELATION_TO_0006:
      authorityClass === 'ACTIVE_BACKEND_PREREQUISITE'
        ? 'Governance requires local Django materialization before scoped bootstrap; physical binding not proven'
        : authorityClass === 'HISTORICAL_FROZEN_LINEAGE_ONLY'
          ? 'Historical only; not executable predecessor authority'
          : 'No accepted prerequisite precedence established',
    ...extra,
  })
}
const manifestFiles = new Set(manifest.map((entry) => entry.FILE))
const sqlSources = unique([
  ...list('apps/union-eyes/db', (file) => file.endsWith('.sql') && !file.includes('__tests__')),
  ...list('packages/db', (file) => file.endsWith('.sql')),
  ...manifest.map((entry) => entry.FILE),
])
const parsed = new Map()
for (const file of sqlSources) {
  const result = sqlDependencies(source(file).text)
  parsed.set(file, result)
  const authority =
    file.includes('/migrations/') || file.includes('/migrations-audit/')
      ? 'HISTORICAL_FROZEN_LINEAGE_ONLY'
      : manifestFiles.has(file)
        ? 'CANONICAL_ACTIVE_PREDECESSOR_MIGRATION'
        : file.startsWith('packages/db/drizzle/')
          ? 'CANONICAL_SHARED_PLATFORM_PREREQUISITE'
          : 'SOURCE_CEILING_AUTHORITY'
  for (const creation of result.creations)
    candidate(
      file,
      creation.KIND,
      creation.NAME,
      creation.OFFSET,
      file.startsWith('packages/db/') ? 'PLATFORM_MIGRATION' : 'SQL_MIGRATION',
      authority,
      {
        COLUMN_NAMES: creation.COLUMN_NAMES,
        CONDITIONAL_OR_FUNCTION_BODY_CREATION: creation.BODY_DECLARATION,
      },
    )
}
const djangoFiles = list('apps/union-eyes/backend', (file) => /\/migrations\/[^/]+\.py$/.test(file))
const backendMigrationDependencyRegistry = []
for (const file of djangoFiles) {
  const text = source(file).text
  if (path.basename(file) !== '__init__.py') {
    const block = text.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)
    const literalDependencies = [
      ...(block?.[1] ?? '').matchAll(/\(\s*["'](\w+)["']\s*,\s*["']([\w]+)["']\s*,?\s*\)/g),
    ].map((match) => {
      const target = `apps/union-eyes/backend/${match[1]}/migrations/${match[2]}.py`
      return {
        APP: match[1],
        MIGRATION: match[2],
        EXPECTED_SOURCE: target,
        SOURCE_PRESENT: djangoFiles.includes(target) ? 'YES' : 'NO_OR_FRAMEWORK_EXTERNAL',
      }
    })
    backendMigrationDependencyRegistry.push({
      BACKEND_MIGRATION_ID: id('BACKEND-MIGRATION', file),
      SOURCE_FILE: file,
      DATABASE_SCOPE: 'union-eyes',
      SOURCE_EVIDENCE: evidence(file),
      DECLARED_LITERAL_DEPENDENCIES: literalDependencies,
      DYNAMIC_DEPENDENCY_DECLARATION:
        block && /swappable_dependency|settings\./.test(block[1])
          ? 'SOURCE_CEILING'
          : 'NONE_DETECTED',
      NON_MODEL_OPERATION_BINDING: /migrations\.(RunSQL|RunPython|SeparateDatabaseAndState)/.test(
        text,
      )
        ? 'SOURCE_CEILING_UNEXECUTED_RAW_OR_STATE_OPERATIONS'
        : 'MODEL_OPERATIONS_ONLY_DETECTED',
      PHYSICAL_TARGET_BINDING: 'SOURCE_CEILING_PG_ENV_NOT_ASSUMED_EQUAL_TO_DRIZZLE_TARGET',
      COMPLETE_DJANGO_EXECUTION_PLAN_ESTABLISHED: 'NO',
    })
  }
  const starts = [...text.matchAll(/migrations\.CreateModel\s*\(/g)]
  for (const match of starts) {
    let i = match.index + match[0].length,
      depth = 1,
      quote = null
    while (i < text.length && depth) {
      if (quote) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === quote) quote = null
      } else if (text[i] === "'" || text[i] === '"') quote = text[i]
      else if (text[i] === '(') depth++
      else if (text[i] === ')') depth--
      i++
    }
    assert.equal(depth, 0, `Unbalanced Django model operation ${file}`)
    const block = text.slice(match.index, i)
    const table = block.match(/["']db_table["']\s*:\s*["']([^"']+)["']/)?.[1]
    if (table) {
      candidate(
        file,
        'RELATION',
        table,
        match.index,
        'DJANGO_MIGRATION',
        'ACTIVE_BACKEND_PREREQUISITE',
        {
          CREATES_OBJECT: /["']managed["']\s*:\s*False/.test(block) ? 'NO' : 'YES',
          DJANGO_MIGRATION_PREREQUISITE: 'YES',
          DJANGO_MODEL: block.match(/name\s*=\s*["']([^"']+)["']/)?.[1] ?? null,
          COLUMN_NAMES: unique(
            [...block.matchAll(/\(\s*["'](\w+)["']\s*,\s*models\./g)].map((row) => row[1]),
          ),
          CURRENT_EXECUTION_PATH:
            'Governance local manage.py migrate; installed app membership and complete backend dependency plan require binding/validation',
          ORDER_RELATIVE_TO_DRIZZLE_MIGRATIONS:
            'Declared local Django-first; unexecuted, no same-physical-database assumption',
        },
      )
    }
  }
}
const tsSources = unique([
  ...list('apps/union-eyes/db', (file) => file.endsWith('.ts') && !file.includes('__tests__')),
  ...list('packages/db/src/schema', (file) => file.endsWith('.ts')),
  ...list(
    'apps/union-eyes/services/financial-service/src/db',
    (file) => file.endsWith('.ts') && file.includes('schema'),
  ),
  'apps/union-eyes/services/financial-service/drizzle/schema.ts',
])
for (const file of tsSources) {
  const text = source(file).text
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const schemaBindings = new Map()
  function findSchemas(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(tree) === 'pgSchema' &&
      ts.isStringLiteralLike(node.initializer.arguments[0])
    )
      schemaBindings.set(node.name.text, node.initializer.arguments[0].text)
    ts.forEachChild(node, findSchemas)
  }
  findSchemas(tree)
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const callee = node.expression.getText(tree)
      const table = callee === 'pgTable' || callee.endsWith('.table')
      if (table || callee === 'pgEnum') {
        const namespace = callee.endsWith('.table')
          ? schemaBindings.get(callee.slice(0, -6))
          : 'public'
        const columns = []
        const fields = node.arguments[1]
        if (table && fields && ts.isObjectLiteralExpression(fields)) {
          for (const property of fields.properties) {
            if (!ts.isPropertyAssignment(property)) continue
            let expression = property.initializer
            while (
              ts.isCallExpression(expression) &&
              ts.isPropertyAccessExpression(expression.expression)
            )
              expression = expression.expression.expression
            if (ts.isCallExpression(expression) && ts.isStringLiteralLike(expression.arguments[0]))
              columns.push(expression.arguments[0].text)
          }
        }
        candidate(
          file,
          table ? 'RELATION' : 'TYPE',
          `${namespace ?? 'UNRESOLVED_SCHEMA_RECEIVER'}.${node.arguments[0].text}`,
          node.getStart(tree),
          'DRIZZLE_SCHEMA',
          'SCHEMA_DECLARATION_WITHOUT_EXECUTION_PATH',
          {
            COLUMN_NAMES: unique(columns),
            SCHEMA_DECLARATION_EXISTS: 'YES',
            CANONICAL_CREATION_PATH_ESTABLISHED: 'NO',
            DECLARED_SCHEMA_BINDING: namespace ?? 'SOURCE_CEILING_UNRESOLVED_NAMESPACE_RECEIVER',
          },
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
}
const fixtureCandidateFile =
  'apps/union-eyes/db/__tests__/automation-rules-ownership-migration-postgres.test.ts'
for (const match of source(fixtureCandidateFile).text.matchAll(
  /CREATE TABLE public\.organizations\s*\(/g,
))
  candidate(
    fixtureCandidateFile,
    'RELATION',
    'public.organizations',
    match.index,
    'OTHER_EXPLICIT',
    'SOURCE_CEILING_AUTHORITY',
    {
      EXECUTION_PATH_ESTABLISHED: 'NO',
      COLUMN_NAMES: ['id'],
      PURPOSE: 'Test-only reduced fixture; prohibited as canonical substitute DDL',
    },
  )

for (const extension of ['uuid-ossp', 'pgcrypto', 'pg_trgm', 'btree_gin', 'vector']) {
  const file = 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs'
  assert.ok(source(file).text.includes(`'${extension}'`))
  candidate(
    file,
    'EXTENSION',
    extension,
    source(file).text.indexOf(`'${extension}'`),
    'BOOTSTRAP_SCRIPT',
    'CANONICAL_ACTIVE_BOOTSTRAP',
    {
      PHYSICAL_OBJECT: extension,
      SCHEMA: null,
      EXECUTION_PATH_ESTABLISHED: 'YES',
      PRECEDENCE_RELATION_TO_0006: 'ensureExtensions called before scoped application',
      OPTIONAL_EXTENSION: extension === 'vector',
    },
  )
}

const prerequisiteMap = new Map()
const migrationDependencyGraph = []
const creationTimeline = new Map()
function addPrerequisite(node, requirement) {
  const key = identity(node.DATABASE_SCOPE, requirement.KIND, requirement.NAME)
  let record = prerequisiteMap.get(key)
  if (!record) {
    record = {
      PREREQUISITE_ID: id('PREREQUISITE', key),
      IDENTITY: key,
      DATABASE_SCOPE: node.DATABASE_SCOPE,
      KIND: requirement.KIND,
      PHYSICAL_NAME: key.split('::').at(-1),
      FIRST_CONSUMING_MIGRATION: node.FILE,
      CONSUMERS: [],
      CANDIDATE_SOURCE_IDS: [],
      AUTHORITY_CLASS: 'SOURCE_CEILING_AUTHORITY',
    }
    prerequisiteMap.set(key, record)
  }
  const at = creationTimeline.get(key) ?? []
  const prior = at.filter((event) => event.FILE !== node.FILE || event.OFFSET < requirement.OFFSET)
  const core =
    (requirement.KIND === 'SCHEMA' &&
      ['public', 'pg_catalog', 'information_schema'].includes(requirement.NAME)) ||
    (requirement.KIND === 'RELATION' &&
      /^(pg_catalog|information_schema)\./.test(record.PHYSICAL_NAME)) ||
    (requirement.KIND === 'ROLE' &&
      ['public', 'current_user', 'session_user'].includes(requirement.NAME))
  const resolution = core
    ? 'POSTGRES_CORE_PREREQUISITE'
    : prior.length
      ? 'SATISFIED_BY_EARLIER_FROZEN_DECLARATION'
      : 'REQUIRES_CANONICAL_BOOTSTRAP_OR_SOURCE_CEILING'
  record.CONSUMERS.push({
    MIGRATION_NODE_ID: node.MIGRATION_NODE_ID,
    MIGRATION_FILE: node.FILE,
    REASON: requirement.REASON,
    SOURCE_EVIDENCE: evidence(node.FILE, requirement.OFFSET),
    RESOLUTION: resolution,
    EARLIER_FROZEN_CREATION_EVIDENCE: prior.map((event) => evidence(event.FILE, event.OFFSET)),
    ...(requirement.EXPANSION_REFERENCE
      ? { FROZEN_EXPANSION_REFERENCE: requirement.EXPANSION_REFERENCE }
      : {}),
  })
  return { PREREQUISITE_ID: record.PREREQUISITE_ID, RESOLUTION: resolution }
}
for (const node of manifest) {
  const result = parsed.get(node.FILE)
  const requirements = [...result.requirements]
  const emptySql = lex(source(node.FILE).text).length === 0
  for (const extension of node.DATABASE_SCOPE === 'union-eyes'
    ? ['uuid-ossp', 'pgcrypto', 'pg_trgm', 'btree_gin', 'vector']
    : [])
    requirements.push({
      KIND: 'EXTENSION',
      NAME: extension,
      OFFSET: 0,
      REASON:
        extension === 'vector'
          ? 'CANONICAL_BOOTSTRAP_OPTIONAL_EXTENSION_AVAILABILITY'
          : 'CANONICAL_BOOTSTRAP_REQUIRED_EXTENSION',
    })
  requirements.push({
    KIND: 'SOURCE_BINDING',
    NAME: `${node.FILE}:SEMANTIC_DEPENDENCY_CLOSURE`,
    OFFSET: 0,
    REASON: emptySql
      ? 'COMMENT_ONLY_INTROSPECTION_FILE_DOES_NOT_MATERIALIZE_FROZEN_DATABASE_SCOPE'
      : 'COMPLETE_SQL_COLUMN_ALIAS_OVERLOAD_AND_CONDITIONAL_EXECUTION_BINDINGS_NOT_PROVEN_BY_LEXICAL_INVENTORY',
  })
  // Reuse already accepted literal helper expansions; no predicate correctness re-analysis.
  for (const policy of a.rlsPolicies.filter((record) => record.DECLARATION_FILE === node.FILE)) {
    requirements.push({
      KIND: 'RELATION',
      NAME: `${policy.SCHEMA}.${policy.OBJECT_NAME}`,
      OFFSET: source(node.FILE)
        .text.split('\n')
        .slice(0, policy.DECLARATION_RANGE[0] - 1)
        .join('\n').length,
      REASON: 'FROZEN_POLICY_HELPER_EXPANDED_TARGET',
      EXPANSION_REFERENCE: policy.POLICY_ID,
    })
    const args = policy.SOURCE_EVIDENCE.EXPANSION_INPUTS ?? {}
    for (const [key, value] of Object.entries(args)) {
      if (typeof value !== 'string') continue
      const offset = requirements.at(-1).OFFSET
      if (/parent_table/.test(key))
        requirements.push({
          KIND: 'RELATION',
          NAME: value,
          OFFSET: offset,
          REASON: 'FROZEN_HELPER_PARENT_TABLE_ARGUMENT',
          EXPANSION_REFERENCE: policy.POLICY_ID,
        })
      else if (/column/.test(key))
        requirements.push({
          KIND: 'COLUMN',
          NAME: `${
            key.startsWith('p_parent_') && !key.includes('fk_column') && args.p_parent_table
              ? `${policy.SCHEMA}.${args.p_parent_table}`
              : `${policy.SCHEMA}.${policy.OBJECT_NAME}`
          }.${value}`,
          OFFSET: offset,
          REASON: 'FROZEN_HELPER_COLUMN_ARGUMENT',
          EXPANSION_REFERENCE: policy.POLICY_ID,
        })
    }
  }
  for (const opaque of result.opaque) {
    requirements.push({
      KIND: 'SOURCE_BINDING',
      NAME: `${node.FILE}:${opaque.OFFSET}:${opaque.KIND}`,
      OFFSET: opaque.OFFSET,
      REASON: opaque.REASON,
    })
  }
  const events = [
    ...result.creations.map((creation) => ({
      type: 'creation',
      offset: creation.OFFSET,
      creation,
    })),
    ...requirements.map((requirement) => ({
      type: 'requirement',
      offset: requirement.OFFSET,
      requirement,
    })),
  ].sort((x, y) => x.offset - y.offset || (x.type === 'requirement' ? -1 : 1))
  const edges = []
  for (const event of events) {
    if (event.type === 'creation') {
      const creation = event.creation
      const key = identity(node.DATABASE_SCOPE, creation.KIND, creation.NAME)
      const prior = creationTimeline.get(key) ?? []
      // Body declarations are conditional and cannot establish unconditional runtime presence.
      if (!creation.BODY_DECLARATION)
        creationTimeline.set(key, [...prior, { ...creation, FILE: node.FILE }])
      if (!creation.BODY_DECLARATION && creation.KIND === 'RELATION')
        for (const column of creation.COLUMN_NAMES) {
          const key = identity(
            node.DATABASE_SCOPE,
            'COLUMN',
            `${creation.NAME.includes('.') ? creation.NAME : `public.${creation.NAME}`}.${column}`,
          )
          creationTimeline.set(key, [{ ...creation, FILE: node.FILE }])
        }
    } else edges.push(addPrerequisite(node, event.requirement))
  }
  const all = unique(edges.map((edge) => edge.PREREQUISITE_ID))
  migrationDependencyGraph.push({
    MIGRATION_NODE_ID: node.MIGRATION_NODE_ID,
    MIGRATION_FILE: node.FILE,
    DATABASE_SCOPE: node.DATABASE_SCOPE,
    FROZEN_POSITION: node.FROZEN_POSITION,
    EXECUTABLE_SQL_PRESENT: emptySql ? 'NO' : 'YES',
    COMMENT_ONLY_SCOPE_MATERIALIZATION_CEILING: emptySql
      ? {
          EXPECTED_OBJECT_IDS: a.relationalSecurityObjects
            .filter((object) => object.DATABASE_SCOPE === node.DATABASE_SCOPE)
            .map((object) => object.OBJECT_ID),
          CREATION_SQL_UNCOMMENTED_OR_GENERATED: 'NO',
          EXPLANATION:
            'Executing this intact file succeeds as a no-op; it does not establish its declared scope schema.',
        }
      : null,
    REQUIRED_PREREQUISITES: all,
    PREREQUISITES_CREATED_BY_EARLIER_FROZEN_MIGRATIONS: unique(
      edges
        .filter((edge) => edge.RESOLUTION === 'SATISFIED_BY_EARLIER_FROZEN_DECLARATION')
        .map((edge) => edge.PREREQUISITE_ID),
    ),
    POSTGRES_CORE_PREREQUISITES: unique(
      edges
        .filter((edge) => edge.RESOLUTION === 'POSTGRES_CORE_PREREQUISITE')
        .map((edge) => edge.PREREQUISITE_ID),
    ),
    PREREQUISITES_CREATED_BY_CANONICAL_BOOTSTRAP: [],
    UNRESOLVED_PREREQUISITES: unique(
      edges
        .filter((edge) => edge.RESOLUTION === 'REQUIRES_CANONICAL_BOOTSTRAP_OR_SOURCE_CEILING')
        .map((edge) => edge.PREREQUISITE_ID),
    ),
    CONDITIONAL_AND_DYNAMIC_DEPENDENCY_COVERAGE: result.opaque.map((record) => ({
      KIND: record.KIND,
      SOURCE_EVIDENCE: evidence(node.FILE, record.OFFSET),
      RESULT: 'EXPLICIT_SOURCE_BINDING_CEILING',
    })),
    EXTRACTION_LIMITATION:
      'Static reference inventory, not PostgreSQL execution planning. Opaque dynamic SQL, aliases/overloads, and transitive backend/bootstrap binding are explicit ceilings; no runtime readiness inferred.',
  })
}
const authorityConflicts = []
const sourceCeilings = []
for (const record of prerequisiteMap.values()) {
  const physical = record.PHYSICAL_NAME
  const matches = candidates.filter((candidate) => {
    if (candidate.DATABASE_SCOPE !== record.DATABASE_SCOPE) return false
    if (record.KIND === 'COLUMN') {
      const parts = physical.split('.')
      const column = parts.pop()
      return (
        candidate.PREREQUISITE_KIND === 'RELATION' &&
        candidate.PHYSICAL_OBJECT === parts.join('.') &&
        candidate.COLUMN_NAMES?.includes(column)
      )
    }
    return candidate.PREREQUISITE_KIND === record.KIND && candidate.PHYSICAL_OBJECT === physical
  })
  record.CANDIDATE_SOURCE_IDS = matches.map((candidate) => candidate.CANDIDATE_ID)
  record.BACKEND_MIGRATION_DEPENDENCY_IDS = unique(
    matches
      .filter((candidate) => candidate.SOURCE_KIND === 'DJANGO_MIGRATION')
      .map((candidate) => id('BACKEND-MIGRATION', candidate.SOURCE_FILE)),
  )
  const unresolved = record.CONSUMERS.filter(
    (consumer) => consumer.RESOLUTION === 'REQUIRES_CANONICAL_BOOTSTRAP_OR_SOURCE_CEILING',
  )
  record.BOOTSTRAP_REQUIRED_BEFORE_CONSUMERS = unique(
    unresolved.map((consumer) => consumer.MIGRATION_FILE),
  )
  record.SATISFIED_ONLY_WITHIN_FROZEN_SEQUENCE = unresolved.length === 0
  const active = matches.filter(
    (candidate) =>
      candidate.CREATES_OBJECT === 'YES' &&
      ['ACTIVE_BACKEND_PREREQUISITE', 'CANONICAL_ACTIVE_PREDECESSOR_MIGRATION'].includes(
        candidate.AUTHORITY_CLASS,
      ),
  )
  const django = active.filter(
    (candidate) => candidate.AUTHORITY_CLASS === 'ACTIVE_BACKEND_PREREQUISITE',
  )
  const operational = active.filter(
    (candidate) => candidate.AUTHORITY_CLASS === 'CANONICAL_ACTIVE_PREDECESSOR_MIGRATION',
  )
  if (unresolved.length && django.length && operational.length) {
    const conflict = {
      CONFLICT_ID: id('CONFLICT', record.IDENTITY),
      CLASS: 'DATABASE_BOOTSTRAP_AUTHORITY_CONFLICT',
      PREREQUISITE_ID: record.PREREQUISITE_ID,
      DATABASE_SCOPE: record.DATABASE_SCOPE,
      COMPETING_SOURCE_IDS: active.map((candidate) => candidate.CANDIDATE_ID),
      LIMITATION:
        'Two active creation surfaces for this scoped physical identity; no accepted precedence/compatibility selected by this analysis.',
    }
    authorityConflicts.push(conflict)
    record.AUTHORITY_CLASS = 'CONFLICTING_ACTIVE_AUTHORITY'
    record.AUTHORITY_CONFLICT_ID = conflict.CONFLICT_ID
  } else if (django.length) record.AUTHORITY_CLASS = 'ACTIVE_BACKEND_PREREQUISITE'
  else if (operational.length) record.AUTHORITY_CLASS = 'CANONICAL_ACTIVE_PREDECESSOR_MIGRATION'
  else if (matches.length) record.AUTHORITY_CLASS = matches[0].AUTHORITY_CLASS
  record.CANONICAL_CREATION_PATH_ESTABLISHED = unresolved.length
    ? 'SOURCE_CEILING'
    : 'FROZEN_DECLARATION_OR_POSTGRES_CORE'
  if (unresolved.length) {
    const ceiling = {
      SOURCE_CEILING_ID: id('CEILING', record.IDENTITY),
      PREREQUISITE_ID: record.PREREQUISITE_ID,
      CLASS:
        record.KIND === 'SOURCE_BINDING'
          ? 'BOOTSTRAP_DEPENDENCY_BINDING_SOURCE_CEILING'
          : 'MISSING_CANONICAL_BOOTSTRAP_PREREQUISITE',
      FIRST_CONSUMING_MIGRATION: record.FIRST_CONSUMING_MIGRATION,
      DATABASE_SCOPE: record.DATABASE_SCOPE,
      CANDIDATE_SOURCES: record.CANDIDATE_SOURCE_IDS,
      WHY_NONE_IS_CANONICAL_SEQUENCE:
        record.KIND === 'SOURCE_BINDING'
          ? record.CONSUMERS.some(
              (consumer) =>
                consumer.REASON ===
                'COMMENT_ONLY_INTROSPECTION_FILE_DOES_NOT_MATERIALIZE_FROZEN_DATABASE_SCOPE',
            )
            ? 'The frozen financial migration is entirely commented introspection SQL. Executing it unchanged is a no-op; uncommenting, generating DDL or assuming a UE/shared physical bootstrap would invent authority.'
            : 'Generated/conditional SQL dependency identities and execution set cannot be closed by a literal declaration inventory. Frozen expansions retained, residual generator authority remains explicit.'
          : django.length
            ? 'Django is canonical creation owner, but same-database PG*/DATABASE_URL binding, its transitive migration dependencies and exact columns/types before frozen SQL are not established.'
            : operational.length
              ? 'Creation occurs conditionally or later in the frozen sequence; no canonical pre-migration materialization proven without reordering or duplicate creation.'
              : matches.some(
                    (candidate) => candidate.AUTHORITY_CLASS === 'CANONICAL_ACTIVE_BOOTSTRAP',
                  )
                ? 'Canonical extension installation source/order exists, but availability and the complete accepted isolated bootstrap execution contract remain unproven. Optional vector absence is not converted into a successful dependency.'
                : matches.length
                  ? 'Only declarations, historical sources, unbound shared sources or unproven bootstrap inputs exist; none establishes this prerequisite before its first consumer.'
                  : 'No exact creation candidate found in the bounded authority sources; no substitute DDL is authorized.',
      REQUIRED_EVIDENCE:
        'Accepted content-digested complete bootstrap inputs and per-scope execution/ordering contract; no SQL repair, source generation or historical revival.',
    }
    sourceCeilings.push(ceiling)
    record.SOURCE_CEILING_ID = ceiling.SOURCE_CEILING_ID
  }
}
const prerequisiteRegistry = [...prerequisiteMap.values()].sort((x, y) =>
  x.PREREQUISITE_ID.localeCompare(y.PREREQUISITE_ID),
)
const organizationOriginCandidates = candidates.filter(
  (candidate) =>
    candidate.PREREQUISITE_KIND === 'RELATION' &&
    candidate.PHYSICAL_OBJECT === 'public.organizations',
)
assert.ok(
  organizationOriginCandidates.some(
    (candidate) =>
      candidate.SOURCE_FILE === 'apps/union-eyes/backend/auth_core/migrations/0001_initial.py' &&
      candidate.CREATES_OBJECT === 'YES',
  ),
)
const organizations = prerequisiteRegistry.find(
  (record) => record.IDENTITY === 'union-eyes::RELATION::public.organizations',
)
assert.ok(organizations?.SOURCE_CEILING_ID)

const result = {
  metadata: {
    PHASE: 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE',
    METHOD: 'BOUNDED_STATIC_BOOTSTRAP_LINEAGE_ONLY',
    FROZEN_INPUT_SHA256: frozenHashes,
    ANALYZER_SHA256: hash(readFileSync(fileURLToPath(import.meta.url))),
    FROZEN_MANIFEST_DIGEST_BEFORE_ANALYSIS: digest(a.metadata.MIGRATION_MANIFEST),
    SOURCE_INVENTORY: [...sourceRegister.values()]
      .map(({ text, ...entry }) => entry)
      .sort((x, y) => x.FILE.localeCompare(y.FILE)),
    SOURCE_SCOPE:
      'UE db SQL/schema; backend migration files; specific bootstrap/config/authority documents; shared db; frozen artifact helper expansions. No product-source scan.',
    PARSER_PROVENANCE:
      'Lexical conventions reused from B3A census, without executing its generator. TS declarations use TypeScript AST; Django CreateModel blocks remain declarations/execution-path candidates only.',
    DEPENDENCY_CLOSURE_STATUS:
      'ALL_EXTRACTED_AND_OPAQUE_DEPENDENCIES_ACCOUNTED_IDENTITIES_NOT_ALL_CLOSED',
    LIMITATIONS: [
      'No general-purpose PostgreSQL semantic parser or SQL execution. Dynamic bindings and deferred body effects have explicit prerequisite/source-ceiling records.',
      'Django transitive migration closure/physical binding and snapshot payload are not executed or assumed.',
      'A source-only inventory cannot prove every dynamically generated dependency identity; such identity sets remain explicitly ceiling-classified, never declared complete canonical closure.',
    ],
  },
  frozenMigrationManifest: manifest,
  prerequisiteRegistry,
  migrationDependencyGraph,
  organizationOriginCandidates,
  bootstrapAuthorityRegistry: bootstrapAuthorities,
  backendMigrationDependencyRegistry,
  creationSourceCandidates: candidates,
  authorityConflicts,
  sourceCeilings,
  canonicalBootstrapSequence: [],
  canonicalBootstrapSequenceDecision: {
    CANONICAL_B3C_BOOTSTRAP_SEQUENCE: 'NOT_ESTABLISHED',
    ALL_REQUIRED_BOOTSTRAP_PREREQUISITES_HAVE_CANONICAL_SOURCE: 'NO',
    REPLAY_AUTHORIZED: 'NO',
    REQUIRED_AUTHORITY_DECISION_OR_SOURCE: [
      'Pin an accepted local canonical Django/bootstrap input and dependency plan with same-physical-database binding to UE scoped SQL.',
      'Establish every required column/type/function/role and dynamic target set before frozen consumers, including later platform objects consumed by scoped 0014.',
      'Resolve active creation conflicts and snapshot/scoped baselining versus the requirement to execute all 23 exact frozen files.',
      'Supply an authorized complete prerequisite sequence; neither schema declarations nor tolerant historical/shim cleanroom output may substitute.',
    ],
    ORGANIZATIONS_CANONICAL_OWNER: 'DJANGO',
    ORGANIZATIONS_CREATION_SOURCE: 'apps/union-eyes/backend/auth_core/migrations/0001_initial.py',
    ORGANIZATIONS_PREREQUISITE_ID: organizations.PREREQUISITE_ID,
    ORGANIZATIONS_EXECUTION_BINDING: 'SOURCE_CEILING',
  },
  replayRuns: [],
  replayDecision: {
    REPLAY_RUNS: 0,
    REPLAY_AUTHORIZED: 'NO',
    REASON:
      'Full canonical prerequisite authority closure is not established; section 19 forbids new replay.',
    DISPOSABLE_CONTAINERS_CREATED: 0,
    PRODUCTION_DATABASE_TOUCHED: 'NO',
    STAGING_DATABASE_TOUCHED: 'NO',
    SHARED_DATABASE_TOUCHED: 'NO',
  },
  catalogQuarantine: {
    CATALOG_SNAPSHOT_AUTHORITY: 'PREFLIGHT_PARTIAL_SCHEMA_OBSERVATION_ONLY',
    INPUT_ARTIFACT_SHA256: frozenHashes.CA,
    CATALOG_ITEMS_INPUT: 640,
    LOCAL_RESOLVED: 9,
    LOCAL_MISMATCH: 603,
    LOCAL_UNRESOLVED: 28,
    CURRENT_PARTIAL_CATALOG_USED_TO_RESOLVE_B3B_CEILINGS: 'NO',
    CURRENT_PARTIAL_CATALOG_USED_AS_PRODUCTION_EVIDENCE: 'NO',
    OBSERVATIONS_UNCHANGED: 'YES',
    PARTIAL_CATALOG_DIGEST: ca.environmentFingerprint.CATALOG_SNAPSHOT_DIGEST,
    KNOWN_FAILURE: {
      FAILED_MIGRATION:
        'apps/union-eyes/db/migrations-cache/0006_external_specialist_runtime_privilege_closure.sql',
      FAILED_DEPENDENCY: 'organizations',
      FAILURE_TYPE: 'REQUIRED_RELATION_ABSENT_BEFORE_MIGRATION',
    },
  },
  carryForward: {
    PHASE_1B_3B: 'SOURCE_CEILING_ACCEPTED',
    STATIC_RLS_POLICY_MODEL: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    RELATIONAL_SECURITY_OBJECTS: 612,
    ACTIVE_POLICY_IDENTITIES: 1490,
    B3C_RUNTIME_PROOF_ITEMS: 3124,
    KNOWN_REQUIRED_RLS_DECLARATION_GAP_OBJECTS: 159,
    KNOWN_NULLABLE_ORG_SEMANTIC_MISMATCH_OBJECTS: 2,
    KNOWN_STATIC_DEFECT_BLOCKERS: 663,
    REQUIREMENT_DECISION_BLOCKERS: 1007,
    READY_FOR_RUNTIME_PROOF: 0,
    PHASE_1B_3C_A_GATE: 'FAIL',
    PREDECESSOR_CARRY_FORWARD: b.predecessorCarryForward,
    FINAL_SERVER_ENTRY_DISPOSITIONS: 1910,
    B3B_CORRECTNESS_CEILING_RECORD_COUNT: 2656,
  },
  summary: {
    TOTAL_FROZEN_MIGRATIONS: 23,
    TOTAL_PREREQUISITE_IDENTITIES: prerequisiteRegistry.length,
    PREREQUISITES_SATISFIED_WITHIN_FROZEN_SEQUENCE: prerequisiteRegistry.filter(
      (record) =>
        record.SATISFIED_ONLY_WITHIN_FROZEN_SEQUENCE &&
        record.CONSUMERS.some(
          (consumer) => consumer.RESOLUTION === 'SATISFIED_BY_EARLIER_FROZEN_DECLARATION',
        ),
    ).length,
    POSTGRES_CORE_ONLY_PREREQUISITES: prerequisiteRegistry.filter((record) =>
      record.CONSUMERS.every((consumer) => consumer.RESOLUTION === 'POSTGRES_CORE_PREREQUISITE'),
    ).length,
    PREREQUISITES_REQUIRING_PRE_MIGRATION_BOOTSTRAP: prerequisiteRegistry.filter(
      (record) => record.BOOTSTRAP_REQUIRED_BEFORE_CONSUMERS.length,
    ).length,
    PREREQUISITES_WITH_CONFLICTING_AUTHORITY: authorityConflicts.length,
    PREREQUISITES_WITH_SOURCE_CEILING: sourceCeilings.length,
    UNACCOUNTED_PREREQUISITES: 0,
    DYNAMIC_OR_GRANT_BINDING_IDENTITIES: prerequisiteRegistry.filter(
      (record) => record.KIND === 'SOURCE_BINDING',
    ).length,
    SOURCE_BACKED_CREATION_CANDIDATES: candidates.length,
    COMMENT_ONLY_FROZEN_MIGRATIONS: migrationDependencyGraph.filter(
      (node) => node.EXECUTABLE_SQL_PRESENT === 'NO',
    ).length,
    ORGANIZATION_ORIGIN_CANDIDATES: organizationOriginCandidates.length,
    CANONICAL_BOOTSTRAP_STEPS: 0,
    REPLAY_RUNS: 0,
  },
  validation: {
    FROZEN_INPUT_HASHES: 'PASS',
    FROZEN_MIGRATION_HASHES: 'PASS',
    FROZEN_B3A_MIGRATION_FILES: 23,
    FROZEN_B3A_MIGRATION_FILES_CHANGED: 'NO',
    MIGRATION_GRAPH_NODE_COUNT: 23,
    ALL_INVENTORIED_AND_OPAQUE_DEPENDENCIES_ACCOUNTED: 'YES',
    ALL_DYNAMIC_PREREQUISITE_IDENTITIES_CLOSED: 'NO',
    GENERATED_SUBSTITUTE_DDL_USED: 'NO',
    MIGRATIONS_REPAIRED: 0,
    POLICIES_CHANGED: 0,
    SCHEMA_SOURCES_CHANGED: 0,
    APPLICATION_BEHAVIOR_CHANGED: 'NO',
    TENANT_ISOLATION_PROOF_TESTS_EXECUTED: 0,
    NEW_DATABASE_CONNECTIONS: 0,
    NEW_DISPOSABLE_CONTAINERS: 0,
  },
  phaseStatus: {
    PHASE_1B_3C_A1_GATE: 'SOURCE_CEILING',
    PHASE_1B_3C_A1: 'SOURCE_CEILING_ACCEPTED',
    CANONICAL_DISPOSABLE_SCHEMA_BOOTSTRAP: 'NOT_ESTABLISHED',
    PHASE_1B_3C_A2: 'NOT_AUTHORIZED',
    PHASE_1B_3C_A2_STARTED: 'NO',
    PHASE_1B_3C_B: 'NOT_AUTHORIZED',
    PHASE_1B_3C_B_STARTED: 'NO',
    PHASE_1B_3B: 'SOURCE_CEILING_ACCEPTED',
    PHASE_1B_3C_A_GATE: 'FAIL',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    PRODUCT_READY: 'NO',
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
  },
}
function validate() {
  const ids = new Set(prerequisiteRegistry.map((record) => record.PREREQUISITE_ID))
  assert.equal(ids.size, prerequisiteRegistry.length)
  assert.equal(new Set(migrationDependencyGraph.map((node) => node.MIGRATION_FILE)).size, 23)
  assert.deepEqual(
    migrationDependencyGraph.map((node) => node.MIGRATION_FILE),
    manifest.map((entry) => entry.FILE),
  )
  for (const node of migrationDependencyGraph) {
    for (const key of node.REQUIRED_PREREQUISITES) assert.ok(ids.has(key))
    const accounted = unique([
      ...node.PREREQUISITES_CREATED_BY_EARLIER_FROZEN_MIGRATIONS,
      ...node.POSTGRES_CORE_PREREQUISITES,
      ...node.UNRESOLVED_PREREQUISITES,
    ])
    assert.deepEqual(accounted, node.REQUIRED_PREREQUISITES)
  }
  for (const record of prerequisiteRegistry) {
    assert.ok(record.CONSUMERS.length)
    if (record.BOOTSTRAP_REQUIRED_BEFORE_CONSUMERS.length) assert.ok(record.SOURCE_CEILING_ID)
  }
  const candidateIds = new Set(candidates.map((candidate) => candidate.CANDIDATE_ID))
  assert.equal(candidateIds.size, candidates.length)
  const backendIds = new Set(
    backendMigrationDependencyRegistry.map((record) => record.BACKEND_MIGRATION_ID),
  )
  for (const record of prerequisiteRegistry) {
    for (const candidateId of record.CANDIDATE_SOURCE_IDS) assert.ok(candidateIds.has(candidateId))
    for (const backendId of record.BACKEND_MIGRATION_DEPENDENCY_IDS)
      assert.ok(backendIds.has(backendId))
  }
  assert.equal(
    sourceCeilings.length,
    result.summary.PREREQUISITES_REQUIRING_PRE_MIGRATION_BOOTSTRAP,
  )
  assert.equal(
    result.summary.TOTAL_PREREQUISITE_IDENTITIES,
    result.summary.PREREQUISITES_SATISFIED_WITHIN_FROZEN_SEQUENCE +
      result.summary.POSTGRES_CORE_ONLY_PREREQUISITES +
      result.summary.PREREQUISITES_REQUIRING_PRE_MIGRATION_BOOTSTRAP,
  )
  assert.ok(sourceCeilings.length > 0)
  assert.equal(result.canonicalBootstrapSequence.length, 0)
  assert.equal(result.replayRuns.length, 0)
  assert.equal(
    result.catalogQuarantine.LOCAL_RESOLVED +
      result.catalogQuarantine.LOCAL_MISMATCH +
      result.catalogQuarantine.LOCAL_UNRESOLVED,
    640,
  )
  for (const entry of manifest) assert.equal(hash(readFileSync(absolute(entry.FILE))), entry.SHA256)
  for (const [key, name] of Object.entries(frozenNames))
    assert.equal(hash(readFileSync(absolute(`${base}${name}.json`))), frozenHashes[key])
}
validate()
function markdown() {
  return `# Phase 1B.3C-A1 — canonical schema bootstrap lineage

## Gate

\`PHASE_1B_3C_A1_GATE = SOURCE_CEILING\`.
Canonical operational ownership is established; a complete faithful disposable bootstrap is **not**.
No new database replay was authorized or executed. A2 and B3C-B remain **NOT_AUTHORIZED**.

## Organizations origin

Django is the canonical operational owner under
[\`orm-authority-governance.md\`](../../categories/platform-and-operations/architecture/orm-governance/orm-authority-governance.md).
[\`auth_core/migrations/0001_initial.py\`](../../../apps/union-eyes/backend/auth_core/migrations/0001_initial.py)
creates model \`Organizations\` with \`db_table = organizations\`.
The local environment strategy specifies Django migration before scoped bootstrap.
This identifies the creation source, **not** a proved complete PostgreSQL prerequisite sequence:
Django PG* target binding, the scoped DATABASE_URL target, backend transitive migrations,
column/type compatibility and active ordering are not assumed equivalent.

${organizationOriginCandidates.map((candidate) => `- \`${candidate.SOURCE_FILE}\` — ${candidate.SOURCE_KIND}; **${candidate.AUTHORITY_CLASS}**; creates: ${candidate.CREATES_OBJECT}; scope: ${candidate.DATABASE_SCOPE}.`).join('\n')}

Historical \`0002_true_selene.sql\`, audit snapshots and broad Drizzle declarations are not promoted
to active predecessors. No table was created manually and \`0006\` was not edited.

## Complete bounded prerequisite graph

The [JSON graph](./PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json)
contains all 23 frozen migration nodes in their original order, identity-scoped prerequisite
records, consumer/range evidence, creation candidates, authority records and explicit residual
dynamic/conditional dependency ceilings.

| Measure | Count |
|---|---:|
| Frozen migrations | 23 |
| Inventoried prerequisite identities, including opaque binding obligations | ${result.summary.TOTAL_PREREQUISITE_IDENTITIES} |
| Satisfied only within frozen sequence | ${result.summary.PREREQUISITES_SATISFIED_WITHIN_FROZEN_SEQUENCE} |
| PostgreSQL-core-only identities | ${result.summary.POSTGRES_CORE_ONLY_PREREQUISITES} |
| Requiring canonical pre-consumer bootstrap/binding | ${result.summary.PREREQUISITES_REQUIRING_PRE_MIGRATION_BOOTSTRAP} |
| Active authority conflicts | ${authorityConflicts.length} |
| Prerequisite source ceilings | ${sourceCeilings.length} |
| Unaccounted inventoried/opaque obligations | 0 |

These are source inventory counts, not a claim that every generated runtime identity is known.
Every opaque EXECUTE/grant-scope site is represented as a binding prerequisite and explicit
ceiling. Accepted B3A literal helper expansions provide target/column references without
re-analysis of policy correctness. Earlier frozen declarations do not prove migration success
or runtime presence. Full dynamic/transitive bootstrap closure remains unproven.

## Bootstrap authority

${bootstrapAuthorities.map((record) => `### ${record.AUTHORITY_CLASS}: \`${record.COMMAND_OR_SCRIPT}\`\n\n- Scope: \`${record.DATABASE_SCOPE}\`.\n- Order: ${record.ORDERING_GUARANTEES}\n- Limits: ${record.LIMITATIONS.join(' ')}\n`).join('\n')}

The canonical snapshot restore implementation exists, but its accepted payload identity and
migration level are operator inputs, not pinned repository prerequisite bytes. Snapshot
baselining skips scoped DDL, so it is not proof of exact execution of the frozen 23-file set.
The old interface-only reference documentation is not substituted for actual source behavior.
The cleanroom script's shims, transaction stripping and tolerance of missing objects disqualify
it from faithful unmodified replay in this mission. No historical override was invoked.

The financial-service frozen \`0000_lucky_mole_man.sql\` is entirely commented introspection
SQL. Its earlier successful execution was a **no-op**, not materialization of the **131**
financial-scope source objects. The scope-materialization obligation is explicitly recorded;
no commented DDL was uncommented, synthesized or merged into the UE database.

## Missing authority/source required

${result.canonicalBootstrapSequenceDecision.REQUIRED_AUTHORITY_DECISION_OR_SOURCE.map((value) => `- ${value}`).join('\n')}

Canonical sequence: **not established**. No generated DDL, scope merging, business-policy
decision, repair or replay has been used to close these ceilings.

## Partial C-A catalog quarantine

\`CATALOG_SNAPSHOT_AUTHORITY = PREFLIGHT_PARTIAL_SCHEMA_OBSERVATION_ONLY\`.

All **640** observations remain unchanged: **9 locally resolved / 603 local mismatches /
28 unresolved**. None resolves a B3B ceiling or supplies production evidence. Frozen first
failure remains \`0006_external_specialist_runtime_privilege_closure.sql\`:
\`relation "organizations" does not exist\`.

## State and validation

\`\`\`text
PHASE_1B_3C_A1_GATE = SOURCE_CEILING
PHASE_1B_3C_A1 = SOURCE_CEILING_ACCEPTED
CANONICAL_DISPOSABLE_SCHEMA_BOOTSTRAP = NOT_ESTABLISHED
PHASE_1B_3C_A2 = NOT_AUTHORIZED
PHASE_1B_3C_B = NOT_AUTHORIZED
READY_FOR_RUNTIME_PROOF = 0
TENANT_ISOLATION_RUNTIME_PROVEN = NO
PRODUCT_READY = NO
\`\`\`

Frozen predecessors, all 23 migration hashes, 612 objects, 1,490 policies, 3,124 packet items,
159 missing-RLS objects, two semantic mismatches and earlier carry-forwards remain unchanged.
No runtime DB/auth, production/staging/shared access, tenant test or later phase work occurred.

\`\`\`powershell
node --check scripts\\ue\\reconcile-runtime-schema-bootstrap-lineage.mjs
node scripts\\ue\\reconcile-runtime-schema-bootstrap-lineage.mjs --self-test
node scripts\\ue\\reconcile-runtime-schema-bootstrap-lineage.mjs
node scripts\\ue\\reconcile-runtime-schema-bootstrap-lineage.mjs --check
pnpm exec prettier --check scripts\\ue\\reconcile-runtime-schema-bootstrap-lineage.mjs docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.md
pnpm validate:docs
\`\`\`
`
}
const args = process.argv.slice(2)
assert.ok(
  args.length <= 1 && args.every((arg) => ['--check', '--self-test'].includes(arg)),
  'Only static generation, --check and --self-test are authorized; runtime replay is prohibited without full canonical closure.',
)
if (args.includes('--self-test')) {
  const sample = sqlDependencies(`-- CREATE TABLE fake(id badtype);
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid, org_id uuid REFERENCES organizations(id), kind custom_kind);
    ALTER TABLE auth.users ADD COLUMN value text;
    GRANT SELECT ON TABLE auth.users TO ordinary_role;
    CREATE FUNCTION helper() RETURNS void LANGUAGE plpgsql AS $tag$ BEGIN EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t); END $tag$;`)
  assert.ok(
    sample.requirements.some(
      (record) => record.KIND === 'RELATION' && record.NAME === 'organizations',
    ),
  )
  assert.ok(
    sample.requirements.some(
      (record) => record.KIND === 'COLUMN' && record.NAME === 'organizations.id',
    ),
  )
  assert.ok(
    sample.requirements.some((record) => record.KIND === 'TYPE' && record.NAME === 'custom_kind'),
  )
  assert.ok(
    sample.requirements.some((record) => record.KIND === 'ROLE' && record.NAME === 'ordinary_role'),
  )
  assert.ok(sample.opaque.some((record) => record.KIND === 'DYNAMIC_SQL'))
  assert.ok(!sample.creations.some((record) => record.NAME === 'fake'))
  assert.ok(
    sample.creations.some(
      (record) => record.KIND === 'COLUMN' && record.NAME === 'auth.users.value',
    ),
  )
  assert.notEqual(
    identity('union-eyes', 'RELATION', 'organizations'),
    identity('financial-service', 'RELATION', 'organizations'),
  )
  const regression = sqlDependencies(`
    CREATE INDEX sample_idx ON auth.users USING btree ("org_id");
    REVOKE SELECT ON TABLE auth.users FROM ordinary_role;
    CREATE POLICY ordinary_update ON auth.users FOR UPDATE TO ordinary_role USING (true);
    SELECT to_regclass('public.' || quote_ident(t));
    SELECT NEW.token IS DISTINCT FROM OLD.token;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM ordinary_role;
  `)
  assert.ok(
    regression.requirements.some(
      (record) => record.KIND === 'COLUMN' && record.NAME === 'auth.users.org_id',
    ),
  )
  assert.ok(
    !regression.requirements.some(
      (record) =>
        record.KIND === 'RELATION' &&
        ['ordinary_role', 'on', 'to', 'tables', 'public.', 'OLD.token'].includes(record.NAME),
    ),
  )
  assert.ok(
    !regression.requirements.some(
      (record) => record.KIND === 'FUNCTION' && ['auth.users', 'btree'].includes(record.NAME),
    ),
  )
  console.log(
    'PASS: quoted/comment/body lexing, FK/type/role/column dependencies, dynamic ceilings, scope separation, full graph accounting and frozen hash preservation.',
  )
} else {
  const config = await resolveConfig(fileURLToPath(import.meta.url))
  for (const [file, contents] of [
    [
      `${base}${outputName}.json`,
      await format(JSON.stringify(result), { ...config, parser: 'json' }),
    ],
    [`${base}${outputName}.md`, await format(markdown(), { ...config, parser: 'markdown' })],
  ]) {
    if (args.includes('--check'))
      assert.equal(readFileSync(absolute(file), 'utf8'), contents, `Stale ${file}`)
    else writeFileSync(absolute(file), contents)
  }
  validate()
  console.log(
    JSON.stringify({ GATE: result.phaseStatus.PHASE_1B_3C_A1_GATE, ...result.summary }, null, 2),
  )
}
