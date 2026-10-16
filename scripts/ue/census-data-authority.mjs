#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import prettier from 'prettier'

const root = process.cwd()
const appRoot = 'apps/union-eyes'
const outputBase = 'docs/union-eyes/reality-remediation/PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS'
const inputPaths = {
  phase1aGate: 'docs/union-eyes/reality-remediation/PHASE_1A_FINAL_SOURCE_RECONCILIATION.json',
  phase1aEffects:
    'docs/union-eyes/reality-remediation/PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json',
  phase1aCloseout: 'docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json',
  authorityRegistry: `${appRoot}/db/schema-authority/registry.json`,
  canonicalSchemaMap: `${appRoot}/scripts/canonical-schema-map.ts`,
  phase1b1R1Adjudication:
    'docs/union-eyes/reality-remediation/PHASE_1B_1_R1_AUTHORITY_CONFLICT_ADJUDICATION.json',
  phase1b1R2Closeout:
    'docs/union-eyes/reality-remediation/PHASE_1B_1_R2_RESIDUAL_AUTHORITY_CLOSEOUT.json',
  runtimeRequiredContract: `${appRoot}/db/schema-authority/runtime-required-contract.json`,
}
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
])
const nonProductionSegments = new Set([
  '__mocks__',
  '__tests__',
  'examples',
  'fixtures',
  'mocks',
  'scripts',
  'test',
  'tests',
])
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql', '.py'])
const sort = (values) => [...values].sort((a, b) => a.localeCompare(b))
const toRepoPath = (file) => path.relative(root, file).split(path.sep).join('/')
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
const unique = (values) => [...new Set(values)]
const normalize = (value) =>
  String(value ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const hashJson = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const isTestPath = (file) =>
  file.split('/').some((segment) => nonProductionSegments.has(segment)) ||
  /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)
const isMigrationPath = (file) =>
  /\/(?:migrations|migrations-platform|migrations-cache|migrations-audit)\//.test(`/${file}`) ||
  /\/backend\/.+\/migrations\//.test(`/${file}`)
const migrationLineage = (file) => {
  if (file.startsWith(`${appRoot}/backend/`) && file.includes('/migrations/')) return 'django'
  if (file.includes('/migrations-cache/')) return 'scoped-cache'
  if (file.includes('/migrations-audit/')) return 'temporary-audit'
  if (file.includes('/migrations-platform/')) return 'platform'
  if (file.startsWith(`${appRoot}/services/financial-service/`)) return 'financial-service'
  if (file.includes('/db/migrations/')) return 'frozen-historical'
  return 'unclassified'
}
const isProductionSchemaFile = (file) => {
  if (isTestPath(file)) return false
  if (file.startsWith(`${appRoot}/db/schema/`)) return true
  if (/^apps\/union-eyes\/db\/schema[^/]*\.tsx?$/.test(file)) return true
  return /^apps\/union-eyes\/services\/financial-service\/.+\/schema[^/]*\.tsx?$/.test(file)
}
const isProductionSourceFile = (file) =>
  file.startsWith(`${appRoot}/`) &&
  !isTestPath(file) &&
  !isMigrationPath(file) &&
  !file.includes('/db/schema/') &&
  !/^apps\/union-eyes\/db\/schema[^/]*\.tsx?$/.test(file) &&
  !file.includes('/scripts/')

function walkFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir)
  if (!fs.existsSync(absoluteDir)) return []
  const result = []
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const full = path.join(absoluteDir, entry.name)
    if (entry.isDirectory()) result.push(...walkFiles(toRepoPath(full)))
    else if (sourceExtensions.has(path.extname(entry.name).toLowerCase()))
      result.push(toRepoPath(full))
  }
  return result
}

function stringValue(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null
}

function rootDrizzleColumnName(initializer) {
  let expression = initializer
  while (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    expression = expression.expression.expression
  }
  return ts.isCallExpression(expression) && expression.arguments.length > 0
    ? stringValue(expression.arguments[0])
    : null
}

function identifierName(node) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return node.getText()
}

function exportedVariable(node, sourceFile) {
  let current = node.parent
  while (current && !ts.isVariableDeclaration(current)) current = current.parent
  if (!current || !ts.isIdentifier(current.name)) return { name: null, isExported: false }
  const statement = current.parent.parent
  if (!ts.isVariableStatement(statement) || statement.parent !== sourceFile)
    return { name: null, isExported: false }
  const isExported = Boolean(
    statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  )
  return {
    name: current.name.text,
    isExported,
  }
}

function parseTypeScript(file, source, r1DeclarationAnchors) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : file.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS,
  )
  const schemaVariables = new Map()
  const declarations = []
  const enumDeclarations = []
  const identifiers = new Set()
  const imports = []

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        if (
          ts.isCallExpression(declaration.initializer) &&
          identifierName(declaration.initializer.expression) === 'pgSchema'
        ) {
          const schemaName = stringValue(declaration.initializer.arguments[0])
          if (schemaName) schemaVariables.set(declaration.name.text, schemaName)
        }
      }
    }
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      if (clause && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        imports.push({
          module: statement.moduleSpecifier.text,
          names: clause.namedBindings.elements.map((element) => ({
            imported: element.propertyName?.text ?? element.name.text,
            local: element.name.text,
          })),
        })
      }
    }
  }

  function visit(node) {
    if (ts.isIdentifier(node)) identifiers.add(node.text)
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const callName = identifierName(expression)
      const receiverName = ts.isPropertyAccessExpression(expression)
        ? expression.expression.getText()
        : null
      const isPgTable = callName === 'pgTable'
      const isSchemaTable = ts.isPropertyAccessExpression(expression) && callName === 'table'
      const isView =
        ts.isPropertyAccessExpression(expression) &&
        (callName === 'view' || callName === 'materializedView')
      const isPgEnum = callName === 'pgEnum'
      if (isPgTable || isSchemaTable || isView || isPgEnum) {
        const name = stringValue(node.arguments[0])
        const variable = exportedVariable(node, sourceFile)
        const declarationLine =
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
        const isR1Declaration = r1DeclarationAnchors.has(
          `${file}::${variable.name}::${declarationLine}`,
        )
        const tableColumns =
          (isPgTable || isSchemaTable) &&
          node.arguments[1] &&
          ts.isObjectLiteralExpression(node.arguments[1])
            ? node.arguments[1].properties
                .filter((property) => ts.isPropertyAssignment(property))
                .map((property) => {
                  const key = ts.isIdentifier(property.name)
                    ? property.name.text
                    : ts.isStringLiteral(property.name)
                      ? property.name.text
                      : null
                  if (!key) return null
                  const initializer = property.initializer
                  const columnName = isR1Declaration
                    ? rootDrizzleColumnName(initializer)
                    : ts.isCallExpression(initializer) && initializer.arguments.length > 0
                      ? stringValue(initializer.arguments[0])
                      : null
                  return { property: key, databaseColumn: columnName ?? key }
                })
                .filter(Boolean)
            : []
        const row = {
          file,
          line: declarationLine,
          declarationKind: isPgEnum
            ? 'pgEnum'
            : isView
              ? `pg${callName[0].toUpperCase()}${callName.slice(1)}`
              : 'pgTable',
          schema: isSchemaTable
            ? (schemaVariables.get(receiverName) ?? 'UNRESOLVED_SCHEMA')
            : 'public',
          name,
          exportName: variable.name,
          exported: variable.isExported,
          columns: tableColumns,
        }
        if (isPgEnum) enumDeclarations.push(row)
        else declarations.push(row)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return { declarations, enumDeclarations, identifiers, imports }
}

function resolveRelativeImport(importingFile, moduleSpecifier) {
  if (!moduleSpecifier.startsWith('.')) return null
  const base = path.resolve(root, path.dirname(importingFile), moduleSpecifier)
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx'].map((extension) => `${base}${extension}`),
    ...['.ts', '.tsx', '.js', '.jsx'].map((extension) => path.join(base, `index${extension}`)),
  ]
  const resolved = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  )
  return resolved ? toRepoPath(resolved) : null
}

function collectDjangoModels(files) {
  const result = []
  for (const file of files.filter((candidate) => candidate.endsWith('/models.py'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    const matches = [...source.matchAll(/^class\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:\s*$/gm)]
    const classes = matches.map((match, index) => ({
      match,
      body: source.slice(match.index + match[0].length, matches[index + 1]?.index ?? source.length),
      bases: match[2].split(',').map((base) => base.trim().replace(/^.*\./, '')),
    }))
    const modelBases = new Set(
      classes.filter(({ bases }) => bases.includes('Model')).map(({ match }) => match[1]),
    )
    let changed = true
    while (changed) {
      changed = false
      for (const { match, bases } of classes) {
        if (!modelBases.has(match[1]) && bases.some((base) => modelBases.has(base))) {
          modelBases.add(match[1])
          changed = true
        }
      }
    }
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index]
      const { body } = classes[index]
      if (!modelBases.has(match[1])) continue
      if (/\babstract\s*=\s*True\b/.test(body)) continue
      const explicitTable = /\bdb_table\s*=\s*['"]([^'"]+)['"]/.exec(body)?.[1] ?? null
      const appName = file.split('/').at(-2)
      const table = explicitTable ?? `${appName}_${match[1].toLowerCase()}`
      result.push({
        app: appName,
        model: match[1],
        table,
        schema: 'public',
        file,
        line: source.slice(0, match.index).split(/\r?\n/).length,
        tableNameEvidence: explicitTable ? 'Meta.db_table' : 'Django app/model default convention',
        inheritanceEvidence: match[2].split(',').map((base) => base.trim()),
      })
    }
  }
  return result.sort((a, b) => a.table.localeCompare(b.table) || a.file.localeCompare(b.file))
}

const quoteIdentifier = '(?:"([^"]+)"|([a-zA-Z_][\\w$]*))'
const qualifiedIdentifier = `(?:${quoteIdentifier}\\s*\\.\\s*)?${quoteIdentifier}`
function parsedIdentifier(match, schemaIndex, nameIndex) {
  return {
    schema: match[schemaIndex] || match[schemaIndex + 1] || 'public',
    name: match[nameIndex] || match[nameIndex + 1],
  }
}

function collectMigrationEvidence(files) {
  const objects = new Map()
  const policies = new Map()
  const rlsFlags = new Map()
  const rlsOccurrences = []
  const views = []
  const ddlFiles = []
  const sqlFiles = []
  const pythonFiles = []
  const addObject = (scope, schema, name, kind, file, line, operation) => {
    const key = `${scope}::${schema}.${name}`
    const entry = objects.get(key) ?? { key, scope, schema, name, kinds: new Set(), events: [] }
    entry.kinds.add(kind)
    entry.events.push({ file, line, operation, lineage: migrationLineage(file) })
    objects.set(key, entry)
  }

  for (const file of files.filter(
    (candidate) => candidate.endsWith('.sql') && isMigrationPath(candidate),
  )) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    ddlFiles.push(file)
    sqlFiles.push(file)
    const scope = file.startsWith(`${appRoot}/services/financial-service/`)
      ? 'financial-service'
      : 'union-eyes'
    const tablePattern = new RegExp(
      `\\b(CREATE\\s+(?:UNLOGGED\\s+)?TABLE|ALTER\\s+TABLE|DROP\\s+TABLE)\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?(?:ONLY\\s+)?${qualifiedIdentifier}`,
      'gi',
    )
    for (const match of source.matchAll(tablePattern)) {
      const parsed = parsedIdentifier(match, 3, 5)
      const operation = match[1].replace(/\s+/g, ' ').toUpperCase()
      const line = source.slice(0, match.index).split(/\r?\n/).length
      addObject(scope, parsed.schema, parsed.name, 'TABLE_DDL', file, line, operation)
    }

    const viewPattern = new RegExp(
      `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:MATERIALIZED\\s+)?VIEW\\s+${qualifiedIdentifier}`,
      'gi',
    )
    for (const match of source.matchAll(viewPattern)) {
      const parsed = parsedIdentifier(match, 2, 4)
      const line = source.slice(0, match.index).split(/\r?\n/).length
      views.push({
        scope,
        schema: parsed.schema,
        name: parsed.name,
        file,
        line,
        evidence: 'CREATE VIEW DDL',
      })
      addObject(scope, parsed.schema, parsed.name, 'VIEW_DDL', file, line, 'CREATE VIEW')
    }

    const policyPattern = new RegExp(
      `\\bCREATE\\s+POLICY\\s+${quoteIdentifier}\\s+ON\\s+${qualifiedIdentifier}`,
      'gi',
    )
    for (const match of source.matchAll(policyPattern)) {
      const parsed = parsedIdentifier(match, 4, 6)
      const key = `${scope}::${parsed.schema}.${parsed.name}`
      const entries = policies.get(key) ?? []
      entries.push({
        policyName: match[1] || match[2],
        file,
        line: source.slice(0, match.index).split(/\r?\n/).length,
      })
      policies.set(key, entries)
    }

    const rlsPattern = new RegExp(
      `\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${qualifiedIdentifier}\\s+(ENABLE|FORCE|DISABLE|NO\\s+FORCE)\\s+ROW\\s+LEVEL\\s+SECURITY`,
      'gi',
    )
    for (const match of source.matchAll(rlsPattern)) {
      const parsed = parsedIdentifier(match, 2, 4)
      const key = `${scope}::${parsed.schema}.${parsed.name}`
      const flag = match.at(-1).toUpperCase().replace(/\s+/g, '_')
      const entry = rlsFlags.get(key) ?? new Set()
      entry.add(flag)
      rlsFlags.set(key, entry)
      rlsOccurrences.push({
        key,
        schema: parsed.schema,
        table: parsed.name,
        action: flag,
        file,
        line: source.slice(0, match.index).split(/\r?\n/).length,
      })
    }
  }

  for (const file of files.filter(
    (candidate) => candidate.endsWith('.py') && isMigrationPath(candidate),
  )) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    ddlFiles.push(file)
    pythonFiles.push(file)
    const appName = file.split('/').at(-3)
    for (const match of source.matchAll(
      /migrations\.CreateModel\(\s*name=['"]([A-Za-z_]\w*)['"]/g,
    )) {
      const line = source.slice(0, match.index).split(/\r?\n/).length
      const operationBlock = source.slice(
        match.index,
        source.indexOf('\n        )', match.index) + 10,
      )
      const explicitTable = /['"]db_table['"]\s*:\s*['"]([^'"]+)['"]/.exec(operationBlock)?.[1]
      const table = explicitTable ?? `${appName}_${match[1].toLowerCase()}`
      addObject('union-eyes', 'public', table, 'DJANGO_MIGRATION_DDL', file, line, 'CREATE MODEL')
    }
    for (const match of source.matchAll(
      /migrations\.AlterModelTable\(\s*name=['"]([A-Za-z_]\w*)['"]\s*,\s*table=['"]([^'"]+)['"]/g,
    )) {
      const line = source.slice(0, match.index).split(/\r?\n/).length
      addObject(
        'union-eyes',
        'public',
        match[2],
        'DJANGO_MIGRATION_DDL',
        file,
        line,
        'ALTER MODEL TABLE',
      )
    }
  }

  return {
    objects: [...objects.values()]
      .map((entry) => ({
        ...entry,
        kinds: sort(entry.kinds),
        events: entry.events.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    policies: Object.fromEntries([...policies].sort(([a], [b]) => a.localeCompare(b))),
    rlsFlags: Object.fromEntries(
      [...rlsFlags]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, sort(value)]),
    ),
    rlsOccurrences: rlsOccurrences.sort(
      (a, b) => a.key.localeCompare(b.key) || a.file.localeCompare(b.file) || a.line - b.line,
    ),
    views: views.sort(
      (a, b) =>
        a.scope.localeCompare(b.scope) ||
        a.schema.localeCompare(b.schema) ||
        a.name.localeCompare(b.name),
    ),
    files: sort(ddlFiles),
    sqlFiles: sort(sqlFiles),
    pythonFiles: sort(pythonFiles),
    lineages: Object.fromEntries(
      sort(unique(ddlFiles.map(migrationLineage))).map((lineage) => [
        lineage,
        sort(ddlFiles.filter((file) => migrationLineage(file) === lineage)),
      ]),
    ),
  }
}

function authorityMapFromRegistry(registry) {
  return new Map(
    registry.tables.map((table) => [
      `union-eyes::public.${table.table}`,
      {
        owner: table.owner,
        djangoApp: table.djangoApp ?? null,
        djangoModel: table.djangoModel ?? null,
        runtimeAccess: table.runtimeAccess,
        rlsRequired: table.rlsRequired,
        canonical43: table.canonical43,
        registryEvidence: `${inputPaths.authorityRegistry}#tables.${table.table}`,
        reconciliationClass: table.reconciliation?.class ?? null,
      },
    ]),
  )
}

function canonicalSchemaMapFromSource(source) {
  const result = new Map()
  for (const match of source.matchAll(/['"]((?:[^'"]+))['"]\s*:\s*['"]([^'"]+)['"]/g)) {
    const key = match[1]
    const modulePath = match[2]
    if (/^[a-z0-9_]+\.[a-z0-9_]+$/.test(key)) result.set(`union-eyes::${key}`, modulePath)
  }
  return result
}

async function writeFormattedJson(file, value) {
  const formatted = await prettier.format(`${JSON.stringify(value, null, 2)}\n`, {
    ...((await prettier.resolveConfig(file)) ?? {}),
    filepath: file,
    parser: 'json',
  })
  fs.writeFileSync(path.join(root, file), formatted)
}

async function applyR2Overlay() {
  const jsonPath = path.join(root, `${outputBase}.json`)
  const markdownPath = path.join(root, `${outputBase}.md`)
  const closeoutPath = path.join(root, inputPaths.phase1b1R2Closeout)
  const r1Path = path.join(root, inputPaths.phase1b1R1Adjudication)
  const contractPath = path.join(root, inputPaths.runtimeRequiredContract)
  const census = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const r1 = JSON.parse(fs.readFileSync(r1Path, 'utf8'))
  const runtimeContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const unionContractTables = new Set(
    runtimeContract.entries.map((entry) => `${entry.schema}.${entry.table}`),
  )
  const r1Ids = new Set(r1.dispositions.map((record) => record.objectId))
  const r1Objects = census.persistenceUniverse.filter((object) => r1Ids.has(object.objectId))
  assert(
    r1Objects.length === 5 &&
      r1.dispositions.length === 5 &&
      r1.dispositions.every((record) => record.unknownAuthority === false),
    'R1 fixed-five disposition is missing or regressed; R2 will not proceed.',
  )

  if (fs.existsSync(closeoutPath)) {
    const closeout = JSON.parse(fs.readFileSync(closeoutPath, 'utf8'))
    assert(
      census.r2ResidualCloseout?.inputCensusHash === closeout.input.inputCensusHash &&
        census.r2ResidualCloseout?.gate === closeout.gate &&
        census.r2ResidualCloseout?.counts?.inputResiduals === closeout.input.inputResidualCount,
      'Existing R2 closeout does not match the generated census overlay.',
    )
    const resolvedPhase1aChains = new Set(
      census.phase1aReconciliation.explicitTargetResolutions
        .filter((resolution) => resolution.matches.length === 1)
        .map((resolution) => resolution.chainId),
    )
    const globalAuthoritySummary = {
      ACTIVE_CANONICAL_TABLES: census.authorityClassCounts.ACTIVE_CANONICAL_AUTHORITY ?? 0,
      ACTIVE_CANONICAL_WITH_LEGACY_MIRROR:
        census.authorityClassCounts.ACTIVE_CANONICAL_AUTHORITY_WITH_LEGACY_MIRROR ?? 0,
      LEGACY_NON_AUTHORITATIVE_TABLES: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      MIGRATION_ONLY_HISTORICAL_TABLES: census.authorityClassCounts.MIGRATION_ONLY_HISTORICAL ?? 0,
      GENERATED_OR_DERIVED_TABLE_REPRESENTATIONS:
        census.authorityClassCounts.GENERATED_OR_DERIVED_REPRESENTATION ?? 0,
      TEST_OR_FIXTURE_ONLY_TABLES: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      KNOWN_DUPLICATE_AUTHORITY_CONFLICTS: r1.dispositions.filter(
        (record) => record.finalDisposition === 'KNOWN_DUPLICATE_AUTHORITY_CONFLICTS',
      ).length,
      KNOWN_REFERENCED_WITHOUT_DECLARATION_DEFECTS: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      KNOWN_MIGRATION_SCHEMA_DIVERGENCES: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      UNKNOWN_AUTHORITY_TABLES: census.authorityClassCounts.UNKNOWN_SOURCE_CEILING ?? 0,
    }
    const phase1aTargetReconciliation = {
      databaseEffectChains: census.denominators.phase1aKnownDatabaseEffectRecords,
      effectChainsWithResolvedDataAuthority: resolvedPhase1aChains.size,
      effectChainsWithKnownDefectiveDataAuthority: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      effectChainsWithUnresolvedDataAuthority:
        census.phase1aReconciliation.knownDatabaseEffectsWithoutExplicitTargets.length,
      frozenUnknownEffectChainsNotReAdjudicated:
        census.phase1aReconciliation.unknownEffectCarryForward.length,
    }
    census.r2ResidualCloseout.globalAuthoritySummary = globalAuthoritySummary
    census.r2ResidualCloseout.counts = {
      ...census.r2ResidualCloseout.counts,
      unresolvedRawSqlObjectReferences: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      effectChainsWithResolvedDataAuthority: resolvedPhase1aChains.size,
      effectChainsWithKnownDefectiveDataAuthority: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      effectChainsWithUnresolvedDataAuthority:
        phase1aTargetReconciliation.effectChainsWithUnresolvedDataAuthority,
    }
    closeout.phase1aTargetReconciliation = phase1aTargetReconciliation
    closeout.postCloseout.globalAuthoritySummary = globalAuthoritySummary
    closeout.postCloseout.phase1aTargetReconciliation = phase1aTargetReconciliation
    closeout.postCloseout.r1FinancialServiceKnownConflicts =
      globalAuthoritySummary.KNOWN_DUPLICATE_AUTHORITY_CONFLICTS
    closeout.postCloseout.r1UnionEyesCanonicalWithLegacyMirror = r1.dispositions.filter(
      (record) => record.finalDisposition === 'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR',
    ).length
    closeout.postCloseout.r1DefectIdsPreserved = r1.defectRegister.map((record) => record.defectId)
    const markdownPath = path.join(root, inputPaths.phase1b1R2Closeout.replace(/\.json$/, '.md'))
    const markdown = fs.readFileSync(markdownPath, 'utf8')
    const summarySection = [
      '## Census-wide authority summary',
      '',
      '| Metric | Count / state |',
      '| --- | ---: |',
      ...Object.entries(globalAuthoritySummary).map(([name, count]) => `| ${name} | ${count} |`),
      '',
      'Counts marked `NOT_ENUMERATED_BY_ACCEPTED_CENSUS` are not zero; the frozen census does not independently enumerate those categories.',
      '',
      '## Phase 1A database-effect target reconciliation',
      '',
      '| Metric | Count |',
      '| --- | ---: |',
      ...Object.entries(phase1aTargetReconciliation).map(
        ([name, count]) => `| ${name} | ${count} |`,
      ),
      '',
      `R1 preservation: **${closeout.postCloseout.r1FinancialServiceKnownConflicts}** registered financial-service conflicts; **${closeout.postCloseout.r1UnionEyesCanonicalWithLegacyMirror}** Union Eyes canonical-with-legacy-mirror record. Defect IDs preserved: ${closeout.postCloseout.r1DefectIdsPreserved.join(', ')}.`,
      '',
    ].join('\n')
    const summaryHeading = '## Complete residual index'
    assert(markdown.includes(summaryHeading), 'Existing R2 Markdown is missing its residual index.')
    const existingSummaryHeading = '## Census-wide authority summary'
    const summaryStart = markdown.indexOf(existingSummaryHeading)
    const prefixEnd = summaryStart >= 0 ? summaryStart : markdown.indexOf(summaryHeading)
    const updatedMarkdown = `${markdown.slice(0, prefixEnd)}${summarySection}${markdown.slice(markdown.indexOf(summaryHeading))}`
    const formattedMarkdown = await prettier.format(updatedMarkdown, {
      ...((await prettier.resolveConfig(markdownPath)) ?? {}),
      filepath: markdownPath,
      parser: 'markdown',
    })
    fs.writeFileSync(markdownPath, formattedMarkdown)
    await writeFormattedJson(inputPaths.phase1b1R2Closeout, closeout)
    await writeFormattedJson(`${outputBase}.json`, census)
    console.log(
      JSON.stringify(
        {
          status: census.status,
          r2Gate: closeout.gate,
          inputResiduals: closeout.input.inputResidualCount,
          phase1aTargetReconciliation,
          globalAuthoritySummary,
          outputs: [
            inputPaths.phase1b1R2Closeout,
            inputPaths.phase1b1R2Closeout.replace(/\.json$/, '.md'),
            `${outputBase}.json`,
            `${outputBase}.md`,
          ],
          idempotent: true,
        },
        null,
        2,
      ),
    )
    return
  }

  assert(
    census.status === 'SOURCE_CEILING' && census.phaseBoundary.phase1B1 === 'SOURCE_CEILING',
    'R2 input census is not the frozen SOURCE_CEILING baseline.',
  )
  const baselineCensusHash = hashJson(census)
  const unknownObjects = census.persistenceUniverse.filter(
    (object) => object.authorityClass === 'UNKNOWN_SOURCE_CEILING' && !r1Ids.has(object.objectId),
  )
  const unknownObjectIds = new Set(unknownObjects.map((object) => object.objectId))
  const unresolvedImports = [...census.unresolvedSchemaAccessImports].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.module.localeCompare(b.module) ||
      a.reason.localeCompare(b.reason),
  )
  const targetlessEffects = [
    ...census.phase1aReconciliation.knownDatabaseEffectsWithoutExplicitTargets,
  ].sort((a, b) => a.chainId.localeCompare(b.chainId))
  const frozenUnknownEffects = [...census.phase1aReconciliation.unknownEffectCarryForward].sort(
    (a, b) => a.chainId.localeCompare(b.chainId),
  )
  const migrationOnlyObjects = unknownObjects.filter(
    (object) =>
      object.declarations.length === 0 &&
      object.migrationDdl.length > 0 &&
      !object.productionAccessObserved &&
      object.djangoModels.length === 0,
  )
  const migrationOnlyIds = new Set(migrationOnlyObjects.map((object) => object.objectId))
  const residualRecords = []

  for (const object of unknownObjects) {
    const active = object.productionAccessObserved
    const hasDeclaration = object.declarations.length > 0
    const hasMigration = object.migrationDdl.length > 0
    const inputResidualCategory = active
      ? 'ACTIVE_UNKNOWN_AUTHORITY'
      : hasDeclaration
        ? 'DECLARATION_AUTHORITY_UNRESOLVED'
        : 'MIGRATION_LINEAGE_AUTHORITY_UNRESOLVED'
    const isMigrationOnly = migrationOnlyIds.has(object.objectId)
    const contractListed =
      object.databaseScope === 'union-eyes' && unionContractTables.has(object.qualifiedName)
    const declarationEvidence = object.declarations.map((declaration) => ({
      file: declaration.file,
      line: declaration.line,
      exportName: declaration.exportName,
      schema: declaration.schema,
      table: declaration.name,
    }))
    const migrationEvidence = object.migrationDdl.map((event) => ({
      file: event.file,
      line: event.line,
      event: event.event,
      lineage: event.lineage ?? null,
    }))
    const directUsageEvidence = object.accessReferences.map((reference) => ({
      file: reference.file,
      symbols: reference.symbols,
      candidateOperations: reference.candidateOperations,
      evidenceClass: reference.evidenceClass,
    }))
    const finalDisposition = isMigrationOnly
      ? 'MIGRATION_ONLY_HISTORICAL'
      : 'SOURCE_CEILING_UNKNOWN_AUTHORITY'
    residualRecords.push({
      residualId: object.objectId,
      objectId: object.objectId,
      inputResidualCategory,
      authorityClass: object.authorityClass,
      databaseScope: object.databaseScope,
      qualifiedName: object.qualifiedName,
      physicalIdentity: {
        sourceQualifiedIdentity: object.qualifiedName,
        physicalIdentityVerified: false,
      },
      productionAccessObserved: active,
      declarationFiles: declarationEvidence.map((entry) => entry.file),
      declarationExports: declarationEvidence.map((entry) => entry.exportName),
      declarationEvidence,
      migrationEvidence,
      registryEvidence: object.registeredAuthority,
      runtimeRequiredContractEvidence: {
        checked: object.databaseScope === 'union-eyes',
        listed: contractListed,
        contract: object.databaseScope === 'union-eyes' ? inputPaths.runtimeRequiredContract : null,
      },
      canonicalMapEvidence: {
        canonicalSchemaModule: object.canonicalSchemaModule,
        mappingFound: object.canonicalSchemaModule !== null,
      },
      configurationEvidence:
        object.databaseScope === 'financial-service' && declarationEvidence.length > 0
          ? {
              file: 'apps/union-eyes/services/financial-service/drizzle.config.ts',
              configuredSchema: './src/db/schema.ts',
              appliesToDeclaration: declarationEvidence.some(
                (entry) =>
                  entry.file === 'apps/union-eyes/services/financial-service/src/db/schema.ts',
              ),
              limitation:
                'The config selects a Drizzle generation input; it does not prove deployed physical schema or establish ownership by itself.',
            }
          : null,
      directUsageEvidence,
      finalDisposition,
      canonicalDeclaration: null,
      knownDefectId: null,
      sourceCeilingReason: isMigrationOnly
        ? null
        : 'The frozen census and permitted authority artifacts do not establish an explicit unique owner. The checked-in declaration and/or migration evidence is retained, but neither alone establishes canonical ownership; runtime physical identity remains unverified.',
      runtimeProven: 'NO',
    })
  }

  unresolvedImports.forEach((entry, index) => {
    residualRecords.push({
      residualId: `unresolved-schema-import::${entry.file}::${entry.module}::${index + 1}`,
      objectId: null,
      inputResidualCategory: 'UNRESOLVED_SCHEMA_IMPORT',
      authorityClass: null,
      databaseScope: entry.file.startsWith(`${appRoot}/`) ? 'union-eyes' : null,
      qualifiedName: null,
      physicalIdentity: { sourceQualifiedIdentity: null, physicalIdentityVerified: false },
      productionAccessObserved: null,
      declarationFiles: [],
      declarationExports: [],
      declarationEvidence: [],
      migrationEvidence: [],
      registryEvidence: null,
      runtimeRequiredContractEvidence: null,
      canonicalMapEvidence: null,
      configurationEvidence: null,
      directUsageEvidence: [{ file: entry.file, module: entry.module }],
      finalDisposition: 'SOURCE_CEILING_UNKNOWN_AUTHORITY',
      canonicalDeclaration: null,
      knownDefectId: null,
      sourceCeilingReason: entry.reason,
      runtimeProven: 'NO',
    })
  })

  for (const chain of targetlessEffects) {
    const refs = chain.sourceReferences ?? []
    residualRecords.push({
      residualId: `phase1a-database-target::${chain.chainId}`,
      objectId: null,
      inputResidualCategory: 'PHASE_1A_DATABASE_TARGET_UNRESOLVED',
      authorityClass: null,
      databaseScope: null,
      qualifiedName: null,
      physicalIdentity: { sourceQualifiedIdentity: null, physicalIdentityVerified: false },
      productionAccessObserved: null,
      declarationFiles: [],
      declarationExports: [],
      declarationEvidence: [],
      migrationEvidence: [],
      registryEvidence: null,
      runtimeRequiredContractEvidence: null,
      canonicalMapEvidence: null,
      configurationEvidence: null,
      directUsageEvidence: [],
      phase1aEvidence: {
        chainId: chain.chainId,
        primaryDataEffect: chain.primaryDataEffect,
        sourceReferenceCount: refs.length,
        sourceFiles: sort(unique(refs.map((reference) => reference.file))),
      },
      finalDisposition: 'SOURCE_CEILING_UNKNOWN_AUTHORITY',
      canonicalDeclaration: null,
      knownDefectId: null,
      sourceCeilingReason:
        'The accepted Phase 1A database-effect record has no explicit dataTargets; this R2 closeout does not infer a target from an unfrozen source traversal.',
      runtimeProven: 'NO',
    })
  }

  for (const chain of frozenUnknownEffects) {
    residualRecords.push({
      residualId: `frozen-phase1a-effect::${chain.chainId}`,
      objectId: null,
      inputResidualCategory: 'OTHER_EXPLICIT_SOURCE_CEILING',
      authorityClass: null,
      databaseScope: null,
      qualifiedName: null,
      physicalIdentity: { sourceQualifiedIdentity: null, physicalIdentityVerified: false },
      productionAccessObserved: null,
      declarationFiles: [],
      declarationExports: [],
      declarationEvidence: [],
      migrationEvidence: [],
      registryEvidence: null,
      runtimeRequiredContractEvidence: null,
      canonicalMapEvidence: null,
      configurationEvidence: null,
      directUsageEvidence: [],
      phase1aEvidence: {
        chainId: chain.chainId,
        primaryDataEffect: chain.primaryDataEffect,
      },
      finalDisposition: 'SOURCE_CEILING_UNKNOWN_AUTHORITY',
      canonicalDeclaration: null,
      knownDefectId: null,
      sourceCeilingReason:
        'Frozen Phase 1A UNKNOWN_DATA_EFFECT carry-forward. Explicitly not re-adjudicated in R2.',
      runtimeProven: 'NO',
    })
  }

  const inputResidualCount = residualRecords.length
  const inputResidualCounts = {
    activeUnknownAuthority: unknownObjects.filter((object) => object.productionAccessObserved)
      .length,
    declarationAuthorityUnresolved: unknownObjects.filter(
      (object) => !object.productionAccessObserved && object.declarations.length > 0,
    ).length,
    migrationLineageAuthorityUnresolved: unknownObjects.filter(
      (object) => !object.productionAccessObserved && object.declarations.length === 0,
    ).length,
    unresolvedSchemaImports: unresolvedImports.length,
    phase1aDatabaseTargetsUnresolved: targetlessEffects.length,
    frozenPhase1aUnknownEffects: frozenUnknownEffects.length,
  }
  const categoryTotal = Object.values(inputResidualCounts).reduce((sum, count) => sum + count, 0)
  assert(
    inputResidualCount === categoryTotal &&
      unknownObjects.length === 260 &&
      unresolvedImports.length === 966 &&
      targetlessEffects.length === 56 &&
      frozenUnknownEffects.length === 247,
    'R2 frozen residual denominator changed; do not silently adjust it.',
  )
  assert(
    unknownObjects.every((object) => !r1Ids.has(object.objectId)) &&
      residualRecords.every((record) => !r1Ids.has(record.objectId)),
    'An R1 fixed-five object re-entered the R2 residual set.',
  )
  assert(
    new Set(residualRecords.map((record) => record.residualId)).size === inputResidualCount,
    'R2 residual records are not uniquely identified.',
  )
  assert(
    migrationOnlyObjects.every(
      (object) =>
        object.declarations.length === 0 &&
        object.accessReferences.length === 0 &&
        object.migrationDdl.every(
          (event) => event.lineage && migrationLineage(event.file) === event.lineage,
        ),
    ),
    'Migration-only historical residual evidence is incomplete or has inconsistent lineages.',
  )

  const nonResidualBaseline = census.persistenceUniverse
    .filter((object) => !unknownObjectIds.has(object.objectId))
    .sort((a, b) => a.objectId.localeCompare(b.objectId))
  const nonResidualObjectsHash = hashJson(nonResidualBaseline)
  const r1ObjectHash = hashJson(r1Objects.sort((a, b) => a.objectId.localeCompare(b.objectId)))
  for (const object of migrationOnlyObjects) {
    object.authorityClass = 'MIGRATION_ONLY_HISTORICAL'
    object.authorityEvidence =
      'Only checked-in migration DDL source evidence exists; no current declaration or indexed production access exists in the frozen census.'
    object.r2Adjudication = {
      finalDisposition: 'MIGRATION_ONLY_HISTORICAL',
      inputResidualCategory: 'MIGRATION_LINEAGE_AUTHORITY_UNRESOLVED',
      runtimeProven: 'NO',
    }
  }
  const byObjectId = new Map(census.persistenceUniverse.map((object) => [object.objectId, object]))
  for (const record of residualRecords.filter((entry) => entry.objectId)) {
    const object = byObjectId.get(record.objectId)
    object.r2Adjudication = {
      finalDisposition: record.finalDisposition,
      inputResidualCategory: record.inputResidualCategory,
      sourceCeilingReason: record.sourceCeilingReason,
      runtimeProven: 'NO',
    }
  }
  const nonResidualAfter = census.persistenceUniverse
    .filter((object) => !unknownObjectIds.has(object.objectId))
    .sort((a, b) => a.objectId.localeCompare(b.objectId))
  assert(
    hashJson(nonResidualAfter) === nonResidualObjectsHash,
    'An object outside the R2 residual object set changed.',
  )
  assert(
    hashJson(
      census.persistenceUniverse
        .filter((object) => r1Ids.has(object.objectId))
        .sort((a, b) => a.objectId.localeCompare(b.objectId)),
    ) === r1ObjectHash,
    'R2 changed one or more frozen R1 objects.',
  )

  const classCounts = Object.fromEntries(
    sort(unique(census.persistenceUniverse.map((object) => object.authorityClass))).map(
      (authorityClass) => [
        authorityClass,
        census.persistenceUniverse.filter((object) => object.authorityClass === authorityClass)
          .length,
      ],
    ),
  )
  const dispositionCounts = {
    CANONICAL_AUTHORITY_ESTABLISHED: 0,
    CANONICAL_WITH_LEGACY_MIRROR: 0,
    CANONICAL_WITH_GENERATED_OR_DERIVED_REPRESENTATION: 0,
    KNOWN_DUPLICATE_AUTHORITY_CONFLICT: 0,
    KNOWN_REFERENCED_WITHOUT_DECLARATION_DEFECT: 0,
    KNOWN_MIGRATION_SCHEMA_DIVERGENCE: 0,
    EXTERNAL_PROVIDER_AUTHORITY: 0,
    TEST_OR_FIXTURE_ONLY: 0,
    MIGRATION_ONLY_HISTORICAL: migrationOnlyObjects.length,
    SOURCE_CEILING_UNKNOWN_AUTHORITY: residualRecords.filter(
      (record) => record.finalDisposition === 'SOURCE_CEILING_UNKNOWN_AUTHORITY',
    ).length,
  }
  assert(
    Object.values(dispositionCounts).reduce((sum, count) => sum + count, 0) === inputResidualCount,
    'R2 final disposition arithmetic does not equal the frozen input denominator.',
  )
  assert(
    residualRecords.every(
      (record) =>
        record.finalDisposition !== 'SOURCE_CEILING_UNKNOWN_AUTHORITY' ||
        Boolean(record.sourceCeilingReason),
    ),
    'An R2 source ceiling is missing an explicit bounded reason.',
  )
  const resolvedPhase1aChains = new Set(
    census.phase1aReconciliation.explicitTargetResolutions
      .filter((resolution) => resolution.matches.length === 1)
      .map((resolution) => resolution.chainId),
  )
  const globalAuthoritySummary = {
    ACTIVE_CANONICAL_TABLES: classCounts.ACTIVE_CANONICAL_AUTHORITY ?? 0,
    ACTIVE_CANONICAL_WITH_LEGACY_MIRROR:
      classCounts.ACTIVE_CANONICAL_AUTHORITY_WITH_LEGACY_MIRROR ?? 0,
    LEGACY_NON_AUTHORITATIVE_TABLES: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
    MIGRATION_ONLY_HISTORICAL_TABLES: classCounts.MIGRATION_ONLY_HISTORICAL ?? 0,
    GENERATED_OR_DERIVED_TABLE_REPRESENTATIONS:
      classCounts.GENERATED_OR_DERIVED_REPRESENTATION ?? 0,
    TEST_OR_FIXTURE_ONLY_TABLES: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
    KNOWN_DUPLICATE_AUTHORITY_CONFLICTS: r1.dispositions.filter(
      (record) => record.finalDisposition === 'KNOWN_DUPLICATE_AUTHORITY_CONFLICTS',
    ).length,
    KNOWN_REFERENCED_WITHOUT_DECLARATION_DEFECTS: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
    KNOWN_MIGRATION_SCHEMA_DIVERGENCES: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
    UNKNOWN_AUTHORITY_TABLES: classCounts.UNKNOWN_SOURCE_CEILING ?? 0,
  }
  const phase1aTargetReconciliation = {
    databaseEffectChains: census.denominators.phase1aKnownDatabaseEffectRecords,
    effectChainsWithResolvedDataAuthority: resolvedPhase1aChains.size,
    effectChainsWithKnownDefectiveDataAuthority: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
    effectChainsWithUnresolvedDataAuthority: targetlessEffects.length,
    frozenUnknownEffectChainsNotReAdjudicated: frozenUnknownEffects.length,
  }
  const closeout = {
    title: 'Phase 1B.1-R2 — Global Residual Authority Closeout',
    gate: 'SOURCE_CEILING',
    phase1b1Status: 'SOURCE_CEILING_ACCEPTED',
    sourceOnly: true,
    input: {
      census: `${outputBase}.json`,
      initialCensusStatus: 'SOURCE_CEILING',
      inputCensusHash: baselineCensusHash,
      inputCounts: inputResidualCounts,
      inputResidualCount,
      residualObjectCount: unknownObjects.length,
      residualObjectIds: unknownObjects.map((object) => object.objectId).sort(),
      r1FixedFiveReintroducedAsUnknown: 0,
      r1ObjectHash,
      nonResidualObjectsHash,
      expectedCounts: {
        unknownAuthorityObjects: 260,
        unresolvedSchemaImports: 966,
        knownDatabaseEffectsWithoutTargets: 56,
        frozenUnknownEffectsExcludedFromReadjudication: 247,
      },
    },
    residualCategoryCounts: {
      ACTIVE_UNKNOWN_AUTHORITY: inputResidualCounts.activeUnknownAuthority,
      ACTIVE_ACCESS_WITHOUT_EXPLICIT_AUTHORITY: 0,
      UNRESOLVED_SCHEMA_IMPORT: inputResidualCounts.unresolvedSchemaImports,
      REFERENCED_WITHOUT_CANONICAL_DECLARATION: 0,
      PHASE_1A_DATABASE_TARGET_UNRESOLVED: inputResidualCounts.phase1aDatabaseTargetsUnresolved,
      DECLARATION_AUTHORITY_UNRESOLVED: inputResidualCounts.declarationAuthorityUnresolved,
      MIGRATION_LINEAGE_AUTHORITY_UNRESOLVED:
        inputResidualCounts.migrationLineageAuthorityUnresolved,
      OTHER_EXPLICIT_SOURCE_CEILING: inputResidualCounts.frozenPhase1aUnknownEffects,
    },
    dispositionCounts,
    globalAuthoritySummary,
    phase1aTargetReconciliation,
    records: residualRecords,
    postCloseout: {
      censusPersistenceObjectCount: census.persistenceUniverse.length,
      authorityClassCounts: classCounts,
      globalAuthoritySummary,
      phase1aTargetReconciliation,
      nonResidualObjectsChanged: 0,
      r1FixedFiveReintroducedAsUnknown: 0,
      r1FinancialServiceKnownConflicts: globalAuthoritySummary.KNOWN_DUPLICATE_AUTHORITY_CONFLICTS,
      r1UnionEyesCanonicalWithLegacyMirror: r1.dispositions.filter(
        (record) => record.finalDisposition === 'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR',
      ).length,
      r1DefectIdsPreserved: r1.defectRegister.map((record) => record.defectId),
      outsideR1AndR2MigrationLineagesUnchanged: true,
      noAdditionalStaticPassAuthorized: true,
      phase1b2AuthorizationCensus: 'AUTHORIZED',
      phase1b2Started: false,
      phase1cStarted: false,
      phase1dStarted: false,
      phase2Started: false,
      runtimeDatabaseInspected: false,
      migrationExecuted: false,
      databaseWritten: false,
      authorizationCorrectnessClaimed: false,
      rlsCorrectnessClaimed: false,
    },
  }
  const r2MarkdownPath = inputPaths.phase1b1R2Closeout.replace(/\.json$/, '.md')
  const residualTable = residualRecords.map(
    (record) =>
      `| ${record.residualId.replace(/\|/g, '\\|')} | ${record.inputResidualCategory} | ${record.finalDisposition} | ${record.sourceCeilingReason ?? 'No remaining authority uncertainty under the recorded source-only classification.'} |`,
  )
  const closeoutMarkdown = [
    '# Phase 1B.1-R2 — Global Residual Authority Closeout',
    '',
    '**R2 gate: SOURCE_CEILING**  ',
    '**Phase 1B.1: SOURCE_CEILING_ACCEPTED**  ',
    '**Phase 1B.2 authorization census: AUTHORIZED; not started.**',
    '',
    '## Frozen residual denominator',
    '',
    `Input residuals: **${inputResidualCount}** = ${unknownObjects.length} unknown-authority census objects + ${unresolvedImports.length} unresolved schema imports + ${targetlessEffects.length} accepted Phase 1A known database-effect chains without explicit targets + ${frozenUnknownEffects.length} frozen Phase 1A UNKNOWN_DATA_EFFECT carry-forwards.`,
    '',
    `R1 fixed-five reintroduced as unknown: **0**. R1 remains four registered financial-service conflicts and one Union Eyes canonical-with-legacy-mirror record. The exact R1 records were not changed.`,
    '',
    '## Residual disposition arithmetic',
    '',
    '| Final disposition | Count |',
    '| --- | ---: |',
    ...Object.entries(dispositionCounts).map(([name, count]) => `| ${name} | ${count} |`),
    `| **SUM** | **${inputResidualCount}** |`,
    '',
    'The 53 objects with migration DDL only, no current declaration, and no indexed production access are classified as migration-only historical. Other census objects remain explicit source ceilings because the bounded registry, contract, canonical-map, config, declaration, and saved access evidence do not establish a unique authority. Unresolved schema imports and targetless Phase 1A chains remain individually enumerated source ceilings; the 247 frozen unknown-effect chains are recorded but were not re-adjudicated.',
    '',
    '## Census-wide authority classes after R2',
    '',
    '| Authority class | Objects |',
    '| --- | ---: |',
    ...Object.entries(classCounts).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    `Non-residual objects changed: **0** (SHA-256 ${nonResidualObjectsHash}).`,
    '',
    '## Census-wide authority summary',
    '',
    '| Metric | Count / state |',
    '| --- | ---: |',
    ...Object.entries(globalAuthoritySummary).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    'Counts marked `NOT_ENUMERATED_BY_ACCEPTED_CENSUS` are not zero; the frozen census does not independently enumerate those categories.',
    '',
    '## Phase 1A database-effect target reconciliation',
    '',
    '| Metric | Count |',
    '| --- | ---: |',
    ...Object.entries(phase1aTargetReconciliation).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    `R1 preservation: **${closeout.postCloseout.r1FinancialServiceKnownConflicts}** registered financial-service conflicts; **${closeout.postCloseout.r1UnionEyesCanonicalWithLegacyMirror}** Union Eyes canonical-with-legacy-mirror record. Defect IDs preserved: ${closeout.postCloseout.r1DefectIdsPreserved.join(', ')}.`,
    '',
    '## Complete residual index',
    '',
    '| Residual ID | Input category | Final disposition | Bounded reason / evidence boundary |',
    '| --- | --- | --- | --- |',
    ...residualTable,
    '',
    '## Proof boundaries',
    '',
    '- Source-only; no runtime database/catalog was inspected, no migration was executed, and no database write was performed.',
    '- No authorization, organization-scope enforcement, or RLS correctness claim is made.',
    '- Phase 1B.2 is authorized by the source-ceiling closeout state but was not started.',
    '- No further Phase 1B.1 static pass is authorized.',
    '',
  ].join('\n')
  const formattedMarkdown = await prettier.format(closeoutMarkdown, {
    ...((await prettier.resolveConfig(path.join(root, r2MarkdownPath))) ?? {}),
    filepath: path.join(root, r2MarkdownPath),
    parser: 'markdown',
  })
  fs.mkdirSync(path.dirname(closeoutPath), { recursive: true })
  await writeFormattedJson(inputPaths.phase1b1R2Closeout, closeout)
  fs.writeFileSync(path.join(root, r2MarkdownPath), formattedMarkdown)

  census.authorityClassCounts = classCounts
  census.status = 'SOURCE_CEILING_ACCEPTED'
  census.phaseBoundary.phase1B1 = 'SOURCE_CEILING_ACCEPTED'
  census.phaseBoundary.phase1B1R2Gate = 'SOURCE_CEILING'
  census.phaseBoundary.phase1B2AuthorizationCensus = 'AUTHORIZED'
  census.r2ResidualCloseout = {
    gate: closeout.gate,
    phase1b1Status: closeout.phase1b1Status,
    inputCensusHash: baselineCensusHash,
    counts: {
      inputResiduals: inputResidualCount,
      ...inputResidualCounts,
      migrationOnlyHistorical: migrationOnlyObjects.length,
      sourceCeilingUnknownAuthority: dispositionCounts.SOURCE_CEILING_UNKNOWN_AUTHORITY,
      unknownAuthorityTables: classCounts.UNKNOWN_SOURCE_CEILING ?? 0,
      unresolvedSchemaImports: unresolvedImports.length,
      unresolvedActiveDataAccessTargets: unknownObjects.filter(
        (object) => object.productionAccessObserved,
      ).length,
      unresolvedRawSqlObjectReferences: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      effectChainsWithResolvedDataAuthority: resolvedPhase1aChains.size,
      effectChainsWithKnownDefectiveDataAuthority: 'NOT_ENUMERATED_BY_ACCEPTED_CENSUS',
      effectChainsWithUnresolvedDataAuthority: targetlessEffects.length,
      phase1aDatabaseEffectChains: phase1aTargetReconciliation,
    },
    globalAuthoritySummary,
    phase1aTargetReconciliation,
    residualRecords,
    nonResidualObjectsHash,
    nonResidualObjectsChanged: 0,
    r1FixedFiveReintroducedAsUnknown: 0,
    noAdditionalStaticPassAuthorized: true,
  }
  census.gateRationale = {
    status: 'SOURCE_CEILING_ACCEPTED',
    reasons: [
      'R2 explicitly enumerated all frozen source-ceiling residual records and reached the final static evidence boundary.',
      `${classCounts.UNKNOWN_SOURCE_CEILING ?? 0} persistence objects remain with genuinely unresolved authority after the bounded source review.`,
      `${unresolvedImports.length} saved schema-like imports remain unresolved; direct-import attribution was not reopened.`,
      `${targetlessEffects.length} accepted Phase 1A known database-effect records lack explicit data targets.`,
      `${frozenUnknownEffects.length} Phase 1A UNKNOWN_DATA_EFFECT records remain frozen and were not re-adjudicated.`,
    ],
    counts: {
      unknownAuthorityTables: classCounts.UNKNOWN_SOURCE_CEILING ?? 0,
      unresolvedActiveDataAccessTargets:
        census.r2ResidualCloseout.counts.unresolvedActiveDataAccessTargets,
      unresolvedSchemaImports: unresolvedImports.length,
      phase1aDatabaseEffectsWithoutTargets: targetlessEffects.length,
      phase1aUnknownEffectsCarriedForward: frozenUnknownEffects.length,
    },
  }
  const censusMarkdownPath = path.join(root, `${outputBase}.md`)
  let updatedMarkdown = fs.readFileSync(censusMarkdownPath, 'utf8')
  updatedMarkdown = updatedMarkdown.replace(
    /Fixed input: 5 objects; unknown authority within the fixed five: 0\. All objects outside the fixed set are unchanged\./,
    'The R1 fixed-five result remains unchanged. R2 changes are limited to the enumerated initial residual set.',
  )
  updatedMarkdown = updatedMarkdown.replace(
    /^\*\*Gate: SOURCE_CEILING\*\*/m,
    '**Gate: SOURCE_CEILING_ACCEPTED**',
  )
  updatedMarkdown += [
    '',
    '## Phase 1B.1-R2 global residual closeout',
    '',
    '**R2 gate: SOURCE_CEILING**  ',
    '**Phase 1B.1: SOURCE_CEILING_ACCEPTED**',
    '',
    `Frozen residual denominator: ${inputResidualCount} records (260 unknown-authority objects, 966 unresolved schema imports, 56 targetless accepted Phase 1A database-effect chains, and 247 frozen Phase 1A unknown-effect carry-forwards).`,
    '',
    `Disposition sum: ${inputResidualCount}; ${migrationOnlyObjects.length} migration-only historical records and ${dispositionCounts.SOURCE_CEILING_UNKNOWN_AUTHORITY} explicit source ceilings.`,
    '',
    `R1 reintroduced as unknown: 0. Non-residual objects changed: 0 (SHA-256 ${nonResidualObjectsHash}).`,
    '',
    `See [R2 residual closeout](./PHASE_1B_1_R2_RESIDUAL_AUTHORITY_CLOSEOUT.md) for the complete residual index and evidence boundaries.`,
    '',
  ].join('\n')
  const formattedCensusMarkdown = await prettier.format(updatedMarkdown, {
    ...((await prettier.resolveConfig(censusMarkdownPath)) ?? {}),
    filepath: censusMarkdownPath,
    parser: 'markdown',
  })
  await writeFormattedJson(`${outputBase}.json`, census)
  fs.writeFileSync(censusMarkdownPath, formattedCensusMarkdown)
  console.log(
    JSON.stringify(
      {
        status: census.status,
        r2Gate: closeout.gate,
        inputResiduals: inputResidualCount,
        dispositionCounts,
        authorityClassCounts: classCounts,
        unresolvedSchemaImports: unresolvedImports.length,
        unresolvedActiveDataAccessTargets:
          census.r2ResidualCloseout.counts.unresolvedActiveDataAccessTargets,
        r1FixedFiveReintroducedAsUnknown: 0,
        nonResidualObjectsChanged: 0,
        outputs: [
          inputPaths.phase1b1R2Closeout,
          r2MarkdownPath,
          `${outputBase}.json`,
          `${outputBase}.md`,
        ],
        fullCensusRescanPerformed: false,
      },
      null,
      2,
    ),
  )
}

function main() {
  if (process.argv.includes('--r2-overlay')) {
    applyR2Overlay().catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    return
  }
  const r1Adjudication = readJson(inputPaths.phase1b1R1Adjudication)
  const baselineCensus = readJson(outputBase + '.json')
  const fixedInputRows = baselineCensus.persistenceUniverse.filter(
    (object) =>
      object.productionAccessObserved &&
      object.declarationConflict &&
      object.canonicalSchemaModule === null,
  )
  const fixedInputIds = sort(fixedInputRows.map((object) => object.objectId))
  const r1ObjectIds = sort(r1Adjudication.dispositions.map((record) => record.objectId))
  assert(
    fixedInputRows.length === r1Adjudication.scope.inputCount &&
      JSON.stringify(fixedInputIds) === JSON.stringify(sort(r1Adjudication.scope.objectIds)) &&
      JSON.stringify(fixedInputIds) === JSON.stringify(r1ObjectIds),
    'R1 fixed-input predicate no longer resolves to exactly the five adjudicated objects.',
  )
  assert(
    new Set(r1ObjectIds).size === r1ObjectIds.length,
    'R1 adjudication contains duplicate object IDs.',
  )
  const r1ByObjectId = new Map(
    r1Adjudication.dispositions.map((record) => [record.objectId, record]),
  )
  const r1DeclarationAnchors = new Set(
    r1Adjudication.dispositions.flatMap((record) =>
      record.declarations.map(
        (declaration) => `${declaration.file}::${declaration.exportName}::${declaration.line}`,
      ),
    ),
  )
  const files = walkFiles(appRoot)
  const tsFiles = files.filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file))
  const allDeclarations = []
  const allEnums = []
  const parsedSources = new Map()
  for (const file of tsFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    const parsed = parseTypeScript(file, source, r1DeclarationAnchors)
    parsedSources.set(file, { source, ...parsed })
    allDeclarations.push(...parsed.declarations)
    allEnums.push(...parsed.enumDeclarations)
  }

  const productionDeclarations = allDeclarations.filter(
    (declaration) =>
      isProductionSchemaFile(declaration.file) &&
      declaration.exported &&
      declaration.name &&
      declaration.exportName,
  )
  const productionEnums = allEnums.filter(
    (declaration) =>
      isProductionSchemaFile(declaration.file) &&
      declaration.exported &&
      declaration.name &&
      declaration.exportName,
  )
  const djangoModels = collectDjangoModels(files)
  const migration = collectMigrationEvidence(files)
  const registry = readJson(inputPaths.authorityRegistry)
  const authorityMap = authorityMapFromRegistry(registry)
  const canonicalMapSource = fs.readFileSync(path.join(root, inputPaths.canonicalSchemaMap), 'utf8')
  const canonicalMap = canonicalSchemaMapFromSource(canonicalMapSource)
  const objectGroups = new Map()

  function groupFor(scope, schema, name) {
    const key = `${scope}::${schema}.${name}`
    const group = objectGroups.get(key) ?? {
      key,
      scope,
      schema,
      name,
      declarations: [],
      djangoModels: [],
      migrationEvents: [],
      accessReferences: [],
      phase1aEffects: [],
      phase1aTargetLabels: [],
      rlsPolicies: [],
      rlsMigrationActions: [],
      sourceKinds: new Set(),
    }
    objectGroups.set(key, group)
    return group
  }

  for (const declaration of productionDeclarations) {
    const scope = declaration.file.startsWith(`${appRoot}/services/financial-service/`)
      ? 'financial-service'
      : 'union-eyes'
    const group = groupFor(scope, declaration.schema, declaration.name)
    group.declarations.push(declaration)
    group.sourceKinds.add(
      declaration.declarationKind === 'pgTable'
        ? 'DRIZZLE_TABLE_DECLARATION'
        : 'DRIZZLE_VIEW_DECLARATION',
    )
  }
  for (const model of djangoModels) {
    const group = groupFor('union-eyes', model.schema, model.table)
    group.djangoModels.push(model)
    group.sourceKinds.add('DJANGO_MODEL')
  }
  for (const object of migration.objects) {
    const group = groupFor(object.scope, object.schema, object.name)
    group.migrationEvents.push(...object.events)
    for (const kind of object.kinds) group.sourceKinds.add(kind)
  }

  const declarationsByModuleAndSymbol = new Map()
  for (const declaration of productionDeclarations) {
    const scope = declaration.file.startsWith(`${appRoot}/services/financial-service/`)
      ? 'financial-service'
      : 'union-eyes'
    const group = groupFor(scope, declaration.schema, declaration.name)
    if (declaration.exportName) {
      const moduleSymbols = declarationsByModuleAndSymbol.get(declaration.file) ?? new Map()
      const symbols = moduleSymbols.get(declaration.exportName) ?? new Set()
      symbols.add(group.key)
      moduleSymbols.set(declaration.exportName, symbols)
      declarationsByModuleAndSymbol.set(declaration.file, moduleSymbols)
    }
  }

  const unresolvedSchemaAccessImports = []
  for (const [file, parsed] of parsedSources) {
    if (!isProductionSourceFile(file)) continue
    const aliases = new Map()
    const aliasModules = new Map()
    for (const imported of parsed.imports) {
      if (!/(?:schema|db)/i.test(imported.module)) continue
      const importedFile = resolveRelativeImport(file, imported.module)
      const importedSymbols = importedFile ? declarationsByModuleAndSymbol.get(importedFile) : null
      let unresolvedExport = false
      for (const entry of imported.names) {
        const objectKeys = importedSymbols?.get(entry.imported)
        if (objectKeys) {
          aliases.set(entry.local, objectKeys)
          const modules = aliasModules.get(entry.local) ?? new Set()
          modules.add(JSON.stringify({ specifier: imported.module, resolvedFile: importedFile }))
          aliasModules.set(entry.local, modules)
        } else if (
          [...declarationsByModuleAndSymbol.values()].some((moduleSymbols) =>
            moduleSymbols.has(entry.imported),
          )
        )
          unresolvedExport = true
      }
      if (unresolvedExport) {
        unresolvedSchemaAccessImports.push({
          file,
          module: imported.module,
          resolvedModule: importedFile,
          reason: importedFile
            ? 'Named schema export exists elsewhere but not in the directly resolved import module.'
            : 'Schema-like import could not be resolved to a checked-in relative module.',
        })
      }
    }
    const referencesByKey = new Map()
    for (const [symbol, keys] of aliases) {
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const read = new RegExp(
        `(?:\\.query\\s*\\.\\s*${escaped}\\s*\\.\\s*find(?:First|Many)\\b|\\b(?:select|selectDistinct)\\s*\\([^)]*\\)\\s*\\.\\s*from\\s*\\(\\s*${escaped}\\b|\\.(?:from|innerJoin|leftJoin|rightJoin|fullJoin)\\s*\\(\\s*${escaped}\\b)`,
        'm',
      )
      const insert = new RegExp(`\\b(?:insert|insertInto)\\s*\\(\\s*${escaped}\\b`, 'm')
      const update = new RegExp(`\\bupdate\\s*\\(\\s*${escaped}\\b`, 'm')
      const remove = new RegExp(`\\b(?:delete|deleteFrom)\\s*\\(\\s*${escaped}\\b`, 'm')
      const operations = [
        read.test(parsed.source) && 'READ_OR_JOIN',
        insert.test(parsed.source) && 'INSERT',
        update.test(parsed.source) && 'UPDATE',
        remove.test(parsed.source) && 'DELETE',
      ].filter(Boolean)
      for (const key of keys) {
        const references = referencesByKey.get(key) ?? { symbols: new Set(), operations: new Set() }
        references.symbols.add(symbol)
        for (const operation of operations) references.operations.add(operation)
        referencesByKey.set(key, references)
      }
    }
    for (const [key, reference] of referencesByKey) {
      const group = objectGroups.get(key)
      if (group) {
        group.accessReferences.push({
          file,
          symbols: sort(reference.symbols),
          imports: [
            ...new Set(
              [...reference.symbols].flatMap((symbol) => [...(aliasModules.get(symbol) ?? [])]),
            ),
          ]
            .map((entry) => JSON.parse(entry))
            .sort(
              (a, b) =>
                a.resolvedFile.localeCompare(b.resolvedFile) ||
                a.specifier.localeCompare(b.specifier),
            ),
          candidateOperations: sort(reference.operations),
          evidenceClass: reference.operations.size
            ? 'DIRECT_MODULE_IMPORT_AND_STATIC_DRIZZLE_CALL_PATTERN'
            : 'DIRECT_MODULE_IMPORT_WITHOUT_STATIC_CALL_PATTERN',
        })
      }
    }
  }

  const phase1aEffects = readJson(inputPaths.phase1aEffects).canonicalRecords
  const knownDatabaseEffects = new Set([
    'DATABASE_READ',
    'DATABASE_INSERT',
    'DATABASE_UPDATE',
    'DATABASE_DELETE',
  ])
  const normalizeIndex = new Map()
  for (const group of objectGroups.values()) {
    for (const value of [
      group.name,
      group.declarations.map((declaration) => declaration.exportName),
      group.djangoModels.map((model) => model.model),
    ].flat()) {
      const key = normalize(value)
      if (!key) continue
      const set = normalizeIndex.get(key) ?? new Set()
      set.add(group.key)
      normalizeIndex.set(key, set)
    }
  }

  const effectTargetResolutions = []
  const effectsWithoutTargets = []
  const sourceCeilingEffects = []
  for (const effect of phase1aEffects) {
    const dataEffect = effect.primaryDataEffect
    const targets = effect.dataTargets ?? []
    if (knownDatabaseEffects.has(dataEffect)) {
      if (targets.length === 0) {
        effectsWithoutTargets.push({
          chainId: effect.chainId,
          primaryDataEffect: dataEffect,
          sourceReferences: effect.sourceReferences ?? [],
          reason: 'Accepted Phase 1A record has no explicit dataTargets entry.',
        })
      }
      for (const label of targets) {
        const matches = sort(normalizeIndex.get(normalize(label)) ?? [])
        const resolution = {
          chainId: effect.chainId,
          primaryDataEffect: dataEffect,
          targetLabel: label,
          matches,
          status:
            matches.length === 1
              ? 'RESOLVED_TO_ONE_SOURCE_OBJECT'
              : matches.length
                ? 'AMBIGUOUS_SOURCE_OBJECT'
                : 'NO_SOURCE_OBJECT_MATCH',
          sourceReferences: effect.sourceReferences ?? [],
        }
        effectTargetResolutions.push(resolution)
        for (const key of matches) {
          const group = objectGroups.get(key)
          if (group) {
            group.phase1aEffects.push({ chainId: effect.chainId, primaryDataEffect: dataEffect })
            group.phase1aTargetLabels.push(label)
          }
        }
      }
    } else if (
      dataEffect === 'UNKNOWN_DATA_EFFECT' ||
      (effect.secondaryDataEffects ?? []).some((entry) => {
        const secondaryEffect =
          typeof entry === 'string' ? entry : (entry.effect ?? entry.dataEffect ?? entry.type)
        return secondaryEffect === 'UNKNOWN_DATA_EFFECT'
      })
    ) {
      sourceCeilingEffects.push({
        chainId: effect.chainId,
        primaryDataEffect: dataEffect,
        dataTargets: targets,
        sourceReferences: effect.sourceReferences ?? [],
      })
    }
  }

  for (const group of objectGroups.values()) {
    const authority = authorityMap.get(group.key)
    const canonicalModule = canonicalMap.get(group.key)
    const objectMigration = migration.objects.find((item) => item.key === group.key)
    const declaredSources = group.declarations.map((declaration) => declaration.file)
    const distinctDeclarationSites = unique(declaredSources).length
    const referencedExports = unique(
      group.accessReferences.flatMap((reference) => reference.symbols),
    )
    const hasProductionAccess = group.accessReferences.some(
      (reference) => reference.candidateOperations.length > 0,
    )
    const migrationOnly =
      group.declarations.length === 0 &&
      group.djangoModels.length === 0 &&
      group.accessReferences.length === 0 &&
      group.migrationEvents.some((event) => event.operation.startsWith('CREATE'))
    const isView =
      group.sourceKinds.has('DRIZZLE_VIEW_DECLARATION') ||
      group.sourceKinds.has('VIEW_DDL') ||
      /^v_/i.test(group.name)
    let authorityClass
    let authorityEvidence

    if (authority?.owner === 'PLATFORM_AUTH' || authority?.owner === 'EXTERNAL_READONLY') {
      authorityClass = 'PROVIDER_OR_EXTERNALLY_MANAGED'
      authorityEvidence = authority
    } else if (isView) {
      authorityClass = 'GENERATED_OR_DERIVED_REPRESENTATION'
      authorityEvidence =
        'View declaration or explicit view naming/DDL; current runtime materialization is not established.'
    } else if (migrationOnly) {
      authorityClass = 'MIGRATION_ONLY_HISTORICAL'
      authorityEvidence =
        'Migration DDL is present without a current exported schema declaration, Django model, or indexed production access reference.'
    } else if (authority || group.djangoModels.length > 0) {
      authorityClass =
        distinctDeclarationSites > 1 ||
        (group.declarations.length > 0 && group.djangoModels.length > 0)
          ? 'ACTIVE_CANONICAL_AUTHORITY_WITH_LEGACY_MIRROR'
          : 'ACTIVE_CANONICAL_AUTHORITY'
      authorityEvidence = authority ?? {
        owner: 'DJANGO_CANONICAL',
        djangoModels: group.djangoModels,
        doctrine: `${appRoot}/db/schema-authority/registry.json#doctrine`,
      }
    } else if (canonicalModule) {
      authorityClass = 'ACTIVE_CANONICAL_AUTHORITY_WITH_LEGACY_MIRROR'
      authorityEvidence = {
        owner: 'DRIZZLE_DECLARATION_MAP',
        canonicalModule,
        evidence: inputPaths.canonicalSchemaMap,
      }
    } else if (group.key.includes('::ue_cache.')) {
      authorityClass = 'GENERATED_OR_DERIVED_REPRESENTATION'
      authorityEvidence =
        'Database schema is explicitly named ue_cache; no database runtime inspection was performed.'
    } else if (group.declarations.length > 1) {
      authorityClass = 'CONFLICTING_OR_UNRESOLVED_AUTHORITY'
      authorityEvidence =
        'Multiple current exported declarations share a qualified object identity without an explicit authority record.'
    } else {
      authorityClass = 'UNKNOWN_SOURCE_CEILING'
      authorityEvidence =
        'Source declarations or migration evidence do not establish a unique canonical owner in the checked-in authority records.'
    }

    const declarationColumnSets = group.declarations.map((declaration) => ({
      file: declaration.file,
      exportName: declaration.exportName,
      columns: sort(declaration.columns.map((column) => column.databaseColumn)),
    }))
    const uniqueColumnSets = unique(
      declarationColumnSets.map((declaration) => JSON.stringify(declaration.columns)),
    )
    const declarationConflict = distinctDeclarationSites > 1 && uniqueColumnSets.length > 1
    const rlsKey = group.key
    group.authorityClass = authorityClass
    group.authorityEvidence = authorityEvidence
    group.registeredAuthority = authority ?? null
    group.canonicalSchemaModule = canonicalModule ?? null
    group.declarationColumnSets = declarationColumnSets
    group.declarationConflict = declarationConflict
    group.declarationConflictEvidence = declarationConflict
      ? 'Different declared column-name sets; column types, nullability, defaults, keys, and foreign-key semantics are not compared.'
      : distinctDeclarationSites > 1
        ? 'Column-name sets match; semantic schema compatibility is not established.'
        : null
    group.productionAccessObserved = hasProductionAccess
    group.referencedSymbols = referencedExports
    group.migrationDdl = objectMigration?.events ?? group.migrationEvents
    group.rlsRequirement =
      authority?.rlsRequired === true
        ? 'REQUIRED_BY_AUTHORITY_REGISTRY'
        : 'NOT_ESTABLISHED_BY_AUTHORITY_REGISTRY'
    group.rlsMigrationActions = migration.rlsFlags[rlsKey] ?? []
    group.rlsPolicies = migration.policies[rlsKey] ?? []
    group.rlsSourceStatus =
      group.rlsMigrationActions.includes('ENABLE') || group.rlsMigrationActions.includes('FORCE')
        ? 'RLS_ENABLE_OR_FORCE_ARTIFACT_OBSERVED'
        : group.rlsPolicies.length
          ? 'POLICY_ARTIFACT_OBSERVED_WITHOUT_ENABLE_FORCE_EVIDENCE'
          : 'NO_RLS_ARTIFACT_MATCHED_IN_SCANNED_MIGRATIONS'
  }

  const objects = [...objectGroups.values()]
    .map((group) => ({
      objectId: group.key,
      databaseScope: group.scope,
      qualifiedName: `${group.schema}.${group.name}`,
      objectName: group.name,
      authorityClass: group.authorityClass,
      authorityEvidence: group.authorityEvidence,
      registeredAuthority: group.registeredAuthority,
      canonicalSchemaModule: group.canonicalSchemaModule,
      declarations: group.declarations.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
      ),
      djangoModels: group.djangoModels,
      migrationDdl: group.migrationDdl.sort(
        (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
      ),
      declarationColumnSets: group.declarationColumnSets,
      declarationConflict: group.declarationConflict,
      declarationConflictEvidence: group.declarationConflictEvidence,
      productionAccessObserved: group.productionAccessObserved,
      accessReferences: group.accessReferences.sort((a, b) => a.file.localeCompare(b.file)),
      phase1aEffects: group.phase1aEffects.sort((a, b) => a.chainId.localeCompare(b.chainId)),
      phase1aTargetLabels: sort(unique(group.phase1aTargetLabels)),
      rls: {
        requirement: group.rlsRequirement,
        sourceStatus: group.rlsSourceStatus,
        migrationActions: group.rlsMigrationActions,
        policyArtifacts: group.rlsPolicies,
      },
      sourceKinds: sort(group.sourceKinds),
    }))
    .sort((a, b) => a.objectId.localeCompare(b.objectId))

  const parsedDeclarationAnchors = new Set(
    productionDeclarations.map(
      (declaration) => `${declaration.file}::${declaration.exportName}::${declaration.line}`,
    ),
  )
  for (const record of r1Adjudication.dispositions) {
    const object = objects.find((candidate) => candidate.objectId === record.objectId)
    assert(
      object,
      `R1 object ${record.objectId} is absent from the generated persistence universe.`,
    )
    assert(
      record.declarations.every((declaration) =>
        parsedDeclarationAnchors.has(
          `${declaration.file}::${declaration.exportName}::${declaration.line}`,
        ),
      ),
      `R1 declaration anchors changed for ${record.objectId}.`,
    )
    assert(
      record.declarations.every((declaration) =>
        r1DeclarationAnchors.has(
          `${declaration.file}::${declaration.exportName}::${declaration.line}`,
        ),
      ),
      `R1 parser scope is incomplete for ${record.objectId}.`,
    )
    object.r1Adjudication = {
      finalDisposition: record.finalDisposition,
      authorityQuestion: record.authorityQuestion,
      unknownAuthority: record.unknownAuthority,
      defectIds: record.defectIds,
      confidence: record.confidence,
    }
  }
  const r1FinalDispositionKeys = {
    ACTIVE_CANONICAL_WITH_LEGACY_MIRROR: 'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR',
    KNOWN_DUPLICATE_AUTHORITY_CONFLICTS: 'KNOWN_DUPLICATE_AUTHORITY_CONFLICTS',
  }
  const r1DispositionCountKeys = [
    'ACTIVE_CANONICAL_TABLES',
    'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR',
    'LEGACY_NON_AUTHORITATIVE_TABLES',
    'MIGRATION_ONLY_HISTORICAL_TABLES',
    'GENERATED_OR_DERIVED_TABLE_REPRESENTATIONS',
    'TEST_OR_FIXTURE_ONLY_TABLES',
    'KNOWN_DUPLICATE_AUTHORITY_CONFLICTS',
    'UNKNOWN_AUTHORITY_TABLES',
  ]
  const r1DispositionCounts = Object.fromEntries(
    r1DispositionCountKeys.map((key) => [
      key,
      r1Adjudication.dispositions.filter(
        (record) => r1FinalDispositionKeys[record.finalDisposition] === key,
      ).length,
    ]),
  )
  assert(
    r1Adjudication.dispositions.every(
      (record) =>
        r1FinalDispositionKeys[record.finalDisposition] && record.unknownAuthority === false,
    ),
    'R1 includes an unmapped or unknown authority disposition.',
  )
  assert(
    r1Adjudication.principalAuthorityCounts.dispositionTotal === r1ObjectIds.length &&
      r1DispositionCountKeys.every(
        (key) => r1DispositionCounts[key] === r1Adjudication.principalAuthorityCounts[key],
      ),
    'Computed R1 exclusive disposition counts differ from the adjudication artifact.',
  )

  const classCounts = Object.fromEntries(
    sort(unique(objects.map((object) => object.authorityClass))).map((authorityClass) => [
      authorityClass,
      objects.filter((object) => object.authorityClass === authorityClass).length,
    ]),
  )
  const declarationGroups = new Map()
  for (const declaration of productionDeclarations) {
    const scope = declaration.file.startsWith(`${appRoot}/services/financial-service/`)
      ? 'financial-service'
      : 'union-eyes'
    const key = `${scope}::${declaration.schema}.${declaration.name}`
    const entries = declarationGroups.get(key) ?? []
    entries.push(declaration)
    declarationGroups.set(key, entries)
  }
  const duplicateGroups = [...declarationGroups]
    .filter(
      ([, declarations]) => unique(declarations.map((declaration) => declaration.file)).length > 1,
    )
    .map(([objectId, declarations]) => ({
      objectId,
      declarationCount: declarations.length,
      declarationFiles: sort(unique(declarations.map((declaration) => declaration.file))),
      columnShapes: unique(
        declarations.map((declaration) =>
          JSON.stringify(sort(declaration.columns.map((column) => column.databaseColumn))),
        ),
      ),
      columnNameSetConflict:
        unique(
          declarations.map((declaration) =>
            JSON.stringify(sort(declaration.columns.map((column) => column.databaseColumn))),
          ),
        ).length > 1,
      comparisonLimit: 'Column names only; schema compatibility is not established.',
    }))
    .sort((a, b) => a.objectId.localeCompare(b.objectId))

  const unresolvedTargets = effectTargetResolutions.filter(
    (resolution) => resolution.matches.length !== 1,
  )
  const sourceCeilingNoTargetCount = effectsWithoutTargets.length
  const activeAuthorityUnknownCount = objects.filter(
    (object) =>
      object.productionAccessObserved && object.authorityClass === 'UNKNOWN_SOURCE_CEILING',
  ).length
  const activeDeclarationConflicts = objects.filter(
    (object) =>
      object.productionAccessObserved &&
      object.declarationConflict &&
      !object.canonicalSchemaModule &&
      !r1ByObjectId.has(object.objectId),
  )
  const r1UnknownAuthorityCount = r1Adjudication.dispositions.filter(
    (record) => record.unknownAuthority,
  ).length
  const r1Gate = r1UnknownAuthorityCount === 0 ? 'PASS' : 'SOURCE_CEILING'
  const outsideR1ObjectsUnchanged = baselineCensus.persistenceUniverse
    .filter((object) => !r1ByObjectId.has(object.objectId))
    .every((baselineObject) => {
      const generatedObject = objects.find((object) => object.objectId === baselineObject.objectId)
      return JSON.stringify(generatedObject) === JSON.stringify(baselineObject)
    })
  assert(
    outsideR1ObjectsUnchanged,
    'An object outside the fixed R1 set changed in generated output.',
  )
  assert(
    objects.length === r1Adjudication.censusWideResiduals.persistenceUniverseObjectCount &&
      JSON.stringify(classCounts) ===
        JSON.stringify(r1Adjudication.censusWideResiduals.authorityClassCountsBeforeR1Overlay),
    'Census-wide object denominator or pre-overlay authority-class counts changed during R1.',
  )
  assert(
    r1Adjudication.censusWideResiduals.outsideFixedInputDispositionChanges === 0 &&
      r1Adjudication.gate.phase1b1Census === 'SOURCE_CEILING',
    'R1 global gate boundary does not match the recorded source-ceiling disposition.',
  )
  const gate =
    activeDeclarationConflicts.length > 0
      ? 'FAIL'
      : unresolvedTargets.length > 0 ||
          sourceCeilingNoTargetCount > 0 ||
          sourceCeilingEffects.length > 0 ||
          activeAuthorityUnknownCount > 0
        ? 'SOURCE_CEILING'
        : 'PASS'

  const phase1aCloseout = readJson(inputPaths.phase1aCloseout)
  const phase1aGate = readJson(inputPaths.phase1aGate)
  assert(
    productionDeclarations.every((declaration) => declaration.name && declaration.exportName),
    'Found an unnamed production relational declaration.',
  )
  assert(
    objects.every((object) => object.objectId && object.authorityClass),
    'Every discovered object must have an identity and authority class.',
  )
  assert(
    phase1aEffects.length === 394 && phase1aEffects.every((effect) => effect.chainId),
    'Accepted Phase 1A effect denominator changed; review the source artifact before updating this census.',
  )
  assert(
    phase1aGate.phaseStatus?.phase1AFinalGate === 'SOURCE_CEILING_ACCEPTED',
    'Phase 1A frozen gate no longer matches the accepted source record.',
  )

  const report = {
    title: 'Phase 1B.1 — Canonical Data Authority & Persistence Universe',
    status: gate,
    phaseBoundary: {
      phase1A: 'FROZEN',
      phase1AGate: phase1aGate.phaseStatus.phase1AFinalGate,
      phase1B1: gate,
      laterPhasesStarted: false,
      runtimeDatabaseInspectionPerformed: false,
      migrationExecuted: false,
      databaseWritten: false,
    },
    methodology: {
      generatedBy: 'scripts/ue/census-data-authority.mjs',
      deterministic: true,
      sourceOnly: true,
      declarationParser:
        'TypeScript compiler API; exported top-level pgTable/pgSchema.table and view declarations in production schema roots.',
      activeAccessIndexer:
        'Production TypeScript named imports are linked only to matching exports in directly resolved relative modules, then checked for Drizzle query/insert/update/delete/from/join call patterns. Unresolved imports are reported separately; this does not prove route reachability or runtime execution.',
      migrationEvidence:
        'Static CREATE/ALTER/DROP TABLE, CREATE VIEW, CREATE POLICY, and RLS enable/force token scan over checked-in SQL and Django migration files. Each file/event retains a source lineage; presence is not proof of application.',
      declarationConflictComparison:
        'Duplicate declaration conflict means declared column-name sets differ only. Matching names do not prove compatibility because types, nullability, defaults, keys, and foreign-key semantics are not compared.',
      djangoModelIndexer:
        'Recognizes direct models.Model subclasses and transitive subclasses declared in the same models.py file, excludes Meta.abstract models, and does not treat the presence of a models.Field expression alone as proof of model inheritance.',
      databaseIdentity:
        'Qualified by source database scope and PostgreSQL schema. financial-service is kept separate from the Union Eyes database scope.',
      sourceScope: {
        application: appRoot,
        declarationFiles:
          'Production exported declarations in apps/union-eyes/db/schema/**, db/schema*.ts, and financial-service schema modules.',
        migrationFiles: migration.files,
        migrationLineages: migration.lineages,
        modelFiles: sort(files.filter((file) => file.endsWith('/models.py'))),
        runtimeReferenceFiles: sort([...parsedSources.keys()].filter(isProductionSourceFile)),
        excludedGeneratedDirectories: sort([...ignoredDirectories]),
        declarationTestAndToolingCount: allDeclarations.length - productionDeclarations.length,
      },
      limitations: [
        'No live PostgreSQL catalog, deployed schema, migration ledger, or runtime database connection was queried.',
        'A checked-in migration or RLS statement proves only source presence, not that it ran or is currently effective.',
        'Authority is asserted only where checked-in authority registry/model doctrine or canonical schema map explicitly supports it; unregistered objects remain source-ceiling findings.',
        'Access references are source-level candidates, not proof of reachable behavior, successful queries, tenant isolation, or actual writes.',
        'Only direct relative named imports are linked to a declaration; unresolved aliases, re-export barrels, and external imports remain outside object-level access evidence.',
        'Declaration conflicts compare column names only and do not establish semantic incompatibility or compatibility.',
        'Dynamic SQL, generated identifiers, framework indirection, and external provider-side persistence may be incompletely represented.',
      ],
    },
    inputs: {
      phase1aFinal: inputPaths.phase1aGate,
      phase1aCanonicalEffects: inputPaths.phase1aEffects,
      phase1aSourceCloseout: inputPaths.phase1aCloseout,
      schemaAuthorityRegistry: inputPaths.authorityRegistry,
      canonicalSchemaDeclarationMap: inputPaths.canonicalSchemaMap,
      phase1b1R1Adjudication: inputPaths.phase1b1R1Adjudication,
      baselineCensus: `${outputBase}.json`,
    },
    denominators: {
      allTypeScriptSchemaCallDeclarations: allDeclarations.length,
      productionExportedRelationalDeclarations: productionDeclarations.length,
      productionExportedEnumDeclarations: productionEnums.length,
      qualifiedObjectsInUnionEyesAndFinanceScopes: objects.length,
      qualifiedObjectsWithProductionDrizzleAccessCandidate: objects.filter(
        (object) => object.productionAccessObserved,
      ).length,
      exactDjangoModelDeclarations: djangoModels.length,
      migrationFilesScanned: migration.files.length,
      migrationSqlFilesScanned: migration.sqlFiles.length,
      migrationPythonFilesScanned: migration.pythonFiles.length,
      migrationDdlEvents: migration.objects.reduce((sum, object) => sum + object.events.length, 0),
      distinctMigrationDdlObjects: migration.objects.length,
      migrationOnlyObjects: classCounts.MIGRATION_ONLY_HISTORICAL ?? 0,
      rlsPolicyArtifacts: Object.values(migration.policies).reduce(
        (sum, rows) => sum + rows.length,
        0,
      ),
      rlsEnableForceDisableArtifacts: migration.rlsOccurrences.length,
      knownPhase1aCanonicalEffectRecords: phase1aEffects.length,
      phase1aKnownDatabaseEffectRecords: phase1aEffects.filter((effect) =>
        knownDatabaseEffects.has(effect.primaryDataEffect),
      ).length,
      phase1aKnownDatabaseEffectRecordsWithoutExplicitTargets: sourceCeilingNoTargetCount,
      phase1aExplicitKnownDatabaseTargetLabels: effectTargetResolutions.length,
      phase1aTargetLabelsResolvedUniquely: effectTargetResolutions.filter(
        (resolution) => resolution.matches.length === 1,
      ).length,
      phase1aTargetLabelsUnresolvedOrAmbiguous: unresolvedTargets.length,
      phase1aAcceptedUnknownEffectRecordsCarriedForward: sourceCeilingEffects.length,
      phase1aCloseoutResidualObligations:
        phase1aCloseout.obligationRegister?.residualEffectChainObligations?.length ?? null,
      registeredAuthorityObjects: registry.tables.length,
    },
    authorityClassCounts: classCounts,
    r1Adjudication: {
      ...r1Adjudication,
      generatedChecks: {
        fixedInputCount: fixedInputRows.length,
        fixedInputPredicateMatched: true,
        declarationAnchorsVerified: true,
        exclusiveDispositionCounts: r1DispositionCounts,
        unknownAuthorityCount: r1UnknownAuthorityCount,
        fixedFiveGate: r1Gate,
        outsideFixedInputObjectsUnchanged: outsideR1ObjectsUnchanged,
        censusWideAuthorityClassCountsUnchanged: true,
      },
    },
    gateRationale: {
      status: gate,
      reasons: [
        unresolvedTargets.length > 0 &&
          `${unresolvedTargets.length} explicit Phase 1A database target label(s) did not resolve to exactly one source object.`,
        sourceCeilingNoTargetCount > 0 &&
          `${sourceCeilingNoTargetCount} accepted Phase 1A database-effect record(s) have no explicit dataTargets.`,
        sourceCeilingEffects.length > 0 &&
          `${sourceCeilingEffects.length} accepted Phase 1A UNKNOWN_DATA_EFFECT record(s) remain carried forward and were not re-adjudicated.`,
        activeAuthorityUnknownCount > 0 &&
          `${activeAuthorityUnknownCount} source objects have indexed production query-pattern references but no explicit canonical owner.`,
        activeDeclarationConflicts.length > 0 &&
          `${activeDeclarationConflicts.length} directly imported declaration group(s) with differing column-name sets match static production access patterns without canonical-map resolution; this is a source conflict finding, not proof of runtime execution.`,
        unresolvedSchemaAccessImports.length > 0 &&
          `${unresolvedSchemaAccessImports.length} schema-like named imports could not be linked to the declaration module and were excluded from object access evidence.`,
        gate === 'PASS' &&
          'All in-scope source evidence reconciled within declared static-analysis limits.',
      ].filter(Boolean),
      counts: {
        explicitTargetLabelsUnresolvedOrAmbiguous: unresolvedTargets.length,
        knownDatabaseEffectRecordsMissingTargets: sourceCeilingNoTargetCount,
        unknownEffectsCarriedForward: sourceCeilingEffects.length,
        activeObjectsWithoutExplicitAuthority: activeAuthorityUnknownCount,
        activeUnmappedDeclarationConflicts: activeDeclarationConflicts.length,
        unresolvedSchemaAccessImports: unresolvedSchemaAccessImports.length,
      },
    },
    phase1aReconciliation: {
      acceptedEffectSource: inputPaths.phase1aEffects,
      knownDatabaseEffectKinds: [
        'DATABASE_READ',
        'DATABASE_INSERT',
        'DATABASE_UPDATE',
        'DATABASE_DELETE',
      ],
      explicitTargetResolutions: effectTargetResolutions,
      knownDatabaseEffectsWithoutExplicitTargets: effectsWithoutTargets.sort((a, b) =>
        a.chainId.localeCompare(b.chainId),
      ),
      unknownEffectCarryForward: sourceCeilingEffects.sort((a, b) =>
        a.chainId.localeCompare(b.chainId),
      ),
      noEffectAndExternalProviderEffectRecordsNotReclassified: phase1aEffects
        .filter((effect) =>
          [
            'NO_PERSISTENT_EFFECT',
            'EXTERNAL_PROVIDER_READ',
            'EXTERNAL_PROVIDER_WRITE',
            'OBJECT_STORAGE_WRITE',
            'STUB_OR_MOCK_EFFECT',
            'MISSING_IMPLEMENTATION',
          ].includes(effect.primaryDataEffect),
        )
        .map((effect) => ({ chainId: effect.chainId, primaryDataEffect: effect.primaryDataEffect }))
        .sort((a, b) => a.chainId.localeCompare(b.chainId)),
    },
    duplicateDeclarationGroups: duplicateGroups,
    unresolvedSchemaAccessImports: unresolvedSchemaAccessImports.sort(
      (a, b) => a.file.localeCompare(b.file) || a.module.localeCompare(b.module),
    ),
    persistenceUniverse: objects,
    separateInventories: {
      enumDeclarations: productionEnums.sort(
        (a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name),
      ),
      djangoModels,
      migrationViews: migration.views,
      rlsOccurrences: migration.rlsOccurrences,
      migrationFiles: migration.files.map((file) => ({
        file,
        language: file.endsWith('.sql') ? 'sql' : 'python',
        lineage: migrationLineage(file),
      })),
      migrationLineages: migration.lineages,
    },
  }

  const markdown = [
    '# Phase 1B.1 — Canonical Data Authority & Persistence Universe',
    '',
    `**Gate: ${gate}**`,
    '',
    '## Scope and non-proofs',
    '',
    '- Phase 1A remains frozen at `SOURCE_CEILING_ACCEPTED`; this census does not modify its findings.',
    '- Source-only analysis. No database connection, runtime inspection, migration execution, database write, repair, or Phase 1B.2+ work was performed.',
    '- Migration/RLS entries show checked-in source artifacts only; they do not prove application or current runtime policy state.',
    '- Access references are static candidates, not proof of runtime reachability or successful execution.',
    '',
    '## Denominators',
    '',
    '| Measure | Count |',
    '| --- | ---: |',
    `| All TypeScript schema-call declarations | ${allDeclarations.length} |`,
    `| Production exported relational declarations | ${productionDeclarations.length} |`,
    `| Production exported enum declarations | ${productionEnums.length} |`,
    `| Qualified relational objects across source database scopes | ${objects.length} |`,
    `| Objects with a directly imported production Drizzle access candidate | ${objects.filter((object) => object.productionAccessObserved).length} |`,
    `| Django model declarations | ${djangoModels.length} |`,
    `| Migration files scanned | ${migration.files.length} |`,
    `| SQL migration files scanned | ${migration.sqlFiles.length} |`,
    `| Django Python migration files scanned | ${migration.pythonFiles.length} |`,
    `| Migration DDL events | ${report.denominators.migrationDdlEvents} |`,
    `| Migration-only historical objects | ${report.denominators.migrationOnlyObjects} |`,
    `| RLS policy artifacts | ${report.denominators.rlsPolicyArtifacts} |`,
    `| RLS enable/force/disable artifacts | ${migration.rlsOccurrences.length} |`,
    '',
    '## Migration source lineages',
    '',
    '| Lineage | Files |',
    '| --- | ---: |',
    ...Object.entries(migration.lineages).map(
      ([lineage, lineageFiles]) => `| ${lineage} | ${lineageFiles.length} |`,
    ),
    '',
    '## Authority classes',
    '',
    '| Class | Objects |',
    '| --- | ---: |',
    ...Object.entries(classCounts).map(([name, count]) => `| ${name} | ${count} |`),
    '',
    '## Phase 1B.1-R1 exact-five adjudication',
    '',
    `**Fixed-five status: ${r1Gate}**  `,
    `**Overall census gate remains: ${gate}**`,
    '',
    'The R1 declaration parser uses each anchored declaration’s root Drizzle builder call to identify database column names; declarations outside the exact five retain the existing parsing behavior.',
    '',
    '| Object | Final disposition | Defect | Confidence |',
    '| --- | --- | --- | --- |',
    ...r1Adjudication.dispositions.map(
      (record) =>
        `| ${record.objectId} | ${record.finalDisposition} | ${record.defectIds.join(', ')} | ${record.confidence} |`,
    ),
    '',
    '| Exclusive R1 disposition | Objects |',
    '| --- | ---: |',
    ...Object.entries(r1DispositionCounts).map(([name, count]) => `| ${name} | ${count} |`),
    `| Noncanonical Drizzle mirror declarations (representation count) | ${r1Adjudication.principalAuthorityCounts.nonAuthoritativeDrizzleMirrorDeclarations} |`,
    `| Declared column-shape conflicts (representation count) | ${r1Adjudication.principalAuthorityCounts.declaredColumnShapeConflicts} |`,
    '',
    `Fixed input: ${fixedInputRows.length} objects; unknown authority within the fixed five: ${r1UnknownAuthorityCount}. All objects outside the fixed set are unchanged.`,
    '',
    `Global residual: ${activeAuthorityUnknownCount} active-access objects retain unknown authority across the full census; the full universe contains ${classCounts.UNKNOWN_SOURCE_CEILING ?? 0} unknown-source-ceiling objects. The R1 adjudication does not resolve or reclassify them.`,
    '',
    '## Phase 1A target reconciliation',
    '',
    `The accepted Phase 1A normalization contains ${phase1aEffects.length} effect records, of which ${report.denominators.phase1aKnownDatabaseEffectRecords} have a known database effect. ${effectTargetResolutions.length} explicit target label(s) are present; ${report.denominators.phase1aTargetLabelsResolvedUniquely} resolve uniquely, and ${unresolvedTargets.length} remain unresolved or ambiguous. ${sourceCeilingNoTargetCount} known database-effect records contain no explicit target label.`,
    '',
    `${sourceCeilingEffects.length} accepted \`UNKNOWN_DATA_EFFECT\` record(s) are carried forward without re-adjudication. This is an evidence boundary, not a claim that they do or do not persist data.`,
    '',
    '| Chain | Effect | Target label | Resolution | Matched object(s) |',
    '| --- | --- | --- | --- | --- |',
    ...effectTargetResolutions.map(
      (resolution) =>
        `| ${resolution.chainId} | ${resolution.primaryDataEffect} | ${resolution.targetLabel} | ${resolution.status} | ${resolution.matches.join(', ') || '—'} |`,
    ),
    '',
    '## Known limitations',
    '',
    ...report.methodology.limitations.map((limitation) => `- ${limitation}`),
    '',
    '## Detailed inventory',
    '',
    `The JSON companion contains ${objects.length} qualified object records, per-declaration columns and source paths, directly bound static access candidates, unresolved schema-like imports, lineage-tagged migration DDL evidence, RLS policy artifacts, explicit registry ownership, and Phase 1A target links.`,
    '',
    `Generated by \`scripts/ue/census-data-authority.mjs\`.`,
    '',
  ].join('\n')

  const jsonPath = path.join(root, `${outputBase}.json`)
  const markdownPath = path.join(root, `${outputBase}.md`)
  const prettierConfig = async (file) => (await prettier.resolveConfig(file)) ?? {}
  const write = async () => {
    const formattedJson = await prettier.format(`${JSON.stringify(report, null, 2)}\n`, {
      ...(await prettierConfig(jsonPath)),
      filepath: jsonPath,
      parser: 'json',
    })
    const formattedMarkdown = await prettier.format(markdown, {
      ...(await prettierConfig(markdownPath)),
      filepath: markdownPath,
      parser: 'markdown',
    })
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true })
    fs.writeFileSync(jsonPath, formattedJson)
    fs.writeFileSync(markdownPath, formattedMarkdown)
  }
  write()
    .then(() => {
      console.log(
        JSON.stringify(
          {
            status: gate,
            productionDeclarations: productionDeclarations.length,
            qualifiedObjects: objects.length,
            migrationOnly: report.denominators.migrationOnlyObjects,
            phase1aKnownDatabaseEffects: report.denominators.phase1aKnownDatabaseEffectRecords,
            targetLabelsResolved: report.denominators.phase1aTargetLabelsResolvedUniquely,
            targetLabelsUnresolved: unresolvedTargets.length,
            databaseEffectsWithoutTargets: sourceCeilingNoTargetCount,
            unknownEffectsCarriedForward: sourceCeilingEffects.length,
            r1FixedFiveStatus: r1Gate,
            r1FixedFiveUnknownAuthority: r1UnknownAuthorityCount,
            outputs: [`${outputBase}.json`, `${outputBase}.md`],
          },
          null,
          2,
        ),
      )
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}

main()
