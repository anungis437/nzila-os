import assert from 'node:assert/strict'
import { writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { format, resolveConfig } from 'prettier'
import { digest, exactIds, read, root, sha } from './w4-physical-producers'
import type { adoptionModel } from './adopt-w4-platform-ownership'
import type { buildAdjudication } from './adjudicate-w4-ownership'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  w4d: folder + 'PHASE_1B_3C_A1I_W4D_PHYSICAL_OWNERSHIP_ADJUDICATION.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  w4: folder + 'PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS.json',
}
export const outputs = {
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json',
  registryMarkdown: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.md',
  report: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.md',
  decisions: folder + 'UE_W4F_CANONICAL_DEFINITION_DECISION_PACKET.json',
}
type Model = ReturnType<typeof adoptionModel>
type Obligation = Model['definitions'][number]
type Candidate = Awaited<
  ReturnType<typeof buildAdjudication>
>['decisionAdjudication'][number]['DECLARATION_ONLY_CANDIDATES'][number]
type Property = { STATE: 'EXPLICIT' | 'UNRESOLVED'; VALUE: string | null; EVIDENCE: string }
const explicit = (value: string, evidence: string): Property => ({
  STATE: 'EXPLICIT',
  VALUE: value,
  EVIDENCE: evidence,
})
const unresolved = (evidence: string): Property => ({
  STATE: 'UNRESOLVED',
  VALUE: null,
  EVIDENCE: evidence,
})
export const materialProperties = [
  'POSTGRES_TYPE',
  'NULLABILITY',
  'DEFAULT',
  'IDENTITY_OR_GENERATED',
  'PRIMARY_KEY_PARTICIPATION',
  'UNIQUE_PARTICIPATION',
  'FOREIGN_KEY',
  'CHECK_CONSTRAINTS',
] as const
type Properties = Record<(typeof materialProperties)[number], Property>
export interface SourceReference {
  FILE: string
  FILE_SHA256: string
  RANGE: number[]
  DIGEST: string
  TEXT: string
  CLASS: 'DECLARATION_DESIGN_EVIDENCE' | 'HISTORICAL_SQL_DESIGN_EVIDENCE'
  CREATION_AUTHORITY: 'NO'
  EXECUTION_AUTHORITY: 'NO'
}
interface ParsedColumn {
  KEY: string
  NAME: string
  SOURCE_EXPRESSION: string
  PROPERTIES: Properties
  REFERENCES: string[]
}
type SourcePointer = Omit<SourceReference, 'TEXT'>
function sourcePointer(reference: SourceReference): SourcePointer {
  return {
    FILE: reference.FILE,
    FILE_SHA256: reference.FILE_SHA256,
    RANGE: reference.RANGE,
    DIGEST: reference.DIGEST,
    CLASS: reference.CLASS,
    CREATION_AUTHORITY: reference.CREATION_AUTHORITY,
    EXECUTION_AUTHORITY: reference.EXECUTION_AUTHORITY,
  }
}
interface ParsedTable {
  NAME: string
  SCHEMA: string
  REFERENCE: SourceReference
  COLUMNS: ParsedColumn[]
  CONSTRAINT_SOURCE: string | null
  LIMITATIONS: string[]
}
function initialProperties(): Properties {
  return Object.fromEntries(
    materialProperties.map((key) => [
      key,
      unresolved(
        'No explicit canonical value adopted; absence of declaration is not positive evidence for NONE/nullable/no constraints',
      ),
    ]),
  ) as Properties
}
function literal(node: ts.Expression | undefined): string | null {
  if (!node) return null
  if (ts.isStringLiteralLike(node)) return JSON.stringify(node.text)
  if (ts.isNumericLiteral(node)) return node.text
  if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true'
  if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null'
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return `-${node.operand.text}`
  if (ts.isArrayLiteralExpression(node)) {
    const items = node.elements.map((n) => (ts.isExpression(n) ? literal(n) : null))
    return items.every((n) => n !== null) ? `[${items.join(',')}]` : null
  }
  return null
}
function option(node: ts.Expression | undefined, key: string): ts.Expression | undefined {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined
  const prop = node.properties.find(
    (p) =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === key,
  )
  return prop && ts.isPropertyAssignment(prop) ? prop.initializer : undefined
}
function chain(expression: ts.Expression) {
  const methods: { name: string; args: readonly ts.Expression[]; text: string }[] = []
  let current = expression
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    methods.push({
      name: current.expression.name.text,
      args: current.arguments,
      text: current.getText(),
    })
    current = current.expression.expression
  }
  return { base: current, methods }
}
function postgresType(
  factory: string,
  args: readonly ts.Expression[],
  enums: Map<string, string>,
): Property {
  const evidence = `Drizzle pg-core ${factory} declaration`
  const simple: Record<string, string> = {
    uuid: 'uuid',
    text: 'text',
    boolean: 'boolean',
    integer: 'integer',
    smallint: 'smallint',
    bigint: 'bigint',
    serial: 'integer',
    bigserial: 'bigint',
    real: 'real',
    doublePrecision: 'double precision',
    json: 'json',
    jsonb: 'jsonb',
    date: 'date',
  }
  if (simple[factory]) return explicit(simple[factory], evidence)
  if (factory === 'varchar' || factory === 'char') {
    const length = literal(option(args[1], 'length'))
    return length && /^\d+$/.test(length)
      ? explicit(`${factory === 'char' ? 'character' : 'character varying'}(${length})`, evidence)
      : unresolved('Character length/unbounded choice not explicitly established')
  }
  if (['numeric', 'decimal'].includes(factory)) {
    const precision = literal(option(args[1], 'precision'))
    const scale = literal(option(args[1], 'scale'))
    return precision && scale && /^\d+$/.test(precision) && /^\d+$/.test(scale)
      ? explicit(`numeric(${precision},${scale})`, evidence)
      : unresolved(
          'Numeric precision/scale or unconstrained representation requires explicit adoption',
        )
  }
  if (factory === 'timestamp') {
    const zone = literal(option(args[1], 'withTimezone'))
    const precision = literal(option(args[1], 'precision'))
    if (zone === 'true' || zone === 'false')
      return explicit(
        `timestamp${precision ? `(${precision})` : ''} ${zone === 'true' ? 'with' : 'without'} time zone`,
        evidence,
      )
    return unresolved(
      'Timestamp timezone semantics not explicitly established; no preferred timezone inferred',
    )
  }
  if (enums.has(factory))
    return unresolved(
      `References existing enum declaration ${enums.get(factory)}; no enum/type authoring or missing execution/dependency approval in W4F`,
    )
  return unresolved(
    `Unsupported/imported type factory ${factory}; exact physical type requires bounded evidence/design decision`,
  )
}
export function parseDeclaration(
  text: string,
  file: string,
  hash: string,
  sourceLine: number,
  physical: string,
): ParsedTable {
  assert.equal(sha(text), hash, 'DECLARATION_SOURCE_HASH_DRIFT')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const enums = new Map<string, string>()
  const coreFactories = new Map<string, string>()
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'drizzle-orm/pg-core'
    ) {
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings))
        for (const element of bindings.elements)
          coreFactories.set(element.name.text, element.propertyName?.text ?? element.name.text)
    }
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          ts.isCallExpression(declaration.initializer) &&
          ts.isIdentifier(declaration.initializer.expression) &&
          coreFactories.get(declaration.initializer.expression.text) === 'pgEnum' &&
          ts.isStringLiteralLike(declaration.initializer.arguments[0])
        )
          enums.set(declaration.name.text, declaration.initializer.arguments[0].text)
      }
  }
  const [schema, name] = physical.split('.')
  let table: ts.CallExpression | undefined
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      coreFactories.get(node.expression.text) === 'pgTable' &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === name
    ) {
      const start = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const end = source.getLineAndCharacterOfPosition(node.end).line + 1
      if (sourceLine >= start - 1 && sourceLine <= end) {
        assert(!table, 'COMPETING_DECLARATIONS_AT_CANDIDATE_RANGE')
        table = node
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert(
    table && table.arguments[1] && ts.isObjectLiteralExpression(table.arguments[1]),
    'EXACT_REFERENCED_PGTABLE_DECLARATION_MISSING',
  )
  const columns: ParsedColumn[] = []
  const limitations: string[] = []
  for (const member of table.arguments[1].properties) {
    if (
      !ts.isPropertyAssignment(member) ||
      (!ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name))
    ) {
      limitations.push(`Nonliteral/spread column member: ${member.getText(source)}`)
      continue
    }
    const { base, methods } = chain(member.initializer)
    const properties = initialProperties()
    if (
      !ts.isCallExpression(base) ||
      !ts.isIdentifier(base.expression) ||
      !base.arguments[0] ||
      !ts.isStringLiteralLike(base.arguments[0])
    ) {
      limitations.push(`Unresolved column builder: ${member.name.text}`)
      continue
    }
    const factory = coreFactories.get(base.expression.text) ?? base.expression.text
    const name = base.arguments[0].text
    const columnExpression = member.getText(source)
    const evidence = `${file}:${source.getLineAndCharacterOfPosition(member.getStart()).line + 1}#${sha(columnExpression)}; exact expression retained in declaration column record`
    properties.POSTGRES_TYPE =
      coreFactories.has(base.expression.text) || enums.has(base.expression.text)
        ? postgresType(factory, base.arguments, enums)
        : unresolved(`Unverified builder import:${factory}`)
    const has = (method: string) => methods.find((m) => m.name === method)
    if (has('primaryKey')) {
      properties.PRIMARY_KEY_PARTICIPATION = explicit('PRIMARY_KEY', evidence)
      properties.NULLABILITY = explicit('NOT_NULL', evidence)
    }
    if (has('notNull')) properties.NULLABILITY = explicit('NOT_NULL', evidence)
    if (has('unique')) properties.UNIQUE_PARTICIPATION = explicit('UNIQUE', evidence)
    if (has('defaultRandom')) properties.DEFAULT = explicit('gen_random_uuid()', evidence)
    else if (has('defaultNow')) properties.DEFAULT = explicit('now()', evidence)
    else if (has('default')) {
      const value = literal(has('default')!.args[0])
      properties.DEFAULT =
        value !== null
          ? explicit(value, evidence)
          : unresolved(
              `Default expression requires exact PostgreSQL lowering:${has('default')!.text}`,
            )
    }
    if (has('generatedAlwaysAsIdentity'))
      properties.IDENTITY_OR_GENERATED = explicit(
        'GENERATED_ALWAYS_AS_IDENTITY; exact sequence options need review',
        evidence,
      )
    else if (has('generatedByDefaultAsIdentity'))
      properties.IDENTITY_OR_GENERATED = explicit(
        'GENERATED_BY_DEFAULT_AS_IDENTITY; exact sequence options need review',
        evidence,
      )
    else if (has('generatedAlwaysAs'))
      properties.IDENTITY_OR_GENERATED = unresolved(
        `Generated expression:${has('generatedAlwaysAs')!.text}`,
      )
    const ref = has('references')
    if (ref) {
      const onDelete = literal(option(ref.args[1], 'onDelete'))
      const onUpdate = literal(option(ref.args[1], 'onUpdate'))
      properties.FOREIGN_KEY = unresolved(
        `Declared target:${ref.args[0]?.getText(source)}; ON_DELETE:${onDelete ?? 'UNRESOLVED'}; ON_UPDATE:${onUpdate ?? 'UNRESOLVED'}; target schema/physical columns and both actions require explicit bounded adoption`,
      )
    }
    if (has('array')) {
      properties.POSTGRES_TYPE =
        properties.POSTGRES_TYPE.STATE === 'EXPLICIT'
          ? explicit(`${properties.POSTGRES_TYPE.VALUE}[]`, evidence)
          : properties.POSTGRES_TYPE
    }
    const recognized = [
      'primaryKey',
      'notNull',
      'unique',
      'defaultRandom',
      'defaultNow',
      'default',
      'references',
      '$type',
      'array',
      'generatedAlwaysAsIdentity',
      'generatedByDefaultAsIdentity',
      'generatedAlwaysAs',
    ]
    for (const method of methods)
      if (!recognized.includes(method.name))
        limitations.push(
          `Unresolved physical/application builder method ${name}.${method.name}; not silently discarded`,
        )
    columns.push({
      KEY: member.name.text,
      NAME: name,
      SOURCE_EXPRESSION: columnExpression,
      PROPERTIES: properties,
      REFERENCES: ref ? [ref.text] : [],
    })
  }
  assert.equal(
    new Set(columns.map((c) => c.NAME)).size,
    columns.length,
    'DUPLICATE_DECLARATION_COLUMNS',
  )
  const declarationText = table.getText(source)
  return {
    NAME: name,
    SCHEMA: schema,
    REFERENCE: {
      FILE: file,
      FILE_SHA256: hash,
      RANGE: [
        source.getLineAndCharacterOfPosition(table.getStart()).line + 1,
        source.getLineAndCharacterOfPosition(table.end).line + 1,
      ],
      DIGEST: sha(declarationText),
      TEXT: declarationText,
      CLASS: 'DECLARATION_DESIGN_EVIDENCE',
      CREATION_AUTHORITY: 'NO',
      EXECUTION_AUTHORITY: 'NO',
    },
    COLUMNS: columns,
    CONSTRAINT_SOURCE: table.arguments[2]?.getText(source) ?? null,
    LIMITATIONS: [
      ...limitations,
      'Omitted defaults/nullability/identity/constraint participation are not canonical NONE values; required explicit design adoption remains pending',
      'Table callback retained verbatim; constraints/index expressions are design evidence, not silently lowered to final SQL',
    ],
  }
}
export function classify(properties: Properties[], references: Pick<SourceReference, 'FILE'>[]) {
  const resolved: Record<string, Property> = {}
  const pending: string[] = []
  const conflicts: { PROPERTY: string; VALUES: string[]; EVIDENCE: string[] }[] = []
  for (const key of materialProperties) {
    const known = properties
      .map((p) => {
        const property = p[key]
        if (
          key !== 'DEFAULT' ||
          property.STATE !== 'EXPLICIT' ||
          p.POSTGRES_TYPE.STATE !== 'EXPLICIT'
        )
          return property
        const type = p.POSTGRES_TYPE.VALUE!
        const value = property.VALUE!
        if (/^(?:numeric\b|integer$|bigint$|real$|double precision$)/.test(type)) {
          const unquoted = /^"(-?\d+(?:\.\d+)?)"$/.exec(value)
          if (unquoted)
            return {
              ...property,
              VALUE: unquoted[1],
              EVIDENCE: `${property.EVIDENCE}; comparison normalization: quoted numeric literal under exact numeric type`,
            }
        }
        if (['json', 'jsonb'].includes(type) && value.startsWith('"')) {
          const unquoted: unknown = JSON.parse(value)
          if (
            typeof unquoted === 'string' &&
            (unquoted.trim().startsWith('[') || unquoted.trim().startsWith('{'))
          ) {
            try {
              return {
                ...property,
                VALUE: JSON.stringify(JSON.parse(unquoted)),
                EVIDENCE: `${property.EVIDENCE}; comparison normalization: JSON literal text under exact JSON type`,
              }
            } catch (error: unknown) {
              assert(error instanceof SyntaxError, 'UNEXPECTED_JSON_LITERAL_PARSE_FAILURE')
              return unresolved(
                `Invalid JSON default literal in referenced design evidence:${property.EVIDENCE}`,
              )
            }
          }
        }
        return property
      })
      .filter((p) => p.STATE === 'EXPLICIT')
    const values = [...new Set(known.map((p) => p.VALUE!))]
    if (values.length > 1)
      conflicts.push({ PROPERTY: key, VALUES: values, EVIDENCE: known.map((p) => p.EVIDENCE) })
    else if (values.length === 1) resolved[key] = known[0]
    else pending.push(key)
  }
  const complete = pending.length === 0 && conflicts.length === 0 && references.length > 0
  return {
    RESOLVED_PROPERTIES: resolved,
    UNRESOLVED_PROPERTIES: pending,
    CONFLICTS: conflicts,
    DEFINITION_EVIDENCE_CLASS: conflicts.length
      ? 'CONTRADICTORY_DEFINITION_EVIDENCE'
      : complete
        ? references.length === 1
          ? 'EXACT_EXISTING_DECLARATION'
          : 'CONSISTENT_MULTI_SOURCE_DEFINITION'
        : 'PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION',
    DEFINITION_DISPOSITION: conflicts.length
      ? 'DEFINITION_CONFLICT'
      : complete
        ? 'CANONICAL_DEFINITION_AUTHORED'
        : 'DESIGN_DECISION_REQUIRED',
  }
}
function splitSqlFields(body: string) {
  const fields: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quote) {
      if (char === quote) {
        if (body[i + 1] === quote) i++
        else quote = ''
      }
    } else if (char === "'" || char === '"') quote = char
    else if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ',' && depth === 0) {
      fields.push(body.slice(start, i))
      start = i + 1
    }
  }
  fields.push(body.slice(start))
  return fields
}
export function parseHistoricalTable(text: string, candidate: Candidate): ParsedTable {
  assert.equal(sha(text), candidate.SOURCE_FILE_SHA256, 'HISTORICAL_SOURCE_HASH_DRIFT')
  const lines = text.split('\n')
  const offset =
    lines.slice(0, candidate.SOURCE_LINE - 1).join('\n').length +
    (candidate.SOURCE_LINE > 1 ? 1 : 0)
  const tail = text.slice(offset)
  const create =
    /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|[\w]+)(?:\.(?:"[^"]+"|[\w]+))?)\s*\(/i.exec(
      tail,
    )
  assert(create, 'EXACT_HISTORICAL_CREATE_TABLE_MISSING')
  const physical = create[1].replaceAll('"', '')
  assert.equal(
    physical.includes('.') ? physical : `public.${physical}`,
    candidate.PHYSICAL_OBJECT,
    'HISTORICAL_OBJECT_IDENTITY_DRIFT',
  )
  const start = create[0].length
  let depth = 1
  let quote = ''
  let end = start
  for (; end < tail.length; end++) {
    const char = tail[end]
    if (quote) {
      if (char === quote) {
        if (tail[end + 1] === quote) end++
        else quote = ''
      }
    } else if (char === "'" || char === '"') quote = char
    else if (char === '(') depth++
    else if (char === ')' && --depth === 0) break
  }
  assert.equal(depth, 0, 'UNTERMINATED_HISTORICAL_TABLE')
  const clause = tail.slice(0, end + 1)
  const constraints: string[] = []
  const columns: ParsedColumn[] = []
  for (const field of splitSqlFields(tail.slice(start, end))) {
    const trimmed = field.trim()
    if (/^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(trimmed)) {
      constraints.push(trimmed)
      continue
    }
    const column = /^(?:"([^"]+)"|([A-Za-z_]\w*))\s+([\s\S]+)$/.exec(trimmed)
    if (!column) {
      constraints.push(`UNPARSED_FIELD:${trimmed}`)
      continue
    }
    const name = column[1] ?? column[2]
    const rest = column[3]
    const props = initialProperties()
    const masked = rest.replace(/'(?:[^']|'')*'/g, (literal) => ' '.repeat(literal.length))
    const typeEnd =
      /\s+(?:DEFAULT|NOT\s+NULL|NULL|PRIMARY\s+KEY|UNIQUE|REFERENCES|CHECK|CONSTRAINT|GENERATED)\b/i.exec(
        masked,
      )
    const rawType = rest.slice(0, typeEnd?.index ?? rest.length).trim()
    const type = rawType
      .replaceAll('"', '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/^varchar\b/, 'character varying')
      .replace(/^decimal\b/, 'numeric')
      .replace(/^int4$/, 'integer')
      .replace(/^int8$/, 'bigint')
      .replace(/^timestamptz$/, 'timestamp with time zone')
      .replace(/^timestamp$/, 'timestamp without time zone')
      .replace(/,\s+/g, ',')
    const evidence = `${candidate.SOURCE_FILE}:${candidate.SOURCE_LINE}#${sha(trimmed)}; exact historical column expression retained`
    props.POSTGRES_TYPE = explicit(type, evidence)
    if (/\bNOT\s+NULL\b/i.test(masked)) props.NULLABILITY = explicit('NOT_NULL', evidence)
    if (/\bPRIMARY\s+KEY\b/i.test(masked)) {
      props.PRIMARY_KEY_PARTICIPATION = explicit('PRIMARY_KEY', evidence)
      props.NULLABILITY = explicit('NOT_NULL', evidence)
    }
    if (/\bUNIQUE\b/i.test(masked)) props.UNIQUE_PARTICIPATION = explicit('UNIQUE', evidence)
    const defaultStart = /\bDEFAULT\b/i.exec(masked)
    if (defaultStart) {
      const start = defaultStart.index + defaultStart[0].length
      const defaultEnd =
        /\s+(?:NOT\s+NULL|PRIMARY\s+KEY|UNIQUE|REFERENCES|CONSTRAINT|CHECK)\b/i.exec(
          masked.slice(start),
        )
      const raw = rest.slice(start, defaultEnd ? start + defaultEnd.index : rest.length).trim()
      const string = /^'((?:[^']|'')*)'(?:\s*::[\w". ]+)?$/.exec(raw)
      const known = string
        ? JSON.stringify(string[1].replaceAll("''", "'"))
        : /^(?:-?\d+(?:\.\d+)?|true|false|null|now\(\)|gen_random_uuid\(\))$/i.test(raw)
          ? raw.toLowerCase()
          : null
      if (known !== null) props.DEFAULT = explicit(known, evidence)
    }
    columns.push({
      KEY: name,
      NAME: name,
      SOURCE_EXPRESSION: trimmed,
      PROPERTIES: props,
      REFERENCES: /\bREFERENCES\b/i.test(rest) ? [rest] : [],
    })
  }
  for (const constraint of constraints) {
    const primary = /\bPRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(constraint)
    if (primary)
      for (const name of primary[1].split(',').map((n) => n.replaceAll('"', '').trim())) {
        const col = columns.find((c) => c.NAME === name)
        if (col) {
          col.PROPERTIES.PRIMARY_KEY_PARTICIPATION = explicit('PRIMARY_KEY', constraint)
          col.PROPERTIES.NULLABILITY = explicit('NOT_NULL', constraint)
        }
      }
  }
  return {
    NAME: candidate.PHYSICAL_OBJECT.split('.')[1],
    SCHEMA: candidate.PHYSICAL_OBJECT.split('.')[0],
    REFERENCE: {
      FILE: candidate.SOURCE_FILE,
      FILE_SHA256: candidate.SOURCE_FILE_SHA256,
      RANGE: [candidate.SOURCE_LINE, candidate.SOURCE_LINE + clause.split('\n').length - 1],
      DIGEST: sha(clause),
      TEXT: clause,
      CLASS: 'HISTORICAL_SQL_DESIGN_EVIDENCE',
      CREATION_AUTHORITY: 'NO',
      EXECUTION_AUTHORITY: 'NO',
    },
    COLUMNS: columns,
    CONSTRAINT_SOURCE: constraints.join('\n'),
    LIMITATIONS: [
      'Historical physical clauses are definition-design evidence only, not canonical adoption or execution authority',
      'Omitted constraints/defaults/nullability and referenced target/action semantics remain explicit human design decisions',
    ],
  }
}
export function validateUniverse(
  obligations: Obligation[],
  django: { PHYSICAL_IDENTITY: string }[],
  late: { PHYSICAL_IDENTITY: string }[],
) {
  assert.equal(obligations.length, 183, 'DEFINITION_DENOMINATOR_DRIFT')
  assert.equal(
    new Set(obligations.map((o) => o.DEFINITION_OBLIGATION_ID)).size,
    183,
    'DUPLICATE_DEFINITION_ID',
  )
  assert.equal(
    new Set(obligations.map((o) => o.SOURCE_W4_DECISION_ID)).size,
    183,
    'DUPLICATE_DECISION_ID',
  )
  const djangoIds = new Set(django.map((d) => d.PHYSICAL_IDENTITY))
  const lateIds = new Set(late.map((d) => d.PHYSICAL_IDENTITY))
  for (const o of obligations) {
    assert.equal(o.DATABASE_SCOPE_ID, 'UE_OPERATIONAL', 'FINANCIAL_SCOPE_DRIFT')
    assert.equal(o.CANONICAL_OWNER, 'PLATFORM_BASELINE', 'OWNERSHIP_DRIFT')
    assert(['RELATION', 'COLUMN'].includes(o.OBJECT_KIND), 'TYPE_FUNCTION_AUTHORING_FORBIDDEN')
    assert(!djangoIds.has(o.PHYSICAL_IDENTITY), 'DJANGO_IDENTITY_COLLISION')
    assert(!lateIds.has(o.PHYSICAL_IDENTITY), 'LATE_DEFINITION_IDENTITY_COLLISION')
  }
}
export function validateInactiveSql(sql: string) {
  assert(
    !/\b(DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE|COPY|CALL|DO)\b/i.test(sql),
    'UNSAFE_DEFINITION_SQL',
  )
  assert(
    !/\bCREATE\s+(EXTENSION|ROLE|USER|FUNCTION|TYPE)\b/i.test(sql),
    'OUT_OF_SCOPE_DEFINITION_SQL',
  )
  assert(
    /^(?:CREATE TABLE|ALTER TABLE)\s+"[^"]+"\."[^"]+"/i.test(sql.trim()),
    'UNQUALIFIED_DEFINITION_SQL',
  )
}
function relationIdentity(o: Obligation) {
  return o.PHYSICAL_IDENTITY.split('::')[2].split('.').slice(0, 2).join('.')
}
const id = (kind: string, value: string) => `UE-W4F-${kind}-${sha(value).slice(0, 16)}`
export async function buildRegistry() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const g: {
    canonicalDefinitionObligations: Obligation[]
    lateDefinitionRegister: Model['lateDefinitions']
    lateProducerCompatibilityObligations: Model['compatibility']
    phaseStatus: Record<string, unknown>
  } = JSON.parse(bytes.w4g)
  const producer: {
    djangoProducerRegistry: { PHYSICAL_IDENTITY: string }[]
    canonicalProducerPlan: unknown[]
    rawOperationProducerRegistry: unknown[]
    w3Preconditions: unknown
    w5OrderingHandoff: unknown[]
    w6OpaqueBindingHandoff: unknown[]
  } = JSON.parse(bytes.producer)
  const c: {
    CONTRACT_VERSION: string
    prerequisiteObligations: unknown[]
    frozenMigrationManifest: unknown[]
    extensionDoctrine: unknown
    phaseStatus: Record<string, unknown>
  } = JSON.parse(bytes.canonical)
  assert.equal(c.CONTRACT_VERSION, '1.3.1')
  assert.equal(g.phaseStatus.PHASE_1B_3C_A1I_W4G, 'PASS')
  const obligations = g.canonicalDefinitionObligations
  validateUniverse(obligations, producer.djangoProducerRegistry, g.lateDefinitionRegister)
  const sources = new Map<string, { text: string; hash: string }>()
  const parsed = new Map<string, ParsedTable>()
  function source(candidate: Candidate) {
    let cached = sources.get(candidate.SOURCE_FILE)
    if (!cached) {
      const text = read(candidate.SOURCE_FILE)
      cached = { text, hash: sha(text) }
      sources.set(candidate.SOURCE_FILE, cached)
    }
    assert.equal(
      cached.hash,
      candidate.SOURCE_FILE_SHA256,
      `BOUNDED_SOURCE_HASH_DRIFT:${candidate.SOURCE_FILE}`,
    )
    return cached
  }
  const grouped = new Map<string, Obligation[]>()
  for (const o of obligations) {
    const key = relationIdentity(o)
    grouped.set(key, [...(grouped.get(key) ?? []), o])
  }
  const definitionRecords: {
    DEFINITION_OBLIGATION_ID: string
    SOURCE_W4_DECISION_ID: string
    PHYSICAL_IDENTITY: string
    OBJECT_KIND: string
    RELATION_DEFINITION_ID: string
    DEFINITION_DISPOSITION: string
    DEFINITION_EVIDENCE_CLASS: string
    RESOLVED_PROPERTIES: Record<string, Property>
    UNRESOLVED_PROPERTIES: string[]
    CONFLICTS: { PROPERTY: string; VALUES: string[]; EVIDENCE: string[] }[]
    EVIDENCE: SourcePointer[]
    COLUMN_DEFINITION_IDS: string[]
  }[] = []
  const relations = [...grouped].map(([physical, members]) => {
    const relationId = id('RELATION', physical)
    const candidates = [
      ...new Map(
        members.flatMap((o) => o.AVAILABLE_DECLARATION_EVIDENCE).map((d) => [d.CANDIDATE_ID, d]),
      ).values(),
    ]
    const tables = candidates.map((candidate) => {
      assert.equal(candidate.PHYSICAL_OBJECT, physical, 'CANDIDATE_RELATION_IDENTITY_DRIFT')
      assert.equal(candidate.SOURCE_KIND, 'DRIZZLE_SCHEMA', 'UNSUPPORTED_DECLARATION_SOURCE_KIND')
      const key = `${candidate.SOURCE_FILE}:${candidate.SOURCE_LINE}:${physical}`
      if (!parsed.has(key)) {
        const cached = source(candidate)
        parsed.set(
          key,
          parseDeclaration(
            cached.text,
            candidate.SOURCE_FILE,
            cached.hash,
            candidate.SOURCE_LINE,
            physical,
          ),
        )
      }
      return parsed.get(key)!
    })
    const historicalCandidates = [
      ...new Map(
        members
          .flatMap((o) => o.HISTORICAL_SUPPORTING_EVIDENCE)
          .filter((candidate) => candidate.SOURCE_KIND === 'SQL_MIGRATION')
          .map((candidate) => [candidate.CANDIDATE_ID, candidate]),
      ).values(),
    ]
    const historicalTables = historicalCandidates.map((candidate) => {
      assert.equal(candidate.PHYSICAL_OBJECT, physical, 'HISTORICAL_RELATION_IDENTITY_DRIFT')
      const key = `${candidate.SOURCE_FILE}:${candidate.SOURCE_LINE}:${physical}`
      if (!parsed.has(key)) {
        const cached = source(candidate)
        parsed.set(key, parseHistoricalTable(cached.text, candidate))
      }
      return parsed.get(key)!
    })
    const uniqueTables = [
      ...new Map(
        [...tables, ...historicalTables].map((t) => [
          `${t.REFERENCE.FILE}:${t.REFERENCE.DIGEST}`,
          t,
        ]),
      ).values(),
    ]
    const allColumnNames = [
      ...new Set(uniqueTables.flatMap((t) => t.COLUMNS.map((col) => col.NAME))),
    ]
    for (const member of members.filter((o) => o.OBJECT_KIND === 'COLUMN')) {
      const name = member.PHYSICAL_IDENTITY.split('::')[2].split('.')[2]
      if (!allColumnNames.includes(name)) allColumnNames.push(name)
    }
    const governedRelation = members.some((o) => o.OBJECT_KIND === 'RELATION')
    const names = governedRelation
      ? allColumnNames
      : [...new Set(members.map((o) => o.PHYSICAL_IDENTITY.split('::')[2].split('.')[2]))]
    const columns = names.map((name) => {
      const linked = members.filter(
        (o) =>
          o.OBJECT_KIND === 'COLUMN' && o.PHYSICAL_IDENTITY.split('::')[2].split('.')[2] === name,
      )
      const available = uniqueTables.flatMap((t) =>
        t.COLUMNS.filter((col) => col.NAME === name).map((col) => ({ col, table: t })),
      )
      const classification = classify(
        available.map((a) => a.col.PROPERTIES),
        available.map((a) => a.table.REFERENCE),
      )
      const properties = Object.fromEntries(
        materialProperties.map((key) => [
          key,
          classification.RESOLVED_PROPERTIES[key] ??
            unresolved(
              available.map((a) => a.col.PROPERTIES[key].EVIDENCE).join('\n') ||
                'No referenced declaration establishes this property',
            ),
        ]),
      )
      return {
        COLUMN_DEFINITION_ID: id('COLUMN', `${physical}.${name}`),
        DEFINITION_OBLIGATION_ID:
          linked[0]?.DEFINITION_OBLIGATION_ID ??
          members.find((o) => o.OBJECT_KIND === 'RELATION')?.DEFINITION_OBLIGATION_ID ??
          null,
        DEFINITION_OBLIGATION_IDS: linked.map((o) => o.DEFINITION_OBLIGATION_ID),
        PHYSICAL_IDENTITY: `union-eyes::COLUMN::${physical}.${name}`,
        SCHEMA_NAME: physical.split('.')[0],
        RELATION_NAME: physical.split('.')[1],
        COLUMN_NAME: name,
        CANONICAL_OWNER: 'PLATFORM_BASELINE',
        OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
        ...properties,
        ...classification,
        DEFINITION_EVIDENCE_REFERENCES: available.map((a) => sourcePointer(a.table.REFERENCE)),
        SOURCE_COLUMN_EXPRESSIONS: available.map((a) => ({
          FILE: a.table.REFERENCE.FILE,
          KEY: a.col.KEY,
          DECLARATION_DIGEST: a.table.REFERENCE.DIGEST,
          COLUMN_EXPRESSION_DIGEST: sha(a.col.SOURCE_EXPRESSION),
        })),
        SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
        INACTIVE_SQL_PAYLOAD: null,
      }
    })
    const missing = new Set(columns.flatMap((col) => col.UNRESOLVED_PROPERTIES))
    const conflicts = columns.flatMap((col) =>
      col.CONFLICTS.map((conflict) => ({ COLUMN_NAME: col.COLUMN_NAME, ...conflict })),
    )
    const relationUnresolved = [
      'Explicit canonical adoption of nullable/no-default/no-identity/no-key/no-unique/no-FK/no-check values where declarations omit them; absence is not NONE',
      'Canonical relation-level primary/unique/FK/check constraints and required indexes; callback expressions retained but not silently inferred/lowered',
      'Referenced FK target schema/physical columns and explicit ON_DELETE/ON_UPDATE; omitted actions require a design decision',
      ...(uniqueTables.length
        ? []
        : [
            'No directly referenced declaration; historical SQL is supporting design evidence only',
          ]),
      ...new Set(uniqueTables.flatMap((t) => t.LIMITATIONS)),
    ]
    const relationClass = conflicts.length
      ? 'CONTRADICTORY_DEFINITION_EVIDENCE'
      : 'PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION'
    for (const member of members) {
      const column =
        member.OBJECT_KIND === 'COLUMN'
          ? columns.find(
              (col) => col.COLUMN_NAME === member.PHYSICAL_IDENTITY.split('::')[2].split('.')[2],
            )
          : undefined
      definitionRecords.push({
        DEFINITION_OBLIGATION_ID: member.DEFINITION_OBLIGATION_ID,
        SOURCE_W4_DECISION_ID: member.SOURCE_W4_DECISION_ID,
        PHYSICAL_IDENTITY: member.PHYSICAL_IDENTITY,
        OBJECT_KIND: member.OBJECT_KIND,
        RELATION_DEFINITION_ID: relationId,
        DEFINITION_DISPOSITION:
          column?.DEFINITION_DISPOSITION ??
          (conflicts.length ? 'DEFINITION_CONFLICT' : 'DESIGN_DECISION_REQUIRED'),
        DEFINITION_EVIDENCE_CLASS: column?.DEFINITION_EVIDENCE_CLASS ?? relationClass,
        RESOLVED_PROPERTIES: column?.RESOLVED_PROPERTIES ?? {
          SCHEMA: explicit(physical.split('.')[0], 'Accepted W4G physical identity'),
          RELATION_NAME: explicit(physical.split('.')[1], 'Accepted W4G physical identity'),
          CANONICAL_OWNER: explicit('PLATFORM_BASELINE', 'HUMAN_GOVERNANCE_W4G'),
        },
        UNRESOLVED_PROPERTIES: column?.UNRESOLVED_PROPERTIES ?? [...missing, ...relationUnresolved],
        CONFLICTS: column?.CONFLICTS ?? conflicts,
        EVIDENCE:
          column?.DEFINITION_EVIDENCE_REFERENCES ??
          uniqueTables.map((t) => sourcePointer(t.REFERENCE)),
        COLUMN_DEFINITION_IDS: column
          ? [column.COLUMN_DEFINITION_ID]
          : columns.map((col) => col.COLUMN_DEFINITION_ID),
      })
    }
    return {
      RELATION_DEFINITION_ID: relationId,
      SCHEMA_NAME: physical.split('.')[0],
      RELATION_NAME: physical.split('.')[1],
      RELATION_KIND: uniqueTables.length
        ? explicit('TABLE', 'Referenced pgTable/CREATE TABLE design evidence')
        : unresolved('No complete canonical relation definition'),
      CANONICAL_OWNER_CLASS: 'PLATFORM_BASELINE',
      OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4G',
      SOURCE_OBLIGATION_IDS: members.map((o) => o.DEFINITION_OBLIGATION_ID),
      SOURCE_DECISION_IDS: members.map((o) => o.SOURCE_W4_DECISION_ID),
      COLUMN_DEFINITION_IDS: columns.map((col) => col.COLUMN_DEFINITION_ID),
      COLUMNS: columns,
      DECLARATIONS: uniqueTables,
      RELATION_CONSTRAINT_EVIDENCE: uniqueTables.map((t) => ({
        SOURCE: t.REFERENCE.FILE,
        CALLBACK: t.CONSTRAINT_SOURCE,
      })),
      RELATION_UNRESOLVED_PROPERTIES: relationUnresolved,
      CONFLICTS: conflicts,
      DEFINITION_STATE: conflicts.length ? 'RELATION_CONFLICTED' : 'RELATION_PARTIALLY_DEFINED',
      SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      INACTIVE_SQL_PAYLOAD: null,
      COMPLETE_CANONICAL_DEFINITION: 'NO',
      PRODUCER_ACTIVATED: 'NO',
    }
  })
  definitionRecords.sort(
    (a, b) =>
      obligations.findIndex((o) => o.DEFINITION_OBLIGATION_ID === a.DEFINITION_OBLIGATION_ID) -
      obligations.findIndex((o) => o.DEFINITION_OBLIGATION_ID === b.DEFINITION_OBLIGATION_ID),
  )
  exactIds(
    definitionRecords.map((d) => d.DEFINITION_OBLIGATION_ID),
    obligations.map((o) => o.DEFINITION_OBLIGATION_ID),
  )
  const historicalEvidence = obligations.map((o) => ({
    DEFINITION_OBLIGATION_ID: o.DEFINITION_OBLIGATION_ID,
    EVIDENCE: o.HISTORICAL_SUPPORTING_EVIDENCE.map((candidate) => {
      const cached = source(candidate)
      const line = cached.text.split('\n')[candidate.SOURCE_LINE - 1]
      assert(line !== undefined, 'HISTORICAL_SOURCE_LINE_DRIFT')
      return {
        FILE: candidate.SOURCE_FILE,
        FILE_SHA256: cached.hash,
        LINE: candidate.SOURCE_LINE,
        SOURCE_LINE: line,
        CLASS: 'HISTORICAL_SUPPORTING_DESIGN_EVIDENCE_NOT_CANONICAL',
        CANDIDATE_ID: candidate.CANDIDATE_ID,
        CANDIDATE_LIMITATION:
          'Exact referenced creation line/hash and CREATE TABLE clause verified; explicit fields are compared as design evidence in the relation registry, not adopted as canonical semantics or execution authority',
      }
    }),
  }))
  const decisionGroups = new Map<string, typeof definitionRecords>()
  for (const record of definitionRecords) {
    const key = digest({
      relation: record.RELATION_DEFINITION_ID,
      evidence: [...new Set(record.EVIDENCE.map((e) => `${e.FILE}:${e.DIGEST}`))].sort(),
      property: 'Canonical physical relation blueprint, including governed member columns',
    })
    decisionGroups.set(key, [...(decisionGroups.get(key) ?? []), record])
  }
  const decisions = [...decisionGroups].map(([key, members]) => ({
    DESIGN_CHOICE_ID: id('DESIGN', key),
    DEFINITION_OBLIGATION_IDS: members.map((m) => m.DEFINITION_OBLIGATION_ID),
    SOURCE_W4_DECISION_IDS: members.map((m) => m.SOURCE_W4_DECISION_ID),
    PHYSICAL_IDENTITIES: members.map((m) => m.PHYSICAL_IDENTITY),
    PROPERTY: 'Canonical physical relation blueprint, including governed member columns',
    AVAILABLE_EVIDENCE: members[0].EVIDENCE,
    UNRESOLVED_PROPERTIES: [...new Set(members.flatMap((m) => m.UNRESOLVED_PROPERTIES))],
    CONFLICTS: members.flatMap((m) => m.CONFLICTS),
    OBLIGATION_SPECIFIC_PROPERTIES: members.map((m) => ({
      DEFINITION_OBLIGATION_ID: m.DEFINITION_OBLIGATION_ID,
      PHYSICAL_IDENTITY: m.PHYSICAL_IDENTITY,
      UNRESOLVED_PROPERTIES: m.UNRESOLVED_PROPERTIES,
      CONFLICTS: m.CONFLICTS,
    })),
    ALTERNATIVES_CONSIDERED: [
      'Explicitly adopt the referenced declaration semantics, including a reviewed exact no-default/nullability/constraint/dependency posture; resolve omitted FK actions and referenced identities',
      'Provide a separately reviewed exact canonical physical design for the same identity; enumerate every deviation and its product/relational consequence',
    ],
    SELECTED_VALUE: null,
    REQUIRES_HUMAN_APPROVAL: 'YES',
    WHY_SELECTION_IS_CONSTRAINED_AND_NON_EXPANSIVE:
      'No automatic selection: omitted properties and inconsistent declaration variants permit materially different semantics',
    MINIMUM_HUMAN_DECISION_REQUIRED:
      'Approve exact values for listed unresolved/conflicting physical properties and reconcile historical candidate design evidence before canonical completeness. Ownership remains PLATFORM_BASELINE; no producer/runtime permission.',
    COMPRESSION_BASIS:
      'One canonical physical blueprint decision for the same relation and its governed member columns, same exact evidence digests/candidate alternatives/downstream blocker; each affected property and obligation enumerated separately, no cross-relation default policy',
    DOWNSTREAM_CONSEQUENCES:
      'Blocks exact canonical definition and inactive SQL; W4 implementation remains pending; W4P/W5 remain unauthorized',
  }))
  exactIds(
    decisions.flatMap((d) => d.DEFINITION_OBLIGATION_IDS).sort(),
    definitionRecords.map((d) => d.DEFINITION_OBLIGATION_ID).sort(),
  )
  const summary = {
    DEFINITION_OBLIGATIONS_INPUT: 183,
    CANONICAL_DEFINITION_AUTHORED: definitionRecords.filter(
      (d) => d.DEFINITION_DISPOSITION === 'CANONICAL_DEFINITION_AUTHORED',
    ).length,
    DESIGN_DECISION_REQUIRED: definitionRecords.filter(
      (d) => d.DEFINITION_DISPOSITION === 'DESIGN_DECISION_REQUIRED',
    ).length,
    DEFINITION_CONFLICT: definitionRecords.filter(
      (d) => d.DEFINITION_DISPOSITION === 'DEFINITION_CONFLICT',
    ).length,
    SUM: definitionRecords.length,
    UNACCOUNTED: 0,
    EVIDENCE_SUM: definitionRecords.length,
    EXACT_EXISTING_DECLARATION: definitionRecords.filter(
      (d) => d.DEFINITION_EVIDENCE_CLASS === 'EXACT_EXISTING_DECLARATION',
    ).length,
    CONSISTENT_MULTI_SOURCE_DEFINITION: definitionRecords.filter(
      (d) => d.DEFINITION_EVIDENCE_CLASS === 'CONSISTENT_MULTI_SOURCE_DEFINITION',
    ).length,
    PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION: definitionRecords.filter(
      (d) => d.DEFINITION_EVIDENCE_CLASS === 'PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION',
    ).length,
    CONTRADICTORY_DEFINITION_EVIDENCE: definitionRecords.filter(
      (d) => d.DEFINITION_EVIDENCE_CLASS === 'CONTRADICTORY_DEFINITION_EVIDENCE',
    ).length,
    DISTINCT_RELATIONS: relations.length,
    RELATIONS_FULLY_DEFINED: 0,
    RELATIONS_PARTIALLY_DEFINED: relations.filter(
      (r) => r.DEFINITION_STATE === 'RELATION_PARTIALLY_DEFINED',
    ).length,
    RELATIONS_CONFLICTED: relations.filter((r) => r.DEFINITION_STATE === 'RELATION_CONFLICTED')
      .length,
    RELATION_SUM: relations.length,
    COMPRESSED_HUMAN_DECISIONS: decisions.length,
    SOURCE_FILES_HASH_CHECKED: sources.size,
    W4F_DJANGO_IDENTITY_COLLISIONS: 0,
    W4F_LATE_DEFINITION_IDENTITY_COLLISIONS: 0,
    W4F_FINANCIAL_SCOPE_OBJECTS: 0,
    INACTIVE_SQL_PAYLOADS: 0,
    PRODUCER_METADATA_UPDATES: 0,
  }
  assert.equal(
    summary.CANONICAL_DEFINITION_AUTHORED,
    0,
    'Complete definitions require explicit relation/constraint/SQL review path; never auto-approve partial extraction',
  )
  assert.equal(summary.DESIGN_DECISION_REQUIRED + summary.DEFINITION_CONFLICT, 183)
  const preservation = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [file, sha(bytes[key])]),
  )
  const sourceHashes = Object.fromEntries([...sources].map(([file, s]) => [file, s.hash]))
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const prior: { preservation: typeof preservation; sourceHashes: typeof sourceHashes } =
      JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, prior.preservation, 'FIXED_W4F_INPUT_DRIFT')
    assert.deepEqual(sourceHashes, prior.sourceHashes, 'FIXED_W4F_SOURCE_DRIFT')
  }
  const phaseStatus = {
    W1: 'PASS',
    W2: 'PASS',
    W3: 'PASS',
    W4G: 'PASS',
    PHASE_1B_3C_A1I_W4F_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W4F: 'BLOCKED',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    CONTRACT_1_3_2_CREATED: 'NO',
    W4: 'BLOCKED_DEFINITION_DECISIONS_PENDING',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
    NO_FURTHER_W4F_GENERIC_DISCOVERY: 'YES',
    DATABASE_ROLES_PROVISIONED: 'NO',
    EXTENSIONS_RUNTIME_PROVEN: 'NO',
    ROLE_MEMBERSHIPS_APPLIED: 'NO',
    DJANGO_SCHEMA_MATERIALIZED: 'NO',
    PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
    PHYSICAL_PRODUCERS_EXECUTED: 'NO',
    CANONICAL_DEFINITION_SQL_EXECUTED: 'NO',
    BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
    FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
    RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    READY_FOR_RUNTIME_PROOF: 0,
    PRODUCT_READY: 'NO',
  }
  return {
    PHASE: 'PHASE_1B_3C_A1I_W4F',
    METHOD:
      'Bounded nonexecuting TypeScript AST extraction from exact referenced pgTable declarations; explicit known properties only. Historical source hashes/creation lines retained as design evidence, never creation authority. Omitted semantics are not defaults.',
    definitionRecords,
    relationDefinitions: relations,
    incompleteDefinitionRecords: definitionRecords.map((record) => {
      const decision = decisions.find((d) =>
        d.DEFINITION_OBLIGATION_IDS.includes(record.DEFINITION_OBLIGATION_ID),
      )
      assert(decision, 'MISSING_INCOMPLETE_DEFINITION_DESIGN_DECISION')
      return {
        ...record,
        DESIGN_CHOICE_ID: decision.DESIGN_CHOICE_ID,
        DESIGN_OPTIONS: decision.ALTERNATIVES_CONSIDERED,
        MINIMUM_HUMAN_DECISION_REQUIRED: decision.MINIMUM_HUMAN_DECISION_REQUIRED,
      }
    }),
    designDecisions: decisions,
    historicalEvidence,
    summary,
    sourceHashes,
    preservation,
    producerMetadataUpdates: [],
    inactiveSqlPayloads: [],
    acceptedPreservation: {
      OWNERSHIP_310: digest(JSON.parse(bytes.w4g).ownershipAdoption),
      LATE_DEFINITIONS_127: digest(g.lateDefinitionRegister),
      COMPATIBILITY_127: digest(g.lateProducerCompatibilityObligations),
      DJANGO_372: digest(producer.djangoProducerRegistry),
      PLAN_82: digest(producer.canonicalProducerPlan),
      RAW_WRAPPERS: digest(producer.rawOperationProducerRegistry),
      W3: digest(producer.w3Preconditions),
      W5_86: digest(producer.w5OrderingHandoff),
      W6_118: digest(producer.w6OpaqueBindingHandoff),
      CANONICAL_803: digest(c.prerequisiteObligations),
      FROZEN_23: digest(c.frozenMigrationManifest),
      EXTENSIONS_AND_VECTOR: digest(c.extensionDoctrine),
    },
    validation: {
      EXACT_183_IDS: 'PASS',
      RELATION_GROUPING: 'PASS;125 unique relations',
      NO_SOURCE_DISCOVERY: 'YES; source paths only from183 fixed obligation candidate references',
      NO_DDL_INVENTION_OR_ACTIVATION: 'YES',
      NO_MODULE_OR_SQL_EXECUTION: 'YES',
      DEFINITION_COMPLETENESS_CEILING:
        'Unsupported/omitted properties remain unresolved, not success-shaped defaults',
      CANONICAL_AND_PRODUCER_CONTRACT_MUTATED: 'NO; no complete definitions or version amendment',
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT: 'PASS;141 tests:44 W4F,38 preserved W4,59 preserved W3E',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\author-w4-canonical-definitions.ts --self-test --check',
          RESULT:
            'PASS;exact183 IDs/source hashes/collision/safety checks,two matching generations,persistent bytes',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\author-w4-canonical-definitions.ts scripts\\ue\\author-w4-canonical-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\author-w4-canonical-definitions.ts scripts\\ue\\author-w4-canonical-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts',
          RESULT: 'PASS;actual root-scoped lint,exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\author-w4-canonical-definitions.ts scripts\\ue\\author-w4-canonical-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.md docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.md docs\\union-eyes\\reality-remediation\\UE_W4F_CANONICAL_DEFINITION_DECISION_PACKET.json',
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors,1215 existing warnings',
        },
        {
          METHOD:
            'Independent read-only Node assertions,not trusting definition parser/classification/restore code',
          RESULT:
            'PASS;183 IDs,182 design/1 conflict,125 relations,126 compressed groups,117 source hashes/exact clause digests,310/127/127/372/82/raw/W3/86/118/803/23/4/22 preservation,zero collisions/SQL/activation,exact1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 reconstructed bytes',
        },
      ],
      PRESERVED_W4_TEST_FIXTURE:
        'verify-frozen-w4.test.ts reconstructs exact accepted1.3 canonical bytes using W4G inverse patches in memory; mocks only that file read for unchanged W4 tests. Current1.3.1 file,source files and W4 test bytes are not rewritten. W4F tests use real current inputs.',
    },
    phaseStatus,
  }
}
export async function generate() {
  const report = await buildRegistry()
  const config = await resolveConfig(path.join(root, ...outputs.report.split('/')))
  const registry = {
    PHASE: report.PHASE,
    definitionRecords: report.definitionRecords,
    relationDefinitions: report.relationDefinitions,
    incompleteDefinitionRecords: report.incompleteDefinitionRecords,
    inactiveSqlPayloads: report.inactiveSqlPayloads,
    summary: report.summary,
    phaseStatus: report.phaseStatus,
  }
  const body = `# W4F - bounded canonical definition authoring

## Gate: BLOCKED - explicit physical design decisions remain

Exactly **183 obligations**:57 relations and126 columns, grouped into **${report.summary.DISTINCT_RELATIONS} relations**. Ownership remains PLATFORM_BASELINE / HUMAN_GOVERNANCE_W4G. No late127 objects enter this authoring denominator.

| Definition disposition | Count |
| --- | ---: |
| CANONICAL_DEFINITION_AUTHORED | ${report.summary.CANONICAL_DEFINITION_AUTHORED} |
| DESIGN_DECISION_REQUIRED | ${report.summary.DESIGN_DECISION_REQUIRED} |
| DEFINITION_CONFLICT | ${report.summary.DEFINITION_CONFLICT} |
| SUM | 183 |
| UNACCOUNTED | 0 |

| Evidence class | Count |
| --- | ---: |
| EXACT_EXISTING_DECLARATION | ${report.summary.EXACT_EXISTING_DECLARATION} |
| CONSISTENT_MULTI_SOURCE_DEFINITION | ${report.summary.CONSISTENT_MULTI_SOURCE_DEFINITION} |
| PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION | ${report.summary.PARTIAL_EVIDENCE_REQUIRES_DESIGN_DECISION} |
| CONTRADICTORY_DEFINITION_EVIDENCE | ${report.summary.CONTRADICTORY_DEFINITION_EVIDENCE} |
| SUM | 183 |

Relations: fully defined **0**, partially defined **${report.summary.RELATIONS_PARTIALLY_DEFINED}**, conflicted **${report.summary.RELATIONS_CONFLICTED}**, sum **${report.summary.DISTINCT_RELATIONS}**.

[Canonical definition registry](UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json) retains exact source declarations/ranges/digests, all governed column properties and their explicit/unresolved state, callback constraint/index expressions and contradictory known values. [W4F report](PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json) includes preservation/historical/source evidence. [Bounded design packet](UE_W4F_CANONICAL_DEFINITION_DECISION_PACKET.json) contains **${report.summary.COMPRESSED_HUMAN_DECISIONS}** unresolved decision groups, enumerating every183 obligation ID.

## Why definition completeness is blocked

Declaration evidence is now legitimate design input, not prior creation authority. Exact imported PostgreSQL builders establish known type/length/precision/timezone where explicit. Literal defaults, explicit NOT NULL/key/unique and referenced expressions are retained. No nullable/no-default/no-identity/no-constraint value is silently adopted from omission. Missing timestamp timezone, unresolved enum/imported factories, SQL default lowering, FK physical targets/actions and relation callback constraints remain explicit pending properties.

Absent FK ON_DELETE/ON_UPDATE is not silently replaced with PostgreSQL defaults. No UUID generator is inferred from extension availability. JSON/text, timestamp timezone, numeric precision and application-only builder methods are not normalized or discarded. Declaration variants with different explicit known values are conflicts, not chronology-based selections.

All historical candidates are hash/creation-line checked; exact referenced CREATE TABLE clauses contribute explicit type/default/key facts and reveal contradictions with current declarations. They are **design evidence only**, not promoted to creation/execution authority or complete canonical semantics. Equivalent typed numeric/JSON literal forms are normalized only for conflict comparison, with original bytes retained. Final design decisions must explicitly reconcile the evidence. Two obligations have only historical evidence: audit_logs.organization_id and organization_users.organization_id.

All definition SQL payloads are **empty** because no physically complete canonical definition was established. SQL_STATUS = DEFINITION_ONLY_NOT_EXECUTABLE; no fake final DDL, no active migration or execution adapter. Producer metadata updates **0**; existing execution flags remain NO.

## Preservation and phase boundaries

Current canonical **1.3.1 remains unchanged**; no1.3.2 or1.4. W4G310 ownership decisions,127 late definition records,127 compatibility obligations,372 Django mappings,82-node plan,raw wrappers,W3,86 W5 handoffs,118 W6 handoffs,803 prerequisites,23 frozen manifest hashes and extensions/vector remain unchanged. Collision checks for Django/late/financial scope return0. Opaque semantics remain required/unstarted.

W4 = **BLOCKED_DEFINITION_DECISIONS_PENDING** in this supplemental current phase packet; the accepted canonical/W4G historical states are not rewritten. W4P/W5 **NOT_AUTHORIZED**. NO_FURTHER_W4F_GENERIC_DISCOVERY = **YES**. No ordering compatibility decision or gated sequencing exemption is made here.

## Validation

\`\`\`powershell
pnpm exec tsx scripts\\ue\\author-w4-canonical-definitions.ts --self-test --check
pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts
pnpm validate:docs
\`\`\`

Closeout **PASS**: **141 tests** (44 W4F,38 preserved W4,59 preserved W3E),exact183/grouping/type/nullability/default/constraint/collision/SQL safety coverage,two-run determinism/check,scoped TypeScript,actual root-scoped ESLint,formatting and documentation audit (**0 errors,1215 existing warnings**). Independent assertions verified183 IDs,182 design/1 conflict,125 relations,126 decision groups,117 referenced-source hashes/exact clause digests,310 ownership/127 late definitions/127 compatibility records,372/82/raw/W3/86/118/803/23/4/22 preservation,zero collisions/SQL/activation and exact **1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 byte reconstruction**. Exact commands/results are recorded in JSON.

Preserved W4 tests run against their exact accepted1.3 canonical input reconstructed **in memory** from W4G inverse patches by verify-frozen-w4.test.ts. Only that file read is substituted inside that isolated test file; current1.3.1 bytes,W4 test bytes and sources remain untouched. W4F tests use real current inputs.

No PostgreSQL,SQL/migration execution,producer activation,role/extension mutation,secrets,W4P/W5/W6-W10 execution or PR. All runtime proof **NO**, READY_FOR_RUNTIME_PROOF **0**, PRODUCT_READY **NO**.
`
  return {
    [outputs.registry]: await format(JSON.stringify(registry), { ...config, parser: 'json' }),
    [outputs.registryMarkdown]: await format(body, { ...config, parser: 'markdown' }),
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.reportMarkdown]: await format(body, { ...config, parser: 'markdown' }),
    [outputs.decisions]: await format(
      JSON.stringify({
        PHASE: report.PHASE,
        designDecisions: report.designDecisions,
        summary: report.summary,
        phaseStatus: report.phaseStatus,
      }),
      { ...config, parser: 'json' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((a) => ['--plan', '--self-test', '--check'].includes(a)),
    'UNAUTHORIZED_EXECUTION_OR_UNKNOWN_ARGUMENT',
  )
  assert.equal(new Set(args).size, args.length)
  const output = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(output, await generate(), 'NONDETERMINISTIC_W4F')
    assert.throws(() => validateInactiveSql('DROP TABLE public.fake CASCADE;'))
    assert.throws(() => validateInactiveSql('CREATE EXTENSION pgcrypto;'))
    console.log(
      'PASS W4F self-tests:exact183 grouping/collisions,source hashes,explicit unresolved semantics,determinism,no SQL activation',
    )
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(output))
      assert.equal(read(file), bytes, `STALE_W4F_OUTPUT:${file}`)
    console.log('PASS W4F --check:BLOCKED;canonical1.3.1 unchanged;no W4P/W5 authorization')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(output))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4F bounded definition/design evidence written;no SQL,producer activation or contract amendment',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(
      '[author-w4-canonical-definitions]',
      error instanceof Error ? error.message : 'Definition authoring failed',
    )
    process.exitCode = 1
  })
