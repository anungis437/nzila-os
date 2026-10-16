import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const remediationDir = 'docs/union-eyes/reality-remediation'
const r2nPath = `${remediationDir}/PHASE_1B_1_R2N_DENOMINATOR_AND_CEILING_AUDIT.json`
const censusPath = `${remediationDir}/PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS.json`
const r2aPath = `${remediationDir}/PHASE_1B_1_R2A_IMPORT_RESOLUTION_CLOSEOUT.json`
const r1Path = `${remediationDir}/PHASE_1B_1_R1_AUTHORITY_CONFLICT_ADJUDICATION.json`
const registryPath = 'apps/union-eyes/db/schema-authority/registry.json'
const contractPath = 'apps/union-eyes/db/schema-authority/runtime-required-contract.json'
const canonicalMapPath = 'apps/union-eyes/scripts/canonical-schema-map.ts'
const unionSchemaIndexPath = 'apps/union-eyes/db/schema/index.ts'
const financeConfigPath = 'apps/union-eyes/services/financial-service/drizzle.config.ts'
const financeSchemaPath = 'apps/union-eyes/services/financial-service/src/db/schema.ts'
const outputBase = `${remediationDir}/PHASE_1B_1_R2B_AUTHORITY_OBJECT_CLOSEOUT`
const allowedDisposition = 'SOURCE_CEILING_UNKNOWN_AUTHORITY'
const defectId = 'R2B-DEFECT-FINANCIAL-CONFIG-SCHEMA-EXCLUSION'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function sha256(file) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, file)))
    .digest('hex')
}

function relativePath(file) {
  return path.relative(root, file).replaceAll('\\', '/')
}

function countBy(records, selector) {
  return records.reduce((counts, record) => {
    const key = selector(record)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function sourceFile(file, cache = new Map()) {
  if (!cache.has(file)) {
    const fullPath = path.join(root, file)
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    cache.set(
      file,
      ts.createSourceFile(fullPath, readText(file), ts.ScriptTarget.Latest, true, kind),
    )
  }
  return cache.get(file)
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function lineNumber(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
}

function stringValue(node) {
  return ts.isStringLiteralLike(node) ? node.text : null
}

function declarationFor(record, cache) {
  const evidence = record.declarationEvidence
  assert(evidence.length === 1, `${record.residualId} must have exactly one frozen declaration.`)
  const item = evidence[0]
  const source = sourceFile(item.file, cache)
  const matches = []

  walk(source, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      node.name.text !== item.exportName ||
      !node.initializer ||
      !ts.isCallExpression(node.initializer)
    ) {
      return
    }

    const call = node.initializer
    let builder = null
    let table = null
    let schema = 'public'

    if (
      ts.isIdentifier(call.expression) &&
      ['pgTable', 'sqliteTable', 'mysqlTable'].includes(call.expression.text)
    ) {
      builder = call.expression.text
      table = stringValue(call.arguments[0])
    } else if (
      ts.isPropertyAccessExpression(call.expression) &&
      call.expression.name.text === 'table'
    ) {
      builder = 'schema.table'
      table = stringValue(call.arguments[0])
      let schemaCall = call.expression.expression
      if (ts.isIdentifier(schemaCall)) {
        const schemaBinding = []
        walk(source, (candidate) => {
          if (
            ts.isVariableDeclaration(candidate) &&
            ts.isIdentifier(candidate.name) &&
            candidate.name.text === schemaCall.text &&
            candidate.initializer
          ) {
            schemaBinding.push(candidate.initializer)
          }
        })
        if (schemaBinding.length === 1) schemaCall = schemaBinding[0]
      }
      if (ts.isCallExpression(schemaCall) && ts.isIdentifier(schemaCall.expression)) {
        if (schemaCall.expression.text === 'pgSchema') {
          schema = stringValue(schemaCall.arguments[0]) ?? schema
        }
      }
    }

    if (!builder || !table) return

    const statement = source.statements.find(
      (candidate) =>
        ts.isVariableStatement(candidate) && candidate.declarationList.declarations.includes(node),
    )
    const exported = Boolean(
      statement?.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
    )

    matches.push({
      file: item.file,
      line: lineNumber(source, node),
      exportName: item.exportName,
      builder,
      schema,
      table,
      exported,
    })
  })

  assert(matches.length === 1, `${record.residualId} declaration could not be uniquely parsed.`)
  const declaration = matches[0]
  assert(
    declaration.line === item.line &&
      declaration.schema === item.schema &&
      declaration.table === item.table &&
      declaration.exported,
    `${record.residualId} source declaration differs from its frozen declaration evidence.`,
  )
  return declaration
}

function migrationEvidenceFor(record) {
  return (record.migrationEvidence ?? []).map((evidence) => {
    const lines = readText(evidence.file).split(/\r?\n/)
    const sourceLine = lines[evidence.line - 1]?.trim()
    assert(sourceLine, `${record.residualId} migration reference is not a source line.`)

    const sqlLine = sourceLine.replace(/^--\s*/, '')
    const match = sqlLine.match(
      /^(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?|ALTER\s+TABLE\s+(?:ONLY\s+)?|DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?)(?:"?([\w]+)"?\.)?"?([\w]+)"?/i,
    )
    assert(match, `${record.residualId} migration line is not a recognized table DDL statement.`)
    const kind = /^--/.test(sourceLine)
      ? 'COMMENTED_OUT_DDL'
      : /^CREATE/i.test(sqlLine)
        ? 'CREATE_TABLE'
        : /^ALTER/i.test(sqlLine)
          ? 'ALTER_TABLE'
          : evidence.file.includes('/rollback/')
            ? 'ROLLBACK_DROP_TABLE'
            : 'DROP_TABLE'
    const statementSchema = match[2] ?? 'public'
    const table = match[3]

    assert(
      table === record.qualifiedName.split('.').at(-1),
      `${record.residualId} migration line targets a different table.`,
    )
    assert(
      statementSchema === record.qualifiedName.split('.')[0],
      `${record.residualId} migration line targets a different schema.`,
    )
    if (kind === 'DROP_TABLE') {
      throw new Error(`${record.residualId} has a non-rollback DROP TABLE evidence line.`)
    }

    return {
      file: evidence.file,
      line: evidence.line,
      kind,
      statement: sourceLine,
    }
  })
}

function resolveExports(entryPath) {
  const entryFullPath = path.join(root, entryPath)
  const program = ts.createProgram([entryFullPath], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    skipLibCheck: true,
    noResolve: false,
  })
  const checker = program.getTypeChecker()
  const entry = program.getSourceFile(entryFullPath)
  assert(entry, `Unable to resolve schema entrypoint ${entryPath}.`)
  const moduleSymbol = checker.getSymbolAtLocation(entry)
  assert(moduleSymbol, `Unable to read exports for schema entrypoint ${entryPath}.`)
  const exports = checker.getExportsOfModule(moduleSymbol)

  return (name, declarationFile) => {
    const symbol = exports.find((item) => item.getName() === name)
    if (!symbol) return { exported: false, targetMatchesDeclaration: false }
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    const targetFiles = (target.declarations ?? []).map((declaration) =>
      relativePath(declaration.getSourceFile().fileName),
    )
    return {
      exported: true,
      targetMatchesDeclaration: targetFiles.includes(declarationFile),
    }
  }
}

function parseConfiguredSchema() {
  const source = sourceFile(financeConfigPath)
  let configuredSchema = null
  walk(source, (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'schema'
    ) {
      configuredSchema = stringValue(node.initializer)
    }
  })
  assert(
    configuredSchema === './src/db/schema.ts',
    'Financial-service Drizzle schema input differs from the frozen configuration evidence.',
  )
  return configuredSchema
}

function parseCanonicalMap() {
  const source = sourceFile(canonicalMapPath)
  let object = null
  walk(source, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'CANONICAL_SCHEMA_DECLARATIONS' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      object = node.initializer
    }
  })
  assert(object, 'Canonical schema declaration map was not found.')
  return new Map(
    object.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [
        property.name.text.replaceAll("'", ''),
        stringValue(property.initializer),
      ])
      .filter(([key, value]) => key && value),
  )
}

function accessEvidenceFor(record, declaration, cache) {
  return (record.directUsageEvidence ?? []).map((evidence) => {
    const source = sourceFile(evidence.file, cache)
    const imports = []
    walk(source, (node) => {
      if (
        !ts.isImportDeclaration(node) ||
        !node.importClause ||
        !node.importClause.namedBindings ||
        !ts.isNamedImports(node.importClause.namedBindings)
      ) {
        return
      }
      const moduleSpecifier = stringValue(node.moduleSpecifier)
      for (const element of node.importClause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text
        if (evidence.symbols.includes(element.name.text)) {
          imports.push({
            symbol: element.name.text,
            importedName,
            moduleSpecifier,
          })
        }
      }
    })

    assert(
      imports.length === evidence.symbols.length,
      `${record.residualId} recorded access import does not resolve uniquely.`,
    )
    const resolvedImports = imports.map((item) => {
      const resolved = ts.resolveModuleName(
        item.moduleSpecifier,
        path.join(root, evidence.file),
        { moduleResolution: ts.ModuleResolutionKind.Node10 },
        ts.sys,
      ).resolvedModule
      assert(resolved, `${record.residualId} access module ${item.moduleSpecifier} is unresolved.`)
      const resolvedFile = relativePath(resolved.resolvedFileName)
      assert(
        resolvedFile === declaration.file,
        `${record.residualId} recorded access imports a different declaration module.`,
      )
      return { ...item, resolvedFile }
    })

    const callSites = []
    const readMethods = new Set(['from', 'join', 'leftJoin', 'rightJoin', 'innerJoin', 'fullJoin'])
    walk(source, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
      const operation = node.expression.name.text
      if (
        !['insert', 'update', 'delete', ...readMethods].includes(operation) ||
        !node.arguments.some(
          (argument) => ts.isIdentifier(argument) && evidence.symbols.includes(argument.text),
        )
      ) {
        return
      }
      callSites.push({
        operation,
        line: lineNumber(source, node),
      })
    })

    const observed = new Set(
      callSites.map((site) =>
        readMethods.has(site.operation) ? 'READ_OR_JOIN' : site.operation.toUpperCase(),
      ),
    )
    const expected = new Set(evidence.candidateOperations ?? [])
    assert(
      [...expected].every((operation) => observed.has(operation)),
      `${record.residualId} access call sites do not support the frozen operation candidates.`,
    )
    assert(callSites.length > 0, `${record.residualId} has no static Drizzle call site.`)

    return {
      file: evidence.file,
      importedSymbols: resolvedImports,
      candidateOperations: [...expected].sort(),
      observedOperations: [...observed].sort(),
      callSites: callSites.sort((a, b) => a.line - b.line),
      limitation:
        'Static call sites do not establish route reachability, runtime execution, query success, or deployed physical identity.',
    }
  })
}

function sourceCeilingReason(record, declaration, mainSchemaExport, configuredSchemaExport) {
  const reasons = [
    'No exact table entry exists in the checked-in authority registry, runtime-required contract, or canonical schema map.',
    'The source declaration identifies a schema/table name but does not verify deployed physical identity or establish unique ownership.',
  ]

  if (record.directUsageEvidence?.length) {
    reasons.push(
      'Recorded direct Drizzle access is confirmed at source level; it proves a consumer reference only, not canonical ownership or runtime reachability.',
    )
  } else {
    reasons.push(
      'No direct access was recorded in the frozen R2N evidence; that absence is not evidence that the object is unused or dead.',
    )
  }
  if (record.databaseScope === 'union-eyes' && !mainSchemaExport.exported) {
    reasons.push(
      `The declaration is not exported by ${unionSchemaIndexPath}; this alone does not establish that the declaration is unused.`,
    )
  }
  if (record.databaseScope === 'financial-service' && !configuredSchemaExport.exported) {
    reasons.push(
      `The financial Drizzle config selects ${financeSchemaPath}, which does not export this declaration.`,
    )
  }
  if (!(record.migrationEvidence ?? []).length) {
    reasons.push(
      'No matching migration DDL line was present in the frozen per-object migration evidence.',
    )
  } else {
    reasons.push(
      'Recorded migration lines are source history only; rollback and commented DDL are not treated as applied migrations.',
    )
  }
  return reasons.join(' ')
}

function renderTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) => `| ${row.map((cell) => String(cell).replaceAll('|', '\\|')).join(' | ')} |`,
    ),
  ]
}

async function writeFormatted(file, content, parser) {
  const fullPath = path.join(root, file)
  const formatted = await prettier.format(content, {
    ...((await prettier.resolveConfig(fullPath)) ?? {}),
    filepath: fullPath,
    parser,
  })
  fs.writeFileSync(fullPath, formatted)
}

function renderMarkdown(data) {
  const summaryRows = Object.entries(data.evidenceSummary).map(([key, value]) => [
    key,
    typeof value === 'object'
      ? Object.entries(value)
          .map(([kind, count]) => `${kind}: ${count}`)
          .join(', ')
      : value,
  ])
  const defectRows = data.defectRegister.map((defect) => [
    defect.id,
    defect.class,
    defect.affectedObjects.join(', '),
    defect.status,
  ])
  const recordRows = data.records.map((record) => [
    record.residualId,
    record.qualifiedName,
    `${record.declaration.file}:${record.declaration.line}`,
    record.authorityEvidence.mainSchemaExport?.exported ? 'Yes' : 'N/A',
    record.authorityEvidence.configuredSchemaExport?.exported ?? 'N/A',
    record.migrationEvidence.map((item) => `${item.kind}@${item.line}`).join(', ') ||
      'None recorded',
    record.directUsageEvidence.map((item) => item.observedOperations.join('+')).join(', ') ||
      'None recorded',
    record.finalDisposition,
  ])

  return [
    '# Phase 1B.1 R2B Authority-Object Closeout',
    '',
    `**Status:** ${data.status}`,
    '',
    '## Scope and boundary',
    '',
    `Adjudicated exactly ${data.inputValidation.selectedCount} records selected by the frozen R2N predicate. This is source-only work: no product code, database, migration execution, or physical schema was changed or queried. R1, R2A, the 56 targetless-effect chains, and the 247 frozen Phase 1A carry-forward chains remain preserved.`,
    '',
    'The disposition is a source ceiling, not proof that an object is canonical, legacy, unused, deployed, or absent from a physical database.',
    '',
    '## Evidence summary',
    '',
    ...renderTable(['Evidence check', 'Result'], summaryRows),
    '',
    'Migration evidence is limited to the exact lines already attached to selected R2N records. The 122 active CREATE/ALTER lines match their selected table name; five DROP lines occur in rollback files; two additional DDL lines are commented out. No migration was executed and no database migration ledger was queried.',
    '',
    '## Registered source discrepancy',
    '',
    ...renderTable(['ID', 'Class', 'Affected objects', 'Status'], defectRows),
    '',
    data.defectRegister.length
      ? data.defectRegister
          .map(
            (defect) =>
              `- **${defect.id}:** ${defect.description} Evidence is source-level only; deployed physical impact is unverified. No repair was made.`,
          )
          .join('\n')
      : 'No confirmed duplicate-authority, referenced-without-declaration, or migration/schema divergence defects were found in the permitted evidence.',
    '',
    '## Arithmetic and gate',
    '',
    `R2A left 207 authority-object evidence paths and 56 targetless-effect paths. R2B consumed the exact 207 authority-object evidence paths; 56 targetless-effect chains remain untouched. Static work therefore moves from 263 after R2A to 56 after R2B. Phase 1B.1 remains open and Phase 1B.2 remains unauthorized.`,
    '',
    `**R2B gate:** ${data.gate.r2b}. **Phase 1B.1 gate:** ${data.gate.phase1B1}.`,
    '',
    '## Accepted source-ceiling state',
    '',
    `**R2BN normalization gate:** ${data.normalization?.PHASE_1B_1_R2BN_GATE ?? 'NOT_RUN'}.`,
    '',
    'R2B evidence work is ACCEPTED; R2B is SOURCE_CEILING_ACCEPTED. All 207 authority records have exhausted bounded static evidence, but static authority and runtime existence remain unproven. They remain open assurance obligations, not unfinished static analysis. The three known configured-schema discrepancies remain attached to source-ceiling records; they do not resolve authority.',
    '',
    'Authority-object universe: CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS. No further R2B static pass is authorized. Authority source-ceiling carry-forward: 207; known authority defect carry-forward: 3 objects. Static work remaining: 56.',
    '',
    'R2C targetless-effect reconciliation: AUTHORIZED, NOT STARTED. Phase 1B.1: NOT_YET_CLOSED. Phase 1B.2: NOT_AUTHORIZED.',
    '',
    'R2BN normalization reads only the accepted closeout; no new application source, targetless-effect chain, runtime database, migration, or database write is consumed or executed.',
    '',
    '## Per-object configured-schema defect records',
    '',
    ...renderTable(
      ['Defect ID', 'Object ID', 'Defect class', 'Declaration file', 'Migration evidence status'],
      (data.defectRegister[0].objectRecords ?? []).map((record) => [
        record.DEFECT_ID,
        record.OBJECT_ID,
        record.DEFECT_CLASS,
        record.DECLARATION_FILE,
        record.MIGRATION_EVIDENCE_STATUS,
      ]),
    ),
    '',
    'Each defect record retains active usage and configuration evidence in JSON. SOURCE_CEILING_UNKNOWN_AUTHORITY and KNOWN_DEFECT are both YES for each of these three objects.',
    '',
    '## Per-object evidence and dispositions',
    '',
    ...renderTable(
      [
        'Residual ID',
        'Source identity',
        'Declaration',
        'Union schema barrel export',
        'Configured finance schema export',
        'Migration evidence',
        'Recorded static access operations',
        'Disposition',
      ],
      recordRows,
    ),
    '',
    'Each JSON record includes the exact consumed paths, source statement lines, authority-artifact match results, direct-import resolution, static call sites, census cross-check, and an object-specific source-ceiling rationale.',
    '',
  ].join('\n')
}

async function adjudicateOriginalEvidence() {
  const input = readJson(r2nPath)
  const census = readJson(censusPath)
  const r2a = readJson(r2aPath)
  const r1 = readJson(r1Path)
  const registry = readJson(registryPath)
  const contract = readJson(contractPath)
  const selected = input.records.filter(
    (record) =>
      record.originClass === 'AUTHORITY_OBJECT_RESIDUAL' &&
      record.STATIC_EVIDENCE_PATH_REMAINING === 'YES',
  )

  assert(selected.length === 207, `Expected 207 R2B inputs; found ${selected.length}.`)
  assert(
    new Set(selected.map((record) => record.residualId)).size === selected.length,
    'R2B residual IDs are not unique.',
  )
  assert(
    new Set(selected.map((record) => record.objectId)).size === selected.length,
    'R2B object IDs are not unique.',
  )
  assert(
    new Set(selected.map((record) => `${record.databaseScope}::${record.qualifiedName}`)).size ===
      selected.length,
    'R2B qualified object identities are not unique.',
  )
  assert(
    JSON.stringify(countBy(selected, (record) => record.databaseScope)) ===
      JSON.stringify({ 'financial-service': 17, 'union-eyes': 190 }),
    'R2B database-scope distribution differs from the fixed selector.',
  )
  assert(
    input.denominator.R2_INPUT_RESIDUALS === 1282 &&
      input.denominator.AUTHORITY_OBJECT_RESIDUALS === 260 &&
      input.denominator.UNRESOLVED_SCHEMA_IMPORT_RESIDUALS === 966 &&
      input.denominator.TARGETLESS_DATABASE_EFFECT_RESIDUALS === 56 &&
      input.denominator.FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD === 247,
    'Frozen R2N denominator or residual counts have changed.',
  )
  assert(r2a.resolutionSummary.total === 966)
  assert(r2a.resolutionSummary.importsNoLongerRequiringStaticResolution === 966)
  assert(r2a.resolutionSummary.importsStillRequiringStaticResolution === 0)
  assert(r2a.resolutionSummary.byDisposition.KNOWN_MISSING_NAMED_EXPORT === 2)
  assert(r2a.staticWorkAccounting.excludedPhase1AUnknownEffectChains === 247)
  assert(r2a.staticWorkAccounting.preservedR1Records === 5)
  assert(r1.gate.fixedFiveAdjudication === 'PASS')
  assert(r1.principalAuthorityCounts.dispositionTotal === 5)
  assert(r1.principalAuthorityCounts.KNOWN_DUPLICATE_AUTHORITY_CONFLICTS === 4)
  assert(r1.principalAuthorityCounts.ACTIVE_CANONICAL_WITH_LEGACY_MIRROR === 1)

  const selectedIds = new Set(selected.map((record) => record.objectId))
  const censusObjects = census.persistenceUniverse.filter((object) =>
    selectedIds.has(object.objectId),
  )
  assert(
    censusObjects.length === selected.length,
    'Selected objects do not map one-to-one to census.',
  )
  const censusById = new Map(censusObjects.map((object) => [object.objectId, object]))

  const unionExport = resolveExports(unionSchemaIndexPath)
  const financeExport = resolveExports(financeSchemaPath)
  const configuredSchema = parseConfiguredSchema()
  const configuredSchemaFile = relativePath(
    path.resolve(path.dirname(path.join(root, financeConfigPath)), configuredSchema),
  )
  assert(
    configuredSchemaFile === financeSchemaPath,
    'Configured financial-service schema path does not resolve to the expected module.',
  )

  const declarationsCache = new Map()
  const migrationCounts = {}
  const records = selected.map((record) => {
    const censusObject = censusById.get(record.objectId)
    assert(censusObject, `${record.residualId} is missing from the frozen persistence census.`)
    assert(
      censusObject.qualifiedName === record.qualifiedName &&
        censusObject.databaseScope === record.databaseScope,
      `${record.residualId} differs from its census identity.`,
    )
    assert(
      censusObject.declarations.length === 1 &&
        censusObject.djangoModels.length === 0 &&
        censusObject.registeredAuthority === null &&
        censusObject.declarationConflict === false,
      `${record.residualId} census ownership/declaration baseline changed.`,
    )

    const declaration = declarationFor(record, declarationsCache)
    const mainSchemaExport =
      record.databaseScope === 'union-eyes'
        ? unionExport(declaration.exportName, declaration.file)
        : null
    const configuredSchemaExport =
      record.databaseScope === 'financial-service'
        ? financeExport(declaration.exportName, declaration.file)
        : null
    const migrationEvidence = migrationEvidenceFor(record)
    for (const item of migrationEvidence) {
      migrationCounts[item.kind] = (migrationCounts[item.kind] ?? 0) + 1
    }
    const directUsageEvidence = accessEvidenceFor(record, declaration, declarationsCache)
    const registryMatches = registry.tables.filter((table) => table.table === declaration.table)
    const runtimeContractMatches = contract.entries.filter(
      (entry) => entry.schema === declaration.schema && entry.table === declaration.table,
    )
    const canonicalMap = parseCanonicalMap()
    const canonicalMapEntry = canonicalMap.get(`${declaration.schema}.${declaration.table}`) ?? null
    assert(
      registryMatches.length === 0 &&
        runtimeContractMatches.length === 0 &&
        canonicalMapEntry === null,
      `${record.residualId} unexpectedly matches a permitted authority artifact.`,
    )

    const finalRecord = {
      residualId: record.residualId,
      objectId: record.objectId,
      databaseScope: record.databaseScope,
      qualifiedName: record.qualifiedName,
      physicalIdentity: {
        sourceQualifiedIdentity: `${declaration.schema}.${declaration.table}`,
        verified: false,
      },
      authorityEvidence: {
        authorityClassBeforeR2B: censusObject.authorityClass,
        registryEntries: registryMatches,
        runtimeRequiredContractEntries: runtimeContractMatches,
        canonicalSchemaMapEntry: canonicalMapEntry,
        mainSchemaExport,
        configuredSchemaExport,
      },
      consumedEvidencePaths: {
        frozenCensus: censusPath,
        declaration: record.declarationEvidence.map((item) => ({
          file: item.file,
          line: item.line,
        })),
        migration: (record.migrationEvidence ?? []).map((item) => ({
          file: item.file,
          line: item.line,
        })),
        directUsage: (record.directUsageEvidence ?? []).map((item) => item.file),
        authorityRegistry: registryPath,
        runtimeRequiredContract: contractPath,
        canonicalSchemaMap: canonicalMapPath,
        schemaExportEntrypoint:
          record.databaseScope === 'union-eyes' ? unionSchemaIndexPath : financeSchemaPath,
        financialDrizzleConfig:
          record.databaseScope === 'financial-service' ? financeConfigPath : null,
      },
      declaration,
      migrationEvidence,
      directUsageEvidence,
      censusCrossCheck: {
        declarations: censusObject.declarations.length,
        djangoModels: censusObject.djangoModels.length,
        registeredAuthority: censusObject.registeredAuthority,
        declarationConflict: censusObject.declarationConflict,
        censusMigrationEvidenceCount: censusObject.migrationDdl.length,
        r2nMigrationEvidenceCount: migrationEvidence.length,
        productionAccessObservedInR2N: record.productionAccessObserved,
      },
      finalDisposition: allowedDisposition,
      authorityClass: 'UNKNOWN_SOURCE_CEILING',
      knownDefectId: null,
      sourceCeilingReason: '',
    }
    finalRecord.sourceCeilingReason = sourceCeilingReason(
      record,
      declaration,
      mainSchemaExport ?? { exported: false },
      configuredSchemaExport ?? { exported: false },
    )
    return finalRecord
  })

  const accessRecords = records.filter((record) => record.directUsageEvidence.length > 0)
  const configExcludedAccessRecords = accessRecords.filter(
    (record) =>
      record.databaseScope === 'financial-service' &&
      record.authorityEvidence.configuredSchemaExport?.exported === false,
  )
  assert(
    accessRecords.length === 7,
    `Expected 7 recorded direct-access objects; found ${accessRecords.length}.`,
  )
  assert(
    configExcludedAccessRecords.length === 3 &&
      configExcludedAccessRecords.every((record) => record.migrationEvidence.length === 0),
    'Expected exactly three directly used financial declarations outside the configured schema input.',
  )

  const defectRegister = [
    {
      id: defectId,
      class: 'CONFIGURED_SCHEMA_INPUT_EXCLUDES_DIRECTLY_USED_DECLARATIONS',
      affectedObjects: configExcludedAccessRecords.map((record) => record.objectId).sort(),
      sourceEvidence: {
        configuredSchema: configuredSchemaFile,
        configFile: financeConfigPath,
        declarationFiles: [
          ...new Set(configExcludedAccessRecords.map((record) => record.declaration.file)),
        ],
        consumerFiles: [
          ...new Set(
            configExcludedAccessRecords.flatMap((record) =>
              record.directUsageEvidence.map((evidence) => evidence.file),
            ),
          ),
        ].sort(),
        migrationEvidence: 'No matching migration DDL paths were present for the affected records.',
      },
      description:
        'Three financial-service tables are imported and used by direct Drizzle INSERT/READ/UPDATE call sites, but their declarations are in schema-platform-economics.ts, which is not exported by the configured drizzle-kit input src/db/schema.ts. The frozen R2N migration evidence contains no matching DDL for these objects.',
      physicalImpact:
        'Unverified. The static mismatch does not establish whether the tables exist in any deployed database or whether another migration/deployment path manages them.',
      status: 'REGISTERED_NOT_REPAIRED',
    },
  ]

  for (const record of configExcludedAccessRecords) record.knownDefectId = defectId
  for (const record of records) {
    assert(
      record.finalDisposition === allowedDisposition && record.sourceCeilingReason.length > 0,
      `${record.residualId} lacks an allowed disposition or specific source-ceiling rationale.`,
    )
  }

  const mainSchemaExported = records.filter(
    (record) => record.authorityEvidence.mainSchemaExport?.exported,
  ).length
  const configuredSchemaExported = records.filter(
    (record) => record.authorityEvidence.configuredSchemaExport?.exported,
  ).length
  const uniqueMigrationObjects = records.filter(
    (record) => record.migrationEvidence.length > 0,
  ).length
  assert(
    mainSchemaExported === 173 &&
      configuredSchemaExported === 13 &&
      uniqueMigrationObjects === 111 &&
      migrationCounts.CREATE_TABLE === 105 &&
      migrationCounts.ALTER_TABLE === 17 &&
      migrationCounts.ROLLBACK_DROP_TABLE === 5 &&
      migrationCounts.COMMENTED_OUT_DDL === 2,
    'R2B source evidence distribution differs from the exact bounded source review.',
  )
  assert(
    records.filter((record) => record.finalDisposition === allowedDisposition).length === 207,
    'R2B final disposition count is not exact.',
  )

  const inputPaths = [
    r2nPath,
    censusPath,
    r2aPath,
    r1Path,
    registryPath,
    contractPath,
    canonicalMapPath,
    unionSchemaIndexPath,
    financeConfigPath,
    financeSchemaPath,
    ...new Set(
      records.flatMap((record) => [
        record.declaration.file,
        ...record.migrationEvidence.map((item) => item.file),
        ...record.directUsageEvidence.map((item) => item.file),
      ]),
    ),
  ].sort()

  const data = {
    title: 'Phase 1B.1 R2B authority-object closeout',
    status: 'SOURCE_CEILING_ACCEPTED',
    sourceOnly: true,
    phaseBoundary: {
      scope:
        'Adjudicate exactly the 207 R2N authority-object residuals with static evidence paths remaining.',
      phase1B1Closed: false,
      phase1B2Authorized: false,
      productCodeChanged: false,
      databaseAccessed: false,
      migrationsExecuted: false,
      targetlessEffectChainsInspected: false,
      r1RecordsReopened: false,
      r2aRecordsReopened: false,
    },
    provenance: {
      selector:
        "originClass === 'AUTHORITY_OBJECT_RESIDUAL' && STATIC_EVIDENCE_PATH_REMAINING === 'YES'",
      r2nInput: r2nPath,
      censusInput: censusPath,
      r2aPreservationInput: r2aPath,
      r1PreservationInput: r1Path,
      generator: 'scripts/ue/adjudicate-r2b-authority-objects.mjs',
      inputSha256: Object.fromEntries(inputPaths.map((file) => [file, sha256(file)])),
    },
    inputValidation: {
      selectedCount: records.length,
      exactOnceResidualIds: true,
      uniqueObjectIds: true,
      uniqueQualifiedIdentities: true,
      databaseScopes: countBy(records, (record) => record.databaseScope),
      dispositionCounts: countBy(records, (record) => record.finalDisposition),
    },
    evidenceSummary: {
      exactSourceDeclarations: `${records.length}/${records.length}`,
      uniqueFrozenCensusObjects: censusObjects.length,
      registeredAuthorityMatches: 0,
      runtimeRequiredContractTableMatches: 0,
      canonicalSchemaMapMatches: 0,
      unionEyesObjectsExportedBySchemaBarrel: `${mainSchemaExported}/190`,
      financialServiceObjectsExportedByConfiguredSchema: `${configuredSchemaExported}/17`,
      objectsWithRecordedMigrationEvidence: `${uniqueMigrationObjects}/207`,
      migrationLinesByKind: migrationCounts,
      objectsWithRecordedDirectDrizzleAccess: `${accessRecords.length}/207`,
      physicalIdentitiesVerified: 0,
      confirmedDuplicateAuthorityDefects: 0,
      confirmedReferencedWithoutDeclarationDefects: 0,
      confirmedSchemaConfigurationDivergenceDefects: defectRegister.length,
    },
    defectsRegistered: defectRegister.length,
    defectRegister,
    staticWorkAccounting: {
      afterR2A: {
        authorityObjectsWithStaticEvidenceRemaining: 207,
        unresolvedSchemaImports: 0,
        targetlessDatabaseEffects: 56,
        totalStaticWorkRemaining: 263,
      },
      afterR2B: {
        authorityObjectsWithStaticEvidenceRemaining: 0,
        authorityObjectsAtSourceCeiling: 207,
        unresolvedSchemaImports: 0,
        targetlessDatabaseEffects: 56,
        totalStaticWorkRemaining: 56,
      },
      excludedFrozenPhase1AUnknownEffectChains: 247,
      preservedR1Records: 5,
      preservedR2AInputs: 966,
      preservedR2AKnownMissingNamedExportDefects: 2,
      arithmetic: '263 - 207 = 56',
    },
    preservation: {
      R1: {
        fixedFiveAdjudication: r1.gate.fixedFiveAdjudication,
        duplicateAuthorityConflicts:
          r1.principalAuthorityCounts.KNOWN_DUPLICATE_AUTHORITY_CONFLICTS,
        canonicalWithLegacyMirror: r1.principalAuthorityCounts.ACTIVE_CANONICAL_WITH_LEGACY_MIRROR,
        inputSha256: sha256(r1Path),
      },
      R2A: {
        inputs: r2a.resolutionSummary.total,
        resolvedOrRegisteredAsKnownDefect:
          r2a.resolutionSummary.importsNoLongerRequiringStaticResolution,
        importsStillRequiringStaticResolution:
          r2a.resolutionSummary.importsStillRequiringStaticResolution,
        knownMissingNamedExportDefects:
          r2a.resolutionSummary.byDisposition.KNOWN_MISSING_NAMED_EXPORT,
        inputSha256: sha256(r2aPath),
      },
      frozenPhase1AChains: 247,
      targetlessEffectChains: 56,
      targetlessEffectEvidenceInspected: false,
      R2NDenominator: 1282,
    },
    gate: {
      r2b: records.some((record) => record.finalDisposition === allowedDisposition)
        ? 'SOURCE_CEILING'
        : 'PASS',
      phase1B1: 'NOT_YET_CLOSED',
      phase1B1Closed: false,
      phase1B2: 'NOT_AUTHORIZED',
      remainingStaticWork: 56,
      recommendation:
        'R2C targetless-effect reconciliation is authorized for the 56 exact remaining chains, but has not started.',
      reason:
        'All 207 selected authority-object evidence paths were consumed and individually dispositioned. The checked-in source evidence still cannot establish unique ownership or deployed physical identity for these objects. Fifty-six targetless-effect chains remain untouched.',
    },
    records,
  }

  await writeFormatted(`${outputBase}.json`, `${JSON.stringify(data, null, 2)}\n`, 'json')
  await writeFormatted(`${outputBase}.md`, renderMarkdown(data), 'markdown')
  console.log(
    JSON.stringify(
      {
        json: `${outputBase}.json`,
        markdown: `${outputBase}.md`,
        selected: records.length,
        dispositions: data.inputValidation.dispositionCounts,
        defectCount: defectRegister.length,
        remainingStaticWork: data.staticWorkAccounting.afterR2B.totalStaticWorkRemaining,
        gate: data.gate,
      },
      null,
      2,
    ),
  )
}

async function normalizeAcceptedCloseout() {
  assert(
    process.argv.length === 2,
    'R2B is frozen; no further source adjudication mode is authorized.',
  )
  const data = readJson(`${outputBase}.json`)
  const originalRecords = JSON.stringify(data.records)
  const recordsHash = crypto.createHash('sha256').update(originalRecords).digest('hex')
  assert(
    recordsHash === 'dbefec38e7add17aab8ae8f9bc5fa96014277abd622b3254715287ec31260836',
    'Accepted R2B per-object adjudications changed; normalization cannot re-adjudicate them.',
  )
  assert(data.records.length === 207, 'Expected exactly 207 accepted records.')
  assert(new Set(data.records.map((record) => record.residualId)).size === 207)
  const ceilings = data.records.filter((record) => record.finalDisposition === allowedDisposition)
  assert(ceilings.length === 207, 'Expected 207 preserved authority source ceilings.')
  const defects = data.records.filter((record) => record.knownDefectId === defectId)
  const expectedIds = [
    'financial-service::public.customer_acquisition',
    'financial-service::public.mrr_snapshots',
    'financial-service::public.subscription_events',
  ]
  assert(
    JSON.stringify(defects.map((record) => record.objectId).sort()) === JSON.stringify(expectedIds),
    'The three accepted configured-schema discrepancy IDs changed.',
  )
  assert(data.defectRegister.length === 1 && data.defectRegister[0].id === defectId)
  const defect = data.defectRegister[0]
  assert(JSON.stringify(defect.affectedObjects) === JSON.stringify(expectedIds))
  assert(defect.status === 'REGISTERED_NOT_REPAIRED')
  assert(data.preservation.R1.duplicateAuthorityConflicts === 4)
  assert(data.preservation.R1.canonicalWithLegacyMirror === 1)
  assert(data.preservation.R2A.inputs === 966)
  assert(data.preservation.R2A.importsStillRequiringStaticResolution === 0)
  assert(data.preservation.frozenPhase1AChains === 247)
  assert(data.preservation.targetlessEffectChains === 56)
  assert(data.staticWorkAccounting.afterR2A.totalStaticWorkRemaining === 263)
  assert(data.staticWorkAccounting.afterR2A.authorityObjectsWithStaticEvidenceRemaining === 207)
  assert(data.staticWorkAccounting.afterR2A.targetlessDatabaseEffects === 56)
  assert(data.staticWorkAccounting.afterR2B.authorityObjectsWithStaticEvidenceRemaining === 0)
  assert(data.staticWorkAccounting.afterR2B.targetlessDatabaseEffects === 56)
  assert(data.staticWorkAccounting.afterR2B.totalStaticWorkRemaining === 56)

  defect.objectRecords = defects.map((record) => ({
    DEFECT_ID: record.knownDefectId,
    OBJECT_ID: record.objectId,
    DEFECT_CLASS: defect.class,
    DECLARATION_FILE: record.declaration.file,
    ACTIVE_USAGE_EVIDENCE: record.directUsageEvidence,
    CONFIGURATION_EVIDENCE: {
      file: defect.sourceEvidence.configFile,
      configuredSchema: defect.sourceEvidence.configuredSchema,
      configuredSchemaExport: record.authorityEvidence.configuredSchemaExport,
    },
    MIGRATION_EVIDENCE_STATUS: 'NO_MIGRATION_LINEAGE_IN_FROZEN_EVIDENCE',
    SOURCE_CEILING_UNKNOWN_AUTHORITY: 'YES',
    KNOWN_DEFECT: 'YES',
  }))
  assert(
    defect.objectRecords.every(
      (record) =>
        record.ACTIVE_USAGE_EVIDENCE.length > 0 &&
        record.CONFIGURATION_EVIDENCE.configuredSchemaExport.exported === false,
    ),
    'Frozen defect records lack the established usage/configuration evidence.',
  )
  data.status = 'SOURCE_CEILING_ACCEPTED'
  data.staticWorkAccounting.authorityObjectsAdjudicated = 207
  data.staticWorkAccounting.authoritySourceCeilingCarryForward = 207
  data.staticWorkAccounting.authorityKnownDefectCarryForward = 3
  data.gate.r2b = ceilings.length === 0 ? 'PASS' : 'SOURCE_CEILING'
  data.gate.phase1B1 = 'NOT_YET_CLOSED'
  data.gate.phase1B1Closed = false
  data.gate.phase1B2 = 'NOT_AUTHORIZED'
  data.gate.recommendation =
    'R2C targetless-effect reconciliation is authorized for the 56 exact remaining chains, but has not started.'
  data.normalization = {
    PHASE_1B_1_R2BN_GATE: 'PASS',
    PHASE_1B_1_R2B_EVIDENCE_WORK: 'ACCEPTED',
    INPUT_AUTHORITY_OBJECTS: 207,
    AUTHORITY_OBJECTS_ADJUDICATED: 207,
    SOURCE_CEILING_UNKNOWN_AUTHORITY: 207,
    KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS: 3,
    AUTHORITY_OBJECT_STATIC_WORK_REMAINING: 0,
    TARGETLESS_DATABASE_EFFECTS_REMAINING: 56,
    PHASE_1B_1_R2B_GATE: 'SOURCE_CEILING',
    PHASE_1B_1_R2B: 'SOURCE_CEILING_ACCEPTED',
    AUTHORITY_OBJECT_UNIVERSE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    NO_FURTHER_R2B_STATIC_PASS: 'YES',
    AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
    AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD: 3,
    STATIC_WORK_REMAINING: 56,
    PHASE_1B_1: 'NOT_YET_CLOSED',
    PHASE_1B_2: 'NOT_AUTHORIZED',
    PHASE_1B_1_R2C_TARGETLESS_EFFECT_RECONCILIATION: 'AUTHORIZED',
    PHASE_1B_1_R2C_STARTED: 'NO',
    acceptedRecordsSha256: recordsHash,
    newApplicationSourceInspected: false,
    runtimeDatabaseInspected: false,
    migrationExecuted: false,
    databaseWriteExecuted: false,
    phase1B2Started: false,
    recordStates: data.records.map((record) => ({
      OBJECT_ID: record.objectId,
      STATIC_EVIDENCE_EXHAUSTED: 'YES',
      STATIC_AUTHORITY_PROVEN: 'NO',
      RUNTIME_EXISTENCE_PROVEN: 'NO',
      SOURCE_CEILING_UNKNOWN_AUTHORITY: 'YES',
      KNOWN_DEFECT: record.knownDefectId ? 'YES' : 'NO',
    })),
  }
  assert(JSON.stringify(data.records) === originalRecords, 'Normalization changed adjudications.')
  assert(data.gate.r2b === 'SOURCE_CEILING')
  await writeFormatted(`${outputBase}.json`, `${JSON.stringify(data, null, 2)}\n`, 'json')
  await writeFormatted(`${outputBase}.md`, renderMarkdown(data), 'markdown')
  console.log(
    JSON.stringify(
      {
        PHASE_1B_1_R2BN_GATE: data.normalization.PHASE_1B_1_R2BN_GATE,
        R2B_GATE: data.gate.r2b,
        preservedRecords: data.records.length,
        preservedSourceCeilings: ceilings.length,
        preservedKnownDefectObjects: defects.length,
        staticWorkRemaining: data.gate.remainingStaticWork,
        r2cAuthorized: true,
        r2cStarted: false,
      },
      null,
      2,
    ),
  )
}

normalizeAcceptedCloseout().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
