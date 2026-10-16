import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = 'docs/union-eyes/reality-remediation/'
const output = `${base}PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS`
const checkOnly = process.argv.includes('--check')
const hash = (value) => createHash('sha256').update(value).digest('hex')
const jsonHash = (value) => hash(JSON.stringify(value))
const absolute = (file) => path.resolve(root, ...file.split('/'))
const relative = (file) => path.relative(root, file).split(path.sep).join('/')
const unique = (values) => [...new Set(values)].sort()
const id = (kind, value) => `UE-1B3A-${kind}-${hash(value).slice(0, 16)}`
const consumed = new Map()
function read(file) {
  const bytes = readFileSync(absolute(file))
  const text = bytes.toString('utf8')
  consumed.set(file, {
    FILE: file,
    SHA256: hash(bytes),
    LINE_START: 1,
    LINE_END: text.split('\n').length,
    RANGE_SHA256: hash(text),
  })
  return text
}
const inputHashes = {
  PHASE_1B_2B2B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION:
    '6199022b0cb3732b7a573b74613e8b6d0527862d8909fd23b084124d4fce7712',
  PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS:
    '089823c216c5f845740c1da1cb64f4fed1b6c3edb19c65ca0fd9931a48b3caa9',
  PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT:
    '57cb807cc0a43d091fb4bc8a03dbb43cff9b26a557576fc3af915f7a38214bc7',
  PHASE_1B_1_R2B_AUTHORITY_OBJECT_CLOSEOUT:
    '55c8524404ef06c310b25e24f0acb96f270221d8a0351c770a4c2e7bed8a000d',
  PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS:
    '8a0ab63ebfcba1590a64668d86200b696447892d7e400f82551ed8364800d5ef',
}
const accepted = Object.fromEntries(
  Object.entries(inputHashes).map(([name, expected]) => {
    const file = `${base}${name}.json`
    const text = read(file)
    assert.equal(hash(text), expected, `Accepted input drift: ${file}`)
    return [name, JSON.parse(text)]
  }),
)
const finalModel = accepted.PHASE_1B_2B2B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION
const entryModel = accepted.PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS
const r2b = accepted.PHASE_1B_1_R2B_AUTHORITY_OBJECT_CLOSEOUT
const r2c = accepted.PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT
const authority = accepted.PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS
assert.equal(finalModel.phaseState.PHASE_1B_2, 'SOURCE_CEILING_ACCEPTED')
assert.equal(finalModel.phaseState.PHASE_1B_3, 'AUTHORIZED_NOT_STARTED')
assert.equal(finalModel.reconciledEntryDispositions.length, 1910)
assert.equal(finalModel.knownEnforcementDefects.length, 1710)
assert.equal(finalModel.sourceCeilings.length, 3672)
assert.equal(finalModel.frozenB1Registers.historicalPageExpectations.RECORDS.length, 43)
const frozenPayloadHashes = {
  FINAL_SERVER_ENTRY_DISPOSITIONS: jsonHash(finalModel.reconciledEntryDispositions),
  PHASE_1B_2_FINDINGS: jsonHash(finalModel.knownEnforcementDefects),
  PHASE_1B_2_CEILINGS: jsonHash(finalModel.sourceCeilings),
  HISTORICAL_PAGES: jsonHash(finalModel.frozenB1Registers.historicalPageExpectations),
  R2B_RECORDS: jsonHash(r2b.records),
  R2C_RECORDS: jsonHash(r2c.records),
}
const validEntryIds = new Set(entryModel.ENTRIES.map((entry) => entry.ENTRY_ID))
assert.equal(validEntryIds.size, 1910)
assert.deepEqual(
  unique(finalModel.reconciledEntryDispositions.map((entry) => entry.ENTRY_ID)),
  [...validEntryIds].sort(),
)

const ceilings = new Map()
function ceiling(kind, key, objects, entries, why, required, evidence = []) {
  const ceilingId = id('CEILING', `${kind}|${key}`)
  ceilings.set(ceilingId, {
    SOURCE_CEILING_ID: ceilingId,
    CEILING_CLASS: kind,
    AFFECTED_OBJECTS: unique(objects),
    AFFECTED_ENTRY_IDS: unique(entries),
    WHY_STATIC_SOURCE_CANNOT_RESOLVE: why,
    ADDITIONAL_EVIDENCE_TYPE_REQUIRED: required,
    SOURCE_EVIDENCE: evidence,
  })
  return ceilingId
}
const sourceEvidence = (file, start = 1, end = consumed.get(file)?.LINE_END ?? start) => ({
  FILE: file,
  LINE_START: start,
  LINE_END: end,
  FILE_SHA256: consumed.get(file)?.SHA256,
})
const excludedDirectories = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '__tests__',
  '__mocks__',
  'tests',
  'fixtures',
])
function walk(directory, extension) {
  if (!existsSync(absolute(directory))) return []
  return readdirSync(absolute(directory), { withFileTypes: true })
    .flatMap((item) => {
      const file = `${directory}/${item.name}`
      if (item.isDirectory()) return excludedDirectories.has(item.name) ? [] : walk(file, extension)
      return item.isFile() && file.endsWith(extension) ? [file] : []
    })
    .sort()
}
function scopeFor(file) {
  return file.startsWith('apps/union-eyes/services/financial-service/')
    ? 'financial-service'
    : 'union-eyes'
}
const objects = new Map()
const authorityById = new Map(
  authority.persistenceUniverse.map((object) => [object.objectId, object]),
)
const r2bById = new Map(r2b.records.map((record) => [record.objectId, record]))
function physical(scope, name) {
  const parts = name.replace(/"/g, '').split('.')
  assert.ok(
    parts.length <= 2 && parts.every((part) => /^[A-Za-z_][\w$]*$/.test(part)),
    `Invalid relational identity: ${name}`,
  )
  const schema = parts.length === 2 ? parts[0] : 'public'
  const objectName = parts.at(-1)
  return {
    scope,
    schema,
    objectName,
    qualified: `${schema}.${objectName}`,
    key: `${scope}::${schema}.${objectName}`,
  }
}
function addObject(scope, name, origin, evidence = [], entryIds = [], type = 'TABLE') {
  const p = physical(scope, name)
  if (!objects.has(p.key)) {
    const prior = authorityById.get(p.key)
    const bounded = r2bById.get(p.key)
    const targetCeilings = r2c.records.filter(
      (record) =>
        record.FINAL_TARGET_DISPOSITION.includes('CEILING') &&
        [
          ...(record.TARGET_OBJECT_IDS ?? []),
          ...(record.POSSIBLE_TARGET_OBJECT_IDS ?? []),
        ].includes(p.key),
    )
    objects.set(p.key, {
      OBJECT_ID: p.key,
      DATABASE_SCOPE: scope,
      SCHEMA: p.schema,
      OBJECT_NAME: p.objectName,
      OBJECT_TYPE: type,
      QUALIFIED_NAME: p.qualified,
      SURFACE_ORIGIN: [],
      SOURCE_EVIDENCE: [],
      PHASE_1B1_OBJECT_ID: prior?.objectId ?? null,
      PHASE_1B1_AUTHORITY_DISPOSITION:
        bounded?.finalDisposition ?? prior?.authorityClass ?? 'NO_FROZEN_AUTHORITY_RECORD',
      PHASE_1B1_KNOWN_DEFECT_IDS: bounded?.knownDefectId ? [bounded.knownDefectId] : [],
      PHASE_1B1_TARGET_RESOLUTION_CEILING: targetCeilings.length ? 'YES' : 'NO',
      PHASE_1B1_TARGET_RESOLUTION_CHAIN_IDS: targetCeilings.map((record) => record.CHAIN_ID),
      PHASE_1B1_DISPOSITION_UNCHANGED: 'YES',
      REACHABLE_FROM_ENTRY_IDS: [],
      COLUMNS: unique(
        (prior?.declarations ?? []).flatMap((d) => d.columns.map((c) => c.databaseColumn)),
      ),
      POLICY_IDS: [],
      RLS_EVENTS: [],
      OWNER_IDENTITY: 'SOURCE_CEILING',
      OWNER_RLS_BEHAVIOR_SOURCE_STATUS: 'SOURCE_CEILING',
    })
  }
  const object = objects.get(p.key)
  object.SURFACE_ORIGIN = unique([...object.SURFACE_ORIGIN, origin])
  object.SOURCE_EVIDENCE.push(...evidence)
  object.REACHABLE_FROM_ENTRY_IDS = unique([...object.REACHABLE_FROM_ENTRY_IDS, ...entryIds])
  if (type !== 'TABLE') object.OBJECT_TYPE = type
  return object
}
for (const target of authority.persistenceUniverse) {
  if (
    !target.productionAccessObserved &&
    !target.accessReferences.length &&
    !target.phase1aEffects.length
  )
    continue
  addObject(target.databaseScope, target.qualifiedName, 'ACCEPTED_PHASE_1B1_TARGET')
}
for (const record of r2c.records) {
  for (const target of record.TARGET_OBJECT_IDS ?? []) {
    const prior = authorityById.get(target)
    if (prior) addObject(prior.databaseScope, prior.qualifiedName, 'ACCEPTED_PHASE_1B1_TARGET')
  }
}

// Resolve only imports reachable from accepted UE entries, never another app.
const modules = new Map()
const imports = new Map()
const moduleEntries = new Map()
const importLinks = []
const boundedExternalModuleLoads = []
function resolveModule(from, specifier) {
  let file
  if (specifier.startsWith('.'))
    file = relative(path.resolve(path.dirname(absolute(from)), specifier))
  else if (specifier.startsWith('@/')) file = `apps/union-eyes/${specifier.slice(2)}`
  else if (specifier.startsWith('@nzila/')) {
    const [name, ...subpath] = specifier.slice(7).split('/')
    const packageFile = `packages/${name}/package.json`
    if (!existsSync(absolute(packageFile))) return null
    const pkg = JSON.parse(read(packageFile))
    let exported = pkg.exports?.[subpath.length ? `./${subpath.join('/')}` : '.']
    if (typeof exported === 'object')
      exported = exported.import ?? exported.default ?? exported.types
    file =
      typeof exported === 'string'
        ? `packages/${name}/${exported.replace(/^\.\//, '')}`
        : `packages/${name}/src/${subpath.join('/') || 'index'}`
  } else return null
  if (!file.startsWith('apps/union-eyes/') && !file.startsWith('packages/')) return null
  return (
    [file, `${file}.ts`, `${file}.tsx`, `${file}.js`, `${file}/index.ts`, `${file}/index.tsx`].find(
      (candidate) => existsSync(absolute(candidate)) && !readdirSafeDirectory(candidate),
    ) ?? null
  )
}
function readdirSafeDirectory(file) {
  return !/\.[cm]?[jt]sx?$/.test(file)
}
function parseModule(file) {
  if (modules.has(file)) return modules.get(file)
  const text = read(file)
  const ast = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  modules.set(file, ast)
  const edges = []
  for (const statement of ast.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.isTypeOnly ||
      (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly)
    )
      continue
    const specifier = statement.moduleSpecifier.text
    const resolved = resolveModule(file, specifier)
    const bindings = []
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.name) bindings.push({ local: clause.name.text, imported: 'default' })
      const named = clause?.namedBindings
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements)
          if (!element.isTypeOnly)
            bindings.push({
              local: element.name.text,
              imported: element.propertyName?.text ?? element.name.text,
            })
      } else if (named && ts.isNamespaceImport(named))
        bindings.push({ local: named.name.text, imported: '*' })
    } else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements)
        bindings.push({
          local: element.name.text,
          imported: element.propertyName?.text ?? element.name.text,
        })
    } else bindings.push({ local: '*', imported: '*' })
    edges.push({
      specifier,
      resolved,
      bindings,
      line: ast.getLineAndCharacterOfPosition(statement.getStart(ast)).line + 1,
    })
    if (
      !resolved &&
      (specifier.startsWith('@/') || specifier.startsWith('.') || specifier.startsWith('@nzila/'))
    ) {
      ceiling(
        'OTHER_EXPLICIT',
        `${file}:${specifier}`,
        [],
        [],
        'A reachable local/workspace persistence dependency cannot be resolved by checked-in module exports.',
        'Exact package/alias export resolution evidence',
        [sourceEvidence(file, edges.at(-1).line, edges.at(-1).line)],
      )
    }
  }
  visit(ast, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !(
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')
      )
    )
      return
    const specifier = stringValue(node.arguments[0])
    if (!specifier) {
      let owner = node.parent
      while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent
      const parameter = owner?.parameters.findIndex(
        (p) =>
          ts.isIdentifier(p.name) &&
          ts.isIdentifier(node.arguments[0]) &&
          p.name.text === node.arguments[0].text,
      )
      if (
        owner?.name &&
        parameter >= 0 &&
        !owner.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const selections = []
        let escaped = false
        visit(ast, (reference) => {
          if (
            !ts.isIdentifier(reference) ||
            reference.text !== owner.name.text ||
            reference === owner.name
          )
            return
          const call = reference.parent
          if (!ts.isCallExpression(call) || call.expression !== reference) {
            escaped = true
            return
          }
          const selected = stringValue(call.arguments[parameter])
          if (
            !selected ||
            /^(?:\.|@\/|@nzila\/)/.test(selected) ||
            /(?:postgres|drizzle|prisma|supabase|mysql|sql|database|rds|sequelize|knex|^pg$)/i.test(
              selected,
            )
          )
            escaped = true
          else selections.push(selected)
        })
        if (!escaped && selections.length) {
          boundedExternalModuleLoads.push({
            SOURCE: range(ast, node),
            MODULE_SPECIFIERS: unique(selections),
            SCOPE_CLASS: 'CLOSED_PRIVATE_HELPER_EXTERNAL_NON_RELATIONAL_MODULE_SELECTION',
          })
          return
        }
      }
      ceiling(
        'OTHER_EXPLICIT',
        `${file}:${node.getStart(ast)}:dynamic-import`,
        [],
        [],
        'Runtime-computed module loading cannot be resolved from a literal import.',
        'Bounded computed module selection evidence',
        [range(ast, node)],
      )
      return
    }
    const resolved = resolveModule(file, specifier)
    edges.push({
      specifier,
      resolved,
      bindings: [{ local: '*', imported: '*' }],
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      DYNAMIC_LITERAL_IMPORT: 'YES',
    })
    if (!resolved && /^(?:\.|@\/|@nzila\/)/.test(specifier))
      ceiling(
        'OTHER_EXPLICIT',
        `${file}:${specifier}`,
        [],
        [],
        'A literal dynamic local/workspace import lacks an exact checked-in module resolution.',
        'Exact module resolution',
        [range(ast, node)],
      )
  })
  imports.set(file, edges)
  return ast
}
const graphQueue = unique(entryModel.ENTRIES.map((entry) => entry.SOURCE_FILE))
for (let index = 0; index < graphQueue.length; index++) {
  const file = graphQueue[index]
  if (!existsSync(absolute(file))) throw new Error(`Missing accepted entry source: ${file}`)
  parseModule(file)
  for (const edge of imports.get(file)) {
    if (!edge.resolved || /(?:\.test\.|\.spec\.|\/__tests__\/)/.test(edge.resolved)) continue
    if (!graphQueue.includes(edge.resolved)) graphQueue.push(edge.resolved)
  }
  for (const entry of entryModel.ENTRIES) {
    for (const evidence of entry.BOUNDARY_EVIDENCE) {
      const ast = parseModule(evidence.SOURCE_FILE)
      const lines = ast.text.split(/\r?\n/)
      const excerpt = lines.slice(evidence.LINE_START - 1, evidence.LINE_END).join('\n')
      assert.equal(
        hash(excerpt),
        evidence.RANGE_SHA256,
        `Accepted entry boundary source drift: ${entry.ENTRY_ID} ${evidence.SOURCE_FILE}:${evidence.LINE_START}`,
      )
    }
  }
}
const parents = new Map()
for (const entry of entryModel.ENTRIES) {
  const queue = [entry.SOURCE_FILE]
  const seen = new Set()
  const previous = new Map([[entry.SOURCE_FILE, null]])
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index]
    if (seen.has(file)) continue
    seen.add(file)
    if (!moduleEntries.has(file)) moduleEntries.set(file, new Set())
    moduleEntries.get(file).add(entry.ENTRY_ID)
    if (!parents.has(`${entry.ENTRY_ID}|${file}`))
      parents.set(`${entry.ENTRY_ID}|${file}`, previous.get(file))
    for (const edge of imports.get(file) ?? [])
      if (edge.resolved && modules.has(edge.resolved) && !seen.has(edge.resolved)) {
        if (!previous.has(edge.resolved)) previous.set(edge.resolved, file)
        queue.push(edge.resolved)
      }
  }
}
function boundedPath(entryId, destination) {
  const result = []
  let file = destination
  const seen = new Set()
  while (file && !seen.has(file)) {
    seen.add(file)
    result.unshift(file)
    file = parents.get(`${entryId}|${file}`)
  }
  return result
}
function visit(node, fn) {
  fn(node)
  ts.forEachChild(node, (child) => visit(child, fn))
}
function stringValue(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null
}
function range(ast, node) {
  return sourceEvidence(
    ast.fileName,
    ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
    ast.getLineAndCharacterOfPosition(node.end).line + 1,
  )
}
function enclosingSymbol(node) {
  for (let current = node; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text
    if (ts.isMethodDeclaration(current)) return current.name.getText()
  }
  return 'MODULE_SCOPE'
}
const declarations = new Map()
const tableAliases = new Map()
for (const object of objects.values()) {
  for (const declaration of authorityById.get(object.OBJECT_ID)?.declarations ?? []) {
    if (existsSync(absolute(declaration.file))) parseModule(declaration.file)
  }
}
for (const [file, ast] of modules) {
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isIdentifier(declaration.initializer) ||
            ts.isPropertyAccessExpression(declaration.initializer))
        )
          tableAliases.set(`${file}|${declaration.name.text}`, declaration.initializer.getText(ast))
      }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        if (element.propertyName)
          tableAliases.set(`${file}|${element.name.text}`, element.propertyName.text)
  }
  const schemas = new Map()
  visit(ast, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      !node.initializer ||
      !ts.isCallExpression(node.initializer)
    )
      return
    const call = node.initializer
    if (call.expression.getText(ast) === 'pgSchema' && stringValue(call.arguments[0]))
      schemas.set(node.name.text, stringValue(call.arguments[0]))
  })
  visit(ast, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      !node.initializer ||
      !ts.isCallExpression(node.initializer)
    )
      return
    const call = node.initializer
    const expression = call.expression.getText(ast)
    const tableName = stringValue(call.arguments[0])
    if (
      !tableName ||
      !(
        expression === 'pgTable' ||
        expression === 'pgView' ||
        expression === 'pgMaterializedView' ||
        (ts.isPropertyAccessExpression(call.expression) &&
          schemas.has(call.expression.expression.getText(ast)) &&
          ['table', 'view', 'materializedView'].includes(call.expression.name.text))
      )
    )
      return
    const schema = ts.isPropertyAccessExpression(call.expression)
      ? schemas.get(call.expression.expression.getText(ast))
      : 'public'
    const columns = []
    const body = call.arguments[1]
    if (body && ts.isObjectLiteralExpression(body))
      for (const prop of body.properties) {
        if (!ts.isPropertyAssignment(prop)) continue
        let initializer = prop.initializer
        while (
          ts.isCallExpression(initializer) &&
          ts.isPropertyAccessExpression(initializer.expression)
        )
          initializer = initializer.expression.expression
        if (ts.isCallExpression(initializer))
          columns.push(
            stringValue(initializer.arguments[0]) ?? prop.name.getText(ast).replace(/['"]/g, ''),
          )
      }
    declarations.set(`${file}|${node.name.text}`, {
      scope: scopeFor(file),
      name: `${schema}.${tableName}`,
      columns,
      source: range(ast, node),
      type: /materialized/i.test(expression)
        ? 'MATERIALIZED_VIEW'
        : /view/i.test(expression)
          ? 'VIEW'
          : 'TABLE',
    })
  })
}
function resolveTable(file, symbol, seen = new Set()) {
  const key = `${file}|${symbol}`
  if (seen.has(key)) return []
  seen.add(key)
  if (declarations.has(key)) return [declarations.get(key)]
  if (tableAliases.has(key)) return resolveTable(file, tableAliases.get(key), seen)
  const matches = []
  for (const edge of imports.get(file) ?? []) {
    if (!edge.resolved) continue
    for (const binding of edge.bindings) {
      if (binding.local === symbol)
        matches.push(...resolveTable(edge.resolved, binding.imported, seen))
      if (symbol.startsWith(`${binding.local}.`) && binding.imported !== '*')
        matches.push(
          ...resolveTable(
            edge.resolved,
            `${binding.imported}.${symbol.slice(binding.local.length + 1)}`,
            seen,
          ),
        )
      if (binding.local === '*' && binding.imported === '*')
        matches.push(...resolveTable(edge.resolved, symbol, seen))
      if (binding.imported === '*' && symbol.startsWith(`${binding.local}.`))
        matches.push(...resolveTable(edge.resolved, symbol.slice(binding.local.length + 1), seen))
    }
  }
  return [...new Map(matches.map((record) => [`${record.scope}|${record.name}`, record])).values()]
}
function resolveLocalTable(file, symbol, node) {
  const ast = modules.get(file)
  let initializer
  for (let scope = node.parent; scope; scope = scope.parent) {
    if (!(ts.isBlock(scope) || ts.isSourceFile(scope))) continue
    for (const statement of scope.statements)
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (ts.isIdentifier(declaration.name) && declaration.name.text === symbol)
            initializer = declaration.initializer
          else if (
            ts.isObjectBindingPattern(declaration.name) &&
            declaration.name.elements.some(
              (element) =>
                ts.isIdentifier(element.name) &&
                element.name.text === symbol &&
                (element.propertyName?.getText(ast) ?? symbol) === 'table',
            ) &&
            declaration.initializer &&
            ts.isIdentifier(declaration.initializer) &&
            ts.isFunctionDeclaration(scope.parent) &&
            scope.parent.name
          ) {
            const parameterIndex = scope.parent.parameters.findIndex(
              (parameter) =>
                ts.isIdentifier(parameter.name) &&
                parameter.name.text === declaration.initializer.text,
            )
            if (parameterIndex >= 0)
              return resolveOptionsTargets(file, scope.parent.name.text, parameterIndex)
          }
    if (initializer) break
  }
  if (
    !initializer ||
    !ts.isElementAccessExpression(initializer) ||
    !ts.isIdentifier(initializer.expression)
  )
    return []
  const mappingName = initializer.expression.text
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== mappingName) continue
      let mapping = declaration.initializer
      while (mapping && (ts.isAsExpression(mapping) || ts.isParenthesizedExpression(mapping)))
        mapping = mapping.expression
      if (
        !mapping ||
        !ts.isObjectLiteralExpression(mapping) ||
        mapping.properties.some((property) => !ts.isPropertyAssignment(property))
      )
        return []
      const targets = mapping.properties.map((property) =>
        resolveTable(file, property.initializer.getText(ast)),
      )
      if (targets.some((matches) => !matches.length)) return []
      return [
        ...new Map(
          targets.flat().map((target) => [`${target.scope}|${target.name}`, target]),
        ).values(),
      ]
    }
  }
  return []
}
function referencesFunction(file, symbol, targetFile, targetName, seen = new Set()) {
  const key = `${file}|${symbol}`
  if (seen.has(key)) return false
  seen.add(key)
  if (file === targetFile && symbol === targetName) return true
  for (const edge of imports.get(file) ?? []) {
    if (!edge.resolved) continue
    for (const binding of edge.bindings) {
      const imported =
        binding.local === symbol
          ? binding.imported
          : binding.local === '*'
            ? symbol
            : binding.imported === '*' && symbol.startsWith(`${binding.local}.`)
              ? symbol.slice(binding.local.length + 1)
              : null
      if (imported && referencesFunction(edge.resolved, imported, targetFile, targetName, seen))
        return true
    }
  }
  return false
}
const optionTargetCache = new Map()
const boundedFactoryTargetSets = []
function resolveOptionsTargets(targetFile, targetName, parameterIndex) {
  const key = `${targetFile}|${targetName}|${parameterIndex}`
  if (optionTargetCache.has(key)) return optionTargetCache.get(key)
  const targets = []
  let unresolved = false
  let calls = 0
  const unresolvedCalls = []
  for (const [file, ast] of modules)
    visit(ast, (call) => {
      if (
        !ts.isCallExpression(call) ||
        !referencesFunction(file, call.expression.getText(ast), targetFile, targetName)
      )
        return
      calls++
      const options = call.arguments[parameterIndex]
      const property =
        options &&
        ts.isObjectLiteralExpression(options) &&
        !options.properties.some((property) => ts.isSpreadAssignment(property))
          ? options.properties.find(
              (property) =>
                ts.isPropertyAssignment(property) &&
                property.name.getText(ast).replace(/['"]/g, '') === 'table',
            )
          : null
      let expression = property?.initializer
      while (
        expression &&
        (ts.isAsExpression(expression) ||
          ts.isParenthesizedExpression(expression) ||
          ts.isNonNullExpression(expression))
      )
        expression = expression.expression
      const resolved = expression ? resolveTable(file, expression.getText(ast)) : []
      if (!resolved.length) {
        unresolved = true
        unresolvedCalls.push({
          SOURCE: range(ast, call),
          OPTIONS_ARGUMENT: options?.getText(ast) ?? null,
          TABLE_EXPRESSION: expression?.getText(ast) ?? null,
        })
      }
      targets.push(...resolved)
    })
  const result =
    calls && !unresolved
      ? [...new Map(targets.map((target) => [`${target.scope}|${target.name}`, target])).values()]
      : []
  optionTargetCache.set(key, result)
  boundedFactoryTargetSets.push({
    FACTORY_FILE: targetFile,
    FACTORY_SYMBOL: targetName,
    SOURCE_CALL_COUNT: calls,
    TARGET_SET_CLOSED: calls && !unresolved ? 'YES' : 'NO',
    POSSIBLE_TARGET_OBJECT_IDS: unique(
      targets.map((target) => physical(target.scope, target.name).key),
    ),
    UNRESOLVED_SOURCE_CALLS: unresolvedCalls,
    LINKAGE_LIMITATION:
      'Finite source options, not caller execution or runtime target selection proof',
  })
  return result
}
const operationLinks = []
const unresolvedOperationLinks = []
for (const [file, ast] of modules)
  visit(ast, (node) => {
    const queryMatch =
      ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        ? node.expression.expression.getText(ast).match(/^(\w+)\.query\.(\w+)$/)
        : null
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      (!queryMatch &&
        ![
          'from',
          'insert',
          'update',
          'delete',
          'join',
          'leftJoin',
          'innerJoin',
          'rightJoin',
        ].includes(node.expression.name.text))
    )
      return
    const argument = node.arguments[0]
    const symbol = queryMatch?.[2] ?? argument?.getText(ast) ?? 'NO_EXPLICIT_TARGET_ARGUMENT'
    let targets = queryMatch ? [] : resolveTable(file, symbol)
    if (!queryMatch && !targets.length) targets = resolveLocalTable(file, symbol, node)
    if (queryMatch) {
      const clientImport = (imports.get(file) ?? []).find((edge) =>
        edge.bindings.some((binding) => binding.local === queryMatch[1]),
      )
      const targetScope = clientImport?.resolved ? scopeFor(clientImport.resolved) : scopeFor(file)
      const importedMatches = resolveTable(file, symbol).filter(
        (declaration) => declaration.scope === targetScope,
      )
      const matches = importedMatches.length
        ? importedMatches
        : [...declarations]
            .filter(
              ([key, declaration]) =>
                key.endsWith(`|${symbol}`) && declaration.scope === targetScope,
            )
            .map(([, declaration]) => declaration)
      targets = [
        ...new Map(matches.map((record) => [`${record.scope}|${record.name}`, record])).values(),
      ]
      if (targets.length !== 1) targets = []
    }
    if (!targets.length) {
      const receiver = node.expression.expression.getText(ast)
      if (/\b(?:db|tx|database|systemDb|authDb)\b/.test(receiver)) {
        unresolvedOperationLinks.push({
          SOURCE: range(ast, node),
          SYMBOL: symbol,
          OPERATION: node.expression.name.text,
          ENTRY_IDS: [...(moduleEntries.get(file) ?? [])],
        })
        ceiling(
          'RELATIONAL_OBJECT_IDENTITY',
          `${file}:${node.getStart(ast)}:${symbol}`,
          [],
          [...(moduleEntries.get(file) ?? [])],
          `Database operation uses ${symbol}, but its exact relational declaration cannot be resolved through static named exports.`,
          'Exact symbol-to-schema mapping or bounded dynamic selection evaluation',
          [range(ast, node)],
        )
      }
      return
    }
    const entries = [...(moduleEntries.get(file) ?? [])]
    for (const target of targets) {
      const isShared = file.startsWith('packages/')
      const origin =
        isShared || !authorityById.has(physical(target.scope, target.name).key)
          ? 'SHARED_AUTH_DB_DEPENDENCY'
          : 'ACCEPTED_PHASE_1B1_TARGET'
      const object = addObject(
        target.scope,
        target.name,
        origin,
        [target.source, range(ast, node)],
        entries,
        target.type,
      )
      object.COLUMNS = unique([...object.COLUMNS, ...target.columns])
      operationLinks.push({
        OBJECT_ID: object.OBJECT_ID,
        SOURCE: range(ast, node),
        SYMBOL: symbol,
        OPERATION: node.expression.name.text,
        ENTRY_IDS: entries,
        LINKAGE_CLASS: 'CONSERVATIVE_STATIC_MODULE_IMPORT_PATH_NOT_FUNCTION_EXECUTION_PROOF',
        TARGET_SELECTION:
          targets.length > 1
            ? 'FINITE_STATIC_TARGET_MAP_CANDIDATE_NOT_RUNTIME_SELECTION'
            : 'STATIC_SYMBOL_DECLARATION',
      })
    }
  })

// PostgreSQL lexical tokens keep strings/dollar bodies distinct from executable SQL.
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
      assert.ok(end >= 0, 'Unterminated SQL dollar body')
      tokens.push({
        kind: 'body',
        value: sql.slice(i + dollar.length, end),
        start: offset + start,
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
      if (word) {
        i += word.length
        tokens.push({ kind: 'word', value: word, start: offset + start, end: offset + i })
      } else {
        const operator = sql.slice(i).match(/^(?:::|\|\||:=|<=|>=|<>|!=)/)?.[0] ?? sql[i]
        i += operator.length
        tokens.push({ kind: 'punct', value: operator, start: offset + start, end: offset + i })
      }
    }
  }
  return tokens
}
const is = (token, value) => token?.kind === 'word' && token.value.toUpperCase() === value
function closing(tokens, start) {
  assert.equal(tokens[start]?.value, '(')
  let depth = 0
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].value === '(' && tokens[i].kind === 'punct') depth++
    if (tokens[i].value === ')' && tokens[i].kind === 'punct' && --depth === 0) return i
  }
  assert.fail('Unbalanced SQL parentheses')
}
function splitArguments(tokens) {
  const parts = [[]]
  let depth = 0
  for (const token of tokens) {
    if (token.kind === 'punct' && token.value === '(') depth++
    if (token.kind === 'punct' && token.value === ')') depth--
    if (token.kind === 'punct' && token.value === ',' && depth === 0) parts.push([])
    else parts.at(-1).push(token)
  }
  return parts
}
function identifier(tokens, start) {
  const token = tokens[start]
  if (!token || !['word', 'identifier'].includes(token.kind)) return null
  let name = token.kind === 'identifier' ? token.value : token.value.toLowerCase()
  let end = start + 1
  if (tokens[end]?.value === '.' && ['word', 'identifier'].includes(tokens[end + 1]?.kind)) {
    name += `.${tokens[end + 1].kind === 'identifier' ? tokens[end + 1].value : tokens[end + 1].value.toLowerCase()}`
    end += 2
  }
  return { name, end }
}
function render(tokens) {
  return tokens
    .map((token) =>
      token.kind === 'string'
        ? `'${token.value.replace(/'/g, "''")}'`
        : token.kind === 'identifier'
          ? `"${token.value.replace(/"/g, '""')}"`
          : token.value,
    )
    .join(' ')
}
function literal(tokens, bindings) {
  if (tokens.length === 1) {
    const token = tokens[0]
    if (token.kind === 'string') return token.value
    if (is(token, 'TRUE')) return true
    if (is(token, 'FALSE')) return false
    if (is(token, 'NULL')) return null
    if (bindings.has(token.value)) return bindings.get(token.value)
  }
  if (tokens.some((token) => token.value === '||') && !is(tokens[0], 'FORMAT')) {
    const segments = [[]]
    for (const token of tokens) {
      if (token.value === '||') segments.push([])
      else segments.at(-1).push(token)
    }
    const values = segments.map((segment) => literal(segment, bindings))
    if (values.every((value) => typeof value === 'string')) return values.join('')
  }
  if (is(tokens[0], 'FORMAT') && tokens[1]?.value === '(') {
    const args = splitArguments(tokens.slice(2, closing(tokens, 1))).map((part) =>
      literal(part, bindings),
    )
    if (typeof args[0] !== 'string' || args.slice(1).some((value) => value === undefined))
      return undefined
    let index = 1
    return args[0].replace(/%%|%([ILs])/g, (match, type) => {
      if (match === '%%') return '%'
      assert.ok(index < args.length, 'SQL format argument missing')
      const value = args[index++]
      return type === 'I'
        ? `"${String(value).replace(/"/g, '""')}"`
        : type === 'L'
          ? value === null
            ? 'NULL'
            : `'${String(value).replace(/'/g, "''")}'`
          : String(value)
    })
  }
  return undefined
}
const policies = new Map()
const functions = new Map()
const grants = []
const roles = new Map()
const views = new Map()
const sqlColumns = new Map()
const triggers = []
const sqlEvents = []
const dynamicSql = []
const commands = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
function sqlEvidence(file, text, token, endToken = token, extra = {}) {
  return {
    ...sourceEvidence(
      file,
      text.slice(0, token.start).split('\n').length,
      text.slice(0, endToken.end).split('\n').length,
    ),
    ...extra,
  }
}
function referencedRelations(tokens, scope) {
  const result = []
  const expressionStack = []
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].kind === 'punct' && tokens[index].value === '(')
      expressionStack.push(tokens[index - 1]?.value?.toUpperCase())
    if (tokens[index].kind === 'punct' && tokens[index].value === ')') expressionStack.pop()
    if (
      !(
        is(tokens[index], 'FROM') ||
        is(tokens[index], 'JOIN') ||
        is(tokens[index], 'UPDATE') ||
        is(tokens[index], 'INTO')
      )
    )
      continue
    if (
      expressionStack.at(-1) === 'EXTRACT' ||
      (is(tokens[index], 'FROM') && is(tokens[index - 1], 'DISTINCT')) ||
      (is(tokens[index], 'UPDATE') && is(tokens[index - 1], 'FOR'))
    )
      continue
    const relation = identifier(tokens, index + 1)
    if (
      !relation ||
      [
        'SELECT',
        'VALUES',
        'SET',
        'TO',
        'ON',
        'WHERE',
        'USING',
        'WITH',
        'RETURNING',
        'pg_policies',
        'pg_roles',
        'information_schema.columns',
      ].includes(relation.name.toUpperCase()) ||
      /^(?:pg_policies|pg_roles|information_schema\.columns)$/.test(relation.name)
    )
      continue
    if (tokens[relation.end]?.value === '(') continue
    if (/^(pg_|information_schema\.)/.test(relation.name)) continue
    result.push(physical(scope, relation.name).key)
  }
  return unique(result)
}
function processSql(file, text, scope, tokens = lex(text), inheritedEvidence = null, depth = 0) {
  assert.ok(depth < 10, 'SQL source expansion recursion limit')
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const evidence = inheritedEvidence ?? sqlEvidence(file, text, token)
    if (token.kind === 'body') {
      processSql(file, text, scope, lex(token.value, token.bodyStart), inheritedEvidence, depth + 1)
      continue
    }
    if (
      is(token, 'CREATE') &&
      (is(tokens[i + 1], 'FUNCTION') ||
        (is(tokens[i + 1], 'OR') && is(tokens[i + 2], 'REPLACE') && is(tokens[i + 3], 'FUNCTION')))
    ) {
      const start = is(tokens[i + 1], 'FUNCTION') ? i + 2 : i + 4
      const name = identifier(tokens, start)
      assert.ok(
        name && tokens[name.end]?.value === '(',
        `Unrecognized function definition in ${file}`,
      )
      const endParams = closing(tokens, name.end)
      let bodyIndex = endParams + 1
      while (
        bodyIndex < tokens.length &&
        tokens[bodyIndex].kind !== 'body' &&
        tokens[bodyIndex].value !== ';'
      )
        bodyIndex++
      const body = tokens[bodyIndex]
      if (!body || body.kind !== 'body') {
        ceiling(
          'FUNCTION_SECURITY',
          `${file}:${token.start}`,
          [],
          [],
          'Function body is not a literal dollar-quoted definition.',
          'Exact SQL function body and execution semantics',
          [evidence],
        )
        continue
      }
      let end = bodyIndex + 1
      while (end < tokens.length && tokens[end].value !== ';') end++
      const header = render(tokens.slice(i, end).filter((token) => token.kind !== 'body'))
      const functionId = id(
        'FUNCTION',
        `${scope}|${name.name}|${render(tokens.slice(name.end, endParams + 1))}`,
      )
      const params = splitArguments(tokens.slice(name.end + 1, endParams))
        .filter((part) => part.length)
        .map((part) => {
          const defaultIndex = part.findIndex((t) => is(t, 'DEFAULT') || t.value === '=')
          return {
            name: part[0].value,
            defaultValue:
              defaultIndex < 0 ? undefined : literal(part.slice(defaultIndex + 1), new Map()),
          }
        })
      const record = {
        FUNCTION_ID: functionId,
        DATABASE_SCOPE: scope,
        QUALIFIED_NAME: physical(scope, name.name).qualified,
        OWNER: 'SOURCE_CEILING',
        CALLABLE_BY_ROLES: ['SOURCE_CEILING'],
        SECURITY_MODE: /\bSECURITY DEFINER\b/i.test(header)
          ? 'DEFINER'
          : 'INVOKER_DEFAULT_OR_EXPLICIT',
        SEARCH_PATH_BEHAVIOR:
          header.match(/\bSET search_path\b[\s\S]*?(?=AS |LANGUAGE |$)/i)?.[0] ??
          'SOURCE_CEILING_NO_EXPLICIT_SEARCH_PATH',
        INPUTS: render(tokens.slice(name.end + 1, endParams)),
        RETURN_SEMANTICS:
          header.match(/\bRETURNS\b[\s\S]*?(?=AS |LANGUAGE |$)/i)?.[0] ?? 'SOURCE_CEILING',
        DATABASE_OBJECTS_ACCESSED: referencedRelations(lex(body.value), scope),
        RLS_INTERACTION_SOURCE_SIGNAL: /\brow_security\b|ROW LEVEL SECURITY|CREATE POLICY/i.test(
          body.value,
        )
          ? 'RLS_DECLARATION_OR_CONTEXT_MANIPULATION'
          : 'NO_EXPLICIT_RLS_OVERRIDE_OBSERVED',
        BODY: body.value,
        DECLARATION: sqlEvidence(file, text, token, tokens[end - 1] ?? body),
        REACHABLE_FROM_UE: 'SOURCE_CEILING',
        params,
        tokens: lex(body.value, body.bodyStart),
      }
      functions.set(`${scope}|${name.name}`, record)
      i = end
      continue
    }
    if (
      is(token, 'SELECT') &&
      identifier(tokens, i + 1) &&
      tokens[identifier(tokens, i + 1).end]?.value === '('
    ) {
      const name = identifier(tokens, i + 1)
      const fn = functions.get(`${scope}|${name.name}`)
      if (!fn || !fn.tokens.some((t) => is(t, 'EXECUTE'))) continue
      const end = closing(tokens, name.end)
      const values = splitArguments(tokens.slice(name.end + 1, end)).map((part) =>
        literal(part, new Map()),
      )
      const bindings = new Map(
        fn.params.map((param, index) => [
          param.name,
          values[index] === undefined ? param.defaultValue : values[index],
        ]),
      )
      const casts = fn.BODY.matchAll(
        /(\w+)\s+TEXT\s*:=\s*CASE WHEN\s+(\w+)\s+THEN\s+'([^']*)'\s+ELSE\s+'([^']*)'\s+END/gi,
      )
      for (const match of casts)
        if (typeof bindings.get(match[2]) === 'boolean')
          bindings.set(match[1], bindings.get(match[2]) ? match[3] : match[4])
      fn.REACHABLE_FROM_UE = 'YES'
      fn.SOURCE_INVOCATIONS ??= []
      fn.SOURCE_INVOCATIONS.push({
        SOURCE: sqlEvidence(file, text, token, tokens[end]),
        ARGUMENT_BINDINGS: Object.fromEntries(bindings),
      })
      fn.OBJECTS_SECURITY_MODIFIED ??= []
      for (let n = 0; n < fn.tokens.length; n++) {
        if (!is(fn.tokens[n], 'EXECUTE')) continue
        let stop = n + 1
        while (stop < fn.tokens.length && fn.tokens[stop].value !== ';') stop++
        const expanded = literal(fn.tokens.slice(n + 1, stop), bindings)
        const expansionEvidence = {
          ...sqlEvidence(file, text, token, tokens[end]),
          HELPER_FUNCTION_ID: fn.FUNCTION_ID,
          HELPER_DECLARATION: fn.DECLARATION,
          EXPANSION_INPUTS: Object.fromEntries(bindings),
          SOURCE_APPLICATION_CONDITION:
            'Declared migration operation; helper may skip absent relations. No catalog execution claimed.',
        }
        if (typeof expanded === 'string') {
          processSql(file, expanded, scope, lex(expanded), expansionEvidence, depth + 1)
          const generated = lex(expanded)
          for (let at = 0; at < generated.length; at++) {
            if (!(is(generated[at], 'TABLE') || is(generated[at], 'ON'))) continue
            const target = identifier(generated, at + 1)
            if (target && objects.has(physical(scope, target.name).key))
              fn.OBJECTS_SECURITY_MODIFIED.push(physical(scope, target.name).key)
          }
          fn.OBJECTS_SECURITY_MODIFIED = unique(fn.OBJECTS_SECURITY_MODIFIED)
        } else {
          dynamicSql.push({
            SOURCE: expansionEvidence,
            EXPRESSION: render(fn.tokens.slice(n + 1, stop)),
          })
          ceiling(
            'POLICY_EXPRESSION',
            `${file}:${token.start}:${n}`,
            [],
            [],
            'Policy-helper dynamic SQL cannot be reduced from its literal invocation arguments.',
            'Exact generated SQL or additional static generator semantics',
            [expansionEvidence],
          )
        }
        n = stop
      }
      i = end
      continue
    }
    if (is(token, 'EXECUTE') && is(tokens[i + 1], 'FUNCTION')) {
      const name = identifier(tokens, i + 2)
      if (name) {
        const fn = functions.get(`${scope}|${name.name}`)
        if (fn) fn.REACHABLE_FROM_UE = 'YES'
        triggers.push({
          TRIGGER_BOUNDARY_ID: id('TRIGGER', `${file}:${token.start}`),
          FUNCTION: name.name,
          FUNCTION_ID: fn?.FUNCTION_ID ?? null,
          SOURCE: evidence,
          SEMANTICS: 'Trigger execute-function boundary; not PL/pgSQL dynamic EXECUTE SQL.',
        })
      }
      continue
    }
    if (is(token, 'EXECUTE')) {
      let stop = i + 1
      while (stop < tokens.length && tokens[stop].value !== ';') stop++
      const expanded = literal(tokens.slice(i + 1, stop), new Map())
      if (typeof expanded === 'string')
        processSql(file, expanded, scope, lex(expanded), evidence, depth + 1)
      else {
        const expression = render(tokens.slice(i + 1, stop))
        dynamicSql.push({ SOURCE: evidence, EXPRESSION: expression })
        ceiling(
          /GRANT|REVOKE/i.test(expression) ? 'GRANT_SCOPE' : 'POLICY_EXPRESSION',
          `${file}:${token.start}`,
          [],
          [],
          'Catalog/loop-dependent dynamic SQL has no exact source-only target expansion.',
          'Exact migration expansion/catalog branch evidence',
          [evidence],
        )
      }
      if (is(token, 'CREATE') && is(tokens[i + 1], 'TABLE')) {
        let start = i + 2
        if (is(tokens[start], 'IF') && is(tokens[start + 1], 'NOT')) start += 3
        const relation = identifier(tokens, start)
        if (relation && tokens[relation.end]?.value === '(') {
          const end = closing(tokens, relation.end)
          const columns = splitArguments(tokens.slice(relation.end + 1, end))
            .filter(
              (part) =>
                part.length &&
                ['word', 'identifier'].includes(part[0].kind) &&
                !['CONSTRAINT', 'PRIMARY', 'FOREIGN', 'CHECK', 'UNIQUE', 'EXCLUDE'].some((word) =>
                  is(part[0], word),
                ),
            )
            .map((part) => part[0].value)
          const key = physical(scope, relation.name).key
          sqlColumns.set(key, unique([...(sqlColumns.get(key) ?? []), ...columns]))
        }
      }
      i = stop
      continue
    }
    if (is(token, 'ALTER') && is(tokens[i + 1], 'TABLE')) {
      let start = i + 2
      if (is(tokens[start], 'IF') && is(tokens[start + 1], 'EXISTS')) start += 2
      const relation = identifier(tokens, start)
      if (!relation) continue
      const action = tokens.slice(relation.end, relation.end + 5)
      if (
        ['ENABLE', 'DISABLE', 'FORCE', 'NO'].some((word) => is(action[0], word)) &&
        action.some((t) => is(t, 'SECURITY'))
      ) {
        const object = addObject(scope, relation.name, 'ACTIVE_RLS_DECLARATION', [evidence])
        const kind = is(action[0], 'NO') ? 'NO_FORCE' : action[0].value.toUpperCase()
        object.RLS_EVENTS.push({ ACTION: kind, SOURCE: evidence })
        sqlEvents.push({ OBJECT_ID: object.OBJECT_ID, ACTION: kind, SOURCE: evidence })
      }
      if (is(action[0], 'OWNER') && is(action[1], 'TO')) {
        const p = physical(scope, relation.name)
        if (objects.has(p.key)) objects.get(p.key).OWNER_IDENTITY = action[2].value
      }
    }
    if (
      (is(token, 'CREATE') || is(token, 'DROP') || is(token, 'ALTER')) &&
      is(tokens[i + 1], 'POLICY')
    ) {
      let start = i + 2
      if (is(tokens[start], 'IF')) start += is(tokens[start + 1], 'NOT') ? 3 : 2
      const policyName = identifier(tokens, start)
      if (!policyName || !is(tokens[policyName.end], 'ON')) continue
      const relation = identifier(tokens, policyName.end + 1)
      if (!relation) continue
      const p = physical(scope, relation.name)
      const policyKey = `${p.key}|${policyName.name}`
      if (is(token, 'DROP')) {
        policies.delete(policyKey)
        continue
      }
      let end = relation.end
      while (end < tokens.length && tokens[end].value !== ';') end++
      const rest = tokens.slice(relation.end, end)
      const forIndex = rest.findIndex((t) => is(t, 'FOR'))
      const toIndex = rest.findIndex((t) => is(t, 'TO'))
      const asIndex = rest.findIndex((t) => is(t, 'AS'))
      const expression = (word) => {
        const at = rest.findIndex((t) => is(t, word))
        const open = word === 'WITH' ? at + 2 : at + 1
        return at >= 0 && rest[open]?.value === '('
          ? render(rest.slice(open + 1, closing(rest, open)))
          : null
      }
      if (is(token, 'ALTER')) {
        ceiling(
          'POLICY_EXPRESSION',
          `${file}:${token.start}`,
          [p.key],
          [],
          'ALTER POLICY requires composition with its previous role and predicate clauses.',
          'Composed policy definition',
          [evidence],
        )
        continue
      }
      const command = forIndex >= 0 ? rest[forIndex + 1].value.toUpperCase() : 'ALL'
      assert.ok([...commands, 'ALL'].includes(command), `Unknown policy command ${command}`)
      const rolesEnd =
        toIndex < 0
          ? 0
          : rest.findIndex((t, index) => index > toIndex && (is(t, 'USING') || is(t, 'WITH')))
      const applicableRoles =
        toIndex >= 0
          ? rest
              .slice(toIndex + 1, rolesEnd < 0 ? rest.length : rolesEnd)
              .filter((t) => t.kind !== 'punct')
              .map((t) => t.value)
          : ['public']
      const object = addObject(scope, relation.name, 'ACTIVE_RLS_DECLARATION', [evidence])
      const record = {
        POLICY_ID: id('POLICY', policyKey),
        POLICY_NAME: policyName.name,
        DATABASE_SCOPE: scope,
        SCHEMA: p.schema,
        OBJECT_NAME: p.objectName,
        OBJECT_ID: p.key,
        COMMAND: command,
        MODE:
          asIndex >= 0 ? rest[asIndex + 1].value.toUpperCase() : 'DEFAULT_OR_SOURCE_UNSPECIFIED',
        APPLICABLE_ROLES: applicableRoles,
        USING_EXPRESSION: expression('USING'),
        WITH_CHECK_EXPRESSION: expression('WITH'),
        DECLARATION_FILE: file,
        IMPLICIT_WITH_CHECK_SEMANTICS:
          expression('WITH') === null && ['UPDATE', 'ALL'].includes(command)
            ? 'PostgreSQL reuses USING when WITH CHECK is omitted; exact source clauses retained separately.'
            : 'Explicit clause or command-specific PostgreSQL default; not an adequacy verdict.',
        DECLARATION_RANGE: [
          evidence.LINE_START,
          inheritedEvidence
            ? evidence.LINE_END
            : sqlEvidence(file, text, token, tokens[end - 1]).LINE_END,
        ],
        SOURCE_EVIDENCE: evidence,
        SOURCE_APPLICATION_CONDITION:
          inheritedEvidence?.SOURCE_APPLICATION_CONDITION ??
          'Active migration declaration, not proof of applied catalog state.',
      }
      policies.set(policyKey, record)
      for (const role of applicableRoles)
        if (!roles.has(role))
          roles.set(role, {
            DATABASE_ROLE: role,
            LOGIN_CAPABILITY: 'SOURCE_CEILING',
            BYPASS_RLS: 'SOURCE_CEILING',
            SUPERUSER_SIGNAL: 'SOURCE_CEILING',
            SOURCE_EVIDENCE: [],
          })
      for (const dep of referencedRelations(rest, scope)) {
        const [depScope, qualified] = dep.split('::')
        if (dep !== object.OBJECT_ID)
          addObject(depScope, qualified, 'POLICY_FUNCTION_DEPENDENCY', [evidence])
      }
      i = end
      continue
    }
    if (is(token, 'GRANT') || is(token, 'REVOKE')) {
      let end = i + 1
      while (end < tokens.length && tokens[end].value !== ';') end++
      const statement = tokens.slice(i, end)
      const on = statement.findIndex((t) => is(t, 'ON'))
      const to = statement.findIndex((t) => is(t, is(token, 'GRANT') ? 'TO' : 'FROM'))
      if (on >= 0 && to > on) {
        const recipients = statement
          .slice(to + 1)
          .filter(
            (t) =>
              ['word', 'identifier'].includes(t.kind) &&
              !['WITH', 'GRANT', 'OPTION', 'CASCADE', 'RESTRICT'].includes(t.value.toUpperCase()),
          )
          .map((t) => t.value)
        for (const role of recipients) {
          grants.push({
            GRANT_ID: id('GRANT', `${file}|${token.start}|${role}`),
            GRANTEE: role,
            DATABASE_SCOPE: scope,
            OBJECT: render(statement.slice(on + 1, to)),
            PRIVILEGE: render(statement.slice(1, on)),
            GRANT_OPTION: statement.some((t) => is(t, 'OPTION')) ? 'YES' : 'NO',
            OPERATION: token.value.toUpperCase(),
            SOURCE: inheritedEvidence ?? sqlEvidence(file, text, token, tokens[end - 1]),
          })
          if (!roles.has(role))
            roles.set(role, {
              DATABASE_ROLE: role,
              LOGIN_CAPABILITY: 'SOURCE_CEILING',
              BYPASS_RLS: 'SOURCE_CEILING',
              SUPERUSER_SIGNAL: 'SOURCE_CEILING',
              SOURCE_EVIDENCE: [],
            })
        }
      }
      i = end
      continue
    }
    if (is(token, 'CREATE') && (is(tokens[i + 1], 'VIEW') || is(tokens[i + 1], 'MATERIALIZED'))) {
      const name = identifier(tokens, i + (is(tokens[i + 1], 'VIEW') ? 2 : 3))
      if (!name) continue
      let end = name.end
      while (end < tokens.length && tokens[end].value !== ';') end++
      views.set(physical(scope, name.name).key, {
        VIEW_ID: id('VIEW', `${scope}|${name.name}`),
        DATABASE_SCOPE: scope,
        QUALIFIED_NAME: physical(scope, name.name).qualified,
        OBJECT_TYPE: is(tokens[i + 1], 'MATERIALIZED') ? 'MATERIALIZED_VIEW' : 'VIEW',
        SECURITY_BEHAVIOR:
          render(tokens.slice(name.end, end)).match(/security_invoker\s*=\s*\w+/i)?.[0] ??
          'SOURCE_CEILING_OWNER_EXECUTION_DEFAULT',
        SOURCE: sqlEvidence(file, text, token, tokens[end - 1]),
        DEFINITION: render(tokens.slice(name.end, end)),
      })
    }
  }
}

const bootstrapSources = [
  'apps/union-eyes/drizzle.config.ts',
  'apps/union-eyes/db/migrations/LINEAGE-FROZEN.md',
  'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs',
  'tooling/scripts/lib/union-eyes-scoped-migrations.mjs',
  'tooling/scripts/lib/union-eyes-platform-migrations.mjs',
]
function verifyStaticParser() {
  const reviewFile = 'apps/union-eyes/lib/services/cba-intelligence/review-service.ts'
  let reviewTargets = []
  visit(modules.get(reviewFile), (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'from' &&
      node.arguments[0]?.getText() === 'table'
    )
      reviewTargets = resolveLocalTable(reviewFile, 'table', node)
  })
  assert.equal(reviewTargets.length, 4)
  assert.ok(
    boundedFactoryTargetSets.some(
      (record) =>
        record.FACTORY_SYMBOL === 'crudRoutes' &&
        record.TARGET_SET_CLOSED === 'YES' &&
        record.SOURCE_CALL_COUNT > 0 &&
        record.POSSIBLE_TARGET_OBJECT_IDS.length > 0,
    ),
  )
  assert.deepEqual(
    resolveTable('apps/union-eyes/app/api/users/me/profile/route.ts', 'profiles').map(
      (target) => target.name,
    ),
    ['public.profiles'],
  )
  assert.deepEqual(
    resolveTable(
      'apps/union-eyes/services/financial-service/src/routes/arrears.ts',
      'schema.arrearsCases',
    ).map((target) => target.name),
    ['public.arrears_cases'],
  )
  assert.deepEqual(
    resolveTable(
      'apps/union-eyes/services/financial-service/src/jobs/dues-calculation-workflow.ts',
      'duesAssignments',
    ).map((target) => target.name),
    ['public.member_dues_assignments'],
  )
  const tokens = lex(`-- CREATE POLICY hidden ON ignored;
    SELECT 'CREATE POLICY literal ON ignored', $$CREATE POLICY body ON ignored$$;
    /* nested /* comment */ comment */ SELECT "quoted""name";`)
  assert.equal(tokens.filter((token) => is(token, 'CREATE')).length, 0)
  assert.equal(tokens.find((token) => token.kind === 'body').value, 'CREATE POLICY body ON ignored')
  assert.equal(tokens.find((token) => token.kind === 'identifier').value, 'quoted"name')
  assert.equal(identifier(lex('PUBLIC.MEMBERS'), 0).name, 'public.members')
  assert.equal(identifier(lex('"CaseSchema"."CaseTable"'), 0).name, 'CaseSchema.CaseTable')
  assert.deepEqual(
    referencedRelations(
      lex('SELECT EXTRACT(epoch FROM om.joined_at) FROM public.members FOR UPDATE SKIP LOCKED'),
      'parser-test',
    ),
    ['parser-test::public.members'],
  )
  assert.deepEqual(
    referencedRelations(
      lex(
        'IF NEW.claim_token IS DISTINCT FROM OLD.claim_token OR NEW.stripe_payment_ref IS NOT DISTINCT FROM OLD.stripe_payment_ref THEN RETURN NEW; END IF;',
      ),
      'parser-test',
    ),
    [],
  )
  assert.equal(
    literal(
      lex("format('CREATE POLICY p ON %I USING (%I = ''x'')', p_table, p_column)"),
      new Map([
        ['p_table', 'quoted table'],
        ['p_column', 'org'],
      ]),
    ),
    `CREATE POLICY p ON "quoted table" USING ("org" = 'x')`,
  )
  const beforeEvents = sqlEvents.length
  const sample = `CREATE FUNCTION helper(p_table TEXT, p_col TEXT DEFAULT 'organization_id')
    RETURNS VOID AS $x$ BEGIN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
    EXECUTE format('CREATE POLICY p ON %I AS RESTRICTIVE FOR UPDATE TO union_eyes_runtime USING (%I = current_setting(''app.current_org_id'', true)) WITH CHECK (true)', p_table, p_col);
    END $x$ LANGUAGE plpgsql;
    SELECT helper('members');
    CREATE POLICY all_commands ON members USING (true);
    CREATE POLICY discarded ON members FOR SELECT USING (true);
    DROP POLICY discarded ON members;
    ALTER TABLE members NO FORCE ROW LEVEL SECURITY;`
  processSql('static-parser-self-test', sample, 'parser-test')
  const policy = policies.get('parser-test::public.members|p')
  assert.equal(policy.COMMAND, 'UPDATE')
  assert.equal(policy.MODE, 'RESTRICTIVE')
  assert.deepEqual(policy.APPLICABLE_ROLES, ['union_eyes_runtime'])
  assert.ok(policy.USING_EXPRESSION.includes('app.current_org_id'))
  assert.equal(policy.WITH_CHECK_EXPRESSION, 'true')
  assert.equal(policies.get('parser-test::public.members|all_commands').COMMAND, 'ALL')
  assert.equal(policies.has('parser-test::public.members|discarded'), false)
  assert.deepEqual(
    objects.get('parser-test::public.members').RLS_EVENTS.map((event) => event.ACTION),
    ['ENABLE', 'FORCE', 'NO_FORCE'],
  )
  for (const key of [...objects.keys()]) if (key.startsWith('parser-test::')) objects.delete(key)
  for (const key of [...policies.keys()]) if (key.startsWith('parser-test::')) policies.delete(key)
  for (const key of [...functions.keys()]) if (key.startsWith('parser-test|')) functions.delete(key)
  sqlEvents.length = beforeEvents
  roles.clear()
}
verifyStaticParser()
if (process.argv.includes('--self-test')) {
  console.log(
    'PASS: local aliases, exported namespaces, static SQL lexer, quoted identifiers, extraction vs relation FROM, format expansion, command/mode/roles, USING/WITH CHECK, policy deletion, and RLS event ordering.',
  )
  process.exit(0)
}
for (const file of bootstrapSources) read(file)
const migrationManifest = []
for (const directory of [
  'apps/union-eyes/db/migrations-cache',
  'apps/union-eyes/db/migrations-platform',
]) {
  const journalFile = `${directory}/meta/_journal.json`
  const journal = JSON.parse(read(journalFile))
  for (const entry of journal.entries) {
    const file = `${directory}/${entry.tag}.sql`
    const text = read(file)
    migrationManifest.push({
      FILE: file,
      JOURNAL: journalFile,
      INDEX: entry.idx,
      LINEAGE: directory.endsWith('cache') ? 'ACTIVE_SCOPED' : 'ACTIVE_PLATFORM',
      SHA256: hash(text),
    })
    processSql(file, text, 'union-eyes')
  }
}
const financialRoot = 'apps/union-eyes/services/financial-service'
const financialConfig = `${financialRoot}/drizzle.config.ts`
if (
  objects.size &&
  [...objects.values()].some((object) => object.DATABASE_SCOPE === 'financial-service')
) {
  read(financialConfig)
  const sqlFiles = walk(`${financialRoot}/drizzle`, '.sql')
  for (const file of sqlFiles) {
    const text = read(file)
    migrationManifest.push({
      FILE: file,
      LINEAGE: 'FINANCIAL_SOURCE_MIGRATION_NOT_BOOTSTRAP_PROVEN',
      SHA256: hash(text),
    })
    processSql(file, text, 'financial-service')
  }
  if (!sqlFiles.length)
    ceiling(
      'DATABASE_SCOPE',
      'financial-service-migrations',
      [...objects.values()]
        .filter((o) => o.DATABASE_SCOPE === 'financial-service')
        .map((o) => o.OBJECT_ID),
      [],
      'The configured financial-service migration lineage contains no checked-in SQL in its configured output directory.',
      'Exact financial-service migration/deployment security lineage',
      [sourceEvidence(financialConfig)],
    )
}
const djangoMigrationFiles = walk('apps/union-eyes/backend', '.py').filter((file) =>
  file.includes('/migrations/'),
)
for (const file of djangoMigrationFiles) {
  const text = read(file)
  if (!/RunSQL|ROW LEVEL SECURITY|CREATE POLICY|SECURITY DEFINER/i.test(text)) continue
  const strings = [...text.matchAll(/(?:[rubf]*)("""|''')([\s\S]*?)\1/gi)].filter((match) =>
    /ROW LEVEL SECURITY|CREATE POLICY|SECURITY DEFINER|\bGRANT\b/i.test(match[2]),
  )
  if (!strings.length) continue
  for (const match of strings)
    if (/ROW LEVEL SECURITY|CREATE POLICY|SECURITY DEFINER|GRANT /i.test(match[2])) {
      processSql(file, match[2], 'union-eyes', lex(match[2]), sourceEvidence(file))
    }
  ceiling(
    'OTHER_EXPLICIT',
    `${file}:django-operation-order`,
    [],
    [],
    'Security-relevant Python migration SQL needs forward/reverse operation branch resolution; triple-quoted literals alone do not establish applied order.',
    'Exact forward Django migration operation composition',
    [sourceEvidence(file)],
  )
}
const provisioningFile = 'apps/union-eyes/scripts/provision-runtime-db-roles.ts'
const provisioningText = read(provisioningFile)
assert.match(provisioningText, /NOSUPERUSER.*NOBYPASSRLS/)
for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
  assert.ok(provisioningText.includes(`roleName: '${role}'`))
  roles.set(role, {
    DATABASE_ROLE: role,
    LOGIN_CAPABILITY: 'YES_SOURCE_PROVISIONING_CONTRACT',
    BYPASS_RLS: 'NO_SOURCE_PROVISIONING_CONTRACT',
    SUPERUSER_SIGNAL: 'NO_SOURCE_PROVISIONING_CONTRACT',
    OBJECT_OWNERSHIP_SIGNAL: 'SOURCE_CEILING',
    SOURCE_EVIDENCE: [sourceEvidence(provisioningFile)],
    POLICY_APPLICABILITY: [],
    GRANTS: [],
  })
}

const databaseClients = []
const contextEstablishmentPrimitives = []
const contextSetters = []
const rawSqlReferences = []
const inlineRlsDeclarations = []
for (const [file, ast] of modules) {
  const entries = [...(moduleEntries.get(file) ?? [])]
  visit(ast, (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression.getText(ast)
      const driverBindings = (imports.get(file) ?? [])
        .filter((edge) =>
          ['postgres', 'pg', '@supabase/supabase-js', '@supabase/ssr', '@prisma/client'].includes(
            edge.specifier,
          ),
        )
        .flatMap((edge) => edge.bindings)
      const driverConstructor = driverBindings.some(
        (binding) =>
          expression === binding.local ||
          ((binding.imported === '*' || binding.imported === 'default') &&
            ['Pool', 'Client', 'createClient', 'createServerClient'].some(
              (symbol) => expression === `${binding.local}.${symbol}`,
            )),
      )
      const constructor =
        driverConstructor ||
        /^(?:postgres|drizzle|drizzlePg|drizzleMssql|createClient|createServerClient|PrismaClient|Pool|Client)$/.test(
          expression,
        )
      const credentials =
        node
          .getText(ast)
          .match(
            /(?:SYSTEM_DATABASE_URL|DATABASE_URL|AZURE_SQL_CONNECTION_STRING|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY)/g,
          ) ?? []
      if (
        constructor &&
        (driverConstructor ||
          ['postgres', 'Pool', 'Client', 'PrismaClient'].includes(expression) ||
          credentials.length)
      ) {
        const symbol = enclosingSymbol(node)
        const source = range(ast, node)
        const moduleText = ast.text
        const credentialClass = credentials.length
          ? unique(credentials)
          : unique(
              moduleText
                .match(
                  /process\.env\.(SYSTEM_DATABASE_URL|DATABASE_URL|AZURE_SQL_CONNECTION_STRING|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY)/g,
                )
                ?.map((name) => name.replace('process.env.', '')) ?? [],
            )
        const system =
          file.endsWith('/system-db.ts') ||
          file.endsWith('/system-client.ts') ||
          credentialClass.includes('SUPABASE_SERVICE_ROLE_KEY')
        const proxyMixed = file.endsWith('/db/db.ts')
        const clientId = id('CLIENT', `${file}|${source.LINE_START}|${expression}`)
        databaseClients.push({
          DB_CLIENT_ID: clientId,
          SOURCE_FILE: file,
          SYMBOL: symbol,
          CONSTRUCTOR: expression,
          DATABASE_SCOPE: scopeFor(file),
          AUTHENTICATION_MODE: 'EXTERNAL_CONFIGURATION_CREDENTIAL',
          DATABASE_ROLE_OR_CREDENTIAL_CLASS: credentialClass.length
            ? credentialClass
            : ['SOURCE_CEILING_ARGUMENT_SUPPLIED_CREDENTIAL'],
          RLS_EXPECTATION: system ? 'EXPECTED_BYPASS' : proxyMixed ? 'MIXED' : 'SOURCE_CEILING',
          RLS_EXPECTATION_MEANING: system
            ? 'Privileged policy-mediated/system authority or service credential; not inferred PostgreSQL BYPASSRLS.'
            : proxyMixed
              ? 'db proxy selects active system/tenant transaction or ordinary pool.'
              : 'Actual credential role, owner status, and deployment RLS binding are not checked-in.',
          ORG_CONTEXT_EXPECTATION: system
            ? 'EXPLICIT_SYSTEM_OR_CALLER_DEPENDENT'
            : 'CALLER_CONTEXT_REQUIRED_OR_SOURCE_CEILING',
          USER_CONTEXT_EXPECTATION: system
            ? 'CALLER_DEPENDENT_OR_CLEARED'
            : 'CALLER_CONTEXT_REQUIRED_OR_SOURCE_CEILING',
          REACHABLE_FROM_ENTRY_IDS: entries,
          LINKAGE_CLASS: 'STATIC_MODULE_IMPORT_PATH; FUNCTION_EXECUTION_SOURCE_CEILING',
          SOURCE: source,
          BYPASS_MECHANISM: system
            ? 'SYSTEM_CREDENTIAL_AND_ROLE_TARGETED_FULL_ACCESS_POLICIES_OR_SERVICE_ROLE'
            : proxyMixed
              ? 'ACTIVE_SYSTEM_TRANSACTION_PROXY_PRECEDENCE'
              : 'SOURCE_CEILING_CREDENTIAL_ROLE',
          INTENDED_CALLER_CLASS: system
            ? 'SYSTEM_OR_PLATFORM_ADMIN_SOURCE_INTENT'
            : 'CALLER_DEPENDENT',
          PRECONDITIONS:
            'Constructor requires credential/configuration; caller authorization is not re-adjudicated.',
          CALLER_IDENTITY_RETAINED: 'SOURCE_CEILING',
          ORG_CONTEXT_RETAINED: 'SOURCE_CEILING',
        })
        ceiling(
          'CLIENT_BYPASS',
          clientId,
          [],
          entries,
          'Connection role/ownership and indirect function execution cannot be established from credential variable names and module imports.',
          'Deployment credential-role binding and bounded function-level execution evidence',
          [source],
        )
      }
    }
    if (
      !(
        ts.isTaggedTemplateExpression(node) ||
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      )
    )
      return
    const sqlContainer = ts.isTaggedTemplateExpression(node)
      ? /(?:^|\.)(?:sql|raw|unsafe)$/.test(node.tag.getText(ast))
      : node.parent &&
        ts.isCallExpression(node.parent) &&
        /(?:^|\.)(?:sql|raw|unsafe|query|execute)$/.test(node.parent.expression.getText(ast))
    if (!sqlContainer) return
    const snippet = ts.isTaggedTemplateExpression(node)
      ? node.template.getText(ast).slice(1, -1)
      : node.text
    if (/CREATE\s+POLICY|(?:ENABLE|FORCE|DISABLE)\s+ROW\s+LEVEL\s+SECURITY/i.test(snippet)) {
      const declaration = declarations.get(`${file}|${enclosingSymbol(node)}`)
      const targets = declaration
        ? [
            addObject(
              declaration.scope,
              declaration.name,
              'SHARED_AUTH_DB_DEPENDENCY',
              [range(ast, node)],
              entries,
            ).OBJECT_ID,
          ]
        : []
      const tokens = lex(snippet)
      const policyStart = tokens.findIndex(
        (token, index) => is(token, 'CREATE') && is(tokens[index + 1], 'POLICY'),
      )
      const commandStart = tokens.findIndex((token) => is(token, 'FOR'))
      const usingStart = tokens.findIndex((token) => is(token, 'USING'))
      const checkStart = tokens.findIndex(
        (token, index) => is(token, 'WITH') && is(tokens[index + 1], 'CHECK'),
      )
      const rolesStart = tokens.findIndex((token) => is(token, 'TO'))
      let rolesEnd = rolesStart + 1
      while (
        rolesEnd < tokens.length &&
        !['USING', 'WITH', 'FOR'].some((word) => is(tokens[rolesEnd], word))
      )
        rolesEnd++
      const applicableRoles =
        rolesStart < 0
          ? ['PUBLIC']
          : tokens
              .slice(rolesStart + 1, rolesEnd)
              .filter((token) => ['word', 'identifier'].includes(token.kind))
              .map((token) => token.value)
      const declarationId = id('INLINE-RLS', `${file}:${node.getStart(ast)}`)
      const ceilingId = ceiling(
        'POLICY_EXPRESSION',
        declarationId,
        targets,
        entries,
        'RLS SQL is present in a reachable schema callback/application template, but a configured forward-migration/application path for that exact declaration is not established.',
        'Exact migration or SQL-execution applicability for this declaration',
        [range(ast, node)],
      )
      inlineRlsDeclarations.push({
        DECLARATION_ID: declarationId,
        SOURCE: range(ast, node),
        RAW_SQL: snippet,
        TARGET_OBJECT_IDS: targets,
        POLICY_NAME: policyStart < 0 ? null : tokens[policyStart + 2]?.value,
        POLICY_COMMAND:
          policyStart < 0
            ? null
            : commandStart < 0
              ? 'ALL'
              : tokens[commandStart + 1]?.value.toUpperCase(),
        POLICY_MODE:
          policyStart < 0
            ? null
            : tokens.some((token) => is(token, 'RESTRICTIVE'))
              ? 'RESTRICTIVE'
              : 'PERMISSIVE',
        APPLICABLE_ROLES: policyStart < 0 ? [] : applicableRoles,
        USING_EXPRESSION:
          usingStart < 0
            ? null
            : render(tokens.slice(usingStart + 2, closing(tokens, usingStart + 1))),
        WITH_CHECK_EXPRESSION:
          checkStart < 0
            ? null
            : render(tokens.slice(checkStart + 3, closing(tokens, checkStart + 2))),
        CLASSIFICATION: 'SOURCE_CEILING_DECLARATION_APPLICABILITY',
        DECLARATION_APPLICABILITY:
          'REACHABLE_SCHEMA_OR_APPLICATION_SQL_NOT_CONFIGURED_FORWARD_MIGRATION_EVIDENCE',
        ACTIVE_POLICY_ACCOUNTING:
          'SEPARATE_CANDIDATE_DECLARATION_NOT_COUNTED_AS_ACTIVE_MIGRATION_POLICY',
        SOURCE_CEILING_ID: ceilingId,
      })
      if (policyStart >= 0 && applicableRoles.includes('PUBLIC')) {
        if (!roles.has('PUBLIC'))
          roles.set('PUBLIC', {
            DATABASE_ROLE: 'PUBLIC',
            ROLE_KIND: 'POSTGRESQL_ALL_ROLES_POLICY_PSEUDO_ROLE',
            LOGIN_CAPABILITY: 'NOT_APPLICABLE_POLICY_PSEUDO_ROLE',
            BYPASS_RLS: 'NOT_APPLICABLE_POLICY_PSEUDO_ROLE',
            SUPERUSER_SIGNAL: 'NOT_APPLICABLE_POLICY_PSEUDO_ROLE',
            OBJECT_OWNERSHIP_SIGNAL: 'NOT_APPLICABLE_POLICY_PSEUDO_ROLE',
            SOURCE_EVIDENCE: [],
          })
        roles.get('PUBLIC').SOURCE_EVIDENCE.push(range(ast, node))
      }
    }
    if (/set_config\s*\(|SET\s+(?:LOCAL\s+)?["']?app\./i.test(snippet)) {
      const symbol = enclosingSymbol(node)
      const values = [
        ...snippet.matchAll(/set_config\s*\(\s*'([^']+)'\s*,([\s\S]*?)(?:,\s*(true|false)\s*\))/gi),
      ].map((match) => ({
        VARIABLE: match[1],
        VALUE_EXPRESSION: match[2].trim(),
        IS_LOCAL: match[3].toLowerCase() === 'true',
      }))
      if (values.length)
        contextSetters.push({
          SOURCE_FILE: file,
          SYMBOL: symbol,
          VALUES_SET: values,
          SOURCE: range(ast, node),
          RAW_SOURCE: snippet,
          IN_TRANSACTION_SOURCE_SIGNAL: ancestorText(node, ast).includes('.transaction('),
          ENTRY_IDS: entries,
        })
    }
    if (
      /SELECT|INSERT|UPDATE|DELETE|\bCALL\b/i.test(snippet) &&
      /FROM|INTO|UPDATE|\bCALL\b/i.test(snippet)
    )
      rawSqlReferences.push({ file, text: snippet, evidence: range(ast, node), entries })
  })
}
function ancestorText(node, ast) {
  for (let current = node; current; current = current.parent)
    if (ts.isFunctionDeclaration(current) && current.body) return current.getText(ast)
  return node.parent?.getText(ast) ?? ''
}
const backendConfigFile = 'apps/union-eyes/backend/config/settings.py'
const backendConfig = read(backendConfigFile)
read('apps/union-eyes/backend/manage.py')
const backendMiddlewareFile = 'apps/union-eyes/backend/auth_core/middleware.py'
read(backendMiddlewareFile)
assert.match(backendConfig, /"ENGINE":\s*"django\.db\.backends\.postgresql"/)
const backendSourcePaths = [...modules]
  .filter(([, ast]) =>
    /\b(?:DJANGO_API_URL|DJANGO_BACKEND_URL|BACKEND_URL|BACKEND_API_URL)\b/.test(ast.text),
  )
  .map(([file]) => file)
const backendEntries = unique(
  backendSourcePaths.flatMap((file) => [...(moduleEntries.get(file) ?? [])]),
)
const backendClientId = id('CLIENT', backendConfigFile)
databaseClients.push({
  DB_CLIENT_ID: backendClientId,
  SOURCE_FILE: backendConfigFile,
  SYMBOL: 'DATABASES.default',
  CONSTRUCTOR: 'django.db.backends.postgresql',
  DATABASE_SCOPE: 'union-eyes',
  AUTHENTICATION_MODE: 'EXTERNAL_PGUSER_PGPASSWORD_CONFIGURATION',
  DATABASE_ROLE_OR_CREDENTIAL_CLASS: ['PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGHOST', 'PGPORT'],
  RLS_EXPECTATION: 'SOURCE_CEILING',
  RLS_EXPECTATION_MEANING:
    'PostgreSQL backend configuration is source-established. Role/owner binding, server-to-backend transport and per-request DB context are not runtime proven.',
  ORG_CONTEXT_EXPECTATION:
    'APPLICATION_REQUEST_CONTEXT_DOES_NOT_ESTABLISH_DATABASE_SESSION_CONTEXT',
  USER_CONTEXT_EXPECTATION: 'SOURCE_CEILING_DATABASE_SESSION_BINDING',
  REACHABLE_FROM_ENTRY_IDS: backendEntries,
  LINKAGE_CLASS:
    'BACKEND_CONFIGURATION_PLUS_SOURCE_TRANSPORT_MODULE_CANDIDATES; no HTTP/runtime or function execution proof',
  SOURCE: sourceEvidence(backendConfigFile, 98, 112),
  BYPASS_MECHANISM: 'SOURCE_CEILING_PGUSER_ROLE_AND_OWNER',
  INTENDED_CALLER_CLASS: 'UE_DJANGO_BACKEND',
  PRECONDITIONS:
    'External PostgreSQL configuration; manage.py selects config.settings. No runtime configuration loaded.',
  CALLER_IDENTITY_RETAINED: 'SOURCE_CEILING',
  ORG_CONTEXT_RETAINED: 'SOURCE_CEILING',
  CONNECTION_POOLING_SOURCE_SIGNAL:
    'CONN_MAX_AGE configurable persistent connections; session context establishment/reset not proven.',
})
ceiling(
  'DATABASE_SCOPE',
  backendClientId,
  [],
  backendEntries,
  'Django persistence configuration and frontend backend-transport module candidates exist, but exact transport/credential-role/DB-session composition is not established by source configuration alone.',
  'Bounded backend transport/function linkage, credential-role binding and DB context establishment evidence',
  [
    sourceEvidence(backendConfigFile, 98, 112),
    sourceEvidence(backendMiddlewareFile),
    ...backendSourcePaths.map((file) => sourceEvidence(file)),
  ],
)
for (const raw of rawSqlReferences) {
  for (const interpolation of raw.text.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+\$\{([^}]+)\}/gi)) {
    const targets = resolveTable(raw.file, interpolation[1].trim())
    if (targets.length === 1) {
      const target = targets[0]
      const object = addObject(
        target.scope,
        target.name,
        authorityById.has(physical(target.scope, target.name).key)
          ? 'ACCEPTED_PHASE_1B1_TARGET'
          : 'SHARED_AUTH_DB_DEPENDENCY',
        [target.source, raw.evidence],
        raw.entries,
        target.type,
      )
      object.COLUMNS = unique([...object.COLUMNS, ...target.columns])
    } else {
      ceiling(
        'RELATIONAL_OBJECT_IDENTITY',
        `${raw.file}:${raw.evidence.LINE_START}:sql:${interpolation[1]}`,
        [],
        raw.entries,
        `SQL relational-position interpolation ${interpolation[1]} does not resolve to one exact static declaration. Value-position parameters are not treated as target-identity ceilings.`,
        'Exact SQL identifier construction or bounded selection evaluation',
        [raw.evidence],
      )
    }
  }
  const safeText = raw.text.replace(/\$\{[^}]*\}/g, 'SOURCE_INTERPOLATION')
  for (const key of referencedRelations(lex(safeText), scopeFor(raw.file))) {
    const [scope, name] = key.split('::')
    if (/source_interpolation/i.test(name)) continue
    const cteNames = [...safeText.matchAll(/(?:\bWITH|,)\s*(\w+)\s+AS\s*\(/gi)].map(
      (match) => match[1],
    )
    if (cteNames.includes(name.replace(/^public\./, ''))) continue
    const knownType =
      objects.get(key)?.OBJECT_TYPE ??
      [...declarations.values()].find(
        (declaration) => declaration.scope === scope && declaration.name === name,
      )?.type ??
      (authorityById.has(key) || sqlColumns.has(key) ? 'TABLE' : 'OTHER_EXPLICIT_RELATIONAL_OBJECT')
    addObject(
      scope,
      name,
      raw.file.startsWith('packages/') || !authorityById.has(key)
        ? 'SHARED_AUTH_DB_DEPENDENCY'
        : 'ACCEPTED_PHASE_1B1_TARGET',
      [raw.evidence],
      raw.entries,
      knownType,
    )
    if (!authorityById.has(key) && !sqlColumns.has(key))
      ceiling(
        'RELATIONAL_OBJECT_IDENTITY',
        key,
        [key],
        raw.entries,
        `Raw SQL names ${key}; default public qualification and deployed search_path/physical existence are not proven by the literal alone.`,
        'Exact schema/search_path binding and declaration',
        [raw.evidence],
      )
  }
}
for (const setter of contextSetters) {
  const key = `${setter.SOURCE_FILE}|${setter.SYMBOL}`
  let primitive = contextEstablishmentPrimitives.find((record) => record.key === key)
  if (!primitive) {
    const ast = modules.get(setter.SOURCE_FILE)
    const declaration = ast.statements.find(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === setter.SYMBOL &&
        statement.body,
    )
    const throwStatements = []
    const catchClauses = []
    if (declaration)
      visit(declaration, (node) => {
        if (ts.isThrowStatement(node)) throwStatements.push(node.getText(ast))
        if (ts.isCatchClause(node)) catchClauses.push(node.getText(ast))
      })
    primitive = {
      key,
      CONTEXT_PRIMITIVE_ID: id('CONTEXT-PRIMITIVE', key),
      SOURCE_FILE: setter.SOURCE_FILE,
      SYMBOL: setter.SYMBOL,
      INPUTS: declaration?.parameters.map((parameter) => parameter.getText(ast)) ?? [],
      VALUES_SET: [],
      SOURCE_EVIDENCE: [],
      REACHABLE_FROM_ENTRY_IDS: setter.ENTRY_IDS,
      TRANSACTION_BOUNDARY: setter.IN_TRANSACTION_SOURCE_SIGNAL
        ? 'TRANSACTION_CALLBACK_SOURCE_OBSERVED'
        : 'SOURCE_CEILING',
      RESET_OR_CLEANUP_BEHAVIOR: setter.VALUES_SET.every((value) => value.IS_LOCAL)
        ? 'LOCAL_SETTINGS_END_WITH_TRANSACTION; no runtime pool proof'
        : 'NO_EXPLICIT_RESET_ESTABLISHED',
      FAILURE_BEHAVIOR: {
        EXPLICIT_THROW_STATEMENTS: throwStatements,
        CATCH_CLAUSES: catchClauses,
        DATABASE_OPERATION_FAILURE:
          'No runtime DB/error-path execution; source transaction behavior only.',
      },
      CONTEXT_APPLICATION_CONDITION: declaration
        ?.getText(ast)
        .includes("typeof db.transaction !== 'function'")
        ? 'DB override without a transaction method executes callback without establishing this context.'
        : 'Source transaction callback establishes settings before its protected operation; runtime application is unproven.',
      SYSTEM_CONTEXT_SUPPORT: /System|system|PlatformAdmin/.test(setter.SYMBOL)
        ? 'YES'
        : 'SOURCE_CEILING',
      POOLING_CONTEXT_CLASS:
        setter.VALUES_SET.every((value) => value.IS_LOCAL) && setter.IN_TRANSACTION_SOURCE_SIGNAL
          ? 'LOCAL_TO_TRANSACTION'
          : setter.VALUES_SET.every((value) => !value.IS_LOCAL)
            ? 'SESSION_SCOPED_WITHOUT_OBSERVED_RESET'
            : 'SOURCE_CEILING_POOLING_SEMANTICS',
    }
    contextEstablishmentPrimitives.push(primitive)
  }
  primitive.VALUES_SET.push(...setter.VALUES_SET)
  primitive.SOURCE_EVIDENCE.push(setter.SOURCE)
}
const delegatedContextPrimitives = []
for (const [file, ast] of modules) {
  for (const statement of ast.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) continue
    const symbol = statement.name.text
    if (
      !/^(?:with.*(?:Context|Auth|RLS)|createSecureServerAction)$/.test(symbol) ||
      contextEstablishmentPrimitives.some(
        (primitive) => primitive.SOURCE_FILE === file && primitive.SYMBOL === symbol,
      )
    )
      continue
    const delegates = []
    visit(statement.body, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return
      const called = node.expression.text
      for (const primitive of contextEstablishmentPrimitives) {
        const sameModule = primitive.SOURCE_FILE === file && primitive.SYMBOL === called
        const imported = (imports.get(file) ?? []).some(
          (edge) =>
            edge.resolved === primitive.SOURCE_FILE &&
            edge.bindings.some(
              (binding) => binding.local === called && binding.imported === primitive.SYMBOL,
            ),
        )
        if (sameModule || imported) delegates.push(primitive.CONTEXT_PRIMITIVE_ID)
      }
    })
    if (!delegates.length) continue
    const underlying = contextEstablishmentPrimitives.filter((p) =>
      delegates.includes(p.CONTEXT_PRIMITIVE_ID),
    )
    delegatedContextPrimitives.push({
      key: `${file}|${symbol}`,
      CONTEXT_PRIMITIVE_ID: id('CONTEXT-PRIMITIVE', `${file}|${symbol}`),
      SOURCE_FILE: file,
      SYMBOL: symbol,
      INPUTS: statement.parameters.map((p) => p.getText(ast)),
      VALUES_SET: underlying.flatMap((p) => p.VALUES_SET),
      DELEGATES_TO_PRIMITIVE_IDS: unique(delegates),
      TRANSACTION_BOUNDARY: 'DELEGATED_SOURCE_TRANSACTION',
      RESET_OR_CLEANUP_BEHAVIOR:
        'Inherited from explicitly named underlying primitive; caller branch not runtime proven.',
      FAILURE_BEHAVIOR: 'Source wrapper composition, not runtime validated.',
      SYSTEM_CONTEXT_SUPPORT: /System|PlatformAdmin/.test(symbol) ? 'YES' : 'SOURCE_CEILING',
      POOLING_CONTEXT_CLASS: underlying.every(
        (p) => p.POOLING_CONTEXT_CLASS === 'LOCAL_TO_TRANSACTION',
      )
        ? 'LOCAL_TO_TRANSACTION'
        : 'SOURCE_CEILING_POOLING_SEMANTICS',
      SOURCE_EVIDENCE: [range(ast, statement)],
      REACHABLE_FROM_ENTRY_IDS: [...(moduleEntries.get(file) ?? [])],
    })
  }
}
contextEstablishmentPrimitives.push(...delegatedContextPrimitives)
const contextVariables = new Map()
for (const policy of policies.values()) {
  const expressions = `${policy.USING_EXPRESSION ?? ''} ${policy.WITH_CHECK_EXPRESSION ?? ''}`
  for (const match of expressions.matchAll(
    /current_setting\s*\(\s*'([^']+)'\s*(?:,\s*(true|false))?/gi,
  )) {
    const variable = match[1]
    if (!contextVariables.has(variable))
      contextVariables.set(variable, {
        CONTEXT_ID: id('CONTEXT', variable),
        VARIABLE_OR_FUNCTION: variable,
        VALUE_DOMAIN: /org|tenant/i.test(variable)
          ? 'ORGANIZATION_ID_SOURCE_VALUE'
          : /user|member/i.test(variable)
            ? 'USER_OR_MEMBER_ID_SOURCE_VALUE'
            : 'EXACT_SOURCE_POLICY_VALUE',
        SET_BY_SOURCE_PATHS: [],
        READ_BY_POLICY_IDS: [],
        TRANSACTION_SCOPED: 'SOURCE_CEILING',
        FAILS_WHEN_ABSENT: 'SOURCE_CEILING',
        CALLER_CONTROLLABLE: 'SOURCE_CEILING',
        ABSENT_READ_SEMANTICS: [],
        CONTEXT_PRIMITIVE_IDS: [],
      })
    const context = contextVariables.get(variable)
    context.READ_BY_POLICY_IDS.push(policy.POLICY_ID)
    context.ABSENT_READ_SEMANTICS.push(
      match[2]?.toLowerCase() === 'true'
        ? 'missing_ok=true returns NULL; predicate composition/casts remain unevaluated'
        : 'missing_ok not true; current_setting can raise when absent',
    )
  }
  for (const match of expressions.matchAll(
    /\b(auth\.\w+|current_user|session_user|current_role)\b/gi,
  )) {
    const variable = match[1]
    if (!contextVariables.has(variable))
      contextVariables.set(variable, {
        CONTEXT_ID: id('CONTEXT', variable),
        VARIABLE_OR_FUNCTION: variable,
        VALUE_DOMAIN: 'DATABASE_ROLE_OR_PROVIDER_AUTH_FUNCTION',
        SET_BY_SOURCE_PATHS: [],
        READ_BY_POLICY_IDS: [],
        TRANSACTION_SCOPED: 'SOURCE_CEILING',
        FAILS_WHEN_ABSENT: 'SOURCE_CEILING',
        CALLER_CONTROLLABLE: 'SOURCE_CEILING',
        ABSENT_READ_SEMANTICS: ['Exact function/connection identity semantics required'],
        CONTEXT_PRIMITIVE_IDS: [],
      })
    contextVariables.get(variable).READ_BY_POLICY_IDS.push(policy.POLICY_ID)
  }
}
for (const primitive of contextEstablishmentPrimitives) {
  for (const value of primitive.VALUES_SET) {
    if (!contextVariables.has(value.VARIABLE))
      contextVariables.set(value.VARIABLE, {
        CONTEXT_ID: id('CONTEXT', value.VARIABLE),
        VARIABLE_OR_FUNCTION: value.VARIABLE,
        VALUE_DOMAIN: 'SOURCE_CONTEXT_VALUE',
        SET_BY_SOURCE_PATHS: [],
        READ_BY_POLICY_IDS: [],
        TRANSACTION_SCOPED: 'SOURCE_CEILING',
        FAILS_WHEN_ABSENT: 'SOURCE_CEILING',
        CALLER_CONTROLLABLE: 'SOURCE_CEILING',
        ABSENT_READ_SEMANTICS: [],
        CONTEXT_PRIMITIVE_IDS: [],
      })
    const context = contextVariables.get(value.VARIABLE)
    context.SET_BY_SOURCE_PATHS.push(primitive.SOURCE_FILE)
    context.CONTEXT_PRIMITIVE_IDS.push(primitive.CONTEXT_PRIMITIVE_ID)
  }
}
for (const context of contextVariables.values()) {
  context.SET_BY_SOURCE_PATHS = unique(context.SET_BY_SOURCE_PATHS)
  context.READ_BY_POLICY_IDS = unique(context.READ_BY_POLICY_IDS)
  context.CONTEXT_PRIMITIVE_IDS = unique(context.CONTEXT_PRIMITIVE_IDS)
  context.ABSENT_READ_SEMANTICS = unique(context.ABSENT_READ_SEMANTICS)
  const setters = contextSetters
    .flatMap((setter) => setter.VALUES_SET)
    .filter((value) => value.VARIABLE === context.VARIABLE_OR_FUNCTION)
  if (setters.length)
    context.TRANSACTION_SCOPED = setters.every((value) => value.IS_LOCAL)
      ? 'YES'
      : setters.every((value) => !value.IS_LOCAL)
        ? 'NO'
        : 'SOURCE_CEILING'
  ceiling(
    'CONTEXT_SCOPE',
    context.CONTEXT_ID,
    [],
    [],
    'Setter locality is inventoried, but caller controllability, missing-context predicate behavior, and pool/role interaction are not established by this structural census.',
    'Static context-value provenance and predicate reconciliation in Phase 1B.3B',
    context.SET_BY_SOURCE_PATHS.map((file) => sourceEvidence(file)),
  )
}

const policyHelperFunctions = []
const builtins = new Set([
  'current_setting',
  'exists',
  'nullif',
  'coalesce',
  'any',
  'all',
  'count',
  'lower',
  'upper',
  'length',
  'format',
  'quote_ident',
  'to_regclass',
  'and',
  'or',
  'not',
  'in',
  'using',
  'check',
  'select',
  'where',
  'case',
  'when',
  'cast',
])
for (const policy of policies.values()) {
  const expressionTokens = lex(
    `${policy.USING_EXPRESSION ?? ''} ${policy.WITH_CHECK_EXPRESSION ?? ''}`,
  )
  for (let index = 0; index < expressionTokens.length; index++) {
    const name = identifier(expressionTokens, index)
    if (!name || expressionTokens[name.end]?.value !== '(' || builtins.has(name.name.toLowerCase()))
      continue
    const fn = functions.get(`${policy.DATABASE_SCOPE}|${name.name}`)
    const key = `${policy.DATABASE_SCOPE}|${name.name}`
    let record = policyHelperFunctions.find((helper) => helper.key === key)
    if (!record) {
      record = {
        key,
        POLICY_HELPER_ID: id('POLICY-HELPER', key),
        FUNCTION: name.name,
        SECURITY_MODE: fn?.SECURITY_MODE ?? 'SOURCE_CEILING',
        INPUTS:
          fn?.INPUTS ??
          render(expressionTokens.slice(name.end + 1, closing(expressionTokens, name.end))),
        RETURN_SEMANTICS: fn?.RETURN_SEMANTICS ?? 'SOURCE_CEILING_NO_ACTIVE_FUNCTION_DEFINITION',
        DATA_ACCESSED: fn?.DATABASE_OBJECTS_ACCESSED ?? [],
        DEPENDENT_POLICY_IDS: [],
        SOURCE: fn?.DECLARATION ?? policy.SOURCE_EVIDENCE,
      }
      policyHelperFunctions.push(record)
      if (!fn)
        ceiling(
          'FUNCTION_SECURITY',
          key,
          [policy.OBJECT_ID],
          [],
          `Policy calls ${name.name}, but its exact active SQL definition is not established.`,
          'Exact function/extension definition, role and search_path semantics',
          [policy.SOURCE_EVIDENCE],
        )
    }
    record.DEPENDENT_POLICY_IDS = unique([...record.DEPENDENT_POLICY_IDS, policy.POLICY_ID])
    if (fn) {
      fn.REACHABLE_FROM_UE = 'YES'
      for (const dependency of fn.DATABASE_OBJECTS_ACCESSED) {
        const [scope, name] = dependency.split('::')
        addObject(scope, name, 'POLICY_FUNCTION_DEPENDENCY', [fn.DECLARATION])
      }
    }
    index = name.end
  }
}
for (const object of objects.values()) {
  const view = views.get(object.OBJECT_ID)
  if (view) object.OBJECT_TYPE = view.OBJECT_TYPE
  const prior = authorityById.get(object.OBJECT_ID)
  const currentDeclarations = [...declarations.values()].filter(
    (d) => d.scope === object.DATABASE_SCOPE && d.name === object.QUALIFIED_NAME,
  )
  if (currentDeclarations.length || sqlColumns.has(object.OBJECT_ID)) {
    object.COLUMNS = unique([
      ...currentDeclarations.flatMap((d) => d.columns),
      ...(sqlColumns.get(object.OBJECT_ID) ?? []),
    ])
    object.SOURCE_EVIDENCE.push(...currentDeclarations.map((d) => d.source))
  }
  for (const d of prior?.declarations ?? []) {
    if (existsSync(absolute(d.file)) && !consumed.has(d.file)) read(d.file)
    object.SOURCE_EVIDENCE.push(sourceEvidence(d.file, d.line, d.line))
  }
  object.POLICY_IDS = [...policies.values()]
    .filter((policy) => policy.OBJECT_ID === object.OBJECT_ID)
    .map((policy) => policy.POLICY_ID)
  let enabled = null
  let forced = false
  for (const event of object.RLS_EVENTS) {
    if (event.ACTION === 'ENABLE') enabled = true
    if (event.ACTION === 'DISABLE') enabled = false
    if (event.ACTION === 'FORCE') forced = true
    if (event.ACTION === 'NO_FORCE') forced = false
  }
  object.OBSERVED_RLS_STATE =
    object.OBJECT_TYPE === 'OTHER_EXPLICIT_RELATIONAL_OBJECT'
      ? 'SOURCE_CEILING_RLS_STATE'
      : object.OBJECT_TYPE !== 'TABLE'
        ? 'RLS_NOT_APPLICABLE_BY_OBJECT_TYPE'
        : enabled === true
          ? forced
            ? 'RLS_ENABLED_AND_FORCED'
            : 'RLS_ENABLED'
          : enabled === false
            ? 'RLS_DISABLED_EXPLICIT'
            : 'NO_RLS_DECLARATION_OBSERVED'
  object.FORCE_ROW_LEVEL_SECURITY = forced ? 'YES' : 'NO'
  object.RLS_STATE_INTERPRETATION =
    'Active checked-in migration declarations conditional on application/relation existence; not runtime catalog state.'
  const cols = object.COLUMNS.join(' ')
  const objectPolicies = [...policies.values()].filter(
    (policy) => policy.OBJECT_ID === object.OBJECT_ID,
  )
  const expr = objectPolicies
    .map((policy) => `${policy.USING_EXPRESSION} ${policy.WITH_CHECK_EXPRESSION}`)
    .join(' ')
  const orgColumn =
    /\b(?:organization_id|organizationId|org_id|orgId|tenant_id|tenantId|source_organization_id|union_local_id)\b/.test(
      cols,
    )
  const derivedOrg = /current_org_id/.test(expr) && /\b(?:FROM|JOIN)\b/i.test(expr)
  object.ORG_BOUNDARY_SIGNAL = orgColumn
    ? 'EXPLICIT_ORG_COLUMN'
    : derivedOrg
      ? 'DERIVED_ORG_RELATIONSHIP'
      : 'NO_ORG_SIGNAL_OBSERVED'
  object.RESOURCE_BOUNDARY_SIGNAL = unique(
    [
      /\b(?:user_id|userId|claimed_by_user_id)\b/.test(cols) ? 'USER_ID' : null,
      /\b(?:member_id|memberId)\b/.test(cols) ? 'MEMBER_ID' : null,
      /\b(?:owner_id|ownerId|created_by|createdBy)\b/.test(cols) ? 'OWNER_ID' : null,
      /\b(?:assignment_id|assigned_to)\b/.test(cols) ? 'ASSIGNMENT' : null,
      /\bparticipant/.test(cols) ? 'PARTICIPATION' : null,
      /\b(?:claim_id|case_id|matter_id|grievance_id)\b/.test(cols)
        ? 'CASE_OR_MATTER_RELATION'
        : null,
    ].filter(Boolean),
  )
  if (!object.RESOURCE_BOUNDARY_SIGNAL.length)
    object.RESOURCE_BOUNDARY_SIGNAL = ['NO_RESOURCE_SIGNAL_OBSERVED']
  const resource = /\b(?:user_id|member_id|owner_id|claimed_by_user_id)\b/.test(cols)
  object.RLS_REQUIREMENT_CLASS =
    object.OBJECT_TYPE === 'OTHER_EXPLICIT_RELATIONAL_OBJECT'
      ? 'REQUIREMENT_SOURCE_CEILING'
      : object.OBJECT_TYPE !== 'TABLE'
        ? 'RLS_NOT_APPLICABLE'
        : orgColumn || derivedOrg
          ? resource
            ? 'ORG_AND_RESOURCE_RLS_REQUIRED'
            : 'ORG_RLS_REQUIRED'
          : resource
            ? 'USER_OR_RESOURCE_RLS_REQUIRED'
            : 'REQUIREMENT_SOURCE_CEILING'
  object.REQUIREMENT_BASIS =
    'Structural org/user/member/owner columns and accepted persistence linkage; no invented business-policy exemption.'
  if (object.RLS_REQUIREMENT_CLASS === 'REQUIREMENT_SOURCE_CEILING')
    ceiling(
      'REQUIREMENT',
      object.OBJECT_ID,
      [object.OBJECT_ID],
      object.REACHABLE_FROM_ENTRY_IDS,
      'Neither an explicit organization/resource ownership column nor an accepted global/system-only exemption establishes the expected DB isolation requirement.',
      'Exact ownership/relationship or approved global/system requirement contract',
      object.SOURCE_EVIDENCE,
    )
  if (object.OBSERVED_RLS_STATE === 'SOURCE_CEILING_RLS_STATE')
    ceiling(
      'RLS_STATE',
      object.OBJECT_ID,
      [object.OBJECT_ID],
      object.REACHABLE_FROM_ENTRY_IDS,
      'A literal query names a relational object but its object type and RLS applicability are not established by an exact declaration.',
      'Exact table/view/materialized-view declaration and active security lineage',
      object.SOURCE_EVIDENCE,
    )
  ceiling(
    'DATABASE_ROLE',
    `${object.OBJECT_ID}:owner`,
    [object.OBJECT_ID],
    object.REACHABLE_FROM_ENTRY_IDS,
    'Checked-in declarations do not establish the deployed table owner or owner/BYPASSRLS applicability. FORCE declarations alone do not bind connection roles.',
    'Exact object owner and connection role binding',
    object.SOURCE_EVIDENCE,
  )
  object.SOURCE_EVIDENCE = [
    ...new Map(object.SOURCE_EVIDENCE.map((e) => [JSON.stringify(e), e])).values(),
  ]
}
for (const client of databaseClients) {
  if (!['EXPECTED_BYPASS', 'MIXED'].includes(client.RLS_EXPECTATION)) continue
  for (const link of operationLinks.filter((link) => link.SOURCE.FILE === client.SOURCE_FILE))
    objects.get(link.OBJECT_ID).SURFACE_ORIGIN = unique([
      ...objects.get(link.OBJECT_ID).SURFACE_ORIGIN,
      'PRIVILEGED_DB_PATH',
    ])
}
const definitions = new Map()
for (const [file, ast] of modules)
  for (const statement of ast.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)
      definitions.set(`${file}|${statement.name.text}`, statement)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer)
          definitions.set(`${file}|${declaration.name.text}`, declaration)
  }
function resolveDefinition(file, symbol, seen = new Set()) {
  const key = `${file}|${symbol}`
  if (seen.has(key)) return []
  seen.add(key)
  if (definitions.has(key)) return [key]
  const matches = []
  for (const edge of imports.get(file) ?? []) {
    if (!edge.resolved) continue
    for (const binding of edge.bindings) {
      if (binding.local === symbol)
        matches.push(...resolveDefinition(edge.resolved, binding.imported, seen))
      if (binding.local === '*' && binding.imported === '*')
        matches.push(...resolveDefinition(edge.resolved, symbol, seen))
    }
  }
  return unique(matches)
}
const definitionEdges = new Map()
for (const [key, node] of definitions) {
  const file = key.split('|')[0]
  const edges = []
  visit(node, (child) => {
    if (!ts.isIdentifier(child) || child === node.name) return
    if (ts.isPropertyAccessExpression(child.parent) && child.parent.name === child) return
    if (ts.isPropertyAssignment(child.parent) && child.parent.name === child) return
    if (ts.isTypeReferenceNode(child.parent)) return
    edges.push(...resolveDefinition(file, child.text))
  })
  definitionEdges.set(
    key,
    unique(edges).filter((edge) => edge !== key),
  )
}
const privilegedEntryPaths = []
for (const entry of entryModel.ENTRIES) {
  const roots = resolveDefinition(entry.SOURCE_FILE, entry.EXPORT_OR_HANDLER)
  const queue = [...roots]
  const visited = new Set()
  const previous = new Map(roots.map((key) => [key, null]))
  for (let index = 0; index < queue.length; index++) {
    const key = queue[index]
    if (visited.has(key)) continue
    visited.add(key)
    const [file, symbol] = key.split('|')
    const isPrivileged =
      symbol === 'systemDb' &&
      (file.endsWith('/system-db.ts') || file.endsWith('/system-client.ts'))
    if (isPrivileged) {
      const nodes = []
      for (let cursor = key; cursor; cursor = previous.get(cursor)) nodes.unshift(cursor)
      privilegedEntryPaths.push({
        PRIVILEGED_PATH_ID: id('ENTRY-PRIVILEGED', `${entry.ENTRY_ID}|${key}`),
        ENTRY_ID: entry.ENTRY_ID,
        CLIENT_SYMBOL: symbol,
        CLIENT_SOURCE_FILE: file,
        BOUNDED_SYMBOL_REFERENCE_PATH: nodes.map((name) => {
          const [source, nameSymbol] = name.split('|')
          return {
            SOURCE_FILE: source,
            SYMBOL: nameSymbol,
            SOURCE: range(modules.get(source), definitions.get(name)),
          }
        }),
        LINKAGE_CLASS:
          'STATIC_SYMBOL_REFERENCE_PATH; conditional branches/imported-function invocation remain bounded source evidence, not runtime proof.',
      })
    }
    for (const edge of definitionEdges.get(key) ?? [])
      if (!visited.has(edge)) {
        if (!previous.has(edge)) previous.set(edge, key)
        queue.push(edge)
      }
  }
}
const privilegedDatabasePaths = databaseClients
  .filter((client) => ['EXPECTED_BYPASS', 'MIXED'].includes(client.RLS_EXPECTATION))
  .map((client) => ({
    PRIVILEGED_PATH_ID: id('PRIVILEGED', client.DB_CLIENT_ID),
    DB_CLIENT_ID: client.DB_CLIENT_ID,
    BYPASS_MECHANISM: client.BYPASS_MECHANISM,
    INTENDED_CALLER_CLASS: client.INTENDED_CALLER_CLASS,
    PRECONDITIONS: client.PRECONDITIONS,
    CALLER_IDENTITY_RETAINED: client.CALLER_IDENTITY_RETAINED,
    ORG_CONTEXT_RETAINED: client.ORG_CONTEXT_RETAINED,
    REACHABLE_FROM_ENTRY_IDS: client.REACHABLE_FROM_ENTRY_IDS,
    BOUNDED_PATHS: client.REACHABLE_FROM_ENTRY_IDS.map((entryId) => ({
      ENTRY_ID: entryId,
      MODULE_PATH: boundedPath(entryId, client.SOURCE_FILE),
    })),
    LINKAGE_CLASS:
      'CONSERVATIVE_MODULE_REACHABILITY; exact function call/branch applicability is an explicit source ceiling',
    SOURCE: client.SOURCE,
  }))
for (const role of roles.values()) {
  role.POLICY_APPLICABILITY = [...policies.values()]
    .filter((policy) => policy.APPLICABLE_ROLES.includes(role.DATABASE_ROLE))
    .map((policy) => policy.POLICY_ID)
  role.INLINE_POLICY_DECLARATION_APPLICABILITY = inlineRlsDeclarations
    .filter((record) => record.APPLICABLE_ROLES.includes(role.DATABASE_ROLE))
    .map((record) => record.DECLARATION_ID)
  role.GRANTS = grants
    .filter((grant) => grant.GRANTEE === role.DATABASE_ROLE)
    .map((grant) => grant.GRANT_ID)
  role.OBJECT_OWNERSHIP_SIGNAL ??= 'SOURCE_CEILING'
  if (role.ROLE_KIND === 'POSTGRESQL_ALL_ROLES_POLICY_PSEUDO_ROLE') continue
  ceiling(
    'DATABASE_ROLE',
    role.DATABASE_ROLE,
    [],
    [],
    'Source role references/provisioning are not evidence of the deployed role attributes, memberships, ownership or credential binding.',
    'Exact role provisioning/application and credential-role evidence',
    role.SOURCE_EVIDENCE,
  )
}
const policyCommandCoverage = [...objects.values()].map((object) => ({
  OBJECT_ID: object.OBJECT_ID,
  COMMANDS: Object.fromEntries(
    commands.map((command) => [
      command,
      object.OBJECT_TYPE === 'OTHER_EXPLICIT_RELATIONAL_OBJECT'
        ? 'SOURCE_CEILING'
        : object.OBJECT_TYPE !== 'TABLE'
          ? 'NOT_APPLICABLE'
          : [...policies.values()].some(
                (policy) =>
                  policy.OBJECT_ID === object.OBJECT_ID &&
                  (policy.COMMAND === command || policy.COMMAND === 'ALL'),
              )
            ? 'POLICY_PRESENT'
            : 'POLICY_ABSENT',
    ]),
  ),
  POLICY_IDS_BY_COMMAND: Object.fromEntries(
    commands.map((command) => [
      command,
      [...policies.values()]
        .filter(
          (policy) =>
            policy.OBJECT_ID === object.OBJECT_ID &&
            (policy.COMMAND === command || policy.COMMAND === 'ALL'),
        )
        .map((policy) => policy.POLICY_ID),
    ]),
  ),
  COVERAGE_MEANING:
    'Source policy presence, irrespective of role or predicate adequacy; ALL covers four commands but is counted once.',
}))
const structuralFindings = []
function finding(kind, key, objectsAffected, entries, evidence, fact) {
  structuralFindings.push({
    FINDING_ID: id('FINDING', `${kind}|${key}`),
    FINDING_CLASS: kind,
    AFFECTED_OBJECTS: objectsAffected,
    AFFECTED_ENTRY_IDS: entries,
    SOURCE_EVIDENCE: evidence,
    STRUCTURAL_FACT: fact,
    FINAL_SECURITY_DEFECT_VERDICT: 'NOT_ISSUED',
  })
}
for (const object of objects.values()) {
  if (
    object.RLS_REQUIREMENT_CLASS.endsWith('RLS_REQUIRED') &&
    object.OBSERVED_RLS_STATE === 'NO_RLS_DECLARATION_OBSERVED'
  )
    finding(
      'RLS_REQUIRED_BUT_NO_RLS_DECLARATION',
      object.OBJECT_ID,
      [object.OBJECT_ID],
      object.REACHABLE_FROM_ENTRY_IDS,
      object.SOURCE_EVIDENCE,
      'An isolation requirement is structurally indicated; no active-lineage RLS declaration was observed.',
    )
  if (object.OBSERVED_RLS_STATE === 'RLS_ENABLED')
    finding(
      'OWNER_BYPASS_WITHOUT_FORCE_RLS',
      object.OBJECT_ID,
      [object.OBJECT_ID],
      [],
      object.SOURCE_EVIDENCE,
      'ENABLE is declared without FORCE. PostgreSQL owner behavior differs; actual owner remains source ceiling.',
    )
  if (object.OBSERVED_RLS_STATE.startsWith('RLS_ENABLED')) {
    const coverage = policyCommandCoverage.find((record) => record.OBJECT_ID === object.OBJECT_ID)
    for (const command of commands)
      if (coverage.COMMANDS[command] === 'POLICY_ABSENT')
        finding(
          'RLS_ENABLED_WITH_NO_POLICY_FOR_COMMAND',
          `${object.OBJECT_ID}|${command}`,
          [object.OBJECT_ID],
          [],
          object.SOURCE_EVIDENCE,
          `No source policy covers ${command}; policy adequacy is not adjudicated.`,
        )
  }
  const expressions = policyArrayForObject(object.OBJECT_ID)
    .map((p) => `${p.USING_EXPRESSION ?? ''} ${p.WITH_CHECK_EXPRESSION ?? ''}`)
    .join(' ')
  if (
    ['EXPLICIT_ORG_COLUMN', 'DERIVED_ORG_RELATIONSHIP'].includes(object.ORG_BOUNDARY_SIGNAL) &&
    !/current_org_id|organization_id|org_id|tenant_id|organizationId|orgId/.test(expressions)
  )
    finding(
      'ORG_SCOPED_OBJECT_WITH_NO_ORG_POLICY_SIGNAL',
      object.OBJECT_ID,
      [object.OBJECT_ID],
      object.REACHABLE_FROM_ENTRY_IDS,
      object.SOURCE_EVIDENCE,
      'Object has a structural organization boundary but no exact source policy-expression organization signal was observed; adequacy is not adjudicated.',
    )
  if (
    !object.RESOURCE_BOUNDARY_SIGNAL.includes('NO_RESOURCE_SIGNAL_OBSERVED') &&
    !/current_user_id|user_id|member_id|owner_id|assigned_to|participant|claim_id|grievance_id/.test(
      expressions,
    )
  )
    finding(
      'RESOURCE_SCOPED_OBJECT_WITH_NO_RESOURCE_POLICY_SIGNAL',
      object.OBJECT_ID,
      [object.OBJECT_ID],
      object.REACHABLE_FROM_ENTRY_IDS,
      object.SOURCE_EVIDENCE,
      'Object has a structural user/resource column but no exact source policy-expression resource signal was observed; business-policy applicability is not adjudicated.',
    )
}
function policyArrayForObject(objectId) {
  return [...policies.values()].filter((policy) => policy.OBJECT_ID === objectId)
}
for (const context of contextVariables.values()) {
  if (context.READ_BY_POLICY_IDS.length && !context.SET_BY_SOURCE_PATHS.length)
    finding(
      'POLICY_REFERENCES_UNRESOLVED_CONTEXT',
      context.CONTEXT_ID,
      unique(
        [...policies.values()]
          .filter((p) => context.READ_BY_POLICY_IDS.includes(p.POLICY_ID))
          .map((p) => p.OBJECT_ID),
      ),
      [],
      [],
      `Policies read ${context.VARIABLE_OR_FUNCTION} without a resolved source establishment primitive.`,
    )
}
for (const client of databaseClients.filter((c) =>
  ['EXPECTED_BYPASS', 'MIXED'].includes(c.RLS_EXPECTATION),
)) {
  finding(
    'PRIVILEGED_CLIENT_REACHABLE_FROM_USER_ENTRY',
    client.DB_CLIENT_ID,
    [],
    client.REACHABLE_FROM_ENTRY_IDS,
    [client.SOURCE],
    'Accepted server-entry module import paths reach a privileged/system-capable client; exact entry function execution and preconditions are ceiling, not a runtime assertion.',
  )
}
for (const primitive of contextEstablishmentPrimitives)
  if (primitive.POOLING_CONTEXT_CLASS === 'SESSION_SCOPED_WITHOUT_OBSERVED_RESET')
    finding(
      'SESSION_CONTEXT_WITHOUT_OBSERVED_RESET',
      primitive.CONTEXT_PRIMITIVE_ID,
      [],
      primitive.REACHABLE_FROM_ENTRY_IDS,
      primitive.SOURCE_EVIDENCE,
      'A session-local setting is declared without a mapped explicit reset.',
    )
for (const policy of policies.values()) {
  if (policy.APPLICABLE_ROLES.includes('public'))
    finding(
      'POLICY_ROLE_SCOPE_BROAD',
      policy.POLICY_ID,
      [policy.OBJECT_ID],
      [],
      [policy.SOURCE_EVIDENCE],
      'Policy role scope is PUBLIC/default; no sufficiency judgment.',
    )
}
const securityDefinerFunctions = [...functions.values()].filter(
  (fn) => fn.SECURITY_MODE === 'DEFINER',
)
for (const fn of functions.values()) {
  if (fn.REACHABLE_FROM_UE !== 'YES' && fn.SECURITY_MODE !== 'DEFINER') continue
  fn.SOURCE_CEILING_ID = ceiling(
    'FUNCTION_SECURITY',
    fn.FUNCTION_ID,
    unique([...(fn.DATABASE_OBJECTS_ACCESSED ?? []), ...(fn.OBJECTS_SECURITY_MODIFIED ?? [])]),
    [],
    'SQL function declaration/invocations are inventoried, but its deployed owner, effective execute privileges and search_path composition are not established by its body alone.',
    'Exact owner, execute grants and search_path composition',
    [fn.DECLARATION],
  )
}
for (const fn of securityDefinerFunctions) {
  finding(
    'SECURITY_DEFINER_REACHABLE',
    fn.FUNCTION_ID,
    fn.DATABASE_OBJECTS_ACCESSED,
    [],
    [fn.DECLARATION],
    `Elevated SQL definition is present; UE reachability: ${fn.REACHABLE_FROM_UE}.`,
  )
  ceiling(
    'FUNCTION_SECURITY',
    fn.FUNCTION_ID,
    fn.DATABASE_OBJECTS_ACCESSED,
    [],
    'Function owner, effective execute grants and search_path resolution are not fully established.',
    'Exact owner/grant/search_path composition',
    [fn.DECLARATION],
  )
}
const securitySensitiveViews = [...views]
  .filter(([key]) => objects.has(key))
  .map(([, record]) => ({ ...record, REACHABLE_FROM_UE: 'YES_SOURCE_OBJECT_LINKAGE_NOT_RUNTIME' }))
for (const view of securitySensitiveViews)
  ceiling(
    'FUNCTION_SECURITY',
    view.VIEW_ID,
    [physical(view.DATABASE_SCOPE, view.QUALIFIED_NAME).key],
    [],
    'View owner/invoker execution and base-object RLS composition require explicit reconciliation.',
    'Exact view owner and execution-role composition',
    [view.SOURCE],
  )
const countBy = (records, field, values) =>
  Object.fromEntries(
    values.map((value) => [value, records.filter((record) => record[field] === value).length]),
  )
const objectArray = [...objects.values()].sort((a, b) => a.OBJECT_ID.localeCompare(b.OBJECT_ID))
const policyArray = [...policies.values()].sort((a, b) => a.POLICY_ID.localeCompare(b.POLICY_ID))
const rlsStates = [
  'RLS_ENABLED',
  'RLS_ENABLED_AND_FORCED',
  'RLS_DISABLED_EXPLICIT',
  'NO_RLS_DECLARATION_OBSERVED',
  'RLS_NOT_APPLICABLE_BY_OBJECT_TYPE',
  'SOURCE_CEILING_RLS_STATE',
]
const requirementClasses = [
  'ORG_RLS_REQUIRED',
  'USER_OR_RESOURCE_RLS_REQUIRED',
  'ORG_AND_RESOURCE_RLS_REQUIRED',
  'SYSTEM_ONLY_WITH_EXPLICIT_BYPASS',
  'GLOBAL_REFERENCE_RLS_NOT_REQUIRED',
  'RLS_NOT_APPLICABLE',
  'REQUIREMENT_SOURCE_CEILING',
]
const summary = {
  TOTAL_RELATIONAL_SECURITY_OBJECTS: objectArray.length,
  RLS_STATE_COUNTS: countBy(objectArray, 'OBSERVED_RLS_STATE', rlsStates),
  REQUIREMENT_COUNTS: countBy(objectArray, 'RLS_REQUIREMENT_CLASS', requirementClasses),
  TOTAL_RLS_POLICIES: policyArray.length,
  POLICY_COMMAND_COUNTS: countBy(policyArray, 'COMMAND', [...commands, 'ALL']),
  POLICY_COUNTING_CONVENTION:
    'Final source declarations keyed by database scope + schema + table + policy name, after source DROP/replacement order. FOR ALL counted once, four-command coverage recorded separately. Unexpanded dynamic SQL is separately registered, never silently counted as concrete policies.',
  TOTAL_DATABASE_CLIENTS: databaseClients.length,
  CLIENT_RLS_EXPECTATION_COUNTS: countBy(databaseClients, 'RLS_EXPECTATION', [
    'SUBJECT_TO_RLS',
    'EXPECTED_BYPASS',
    'MIXED',
    'SOURCE_CEILING',
  ]),
  PRIVILEGED_DB_REACHABLE_ENTRIES: unique(privilegedEntryPaths.map((record) => record.ENTRY_ID))
    .length,
  PRIVILEGED_DB_REACHABLE_ENTRY_IDS: unique(privilegedEntryPaths.map((record) => record.ENTRY_ID)),
  PRIVILEGED_MODULE_IMPORT_CANDIDATE_ENTRIES: unique(
    privilegedDatabasePaths.flatMap((record) => record.REACHABLE_FROM_ENTRY_IDS),
  ).length,
  PRIVILEGED_ENTRY_COUNT_MEANING:
    'Source symbol-reference paths from exact accepted entry exports to a dedicated systemDb symbol. Conditional runtime branch execution is not proven. Broader module-import candidates counted separately.',
  TOTAL_RLS_CONTEXT_VARIABLES: contextVariables.size,
  TOTAL_CONTEXT_ESTABLISHMENT_PRIMITIVES: contextEstablishmentPrimitives.length,
  TRANSACTION_LOCAL_CONTEXTS: contextEstablishmentPrimitives.filter(
    (p) => p.POOLING_CONTEXT_CLASS === 'LOCAL_TO_TRANSACTION',
  ).length,
  SESSION_SCOPED_CONTEXTS: contextEstablishmentPrimitives.filter((p) =>
    p.POOLING_CONTEXT_CLASS.startsWith('SESSION_SCOPED'),
  ).length,
  SOURCE_CEILING_CONTEXT_SCOPES: contextEstablishmentPrimitives.filter(
    (p) => p.POOLING_CONTEXT_CLASS === 'SOURCE_CEILING_POOLING_SEMANTICS',
  ).length,
  SECURITY_DEFINER_FUNCTIONS: securityDefinerFunctions.length,
  UE_REACHABLE_SECURITY_DEFINER_FUNCTIONS: securityDefinerFunctions.filter(
    (fn) => fn.REACHABLE_FROM_UE === 'YES',
  ).length,
  OTHER_ELEVATED_SQL_FUNCTIONS: [...functions.values()].filter(
    (fn) =>
      fn.SECURITY_MODE !== 'DEFINER' &&
      fn.RLS_INTERACTION_SOURCE_SIGNAL !== 'NO_EXPLICIT_RLS_OVERRIDE_OBSERVED',
  ).length,
  TOTAL_SQL_FUNCTION_BOUNDARIES: [...functions.values()].filter(
    (fn) => fn.REACHABLE_FROM_UE === 'YES' || fn.SECURITY_MODE === 'DEFINER',
  ).length,
  UE_REACHABLE_OTHER_ELEVATED_SQL_FUNCTIONS: [...functions.values()].filter(
    (fn) =>
      fn.SECURITY_MODE !== 'DEFINER' &&
      fn.RLS_INTERACTION_SOURCE_SIGNAL !== 'NO_EXPLICIT_RLS_OVERRIDE_OBSERVED' &&
      fn.REACHABLE_FROM_UE === 'YES',
  ).length,
  SECURITY_SENSITIVE_VIEWS: securitySensitiveViews.length,
  UE_REACHABLE_SECURITY_SENSITIVE_VIEWS: securitySensitiveViews.filter(
    (view) => view.REACHABLE_FROM_UE === 'YES_SOURCE_OBJECT_LINKAGE_NOT_RUNTIME',
  ).length,
  RELEVANT_GRANT_RECORDS: grants.length,
  STRUCTURAL_FINDING_RECORDS: structuralFindings.length,
  SOURCE_CEILING_RECORDS: ceilings.size,
  UNEXPANDED_DYNAMIC_SQL_RECORDS: dynamicSql.length,
  INLINE_RLS_SOURCE_DECLARATIONS: inlineRlsDeclarations.length,
  INLINE_SOURCE_POLICY_IDENTITIES: new Set(
    inlineRlsDeclarations
      .filter((record) => record.POLICY_NAME !== null)
      .map((record) => `${record.TARGET_OBJECT_IDS.join('|')}|${record.POLICY_NAME}`),
  ).size,
}
for (const counts of [summary.RLS_STATE_COUNTS, summary.REQUIREMENT_COUNTS])
  assert.equal(
    Object.values(counts).reduce((a, b) => a + b, 0),
    objectArray.length,
  )
assert.equal(
  Object.values(summary.POLICY_COMMAND_COUNTS).reduce((a, b) => a + b, 0),
  policyArray.length,
)
assert.equal(
  Object.values(summary.CLIENT_RLS_EXPECTATION_COUNTS).reduce((a, b) => a + b, 0),
  databaseClients.length,
)
assert.equal(
  summary.TRANSACTION_LOCAL_CONTEXTS +
    summary.SESSION_SCOPED_CONTEXTS +
    summary.SOURCE_CEILING_CONTEXT_SCOPES,
  contextEstablishmentPrimitives.length,
)
assert.equal(new Set(policyArray.map((record) => record.POLICY_ID)).size, policyArray.length)
assert.equal(
  new Set(structuralFindings.map((record) => record.FINDING_ID)).size,
  structuralFindings.length,
)
for (const record of [...objectArray, ...databaseClients, ...privilegedDatabasePaths])
  for (const entryId of record.REACHABLE_FROM_ENTRY_IDS) assert.ok(validEntryIds.has(entryId))
for (const record of policyArray) assert.ok(objects.has(record.OBJECT_ID))
for (const record of ceilings.values()) {
  for (const objectId of record.AFFECTED_OBJECTS)
    assert.ok(objects.has(objectId), `Unknown ceiling object: ${objectId}`)
  for (const entryId of record.AFFECTED_ENTRY_IDS)
    assert.ok(validEntryIds.has(entryId), `Unknown ceiling entry: ${entryId}`)
}
assert.equal(
  new Set(inlineRlsDeclarations.map((record) => record.DECLARATION_ID)).size,
  inlineRlsDeclarations.length,
)
for (const record of inlineRlsDeclarations) {
  assert.ok(ceilings.has(record.SOURCE_CEILING_ID))
  for (const objectId of record.TARGET_OBJECT_IDS) assert.ok(objects.has(objectId))
  if (record.POLICY_NAME !== null) assert.ok([...commands, 'ALL'].includes(record.POLICY_COMMAND))
}
const carryForward = {
  PHASE_1B_2_SOURCE_FINDINGS: 1710,
  PHASE_1B_2_SOURCE_CEILING_RECORDS: 3672,
  HISTORICAL_PAGE_EXPECTATION_SOURCE_CEILING_CARRY_FORWARD: 43,
  AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
  R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD: 3,
  R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS: 56,
  R2C_RESOLVED_TARGET_CHAINS: 43,
  TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD: 13,
  TARGETLESS_EFFECT_STATIC_WORK_REMAINING: 0,
  FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD: 247,
}
for (const [key, value] of Object.entries(carryForward)) {
  const frozen = finalModel.closeoutCarryForward[key]
  if (frozen !== undefined) assert.equal(frozen, value, `Carry-forward drift: ${key}`)
}
const cleanFunction = ({ params, tokens, ...record }) => record
const report = {
  metadata: {
    PHASE: 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS',
    METHOD: 'STATIC_SOURCE_ONLY_NO_MODULE_EXECUTION',
    ACCEPTED_INPUT_SHA256: inputHashes,
    FROZEN_PAYLOAD_SHA256: frozenPayloadHashes,
    CONSUMED_SOURCE: [...consumed.values()].sort((a, b) => a.FILE.localeCompare(b.FILE)),
    MIGRATION_MANIFEST: migrationManifest,
    HISTORICAL_RLS_RUNTIME_CLAIMS_USED_AS_CURRENT_PROOF: 'NO',
    HISTORICAL_RUNTIME_EVIDENCE_STATUS: 'HISTORICAL_REFERENCE_ONLY',
    HISTORICAL_FROZEN_MIGRATION_LINEAGE_USED_AS_ACTIVE_SECURITY_SOURCE: 'NO',
    DATABASE_SCOPE_CONVENTION:
      'Union-eyes and financial-service logical source scopes remain separate even when credential variable names match. Shared @nzila/db auth paths are UE database dependencies; deployed scope binding is not proven.',
    IMPORT_LINKAGE_LIMITATION:
      'Module import/re-export closure is a conservative denominator, not function-call execution or authorization proof.',
    BOUNDED_EXTERNAL_MODULE_LOADS: boundedExternalModuleLoads,
    BOUNDED_FACTORY_TARGET_SETS: boundedFactoryTargetSets,
    NO_RUNTIME_DB_INSPECTED: 'YES',
    NO_RUNTIME_AUTH_EXECUTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE_EXECUTED: 'YES',
    NO_POLICY_CHANGED: 'YES',
    NO_APPLICATION_BEHAVIOR_CHANGED: 'YES',
  },
  relationalSecurityObjects: objectArray,
  rlsPolicies: policyArray,
  policyCommandCoverage,
  rlsRequirements: objectArray.map((o) => ({
    OBJECT_ID: o.OBJECT_ID,
    RLS_REQUIREMENT_CLASS: o.RLS_REQUIREMENT_CLASS,
    BASIS: o.REQUIREMENT_BASIS,
  })),
  contextVariables: [...contextVariables.values()],
  contextEstablishmentPrimitives: contextEstablishmentPrimitives.map(
    ({ key, ...record }) => record,
  ),
  databaseClients,
  privilegedDatabasePaths,
  privilegedEntryPaths,
  databaseRoles: [...roles.values()],
  securityDefinerFunctions: securityDefinerFunctions.map(cleanFunction),
  securityRelevantTriggers: triggers,
  sourceSqlFunctionBoundaries: [...functions.values()]
    .filter((fn) => fn.REACHABLE_FROM_UE === 'YES' || fn.SECURITY_MODE === 'DEFINER')
    .map(cleanFunction),
  otherElevatedSqlFunctions: [...functions.values()]
    .filter(
      (fn) =>
        fn.SECURITY_MODE !== 'DEFINER' &&
        fn.RLS_INTERACTION_SOURCE_SIGNAL !== 'NO_EXPLICIT_RLS_OVERRIDE_OBSERVED',
    )
    .map(cleanFunction),
  policyHelperFunctions: policyHelperFunctions.map(({ key, ...record }) => record),
  securitySensitiveViews,
  relevantGrants: grants,
  structuralFindings,
  sourceCeilings: [...ceilings.values()],
  unexpandedDynamicSql: dynamicSql,
  inlineRlsDeclarations,
  phase1BLinkage: {
    ACCEPTED_ENTRY_IDS: [...validEntryIds].sort(),
    OBJECT_OPERATION_LINKS: operationLinks,
    UNRESOLVED_OBJECT_OPERATION_LINKS: unresolvedOperationLinks,
    TARGET_RESOLUTION_SOURCE_CEILING_CHAIN_IDS: r2c.records
      .filter((r) => r.FINAL_TARGET_DISPOSITION.includes('CEILING'))
      .map((r) => r.CHAIN_ID),
    FROZEN_DISPOSITIONS_REINTERPRETED: 'NO',
  },
  carryForward,
  summary,
  validation: {
    OBJECTS_EXACTLY_ONCE: 'PASS',
    POLICY_IDENTITIES_EXACTLY_ONCE: 'PASS',
    COMMAND_ACCOUNTING: 'PASS',
    CLIENT_ACCOUNTING: 'PASS',
    CONTEXT_ACCOUNTING: 'PASS',
    ACCEPTED_ENTRY_LINKAGE_IDS_VALID: 'PASS',
    FROZEN_INPUT_HASHES_UNCHANGED: 'PASS',
    FINAL_1910_ENTRY_MODEL_UNCHANGED: 'PASS',
    ACCEPTED_ENTRY_SOURCE_RANGES_MATCH: 'PASS',
    PHASE_1B_2_1710_FINDINGS_UNCHANGED: 'PASS',
    PHASE_1B_2_3672_CEILINGS_UNCHANGED: 'PASS',
    HISTORICAL_43_PAGES_PRESERVED: 'PASS',
    PHASE_1B_1_CARRY_FORWARDS_PRESERVED: 'PASS',
    DYNAMIC_SQL_EXPLICIT_NOT_SILENTLY_OMITTED: 'PASS',
    NO_RUNTIME_DB_INSPECTED: 'YES',
    NO_RUNTIME_AUTH_EXECUTED: 'YES',
    NO_MIGRATION_EXECUTED: 'YES',
    NO_DATABASE_WRITE_EXECUTED: 'YES',
    NO_POLICY_CHANGED: 'YES',
    NO_APPLICATION_BEHAVIOR_CHANGED: 'YES',
    PHASE_1B_3B_STARTED: 'NO',
  },
  phaseStatus: {
    PHASE_1B_3A_GATE: ceilings.size ? 'SOURCE_CEILING' : 'PASS',
    PHASE_1B_3A: ceilings.size ? 'SOURCE_CEILING_ACCEPTED' : 'PASS',
    RLS_ENFORCEMENT_SURFACE: ceilings.size ? 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS' : 'CLOSED',
    DATABASE_CLIENT_TRUST_SURFACE: ceilings.size
      ? 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS'
      : 'CLOSED',
    RLS_CONTEXT_SURFACE: ceilings.size ? 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS' : 'CLOSED',
    RLS_POLICY_CORRECTNESS_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    PHASE_1B_3: 'NOT_YET_COMPLETE',
    PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION: 'AUTHORIZED',
    PHASE_1B_3B_STARTED: 'NO',
    PHASE_1B_3C_STARTED: 'NO',
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
    PRODUCT_READY: 'NO',
  },
}
const table = (counts) =>
  '| Classification | Count |\n| --- | ---: |\n' +
  Object.entries(counts)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n')
const markdown = `# Phase 1B.3A - RLS / privileged DB / tenant-isolation surface census

## Gate and boundaries

- Phase 1B.3A gate: \`${report.phaseStatus.PHASE_1B_3A_GATE}\`.
- RLS, client trust, and context surfaces: \`${report.phaseStatus.RLS_ENFORCEMENT_SURFACE}\`.
- Phase 1B.3 remains \`NOT_YET_COMPLETE\`.
- Phase 1B.3B static policy reconciliation: \`AUTHORIZED\`; started: \`NO\`.
- Policy correctness, runtime tenant isolation, and product readiness: \`NO\`.
- Historical runtime RLS claims: \`HISTORICAL_REFERENCE_ONLY\`, not current proof.

## Relational denominator

${summary.TOTAL_RELATIONAL_SECURITY_OBJECTS} distinct source-qualified relational objects, with one or more explicit origins: accepted Phase 1B.1 target, active RLS declaration, shared auth/database dependency, privileged DB path, or policy-function dependency. Logical database scopes are not collapsed.

### Observed source RLS state

${table(summary.RLS_STATE_COUNTS)}

Sum: **${summary.TOTAL_RELATIONAL_SECURITY_OBJECTS}**. These are checked-in active migration declarations, not applied catalog state. Frozen historical migrations and rollback SQL are not active-lineage evidence.

### Isolation requirements

${table(summary.REQUIREMENT_COUNTS)}

Sum: **${summary.TOTAL_RELATIONAL_SECURITY_OBJECTS}**. Requirement and observed state remain separate; no business-policy exemptions are invented.

## Policy inventory

Total concrete final source policy identities: **${summary.TOTAL_RLS_POLICIES}**.

${table(summary.POLICY_COMMAND_COUNTS)}

${summary.POLICY_COUNTING_CONVENTION}

Literal helper invocations are expanded from checked-in function bodies without executing SQL. Exact USING/WITH CHECK expressions and role lists are preserved. Dynamic/catalog-dependent SQL remains separately inventoried (${dynamicSql.length} records) with explicit ceilings. Policy presence is not predicate adequacy.

Reachable inline schema/application RLS SQL declarations: **${inlineRlsDeclarations.length}**, covering **${summary.INLINE_SOURCE_POLICY_IDENTITIES}** distinct candidate policy identities with repeated declaration sources retained. They are separately source-classified with exact raw expressions, source ranges, target linkage and applicability ceilings. These templates are not counted as configured forward-migration policies and do not override that lineage's observed state.

## Database clients and bypass paths

Client constructor records: **${summary.TOTAL_DATABASE_CLIENTS}**.

${table(summary.CLIENT_RLS_EXPECTATION_COUNTS)}

Privileged/system-client symbol-reference-linked entries: **${summary.PRIVILEGED_DB_REACHABLE_ENTRIES}**. Broader module-import candidates: **${summary.PRIVILEGED_MODULE_IMPORT_CANDIDATE_ENTRIES}**. Exact entry-export-to-system-client symbol paths are retained separately from module candidates; conditional runtime invocation is not proven. System credential/full-access policies are distinguished from PostgreSQL BYPASSRLS. Credential role/owner binding remains ceiling.

## Context model

- Context variables: **${summary.TOTAL_RLS_CONTEXT_VARIABLES}**.
- Context establishment primitives: **${summary.TOTAL_CONTEXT_ESTABLISHMENT_PRIMITIVES}**.
- Transaction local: **${summary.TRANSACTION_LOCAL_CONTEXTS}**.
- Session scoped: **${summary.SESSION_SCOPED_CONTEXTS}**.
- Scope ceilings: **${summary.SOURCE_CEILING_CONTEXT_SCOPES}**.

Exact setting names, setter source expressions, dependent policy IDs, local flags, and transaction signals are inventoried. No runtime pooling, missing-context predicate correctness, or caller-controllability claim is made.

## Elevated SQL and grants

- SECURITY DEFINER definitions: **${summary.SECURITY_DEFINER_FUNCTIONS}**; source-linked UE subset: **${summary.UE_REACHABLE_SECURITY_DEFINER_FUNCTIONS}**.
- Other RLS-manipulating SQL functions: **${summary.OTHER_ELEVATED_SQL_FUNCTIONS}**; source-linked UE subset: **${summary.UE_REACHABLE_OTHER_ELEVATED_SQL_FUNCTIONS}**.
- Total source SQL function boundaries retained, including non-definer trigger functions: **${summary.TOTAL_SQL_FUNCTION_BOUNDARIES}**; trigger invocation records: **${triggers.length}**. Exact function-to-ceiling links are preserved.
- Established security-sensitive views: **${summary.SECURITY_SENSITIVE_VIEWS}**; source-linked UE subset: **${summary.UE_REACHABLE_SECURITY_SENSITIVE_VIEWS}**. Queried relations without an established table/view declaration retain object-type/RLS-state ceilings, not a naming-derived type.
- Relevant source grant/revoke records: **${summary.RELEVANT_GRANT_RECORDS}**.

Owner, callable-role, search-path, and catalog-generated grant uncertainty is explicit. No elevated-execution verdict is issued.

## Structural findings and ceilings

- Structural finding records: **${summary.STRUCTURAL_FINDING_RECORDS}**.
- Explicit source-ceiling records: **${summary.SOURCE_CEILING_RECORDS}**.

${table(countBy(structuralFindings, 'FINDING_CLASS', unique(structuralFindings.map((f) => f.FINDING_CLASS))))}

${table(countBy([...ceilings.values()], 'CEILING_CLASS', unique([...ceilings.values()].map((c) => c.CEILING_CLASS))))}

These are census records, not final security defects or affected-entry counts. No runtime DB, runtime auth, cross-tenant tests, migrations, or writes were performed. No policy, grants, roles, schema, context behavior, or product code changed.

## Frozen phase preservation

- Phase 1B.2: 1,910 unique final entries, 1,710 finding records, 3,672 ceiling records unchanged by accepted input/payload hashes.
- Historical page expectations: 43 carried forward without investigation.
- Phase 1B.1: 207 authority ceilings, 3 known authority defects, 56 input targetless chains, 43 resolved, 13 target-resolution ceilings, 0 targetless static work, and 247 Phase 1A unknown chains retained.
- RLS identity/policy evidence does not resolve authority ceilings or rewrite R2C.

## Validation

${Object.entries(report.validation)
  .map(([key, value]) => `- ${key}: \`${value}\``)
  .join('\n')}

All consumed files are fingerprinted with whole-file/range hashes. \`--check\` verifies frozen inputs, consumed source closure, and byte-identical JSON/Markdown. Full object, policy, context, client, function, grant, finding, ceiling, and linkage evidence is in [the JSON census](./PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS.json).
`
for (const [extension, content] of [
  ['json', `${JSON.stringify(report, null, 2)}\n`],
  ['md', markdown],
]) {
  const file = `${output}.${extension}`
  const formatted = await format(content, {
    ...(await resolveConfig(absolute(file))),
    filepath: absolute(file),
  })
  if (checkOnly)
    assert.ok(
      readFileSync(absolute(file), 'utf8') === formatted,
      `${file} or consumed source/inputs drifted.`,
    )
  else writeFileSync(absolute(file), formatted)
}
console.log(
  `${checkOnly ? 'Verified' : 'Generated'} ${objectArray.length} relational objects, ${policyArray.length} policies, ${databaseClients.length} clients, ${ceilings.size} ceilings; gate ${report.phaseStatus.PHASE_1B_3A_GATE}.`,
)
