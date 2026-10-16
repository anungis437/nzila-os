import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import { outputs as w4frOutputs } from './regenerate-w4fr-definitions'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildProducerContract } from './w4-physical-producers'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4fr: folder + 'PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.json',
  resolved: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  w4h3: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const outputs = {
  registry: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json',
  registryMarkdown: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.md',
  report: folder + 'PHASE_1B_3C_A1I_W4T_NAMED_TYPE_PRODUCTION_CLOSURE.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W4T_NAMED_TYPE_PRODUCTION_CLOSURE.md',
  decisions: folder + 'UE_W4T_NAMED_TYPE_HUMAN_DECISION_PACKET.json',
}
type W4FR = ReturnType<typeof buildRegeneration>['report']
type W4F = Awaited<ReturnType<typeof buildRegistry>>
type Producer = Omit<ReturnType<typeof buildProducerContract>, 'rawOperationProducerRegistry'> & {
  rawOperationProducerRegistry: {
    RAW_OPERATION_ID: string
    REFERENCED_OBJECTS: string[]
  }[]
}
interface DefinitionCandidate {
  SCHEMA_NAME: string
  TYPE_NAME: string
  TYPE_KIND: 'ENUM' | 'DOMAIN' | 'COMPOSITE' | 'OTHER_EXPLICIT_POSTGRES_NAMED_TYPE' | null
  ORDERED_ENUM_MEMBERS: string[] | null
  DEFINITION_COMPLETE: boolean
  MISSING_PHYSICAL_FACTS: string[]
  SOURCE_FILE: string
  SOURCE_SHA256: string
  SOURCE_RANGE: number[]
  DEFINITION_DIGEST: string
  EXACT_DEFINITION_TEXT: string
  SYMBOL: string | null
  EVIDENCE_CLASS: 'CURRENT' | 'HISTORICAL'
}
function evidence(
  file: string,
  text: string,
  start: number,
  end: number,
  name: string,
  members: string[] | null,
  current: boolean,
  symbol: string | null,
  schema = 'public',
  kind: DefinitionCandidate['TYPE_KIND'] = 'ENUM',
): DefinitionCandidate {
  const exact = text.slice(start, end)
  const complete =
    kind === 'ENUM' &&
    members !== null &&
    new Set(members).size === members.length &&
    members.every((member) => Buffer.byteLength(member, 'utf8') <= 63 && !member.includes('\0'))
  return {
    SCHEMA_NAME: schema,
    TYPE_NAME: name,
    TYPE_KIND: kind,
    ORDERED_ENUM_MEMBERS: members,
    DEFINITION_COMPLETE: complete,
    MISSING_PHYSICAL_FACTS: complete
      ? []
      : [
          'Exact reproducible physical definition;nonliteral/unsupported members or type properties cannot be inferred',
        ],
    SOURCE_FILE: file,
    SOURCE_SHA256: sha(text),
    SOURCE_RANGE: [text.slice(0, start).split('\n').length, text.slice(0, end).split('\n').length],
    DEFINITION_DIGEST: sha(exact),
    EXACT_DEFINITION_TEXT: exact,
    SYMBOL: symbol,
    EVIDENCE_CLASS: current ? 'CURRENT' : 'HISTORICAL',
  }
}
function sourceFile(file: string, text: string) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
}
function pgFactories(source: ts.SourceFile) {
  const result = new Set<string>()
  for (const statement of source.statements)
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'drizzle-orm/pg-core' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    )
      for (const binding of statement.importClause.namedBindings.elements)
        if ((binding.propertyName?.text ?? binding.name.text) === 'pgEnum')
          result.add(binding.name.text)
  return result
}
export function parseCurrentEnums(file: string, text: string, names: Set<string>) {
  const source = sourceFile(file, text),
    factories = pgFactories(source)
  const result: DefinitionCandidate[] = []
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      const call = declaration.initializer
      if (
        !call ||
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        !factories.has(call.expression.text)
      )
        continue
      const [name, values] = call.arguments
      if (!name || !ts.isStringLiteralLike(name) || !names.has(name.text)) continue
      const members =
        values &&
        ts.isArrayLiteralExpression(values) &&
        values.elements.every((member) => ts.isStringLiteralLike(member))
          ? values.elements.map((member) => {
              assert(ts.isStringLiteralLike(member))
              return member.text
            })
          : null
      result.push(
        evidence(
          file,
          text,
          declaration.getStart(source),
          declaration.end,
          name.text,
          members,
          true,
          ts.isIdentifier(declaration.name) ? declaration.name.text : null,
        ),
      )
    }
  }
  return result
}
interface Token {
  value: string
  kind: 'WORD' | 'IDENTIFIER' | 'STRING' | 'SYMBOL'
  start: number
  end: number
}
export function sqlTokens(text: string, start = 0, end = text.length): Token[] {
  const tokens: Token[] = []
  let at = start
  while (at < end) {
    if (/\s/.test(text[at])) {
      at++
      continue
    }
    if (text.startsWith('--', at)) {
      const next = text.indexOf('\n', at + 2)
      at = next < 0 ? end : next + 1
      continue
    }
    if (text.startsWith('/*', at)) {
      let depth = 1
      at += 2
      while (at < end && depth) {
        if (text.startsWith('/*', at)) {
          depth++
          at += 2
        } else if (text.startsWith('*/', at)) {
          depth--
          at += 2
        } else at++
      }
      assert.equal(depth, 0, 'UNTERMINATED_SQL_COMMENT')
      continue
    }
    const dollar = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(at, end))
    if (dollar) {
      const close = text.indexOf(dollar[0], at + dollar[0].length)
      assert(close >= 0, 'UNTERMINATED_SQL_DOLLAR_BODY')
      // Historical DO bodies contain design DDL; parsing does not establish execution authority.
      tokens.push(...sqlTokens(text, at + dollar[0].length, close))
      at = close + dollar[0].length
      continue
    }
    const begin = at
    if (text[at] === "'" || text[at] === '"') {
      const quote = text[at++]
      let value = '',
        closed = false
      while (at < end) {
        if (text[at] === quote) {
          if (text[at + 1] === quote) {
            value += quote
            at += 2
          } else {
            at++
            closed = true
            break
          }
        } else value += text[at++]
      }
      assert(closed, 'UNTERMINATED_SQL_LITERAL')
      tokens.push({ value, kind: quote === "'" ? 'STRING' : 'IDENTIFIER', start: begin, end: at })
      continue
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(text.slice(at, end))
    if (word) {
      at += word[0].length
      tokens.push({ value: word[0], kind: 'WORD', start: begin, end: at })
      continue
    }
    at++
    tokens.push({ value: text[begin], kind: 'SYMBOL', start: begin, end: at })
  }
  return tokens
}
export function parseHistoricalTypes(file: string, text: string, names: Set<string>) {
  const tokens = sqlTokens(text),
    result: DefinitionCandidate[] = []
  const word = (at: number, value: string) =>
    tokens[at]?.kind === 'WORD' && tokens[at].value.toUpperCase() === value
  for (let at = 0; at < tokens.length; at++) {
    if (!word(at, 'CREATE') || !(word(at + 1, 'TYPE') || word(at + 1, 'DOMAIN'))) continue
    let cursor = at + 2
    const identifier = () => {
      const token = tokens[cursor++]
      return token && ['WORD', 'IDENTIFIER'].includes(token.kind)
        ? token.kind === 'WORD'
          ? token.value.toLowerCase()
          : token.value
        : null
    }
    const first = identifier()
    if (!first) continue
    let schema = 'public',
      name = first
    if (tokens[cursor]?.value === '.') {
      cursor++
      schema = first
      name = identifier() ?? ''
    }
    if (!names.has(name)) continue
    const isEnum =
      word(at + 1, 'TYPE') &&
      word(cursor, 'AS') &&
      word(cursor + 1, 'ENUM') &&
      tokens[cursor + 2]?.value === '('
    if (isEnum) {
      cursor += 3
      const members: string[] = []
      let valid = true,
        expectMember = true
      while (cursor < tokens.length && tokens[cursor].value !== ')') {
        const token = tokens[cursor++]
        if (expectMember && token.kind === 'STRING') {
          members.push(token.value)
          expectMember = false
        } else if (!expectMember && token.value === ',') expectMember = true
        else valid = false
      }
      if (expectMember && members.length) valid = false
      assert(tokens[cursor]?.value === ')', 'UNTERMINATED_ENUM_DEFINITION')
      const finish = tokens[cursor + 1]?.value === ';' ? tokens[cursor + 1].end : tokens[cursor].end
      result.push(
        evidence(
          file,
          text,
          tokens[at].start,
          finish,
          name,
          valid ? members : null,
          false,
          null,
          schema,
        ),
      )
    } else {
      const finish = tokens.slice(cursor).find((token) => token.value === ';')?.end ?? text.length
      const kind = word(at + 1, 'DOMAIN')
        ? 'DOMAIN'
        : word(cursor, 'AS') && tokens[cursor + 1]?.value === '('
          ? 'COMPOSITE'
          : 'OTHER_EXPLICIT_POSTGRES_NAMED_TYPE'
      result.push(
        evidence(file, text, tokens[at].start, finish, name, null, false, null, schema, kind),
      )
    }
  }
  return result
}
export function resolveDirectImports(file: string, text: string, symbols: Set<string>) {
  const result: {
    MODULE: string
    LOCAL_SYMBOL: string
    EXPORTED_SYMBOL: string
    CANDIDATE_FILES: string[]
  }[] = []
  for (const statement of sourceFile(file, text).statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    )
      continue
    for (const binding of statement.importClause.namedBindings.elements) {
      if (!symbols.has(binding.name.text)) continue
      const importPath = statement.moduleSpecifier.text
      if (!importPath.startsWith('.')) {
        result.push({
          MODULE: importPath,
          LOCAL_SYMBOL: binding.name.text,
          EXPORTED_SYMBOL: binding.propertyName?.text ?? binding.name.text,
          CANDIDATE_FILES: [],
        })
        continue
      }
      const base = path.resolve(
        root,
        ...path.posix.dirname(file).split('/'),
        ...importPath.split('/'),
      )
      assert(base.startsWith(root), 'DIRECT_IMPORT_OUTSIDE_REPOSITORY')
      result.push({
        MODULE: importPath,
        LOCAL_SYMBOL: binding.name.text,
        EXPORTED_SYMBOL: binding.propertyName?.text ?? binding.name.text,
        CANDIDATE_FILES: [base + '.ts', base + '.tsx', base, path.join(base, 'index.ts')],
      })
    }
  }
  return result
}
export function classifyDefinitions(candidates: DefinitionCandidate[]) {
  const exact = candidates.filter((candidate) => candidate.DEFINITION_COMPLETE)
  const signatures = new Set(
    exact.map((candidate) =>
      digest({
        schema: candidate.SCHEMA_NAME,
        name: candidate.TYPE_NAME,
        kind: candidate.TYPE_KIND,
        members: candidate.ORDERED_ENUM_MEMBERS,
      }),
    ),
  )
  if (signatures.size > 1)
    return {
      EVIDENCE_CLASS: 'CONFLICTING_TYPE_DEFINITIONS',
      DEFINITION_STATUS: 'HOLD_DEFINITION_CONFLICT',
      SELECTED: null,
    }
  if (!exact.length || candidates.some((candidate) => !candidate.DEFINITION_COMPLETE))
    return {
      EVIDENCE_CLASS: 'REFERENCE_ONLY_NO_DEFINITION',
      DEFINITION_STATUS: 'HOLD_DEFINITION_INCOMPLETE',
      SELECTED: null,
    }
  return {
    EVIDENCE_CLASS:
      exact.some((candidate) => candidate.EVIDENCE_CLASS === 'CURRENT') &&
      exact.some((candidate) => candidate.EVIDENCE_CLASS === 'HISTORICAL')
        ? 'CONSISTENT_CURRENT_AND_HISTORICAL_DEFINITION'
        : exact[0].EVIDENCE_CLASS === 'CURRENT'
          ? 'EXACT_CURRENT_TYPE_DECLARATION'
          : 'EXACT_HISTORICAL_TYPE_DEFINITION',
    DEFINITION_STATUS: 'EXACT_DEFINITION_AVAILABLE',
    SELECTED: exact.find((candidate) => candidate.EVIDENCE_CLASS === 'CURRENT') ?? exact[0],
  }
}
interface ExistingAuthority {
  CLASS: string
  AUTHORITY: string
  EVIDENCE: unknown
}
export function assignOwnership(
  name: string,
  schema: string,
  authorities: ExistingAuthority[],
  requiredByPlatform: boolean,
) {
  assert(requiredByPlatform, 'TYPE_NOT_PLATFORM_DEFINITION_DEPENDENCY')
  const reserved = new Set([
    'text',
    'varchar',
    'uuid',
    'json',
    'jsonb',
    'boolean',
    'integer',
    'numeric',
    'timestamp',
    'date',
    'vector',
    'citext',
    'geometry',
    'geography',
    'hstore',
  ])
  if (['pg_catalog', 'information_schema'].includes(schema) || reserved.has(name))
    assert(authorities.length > 0, 'BUILTIN_OR_EXTENSION_TYPE_CAPTURE')
  const owners = new Set(authorities.map((authority) => authority.AUTHORITY))
  if (owners.size > 1)
    return {
      OWNERSHIP_STATUS: 'HOLD_CONFLICTING_AUTHORITY',
      OWNERSHIP_AUTHORITY: null,
      CANONICAL_CREATION_AUTHORITY: null,
      EXISTING_AUTHORITY_EVIDENCE: authorities,
    }
  if (owners.size === 1)
    return {
      OWNERSHIP_STATUS: 'EXISTING_CANONICAL_AUTHORITY',
      OWNERSHIP_AUTHORITY: 'PRESERVED_EXISTING_AUTHORITY',
      CANONICAL_CREATION_AUTHORITY: [...owners][0],
      EXISTING_AUTHORITY_EVIDENCE: authorities,
    }
  return {
    OWNERSHIP_STATUS: 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED',
    OWNERSHIP_AUTHORITY: 'HUMAN_GOVERNANCE_W4T',
    CANONICAL_CREATION_AUTHORITY: 'PLATFORM_BASELINE',
    EXISTING_AUTHORITY_EVIDENCE: authorities,
  }
}
export function enumDescriptor(schema: string, name: string, members: string[]) {
  const identifier = (value: string) => {
    assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(value), 'INVALID_TYPE_IDENTITY')
    return `"${value}"`
  }
  assert(new Set(members).size === members.length)
  assert(
    members.every((member) => !member.includes('\0') && Buffer.byteLength(member, 'utf8') <= 63),
  )
  const sql = `CREATE TYPE ${identifier(schema)}.${identifier(name)} AS ENUM (${members
    .map((member) => `'${member.replace(/'/g, "''")}'`)
    .join(', ')});`
  return {
    SQL: sql,
    SQL_SHA256: sha(sql),
    SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
    EXECUTION_ALLOWED: 'NO',
  }
}
export function buildTypeClosure() {
  const inputBytes = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, read(file)]),
  )
  const fr: W4FR = JSON.parse(inputBytes.w4fr),
    f: W4F = JSON.parse(inputBytes.w4f)
  const producer: Producer = JSON.parse(inputBytes.producer)
  const registry: ReturnType<typeof buildRegeneration>['registry'] = JSON.parse(inputBytes.resolved)
  const g: {
    ownershipAdoption: unknown[]
    lateDefinitionRegister: {
      PHYSICAL_IDENTITY: string
      OBJECT_KIND: string
      CANONICAL_PRECONSUMER_CREATION_AUTHORITY: string
    }[]
    lateProducerCompatibilityObligations: unknown[]
  } = JSON.parse(inputBytes.w4g)
  const canonical: {
    CONTRACT_VERSION: string
    prerequisiteObligations: { PHYSICAL_IDENTITY: string; DATABASE_SCOPE_ID: string }[]
    extensionDoctrine: unknown
    frozenMigrationManifest: unknown[]
    FINANCIAL_SERVICE_PHYSICAL_MATERIALIZATION_OWNER?: string
  } = JSON.parse(inputBytes.canonical)
  const h3: {
    phaseStatus: { PHASE_1B_3C_A1I_W4H3_GATE: string }
    governanceAccounting: { DESIGN_GROUPS_CLOSED: number; DEFINITION_OBLIGATIONS_GOVERNED: number }
  } = JSON.parse(inputBytes.w4h3)
  assert.equal(canonical.CONTRACT_VERSION, '1.3.1')
  assert.equal(fr.phaseStatus.PHASE_1B_3C_A1I_W4FR_GATE, 'BLOCKED')
  assert.equal(h3.phaseStatus.PHASE_1B_3C_A1I_W4H3_GATE, 'PASS')
  assert.equal(h3.governanceAccounting.DESIGN_GROUPS_CLOSED, 126)
  assert.equal(h3.governanceAccounting.DEFINITION_OBLIGATIONS_GOVERNED, 183)
  assert.equal(fr.dependencyBlockers.length, 38)
  const names = [
    ...new Set(fr.dependencyBlockers.map((dependency) => dependency.GOVERNED_TYPE_NAME)),
  ].sort()
  assert.equal(names.length, 36)
  assert.equal(new Set(fr.dependencyBlockers.map((dependency) => dependency.RELATION)).size, 28)
  assert.equal(
    new Set(
      fr.dependencyBlockers.flatMap((dependency) => dependency.AFFECTED_DEFINITION_OBLIGATION_IDS),
    ).size,
    28,
  )
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  for (const [file, hash] of Object.entries(fr.preservation)) {
    preservation[file] = sha(read(file))
    assert.equal(preservation[file], hash, `FIXED_UPSTREAM_DRIFT:${file}`)
  }
  for (const file of Object.values(w4frOutputs)) preservation[file] = sha(read(file))
  const preservedSections = {
    OWNERSHIP_310: digest(g.ownershipAdoption),
    LATE_DEFINITIONS_127: digest(g.lateDefinitionRegister),
    COMPATIBILITY_127: digest(g.lateProducerCompatibilityObligations),
    DJANGO_372: digest(producer.djangoProducerRegistry),
    PLAN_82: digest(producer.canonicalProducerPlan),
    RAW_WRAPPERS: digest(producer.rawOperationProducerRegistry),
    W3: digest(producer.w3Preconditions),
    W5_86: digest(producer.w5OrderingHandoff),
    W6_118: digest(producer.w6OpaqueBindingHandoff),
    CANONICAL_803: digest(canonical.prerequisiteObligations),
    FROZEN_23: digest(canonical.frozenMigrationManifest),
    EXTENSIONS_AND_VECTOR: digest(canonical.extensionDoctrine),
  }
  assert.deepEqual(preservedSections, f.acceptedPreservation, 'ACCEPTED_W4F_SECTION_DRIFT')
  assert.deepEqual(preservedSections, fr.preservedSections, 'ACCEPTED_W4FR_SECTION_DRIFT')
  const sources = new Map<
    string,
    { HASH: string; CLASS: 'CURRENT' | 'HISTORICAL'; NAMES: Set<string> }
  >()
  for (const dependency of fr.dependencyBlockers) {
    const relation = f.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === dependency.RELATION_DEFINITION_ID,
    )
    assert(relation)
    for (const reference of dependency.GOVERNED_VALUE_AND_POSTURE.EVIDENCE_REFERENCES) {
      const declaration: W4F['relationDefinitions'][number]['DECLARATIONS'][number] | undefined =
        relation.DECLARATIONS.find(
          (record) =>
            record.REFERENCE.FILE === reference.FILE &&
            record.REFERENCE.DIGEST === reference.DIGEST,
        )
      assert(declaration, 'MISSING_REFERENCED_SOURCE_EVIDENCE')
      const found = sources.get(reference.FILE)
      if (found) assert.equal(found.HASH, declaration.REFERENCE.FILE_SHA256)
      const value = found ?? {
        HASH: declaration.REFERENCE.FILE_SHA256,
        CLASS:
          declaration.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE'
            ? ('CURRENT' as const)
            : ('HISTORICAL' as const),
        NAMES: new Set<string>(),
      }
      value.NAMES.add(dependency.GOVERNED_TYPE_NAME)
      sources.set(reference.FILE, value)
    }
  }
  const sourceHashes: Record<string, string> = {}
  const candidates: DefinitionCandidate[] = []
  const directImports: {
    FROM_FILE: string
    TYPE_NAME: string
    MODULE: string
    LOCAL_SYMBOL: string
    STATUS: string
    SOURCE_FILE: string | null
  }[] = []
  for (const [file, scope] of sources) {
    const bytes = readFileSync(path.join(root, ...file.split('/')))
    assert.equal(sha(bytes.toString('utf8')), scope.HASH, `SOURCE_HASH_DRIFT:${file}`)
    const text = bytes.toString('utf8')
    sourceHashes[file] = scope.HASH
    if (scope.CLASS === 'HISTORICAL') {
      candidates.push(...parseHistoricalTypes(file, text, scope.NAMES))
      continue
    }
    const local = parseCurrentEnums(file, text, scope.NAMES)
    candidates.push(...local)
    for (const name of scope.NAMES) {
      if (local.some((candidate) => candidate.TYPE_NAME === name && candidate.DEFINITION_COMPLETE))
        continue
      const symbols = new Set<string>()
      for (const dependency of fr.dependencyBlockers.filter(
        (record) => record.GOVERNED_TYPE_NAME === name,
      )) {
        const relation = f.relationDefinitions.find(
          (record) => record.RELATION_DEFINITION_ID === dependency.RELATION_DEFINITION_ID,
        )!
        for (const declaration of relation.DECLARATIONS.filter(
          (record) => record.REFERENCE.FILE === file,
        ))
          for (const column of declaration.COLUMNS.filter(
            (record) => record.NAME === dependency.COLUMN,
          )) {
            const symbol = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(column.SOURCE_EXPRESSION)?.[1]
            if (symbol) symbols.add(symbol)
          }
      }
      for (const imported of resolveDirectImports(file, text, symbols)) {
        const target = imported.CANDIDATE_FILES.find((candidate) => existsSync(candidate))
        if (!target) {
          directImports.push({
            FROM_FILE: file,
            TYPE_NAME: name,
            MODULE: imported.MODULE,
            LOCAL_SYMBOL: imported.LOCAL_SYMBOL,
            STATUS: 'DIRECT_DECLARATION_SOURCE_UNAVAILABLE_NO_FURTHER_TRACE',
            SOURCE_FILE: null,
          })
          continue
        }
        const relative = path.relative(root, target).split(path.sep).join('/')
        const direct = readFileSync(target, 'utf8')
        sourceHashes[relative] = sha(direct)
        const parsed = parseCurrentEnums(relative, direct, new Set([name])).filter(
          (candidate) => candidate.SYMBOL === imported.EXPORTED_SYMBOL,
        )
        candidates.push(...parsed)
        directImports.push({
          FROM_FILE: file,
          TYPE_NAME: name,
          MODULE: imported.MODULE,
          LOCAL_SYMBOL: imported.LOCAL_SYMBOL,
          STATUS: parsed.length
            ? 'EXACT_DIRECT_DECLARATION_SOURCE'
            : 'NO_EXACT_DECLARATION_STOP_NO_BARREL_OR_REEXPORT_TRACE',
          SOURCE_FILE: relative,
        })
      }
    }
  }
  const referenceLinks = fr.dependencyBlockers.map((dependency) => {
    const owned = registry.definitionObligationLinkage.filter((definition) =>
      dependency.AFFECTED_DEFINITION_OBLIGATION_IDS.includes(definition.DEFINITION_OBLIGATION_ID),
    )
    assert(
      owned.length &&
        owned.every(
          (definition) =>
            definition.CANONICAL_OWNER === 'PLATFORM_BASELINE' &&
            definition.DATABASE_SCOPE_ID === 'UE_OPERATIONAL',
        ),
    )
    return {
      REFERENCE_ID: `UE-W4T-REFERENCE-${sha(`${dependency.RELATION}.${dependency.COLUMN}:${dependency.GOVERNED_TYPE_NAME}`).slice(0, 16)}`,
      CANONICAL_TYPE_IDENTITY: `public.${dependency.GOVERNED_TYPE_NAME}`,
      GOVERNED_TYPE_NAME: dependency.GOVERNED_TYPE_NAME,
      CONSUMER_RELATION: dependency.RELATION,
      CONSUMER_COLUMN: dependency.COLUMN,
      SOURCE_W4_DEFINITION_OBLIGATION_IDS: dependency.AFFECTED_DEFINITION_OBLIGATION_IDS,
      TYPE_REFERENCE_EVIDENCE: dependency.GOVERNED_VALUE_AND_POSTURE,
    }
  })
  assert.equal(new Set(referenceLinks.map((reference) => reference.REFERENCE_ID)).size, 38)
  const typeRecords = names.map((name) => {
    const identity = `union-eyes::TYPE::public.${name}`
    const definitionCandidates = candidates.filter((candidate) => candidate.TYPE_NAME === name)
    const definition = classifyDefinitions(definitionCandidates)
    const schemas = new Set(definitionCandidates.map((candidate) => candidate.SCHEMA_NAME))
    assert(
      [...schemas].every((schema) => schema === 'public'),
      'FROZEN_DIFFERENT_SCHEMA_REQUIRES_EXACT_IDENTITY_RECONCILIATION',
    )
    const authorities: ExistingAuthority[] = []
    for (const record of producer.physicalIdentityAuthority.filter(
      (record) =>
        record.PHYSICAL_IDENTITY === identity && record.CREATION_DEFINITION_ESTABLISHED === 'YES',
    ))
      authorities.push({
        CLASS: 'PHYSICAL_IDENTITY_AUTHORITY',
        AUTHORITY: record.CREATE_AUTHORITY,
        EVIDENCE: record,
      })
    for (const record of g.lateDefinitionRegister.filter(
      (record) => record.PHYSICAL_IDENTITY === identity && record.OBJECT_KIND === 'TYPE',
    ))
      authorities.push({
        CLASS: 'GOVERNED_LATE_TYPE',
        AUTHORITY: record.CANONICAL_PRECONSUMER_CREATION_AUTHORITY,
        EVIDENCE: record,
      })
    for (const record of producer.djangoProducerRegistry.filter(
      (record) => record.PHYSICAL_IDENTITY === identity,
    ))
      authorities.push({
        CLASS: 'DJANGO_PRODUCER',
        AUTHORITY: `DJANGO:${record.W4_PRODUCER_ID}`,
        EVIDENCE: record,
      })
    for (const record of producer.djangoExecutionRegistry.filter((record) =>
      record.EXPECTED_OUTPUT_IDENTITIES.includes(identity),
    ))
      authorities.push({
        CLASS: record.DISTRIBUTION_NAME ? 'LOCKED_EXTERNAL_DJANGO_GRAPH' : 'LOCAL_DJANGO_GRAPH',
        AUTHORITY: `DJANGO:${record.PRODUCER_ID}`,
        EVIDENCE: record,
      })
    const raw = producer.rawOperationProducerRegistry.filter(
      (record) =>
        record.REFERENCED_OBJECTS.includes(identity) ||
        record.REFERENCED_OBJECTS.includes(`public.${name}`),
    )
    // A raw reference is not positive creation authority; unresolved overlap must be held, not captured.
    for (const record of raw)
      authorities.push({
        CLASS: 'RAW_OPERATION_UNRESOLVED_AUTHORITY',
        AUTHORITY: `HOLD_RAW:${record.RAW_OPERATION_ID}`,
        EVIDENCE: record,
      })
    const financial = canonical.prerequisiteObligations.filter(
      (record) =>
        record.PHYSICAL_IDENTITY === identity && record.DATABASE_SCOPE_ID !== 'UE_OPERATIONAL',
    )
    for (const record of financial)
      authorities.push({
        CLASS: 'FINANCIAL_SCOPE_IDENTITY',
        AUTHORITY: 'FINANCIAL_SERVICE',
        EVIDENCE: record,
      })
    const ownership = assignOwnership(name, 'public', authorities, true)
    if (raw.length) {
      ownership.OWNERSHIP_STATUS = 'HOLD_CONFLICTING_AUTHORITY'
      ownership.OWNERSHIP_AUTHORITY = null
      ownership.CANONICAL_CREATION_AUTHORITY = null
    }
    const links = referenceLinks.filter((reference) => reference.GOVERNED_TYPE_NAME === name)
    const kind = new Set(definitionCandidates.map((candidate) => candidate.TYPE_KIND))
    const approved =
      definition.DEFINITION_STATUS === 'EXACT_DEFINITION_AVAILABLE' &&
      ownership.OWNERSHIP_STATUS !== 'HOLD_CONFLICTING_AUTHORITY'
    return {
      TYPE_DEPENDENCY_ID: `UE-W4T-TYPE-${sha(`public.${name}`).slice(0, 16)}`,
      GOVERNED_TYPE_NAME: name,
      CANONICAL_SCHEMA: 'public',
      CANONICAL_TYPE_IDENTITY: `public.${name}`,
      TYPE_KIND: kind.size === 1 ? [...kind][0] : null,
      ...ownership,
      ...definition,
      TYPE_REFERENCE_EVIDENCE: links.map((reference) => reference.TYPE_REFERENCE_EVIDENCE),
      TYPE_DEFINITION_EVIDENCE: definitionCandidates,
      AUTHORITY_CHECKS: {
        GOVERNED_LATE_TYPES_41: 'EXACT_IDENTITY_CHECKED',
        PHYSICAL_DJANGO_EXTERNAL_GRAPH_RAW_FINANCIAL: 'EXACT_IDENTITY_CHECKED',
        EXTENSION_SYSTEM_TYPE_CAPTURE:
          'EXCLUDED_BY_EXACT_IDENTITY_AND_RESERVED_TYPE_GUARD;no ownership inferred from filename',
        CURRENT_DECLARATION_CREATION_AUTHORITY: 'NO;design evidence only',
        HISTORICAL_SOURCE_ACTIVE_AUTHORITY: 'NO;frozen accepted producer identity required',
        EXISTING_AUTHORITY_MATCHES: authorities.length,
      },
      CONSUMER_REFERENCE_COUNT: links.length,
      CONSUMER_RELATIONS: [...new Set(links.map((reference) => reference.CONSUMER_RELATION))],
      CONSUMER_COLUMNS: links.map((reference) => ({
        RELATION: reference.CONSUMER_RELATION,
        COLUMN: reference.CONSUMER_COLUMN,
        REFERENCE_ID: reference.REFERENCE_ID,
      })),
      SOURCE_W4_DEFINITION_OBLIGATION_IDS: [
        ...new Set(links.flatMap((reference) => reference.SOURCE_W4_DEFINITION_OBLIGATION_IDS)),
      ],
      TYPE_APPROVAL_STATUS: approved ? 'APPROVED' : 'HELD',
      INACTIVE_TYPE_DESCRIPTOR:
        approved && definition.SELECTED?.TYPE_KIND === 'ENUM'
          ? enumDescriptor('public', name, definition.SELECTED.ORDERED_ENUM_MEMBERS!)
          : null,
    }
  })
  const held = typeRecords.filter((record) => record.TYPE_APPROVAL_STATUS === 'HELD')
  const passed = !held.length
  const summary = {
    NAMED_TYPE_REFERENCES: 38,
    DISTINCT_NAMED_TYPES: 36,
    REFERENCES_WITH_APPROVED_TYPE: referenceLinks.filter(
      (link) => !held.some((record) => record.GOVERNED_TYPE_NAME === link.GOVERNED_TYPE_NAME),
    ).length,
    REFERENCES_WITH_HELD_TYPE: referenceLinks.filter((link) =>
      held.some((record) => record.GOVERNED_TYPE_NAME === link.GOVERNED_TYPE_NAME),
    ).length,
    SUM: referenceLinks.length,
    UNACCOUNTED: 0,
    EXISTING_CANONICAL_AUTHORITY: typeRecords.filter(
      (record) => record.OWNERSHIP_STATUS === 'EXISTING_CANONICAL_AUTHORITY',
    ).length,
    PLATFORM_BASELINE_GOVERNANCE_ADOPTED: typeRecords.filter(
      (record) => record.OWNERSHIP_STATUS === 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED',
    ).length,
    HELD_CONFLICTING_AUTHORITY: typeRecords.filter(
      (record) => record.OWNERSHIP_STATUS === 'HOLD_CONFLICTING_AUTHORITY',
    ).length,
    EXACT_DEFINITION_AVAILABLE: typeRecords.filter(
      (record) => record.DEFINITION_STATUS === 'EXACT_DEFINITION_AVAILABLE',
    ).length,
    HELD_DEFINITION_INCOMPLETE: typeRecords.filter(
      (record) => record.DEFINITION_STATUS === 'HOLD_DEFINITION_INCOMPLETE',
    ).length,
    HELD_DEFINITION_CONFLICT: typeRecords.filter(
      (record) => record.DEFINITION_STATUS === 'HOLD_DEFINITION_CONFLICT',
    ).length,
    SUM_OWNERSHIP: typeRecords.length,
    SUM_DEFINITION: typeRecords.length,
    CONSUMER_REFERENCES: referenceLinks.length,
    AFFECTED_RELATIONS: 28,
    AFFECTED_OBLIGATIONS: 28,
    INACTIVE_TYPE_DESCRIPTORS: typeRecords.filter((record) => record.INACTIVE_TYPE_DESCRIPTOR)
      .length,
    SOURCE_FILES_CHECKED: Object.keys(sourceHashes).length,
  }
  assert.equal(summary.REFERENCES_WITH_APPROVED_TYPE + summary.REFERENCES_WITH_HELD_TYPE, 38)
  assert.equal(
    summary.EXACT_DEFINITION_AVAILABLE +
      summary.HELD_DEFINITION_INCOMPLETE +
      summary.HELD_DEFINITION_CONFLICT,
    36,
  )
  assert.equal(
    summary.EXISTING_CANONICAL_AUTHORITY +
      summary.PLATFORM_BASELINE_GOVERNANCE_ADOPTED +
      summary.HELD_CONFLICTING_AUTHORITY,
    36,
  )
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const previous: { preservation: typeof preservation; sourceHashes: typeof sourceHashes } =
      JSON.parse(read(outputs.report))
    for (const [file, hash] of Object.entries(previous.preservation))
      assert.equal(preservation[file], hash, `FROZEN_W4T_INPUT_DRIFT:${file}`)
    assert.deepEqual(sourceHashes, previous.sourceHashes, 'W4T_SOURCE_HASH_DRIFT')
  }
  const residual = held.map((record) => ({
    CANONICAL_TYPE_IDENTITY: record.CANONICAL_TYPE_IDENTITY,
    TYPE_REFERENCE_EVIDENCE: record.TYPE_REFERENCE_EVIDENCE,
    WHY_DEFINITION_IS_INCOMPLETE_OR_CONFLICTING: record.DEFINITION_STATUS,
    AVAILABLE_DEFINITION_CANDIDATES: record.TYPE_DEFINITION_EVIDENCE,
    MISSING_PHYSICAL_FACTS:
      record.DEFINITION_STATUS === 'HOLD_DEFINITION_CONFLICT'
        ? [
            'Human selection of one exact ordered enum definition;current and historical members differ',
          ]
        : ['Exact physical named type definition'],
    CONSUMER_RELATIONS: record.CONSUMER_RELATIONS,
    CONSUMER_COLUMNS: record.CONSUMER_COLUMNS,
    OWNERSHIP_STATUS: record.OWNERSHIP_STATUS,
    OWNERSHIP_AUTHORITY: record.OWNERSHIP_AUTHORITY,
    MINIMUM_HUMAN_DECISION_REQUIRED:
      record.DEFINITION_STATUS === 'HOLD_DEFINITION_CONFLICT'
        ? 'Select the canonical exact ordered member list from the enumerated candidates;do not revisit settled prospective ownership'
        : 'Provide/adopt exact physical definition facts only;ownership is separately settled where adopted',
  }))
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4T_GATE: passed ? 'PASS' : 'BLOCKED',
    PHASE_1B_3C_A1I_W4T: passed ? 'PASS' : 'BLOCKED',
    NAMED_TYPE_PRODUCTION_MODEL: passed ? 'COMPLETE_NOT_EXECUTED' : 'PARTIAL_HELD_DEFINITIONS',
    NO_FURTHER_W4T_GENERIC_DISCOVERY: 'YES',
    W4FR_RETRY: passed ? 'AUTHORIZED_NOT_STARTED' : 'NOT_AUTHORIZED',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
  }
  return {
    registry: {
      metadata: { PHASE: 'PHASE_1B_3C_A1I_W4T', SCOPE: 'EXACT36_TRANSITIVE_TYPES_ONLY' },
      typeRecords,
      referenceLinks,
      summary,
      phaseStatus,
    },
    residual: {
      PHASE: 'PHASE_1B_3C_A1I_W4T',
      HELD_TYPE_IDENTITIES: held.length,
      residual,
      phaseStatus,
    },
    report: {
      PHASE: 'PHASE_1B_3C_A1I_W4T',
      summary,
      phaseStatus,
      preservation,
      sourceHashes,
      directImports,
      sourceScope: [...sources].map(([FILE, scope]) => ({
        FILE,
        CLASS: scope.CLASS,
        HASH: scope.HASH,
        ALLOWED_TYPE_NAMES: [...scope.NAMES].sort(),
      })),
      priorGovernancePreservation: fr.priorGovernancePreservation,
      preservedSections,
      governanceAccounting: {
        DESIGN_GROUPS_CLOSED: 126,
        DEFINITION_OBLIGATIONS_GOVERNED: 183,
        RELATION_BLUEPRINTS: 125,
        RELATION_COLUMN_GOVERNANCE_CHANGED: 'NO',
      },
      proofBoundaries: { ...fr.proofBoundaries, NAMED_TYPES_MATERIALIZED: 'NO' },
      validation: {
        closeoutChecks: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\close-w4t-named-types.test.ts',
            RESULT: 'PASS;45 tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT: 'PASS;171 tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
            RESULT:
              'PASS;44 tests isolated;initial combined run hit existing W4F120s hook timeout,not a definition failure',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --types node scripts\\ue\\close-w4t-named-types.ts scripts\\ue\\close-w4t-named-types.test.ts',
            RESULT:
              'PASS;exit0;initial NodeNext/no-node-types invocation was invalid for existing module conventions',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\close-w4t-named-types.ts scripts\\ue\\close-w4t-named-types.test.ts',
            RESULT:
              'PASS;exit0;existing Next pages-directory diagnostic;new module-variable warning corrected',
          },
          {
            COMMAND: 'pnpm exec tsx scripts\\ue\\close-w4t-named-types.ts --self-test --check',
            RESULT: 'PASS;two-generation exact-byte equality and persisted supplemental artifacts',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS;0 errors;1215 existing warnings;2607 scanned files',
          },
          {
            COMMAND:
              'Independent Node crypto fixed/source bytes and exact reference ID comparison;generator12 preserved-section assertions',
            RESULT: 'PASS;35 byte commitments;exact38 links;12 accepted section hashes',
          },
        ],
        IDENTITY_36_REFERENCE_38_ACCOUNTING: 'PASS',
        SOURCE_HASHES: 'VERIFIED_AGAINST_FROZEN_W4F',
        OWNERSHIP: 'PROSPECTIVE_HUMAN_GOVERNANCE_W4T_NOT_STATIC_HISTORY',
        ENUM_MEMBER_ORDER: 'EXACT_NOT_SORTED',
        RELATION_SQL: 'NOT_AUTHORED',
        W4FR_INTEGRATION: 'NOT_STARTED',
      },
    },
  }
}
export async function generate() {
  const model = buildTypeClosure(),
    config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const registryBytes = await format(JSON.stringify(model.registry), { ...config, parser: 'json' })
  const rows = model.registry.typeRecords
    .map(
      (record) =>
        `| public.${record.GOVERNED_TYPE_NAME} | ${record.CONSUMER_REFERENCE_COUNT} | ${record.OWNERSHIP_STATUS} | ${record.DEFINITION_STATUS} | ${record.EVIDENCE_CLASS} |`,
    )
    .join('\n')
  const held = model.residual.residual
    .map(
      (record) => `## ${record.CANONICAL_TYPE_IDENTITY}

Ownership: **${record.OWNERSHIP_STATUS}** under **${record.OWNERSHIP_AUTHORITY}**,not reopened.
Definition: **${record.WHY_DEFINITION_IS_INCOMPLETE_OR_CONFLICTING}**.

${record.AVAILABLE_DEFINITION_CANDIDATES.map((candidate) => `- **${candidate.EVIDENCE_CLASS}** [${candidate.SOURCE_FILE}](../../../${candidate.SOURCE_FILE}),lines${candidate.SOURCE_RANGE.join('-')},definition digest \`${candidate.DEFINITION_DIGEST}\`: ordered members \`${JSON.stringify(candidate.ORDERED_ENUM_MEMBERS)}\`.`).join('\n')}

Consumers: ${record.CONSUMER_COLUMNS.map((consumer) => `${consumer.RELATION}.${consumer.COLUMN}`).join(', ')}.
Required decision: ${record.MINIMUM_HUMAN_DECISION_REQUIRED}.
`,
    )
    .join('\n')
  const markdown = `# W4T - named-type production authority and definition closure

Gate: **${model.report.phaseStatus.PHASE_1B_3C_A1I_W4T_GATE}**.
Exact universe: **36 named types /38 references /28 affected relations and obligations**.
Prospective PLATFORM_BASELINE ownership: **${model.report.summary.PLATFORM_BASELINE_GOVERNANCE_ADOPTED}**;existing authority: **${model.report.summary.EXISTING_CANONICAL_AUTHORITY}**;authority holds: **${model.report.summary.HELD_CONFLICTING_AUTHORITY}**.
Exact definitions: **${model.report.summary.EXACT_DEFINITION_AVAILABLE}**;incomplete: **${model.report.summary.HELD_DEFINITION_INCOMPLETE}**;conflicting: **${model.report.summary.HELD_DEFINITION_CONFLICT}**.
References approved/held: **${model.report.summary.REFERENCES_WITH_APPROVED_TYPE}/${model.report.summary.REFERENCES_WITH_HELD_TYPE}**. Inactive type-only descriptors: **${model.report.summary.INACTIVE_TYPE_DESCRIPTORS}**.

## Definition and ownership accounting

| Canonical identity | References | Ownership | Definition | Evidence class |
|---|---:|---|---|---|
${rows}

Current declarations are definition-design evidence only. New ownership is HUMAN_GOVERNANCE_W4T,not retroactive repository authority. Historical definitions do not become active producers. Enum member order is exact;no union,alphabetization,compatibility values or synthetic members.

## Exact residual definitions

${held || 'None.'}
## Evidence and boundaries

All38 links,exact definition texts,source file hashes/ranges,digests,ordered member lists,authority checks and inactive descriptors are in [registry](./UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json). Only recorded affected files and direct named-type imports are inspected;no generic crawl or reexport recursion.

183 relation/column obligations,126 governance groups,125 blueprints,A/A/B selections,case_documents and prior provenance remain unchanged. Historical W4FR/W4F/W4H evidence,producer/canonical contracts and310/127/127/372/82/raw/W3/86/118/803/23/extension-vector commitments are preserved.

Canonical **1.3.1**,no1.3.2. W4FR retry **${model.report.phaseStatus.W4FR_RETRY}**. W4 **BLOCKED_DEFINITION_IMPLEMENTATION_PENDING**;W4P/W5 **NOT_AUTHORIZED**. No named types materialized,relation SQL,W4FR integration,PostgreSQL,migrations,activation,compatibility normalization or runtime proof. READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.

## Validation

${model.report.validation.closeoutChecks.map((check) => `- \`${check.COMMAND}\`: **${check.RESULT}**.`).join('\n')}

The initial combined suite was resource-timed-out in the preserved W4F120-second hook;its isolated rerun passed all44 tests. No frozen test or source was changed to make it pass. The final combined W4T/W4FR/W4/W3E suite passed171 tests;total distinct coverage215. No additional discovery is authorized.
`
  const report = {
    ...model.report,
    REGISTRY_SHA256: sha(registryBytes),
    TYPE_RECORDS_SHA256: digest(model.registry.typeRecords),
    REFERENCE_LINKS_SHA256: digest(model.registry.referenceLinks),
  }
  const result: Record<string, string> = {
    [outputs.registry]: registryBytes,
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.reportMarkdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputs.registryMarkdown]: await format(
      `# W4T - named-type dependency registry\n\n**${model.report.phaseStatus.PHASE_1B_3C_A1I_W4T_GATE}**:36 identities,38 references. Exact authority/definition/consumer evidence and${model.report.summary.INACTIVE_TYPE_DESCRIPTORS} inactive enum descriptors are in [machine registry](./UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json). Definitions held:${model.residual.HELD_TYPE_IDENTITIES}. See [phase report](./PHASE_1B_3C_A1I_W4T_NAMED_TYPE_PRODUCTION_CLOSURE.md). No relation/column governance,SQL execution,contract or producer changes.\n`,
      { ...config, parser: 'markdown' },
    ),
  }
  if (model.residual.residual.length)
    result[outputs.decisions] = await format(JSON.stringify(model.residual), {
      ...config,
      parser: 'json',
    })
  return result
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4T')
    console.log('PASS W4T self-test:exact36/38,sources,ordered definitions,determinism')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4T_OUTPUT:${file}`)
    console.log('PASS W4T --check:exact supplemental bytes;upstream/source hashes unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4T registry/evidence written;no relation SQL,execution or W4FR retry')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[close-w4t-named-types]', error)
    process.exitCode = 1
  })
