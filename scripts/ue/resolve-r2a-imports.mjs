import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const remediationDir = 'docs/union-eyes/reality-remediation'
const inputPath = `${remediationDir}/PHASE_1B_1_R2N_DENOMINATOR_AND_CEILING_AUDIT.json`
const censusPath = `${remediationDir}/PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS.json`
const tsconfigPath = 'apps/union-eyes/tsconfig.json'
const outputBase = `${remediationDir}/PHASE_1B_1_R2A_IMPORT_RESOLUTION_CLOSEOUT`
const expectedGapCounts = {
  ALIAS_RESOLUTION_NOT_FOLLOWED: 959,
  DECLARATION_NOT_EXPORTED: 7,
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
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

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function importBindingName(element) {
  return element.propertyName?.text ?? element.name.text
}

function declarationEvidence(declaration) {
  const sourceFile = declaration.getSourceFile()
  const { line } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile))
  const name = declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : null

  return {
    file: relativePath(sourceFile.fileName),
    line: line + 1,
    declarationKind: ts.SyntaxKind[declaration.kind],
    name,
  }
}

function resolveSymbolDeclarations(checker, symbol) {
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
  return resolved.getDeclarations() ?? []
}

function schemaDeclarationIndex(census) {
  const index = new Map()
  for (const object of census.persistenceUniverse) {
    for (const declaration of object.declarations) {
      const key = `${declaration.file}|${declaration.exportName}`
      const ids = index.get(key) ?? []
      ids.push({
        objectId: object.objectId,
        qualifiedName: object.qualifiedName,
        declarationFile: declaration.file,
        declarationLine: declaration.line,
        exportName: declaration.exportName,
      })
      index.set(key, ids)
    }
  }
  return index
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

function classifyMechanism(moduleSpecifier) {
  if (moduleSpecifier.startsWith('@/')) return 'TSCONFIG_PATH_ALIAS'
  if (moduleSpecifier.startsWith('.')) return 'RELATIVE_MODULE_SPECIFIER'
  return 'PACKAGE_OR_OTHER_MODULE_SPECIFIER'
}

function isSchemaModule(file) {
  return /(?:^|\/)db\/schema(?:\/|[-.]|$)/.test(file)
}

async function main() {
  const input = readJson(inputPath)
  const census = readJson(censusPath)
  const selected = input.records.filter(
    (record) =>
      record.originClass === 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL' &&
      record.STATIC_EVIDENCE_PATH_REMAINING === 'YES',
  )
  const selectedIds = selected.map((record) => record.residualId)

  assert(selected.length === 966, `Expected 966 R2A inputs; found ${selected.length}.`)
  assert(new Set(selectedIds).size === selectedIds.length, 'R2A input residual IDs are not unique.')
  assert(
    JSON.stringify(countBy(selected, (record) => record.importResolutionClass)) ===
      JSON.stringify(expectedGapCounts),
    'R2A input gap distribution differs from the accepted R2N audit.',
  )
  assert(
    input.sourceCeilingSufficiency.authorityObjectsWithStaticPathRemaining === 207 &&
      input.sourceCeilingSufficiency.targetlessEffectsWithStaticPathRemaining === 56,
    'R2N remaining authority/effect counts differ from the accepted audit.',
  )
  assert(input.excludedCarryForward?.phase1AUnknownEffectChains?.count === 247)
  assert(input.R1Preservation?.defectIdsPreserved?.length === 5)
  assert(
    selected.every((record) => record.objectId === null && record.databaseScope === 'union-eyes'),
    'An R2A input includes a linked object or has left the Union Eyes database scope.',
  )

  const configFullPath = path.join(root, tsconfigPath)
  const configRead = ts.readConfigFile(configFullPath, ts.sys.readFile)
  assert(!configRead.error, 'Unable to read the Union Eyes TypeScript configuration.')
  const parsedConfig = ts.parseJsonConfigFileContent(
    configRead.config,
    ts.sys,
    path.dirname(configFullPath),
    undefined,
    configFullPath,
  )
  assert(
    parsedConfig.errors.length === 0,
    `Union Eyes TypeScript configuration has errors: ${parsedConfig.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
      .join('; ')}`,
  )

  const grouped = new Map()
  for (const record of selected) {
    const reference = record.directUsageEvidence?.[0]
    assert(reference?.file && reference?.module, `Import ${record.residualId} lacks a saved path.`)
    const key = `${reference.file}\n${reference.module}`
    const group = grouped.get(key) ?? {
      file: reference.file,
      module: reference.module,
      records: [],
    }
    group.records.push(record)
    grouped.set(key, group)
  }

  const sourceFiles = new Map()
  const importsByKey = new Map()
  for (const [key, group] of grouped) {
    const importer = path.join(root, group.file)
    assert(fs.existsSync(importer), `R2A importer does not exist: ${group.file}`)
    const sourceText = fs.readFileSync(importer, 'utf8')
    const sourceFile = ts.createSourceFile(
      importer,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      group.file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    sourceFiles.set(importer, sourceFile)
    const declarations = []
    function visit(node) {
      if (
        ts.isImportDeclaration(node) &&
        node.moduleSpecifier.text === group.module &&
        node.importClause &&
        !node.importClause.isTypeOnly
      ) {
        declarations.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    assert(
      declarations.length === group.records.length,
      `Import occurrence count drift for ${group.file} :: ${group.module}: ` +
        `${group.records.length} R2N entries versus ${declarations.length} non-type imports.`,
    )
    importsByKey.set(key, declarations)
  }

  const program = ts.createProgram({
    rootNames: [...sourceFiles.keys()],
    options: parsedConfig.options,
  })
  const checker = program.getTypeChecker()
  const host = ts.createCompilerHost(parsedConfig.options)
  const censusIndex = schemaDeclarationIndex(census)
  const occurrenceIndices = new Map()

  for (const [key, group] of grouped) {
    const sourceFile = program.getSourceFile(path.join(root, group.file))
    assert(sourceFile, `TypeScript program omitted the selected importer ${group.file}.`)
    const declarations = []
    function visit(node) {
      if (
        ts.isImportDeclaration(node) &&
        node.moduleSpecifier.text === group.module &&
        node.importClause &&
        !node.importClause.isTypeOnly
      ) {
        declarations.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    importsByKey.set(key, declarations)
  }

  const resolutions = selected.map((record) => {
    const reference = record.directUsageEvidence[0]
    const key = `${reference.file}\n${reference.module}`
    const occurrenceIndex = occurrenceIndices.get(key) ?? 0
    occurrenceIndices.set(key, occurrenceIndex + 1)
    const importDeclaration = importsByKey.get(key)[occurrenceIndex]
    assert(importDeclaration, `No matching import declaration for ${record.residualId}.`)
    const sourceFile = importDeclaration.getSourceFile()
    const importLine =
      sourceFile.getLineAndCharacterOfPosition(importDeclaration.getStart()).line + 1
    const importerFullPath = path.join(root, reference.file)
    const tsResolution = ts.resolveModuleName(
      reference.module,
      importerFullPath,
      parsedConfig.options,
      host,
    ).resolvedModule
    const resolvedModule = tsResolution ? relativePath(tsResolution.resolvedFileName) : null
    const moduleSymbol = checker.getSymbolAtLocation(importDeclaration.moduleSpecifier)
    const moduleExports = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []
    const bindings = importDeclaration.importClause.namedBindings
    assert(
      bindings && ts.isNamedImports(bindings),
      `Expected named schema imports for ${record.residualId}; inspect the changed input shape.`,
    )

    const importedExports = bindings.elements.map((element) => {
      const importedName = importBindingName(element)
      const exportSymbol = moduleExports.find((symbol) => symbol.name === importedName)
      const declarations = exportSymbol
        ? resolveSymbolDeclarations(checker, exportSymbol)
            .map(declarationEvidence)
            .sort((left, right) =>
              `${left.file}:${left.line}`.localeCompare(`${right.file}:${right.line}`),
            )
        : []
      const linkedObjects = []
      for (const declaration of declarations) {
        if (!declaration.name) continue
        const matches = censusIndex.get(`${declaration.file}|${declaration.name}`) ?? []
        linkedObjects.push(...matches)
      }
      return {
        importedName,
        localName: element.name.text,
        isTypeOnly: element.isTypeOnly,
        status: exportSymbol ? 'EXPORTED' : 'EXPORT_NOT_FOUND',
        declarationEvidence: declarations,
        linkedSchemaObjects: linkedObjects,
      }
    })

    const missingExports = importedExports
      .filter((entry) => entry.status === 'EXPORT_NOT_FOUND')
      .map((entry) => entry.importedName)
    const linkedSchemaObjects = importedExports.flatMap((entry) => entry.linkedSchemaObjects)
    const moduleKind =
      resolvedModule && isSchemaModule(resolvedModule)
        ? 'UNION_EYES_SCHEMA_SOURCE'
        : 'OTHER_OR_PACKAGE_SOURCE'
    let disposition
    if (!resolvedModule || !moduleSymbol) {
      disposition = 'SOURCE_CEILING_UNRESOLVED_MODULE'
    } else if (moduleKind === 'OTHER_OR_PACKAGE_SOURCE' && linkedSchemaObjects.length === 0) {
      disposition = 'NON_SCHEMA_OR_PACKAGE_IMPORT'
    } else if (missingExports.length > 0) {
      disposition = 'KNOWN_MISSING_NAMED_EXPORT'
    } else {
      disposition = 'MODULE_AND_NAMED_EXPORTS_RESOLVED'
    }

    const sourceLine = importDeclaration.getText(sourceFile)
    const uniqueLinkedObjects = new Map(
      linkedSchemaObjects.map((object) => [`${object.objectId}|${object.declarationFile}`, object]),
    )
    return {
      residualId: record.residualId,
      initialGapClass: record.importResolutionClass,
      importer: reference.file,
      importLine,
      moduleSpecifier: reference.module,
      moduleResolutionMechanism: classifyMechanism(reference.module),
      resolvedModule,
      moduleKind,
      sourceImport: sourceLine,
      importedExports,
      missingExports: uniqueSorted(missingExports),
      linkedSchemaObjects: [...uniqueLinkedObjects.values()].sort((left, right) =>
        `${left.objectId}|${left.declarationFile}`.localeCompare(
          `${right.objectId}|${right.declarationFile}`,
        ),
      ),
      disposition,
      staticEvidencePathRemaining:
        disposition === 'SOURCE_CEILING_UNRESOLVED_MODULE' ? 'YES' : 'NO',
      evidenceBoundary:
        'Resolves only the recorded import module and named exports. Schema-object links are census references, not authority adjudications.',
    }
  })

  assert(resolutions.length === selected.length, 'R2A output cardinality differs from its input.')
  assert(
    new Set(resolutions.map((record) => record.residualId)).size === selected.length,
    'R2A output does not represent each input exactly once.',
  )
  const dispositionCounts = countBy(resolutions, (record) => record.disposition)
  const remainingImports = resolutions.filter(
    (record) => record.staticEvidencePathRemaining === 'YES',
  ).length
  const linkedSchemaObjectIds = uniqueSorted(
    resolutions.flatMap((record) => record.linkedSchemaObjects.map((object) => object.objectId)),
  )
  const data = {
    title: 'Phase 1B.1-R2A Import Resolution Closeout',
    status: remainingImports === 0 ? 'IMPORT_RESOLUTION_COMPLETE' : 'STATIC_WORK_REMAINS',
    auditMode: 'bounded source inspection; no application source changes',
    phaseBoundary: {
      scope:
        'Resolve exactly the 966 R2N unresolved schema-import residuals with remaining static evidence paths.',
      excluded:
        'Does not adjudicate authority objects, targetless effects, frozen Phase 1A chains, R1 records, or schema authority.',
      phase1B1Closed: false,
      phase1B2Authorized: false,
    },
    provenance: {
      inputAudit: inputPath,
      census: censusPath,
      typescriptConfig: tsconfigPath,
      hashes: {
        inputAuditSha256: sha256(inputPath),
        censusSha256: sha256(censusPath),
        typescriptConfigSha256: sha256(tsconfigPath),
      },
      generator: 'scripts/ue/resolve-r2a-imports.mjs',
    },
    inputValidation: {
      selector:
        "originClass === 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL' && STATIC_EVIDENCE_PATH_REMAINING === 'YES'",
      selectedCount: selected.length,
      expectedInitialGapCounts: expectedGapCounts,
      actualInitialGapCounts: countBy(selected, (record) => record.importResolutionClass),
      exactImporterModuleOccurrenceMapping: 'PASS',
    },
    resolutionSummary: {
      total: resolutions.length,
      byDisposition: dispositionCounts,
      importsNoLongerRequiringStaticResolution: resolutions.length - remainingImports,
      importsStillRequiringStaticResolution: remainingImports,
      distinctLinkedCensusSchemaObjects: linkedSchemaObjectIds.length,
      linkedSchemaObjectIds,
    },
    staticWorkAccounting: {
      beforeR2A: {
        authorityObjects: 207,
        unresolvedSchemaImports: 966,
        targetlessEffects: 56,
        total: 1229,
      },
      afterR2A: {
        authorityObjects: 207,
        unresolvedSchemaImports: remainingImports,
        targetlessEffects: 56,
        total: 207 + remainingImports + 56,
      },
      importsResolvedOrIdentifiedAsKnownExportDefects: resolutions.length - remainingImports,
      excludedPhase1AUnknownEffectChains: 247,
      preservedR1Records: 5,
    },
    gate: {
      state: 'STATIC_WORK_REMAINS',
      phase1B1: 'NOT_YET_CLOSED',
      phase1B2: 'NOT_AUTHORIZED',
      reason:
        'R2A addresses import-resolution paths only. The 207 authority-object paths and 56 targetless-effect paths remain outside this pass.',
    },
    records: resolutions,
  }

  const jsonPath = `${outputBase}.json`
  const markdownPath = `${outputBase}.md`
  const byDispositionRows = Object.entries(dispositionCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([disposition, count]) => [disposition, count])
  const missingExportRows = resolutions
    .filter((record) => record.missingExports.length > 0)
    .map((record) => [
      record.residualId,
      `${record.importer}:${record.importLine}`,
      record.moduleSpecifier,
      record.missingExports.join(', '),
    ])
  const markdown = [
    '# Phase 1B.1-R2A — Import Resolution Closeout',
    '',
    `**Status: ${data.status}**`,
    '**Phase 1B.1: NOT YET CLOSED**',
    '**Phase 1B.2: NOT AUTHORIZED**',
    '',
    '## Scope and evidence boundary',
    '',
    `This closeout resolves exactly ${selected.length} records selected from the accepted R2N audit by ` +
      "`originClass === 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL'` and `STATIC_EVIDENCE_PATH_REMAINING === 'YES'`. " +
      'It uses the Union Eyes TypeScript configuration and follows only the matching non-type-only import declarations and named exports. ' +
      'No product code, imports, aliases, exports, schema declarations, migrations, or runtime databases were changed.',
    '',
    'The seven initial `DECLARATION_NOT_EXPORTED` labels are input gap classifications, not presumed outcomes. ' +
      'The generator records the current configured module/export result for each exact import. Companion type-only imports are not separate R2A records.',
    '',
    '## Input and resolution counts',
    '',
    ...renderTable(
      ['Initial R2N gap class', 'Count'],
      [
        ...Object.entries(expectedGapCounts).map(([name, count]) => [name, count]),
        ['SUM', selected.length],
      ],
    ),
    '',
    ...renderTable(
      ['Final R2A disposition', 'Count'],
      [...byDispositionRows, ['SUM', resolutions.length]],
    ),
    '',
    `Imports no longer requiring static resolution: **${resolutions.length - remainingImports}**.`,
    `Imports still requiring static resolution: **${remainingImports}**.`,
    '',
    missingExportRows.length > 0
      ? '### Confirmed missing named exports (not repaired)'
      : '### Confirmed missing named exports',
    '',
    ...(missingExportRows.length > 0
      ? [
          'These are precise export-resolution defects in the existing source. This closeout does not repair them or infer table authority.',
          '',
          ...renderTable(
            ['Residual ID', 'Import location', 'Module', 'Missing export(s)'],
            missingExportRows,
          ),
        ]
      : ['No missing named exports were detected.']),
    '',
    '## Updated static-work accounting',
    '',
    ...renderTable(
      ['Work class', 'Before R2A', 'After R2A'],
      [
        ['Authority-object paths', 207, 207],
        ['Unresolved schema-import paths', 966, remainingImports],
        ['Targetless-effect paths', 56, 56],
        ['Total static paths remaining', 1229, 207 + remainingImports + 56],
      ],
    ),
    '',
    'The 247 frozen Phase 1A unknown-effect chains and five R1 records remain separately preserved and are not R2A inputs. ' +
      `R2A links to ${linkedSchemaObjectIds.length} existing census schema-object IDs as source references only; it makes no authority determination.`,
    '',
    '## Gate',
    '',
    '- `STATIC_WORK_REMAINS`',
    '- Phase 1B.1: `NOT YET CLOSED`',
    '- Phase 1B.2: `NOT AUTHORIZED`',
    '- The 207 authority-object and 56 targetless-effect paths remain unprocessed.',
    '',
    '## Reproduction and validation',
    '',
    '- Generate artifacts: `node scripts/ue/resolve-r2a-imports.mjs`',
    '- Exact-once record and count assertions run inside the generator.',
    '- Documentation validation: `pnpm validate:docs`',
    '- The complete per-import evidence index is in the adjacent JSON artifact.',
    '',
  ].join('\n')

  await writeFormatted(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'json')
  await writeFormatted(markdownPath, markdown, 'markdown')
  console.log(
    JSON.stringify(
      {
        json: jsonPath,
        markdown: markdownPath,
        selected: selected.length,
        dispositions: dispositionCounts,
        staticPathsRemaining: data.staticWorkAccounting.afterR2A.total,
        gate: data.gate,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
