import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const remediationDir = 'docs/union-eyes/reality-remediation'
const r2Path = `${remediationDir}/PHASE_1B_1_R2_RESIDUAL_AUTHORITY_CLOSEOUT.json`
const censusPath = `${remediationDir}/PHASE_1B_1_CANONICAL_DATA_AUTHORITY_CENSUS.json`
const r1Path = `${remediationDir}/PHASE_1B_1_R1_AUTHORITY_CONFLICT_ADJUDICATION.json`
const outputBase = `${remediationDir}/PHASE_1B_1_R2N_DENOMINATOR_AND_CEILING_AUDIT`

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

function countBy(records, selector) {
  return records.reduce((counts, record) => {
    const key = selector(record)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function sortUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function evidencePath(file, line, role) {
  const location = line === null || line === undefined ? file : `${file}:${line}`
  return role ? `${location} (${role})` : location
}

function withSufficiency(record, available, consumed, remaining, reason) {
  return {
    ...record,
    SOURCE_CEILING_REASON:
      record.finalDisposition === 'SOURCE_CEILING_UNKNOWN_AUTHORITY'
        ? (record.sourceCeilingReason ?? reason)
        : null,
    STATIC_EVIDENCE_ALREADY_AVAILABLE: available,
    STATIC_EVIDENCE_CONSUMED: consumed,
    STATIC_EVIDENCE_PATH_REMAINING: remaining,
    ...(remaining === 'YES' ? { staticEvidencePathWhyNotConsumed: reason } : {}),
  }
}

function classifyImport(record) {
  if (record.sourceCeilingReason?.startsWith('Named schema export exists elsewhere')) {
    return 'DECLARATION_NOT_EXPORTED'
  }
  const module = record.directUsageEvidence?.[0]?.module ?? ''
  if (module.startsWith('@/')) return 'ALIAS_RESOLUTION_NOT_FOLLOWED'
  if (module.startsWith('.')) return 'MODULE_PATH_RESOLUTION_FAILURE'
  return 'OTHER_EXPLICIT_IMPORT_RESOLUTION_GAP'
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

async function main() {
  const historicalR2 = readJson(r2Path)
  const census = readJson(censusPath)
  const r1 = readJson(r1Path)
  const originalRecords = historicalR2.records
  const carryForward = census.phase1aReconciliation.unknownEffectCarryForward
  const carryForwardIds = sortUnique(carryForward.map((chain) => chain.chainId))
  const erroneousFrozenRecords = originalRecords.filter(
    (record) =>
      record.inputResidualCategory === 'OTHER_EXPLICIT_SOURCE_CEILING' &&
      record.residualId.startsWith('frozen-phase1a-effect::'),
  )
  const erroneousFrozenIds = sortUnique(
    erroneousFrozenRecords.map((record) =>
      record.residualId.replace('frozen-phase1a-effect::', ''),
    ),
  )
  assert(originalRecords.length === 1529, 'Historical R2 record count differs from 1,529.')
  assert(carryForward.length === 247, 'Saved Phase 1A carry-forward count differs from 247.')
  assert(
    JSON.stringify(erroneousFrozenIds) === JSON.stringify(carryForwardIds),
    'Frozen Phase 1A IDs in historical R2 do not exactly match the saved carry-forward IDs.',
  )
  assert(
    erroneousFrozenRecords.length === 247,
    'Expected exactly 247 frozen Phase 1A records in the historical R2 artifact.',
  )

  const correctedRecords = originalRecords.filter(
    (record) => !record.residualId.startsWith('frozen-phase1a-effect::'),
  )
  assert(correctedRecords.length === 1282, 'Corrected R2 record count must be 1,282.')
  const authorityRecords = correctedRecords.filter((record) => record.objectId)
  const importRecords = correctedRecords.filter(
    (record) => record.inputResidualCategory === 'UNRESOLVED_SCHEMA_IMPORT',
  )
  const targetlessRecords = correctedRecords.filter(
    (record) => record.inputResidualCategory === 'PHASE_1A_DATABASE_TARGET_UNRESOLVED',
  )
  assert(
    authorityRecords.length === 260 &&
      importRecords.length === 966 &&
      targetlessRecords.length === 56,
    'Corrected R2 origin-class arithmetic differs from 260 + 966 + 56.',
  )

  const importedRecords = importRecords.map((record) => {
    const directReference = record.directUsageEvidence?.[0]
    assert(
      directReference?.file && directReference?.module,
      `Import ${record.residualId} has no exact saved reference.`,
    )
    const importResolutionClass = classifyImport(record)
    const whyNotConsumed =
      importResolutionClass === 'DECLARATION_NOT_EXPORTED'
        ? 'The saved census says the named schema export exists elsewhere but not in the directly resolved import module; the R2 record does not contain evidence that the export/barrel path was followed.'
        : importResolutionClass === 'ALIAS_RESOLUTION_NOT_FOLLOWED'
          ? 'The saved census records an alias module that its direct relative-module resolver could not resolve; no resolved target or export evidence is present in the R2 record.'
          : 'The saved R2 metadata retains this exact importing file and module specifier, but does not contain a resolved target or evidence that the import-resolution gap was followed.'
    return withSufficiency(
      {
        ...record,
        originClass: 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL',
        importResolutionClass,
      },
      [`${directReference.file} imports "${directReference.module}"`],
      ['The census recorded the unresolved import and its resolver reason.'],
      'YES',
      whyNotConsumed,
    )
  })

  const sufficiencyByResidualId = new Map()
  for (const record of authorityRecords) {
    const available = sortUnique([
      ...record.declarationEvidence.map((entry) =>
        evidencePath(entry.file, entry.line, 'declaration'),
      ),
      ...record.migrationEvidence.map((entry) =>
        evidencePath(entry.file, entry.line, 'migration DDL'),
      ),
      ...record.directUsageEvidence.map((entry) =>
        evidencePath(entry.file, null, 'production access reference'),
      ),
    ])
    assert(available.length > 0, `Authority object ${record.residualId} has no saved bounded path.`)
    const historicalDisposition = record.finalDisposition === 'MIGRATION_ONLY_HISTORICAL'
    const whyNotConsumed = historicalDisposition
      ? 'The R2 migration-only rule consumed the frozen census predicates (no declaration, migration DDL present, no indexed production access, and no Django model). The existing metadata identifies no additional current declaration or access path for this historical-only disposition.'
      : 'The frozen census/R2 record identifies exact declaration, migration, or access-reference files, but stores no per-object evidence-consumption result establishing that those source references were adjudicated for unique authority.'
    sufficiencyByResidualId.set(
      record.residualId,
      withSufficiency(
        {
          ...record,
          originClass: 'AUTHORITY_OBJECT_RESIDUAL',
        },
        available,
        historicalDisposition
          ? [
              'Frozen census migrationDdl, declarations, productionAccessObserved, and djangoModels predicates used by the migration-only historical rule.',
            ]
          : [
              'Frozen census and R2 metadata only; no per-reference authority-consumption record is present.',
            ],
        historicalDisposition ? 'NO' : 'YES',
        whyNotConsumed,
      ),
    )
  }

  const chainById = new Map(
    census.phase1aReconciliation.knownDatabaseEffectsWithoutExplicitTargets.map((chain) => [
      chain.chainId,
      chain,
    ]),
  )
  const effectRecords = targetlessRecords.map((record) => {
    const chainId = record.phase1aEvidence?.chainId
    const chain = chainById.get(chainId)
    assert(chain, `Targetless effect ${record.residualId} has no saved Phase 1A chain.`)
    const sourceReferences = chain.sourceReferences ?? []
    assert(
      sourceReferences.length > 0,
      `Targetless effect ${record.residualId} has no source references.`,
    )
    const available = sortUnique(
      sourceReferences.map((reference) =>
        evidencePath(
          reference.file,
          reference.lineStart === reference.lineEnd
            ? reference.lineStart
            : `${reference.lineStart}-${reference.lineEnd}`,
          reference.evidenceRole,
        ),
      ),
    )
    return withSufficiency(
      {
        ...record,
        originClass: 'TARGETLESS_DATABASE_EFFECT_RESIDUAL',
        phase1aEvidence: {
          chainId,
          primaryDataEffect: chain.primaryDataEffect,
          sourceReferences,
        },
      },
      available,
      [
        'Phase 1A captured the chain ID, effect type, and source references; R2 retained only the chain ID and source-file summary.',
      ],
      'YES',
      'The accepted Phase 1A chain has exact source references, but R2 did not consume them to establish the effect target.',
    )
  })

  const completeRecords = [
    ...[...sufficiencyByResidualId.values()],
    ...importedRecords,
    ...effectRecords,
  ].sort((a, b) => a.residualId.localeCompare(b.residualId))
  const uniqueIds = new Set(completeRecords.map((record) => record.residualId))
  assert(
    completeRecords.length === 1282 && uniqueIds.size === 1282,
    'Corrected R2 residuals must each appear exactly once.',
  )

  const dispositionNames = [
    'CANONICAL_AUTHORITY_ESTABLISHED',
    'CANONICAL_WITH_LEGACY_MIRROR',
    'CANONICAL_WITH_GENERATED_OR_DERIVED_REPRESENTATION',
    'KNOWN_DUPLICATE_AUTHORITY_CONFLICT',
    'KNOWN_REFERENCED_WITHOUT_DECLARATION_DEFECT',
    'KNOWN_MIGRATION_SCHEMA_DIVERGENCE',
    'EXTERNAL_PROVIDER_AUTHORITY',
    'TEST_OR_FIXTURE_ONLY',
    'MIGRATION_ONLY_HISTORICAL',
    'SOURCE_CEILING_UNKNOWN_AUTHORITY',
  ]
  const rawDispositionCounts = countBy(completeRecords, (record) => record.finalDisposition)
  const dispositionCounts = Object.fromEntries(
    dispositionNames.map((name) => [name, rawDispositionCounts[name] ?? 0]),
  )
  const dispositionSum = Object.values(dispositionCounts).reduce((sum, count) => sum + count, 0)
  assert(dispositionSum === 1282, 'Corrected R2 disposition counts must sum to 1,282.')

  const incompleteRecords = completeRecords.filter(
    (record) => record.STATIC_EVIDENCE_PATH_REMAINING === 'YES',
  )
  const eligibleRecords = completeRecords.filter(
    (record) => record.STATIC_EVIDENCE_PATH_REMAINING === 'NO',
  )
  assert(
    completeRecords.every((record) =>
      ['YES', 'NO'].includes(record.STATIC_EVIDENCE_PATH_REMAINING),
    ),
    'Every record must have an explicit YES/NO static evidence path state.',
  )
  assert(
    completeRecords.every(
      (record) =>
        Array.isArray(record.STATIC_EVIDENCE_ALREADY_AVAILABLE) &&
        Array.isArray(record.STATIC_EVIDENCE_CONSUMED) &&
        (record.finalDisposition !== 'SOURCE_CEILING_UNKNOWN_AUTHORITY' ||
          typeof record.SOURCE_CEILING_REASON === 'string'),
    ),
    'A corrected R2 record is missing required evidence sufficiency fields.',
  )
  assert(
    completeRecords.every(
      (record) =>
        record.finalDisposition !== 'SOURCE_CEILING_UNKNOWN_AUTHORITY' ||
        record.STATIC_EVIDENCE_PATH_REMAINING === 'YES',
    ),
    'A source-ceiling record has no remaining path but was not adjudicated as a terminal non-ceiling disposition.',
  )
  assert(
    completeRecords.every(
      (record) => record.inputResidualCategory !== 'OTHER_EXPLICIT_SOURCE_CEILING',
    ),
    'A frozen Phase 1A unknown-effect chain contaminated the corrected R2 audit.',
  )
  const staticBreakdown = {
    STATIC_CEILING_ELIGIBLE: {
      TOTAL: eligibleRecords.length,
      ...Object.fromEntries(
        [
          ['AUTHORITY_OBJECT', 'AUTHORITY_OBJECT_RESIDUAL'],
          ['UNRESOLVED_SCHEMA_IMPORT', 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL'],
          ['TARGETLESS_DATABASE_EFFECT', 'TARGETLESS_DATABASE_EFFECT_RESIDUAL'],
        ].map(([label, origin]) => [
          label,
          eligibleRecords.filter((record) => record.originClass === origin).length,
        ]),
      ),
    },
    STATIC_ADJUDICATION_INCOMPLETE: {
      TOTAL: incompleteRecords.length,
      ...Object.fromEntries(
        [
          ['AUTHORITY_OBJECT', 'AUTHORITY_OBJECT_RESIDUAL'],
          ['UNRESOLVED_SCHEMA_IMPORT', 'UNRESOLVED_SCHEMA_IMPORT_RESIDUAL'],
          ['TARGETLESS_DATABASE_EFFECT', 'TARGETLESS_DATABASE_EFFECT_RESIDUAL'],
        ].map(([label, origin]) => [
          label,
          incompleteRecords.filter((record) => record.originClass === origin).length,
        ]),
      ),
    },
  }
  assert(
    staticBreakdown.STATIC_CEILING_ELIGIBLE.TOTAL +
      staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.TOTAL ===
      1282,
    'Static sufficiency categories must sum to 1,282.',
  )

  const importResolutionClasses = [
    'MODULE_PATH_RESOLUTION_FAILURE',
    'BARREL_OR_REEXPORT_NOT_FOLLOWED',
    'ALIAS_RESOLUTION_NOT_FOLLOWED',
    'EXTERNAL_MODULE',
    'MISSING_MODULE',
    'DECLARATION_NOT_EXPORTED',
    'OTHER_EXPLICIT_IMPORT_RESOLUTION_GAP',
  ]
  const importResolutionCounts = Object.fromEntries(
    importResolutionClasses.map((name) => [
      name,
      importedRecords.filter((record) => record.importResolutionClass === name).length,
    ]),
  )
  const r1ConflictCount = r1.dispositions.filter(
    (record) => record.finalDisposition === 'KNOWN_DUPLICATE_AUTHORITY_CONFLICTS',
  ).length
  const r1CanonicalMirrorCount = r1.dispositions.filter(
    (record) => record.finalDisposition === 'ACTIVE_CANONICAL_WITH_LEGACY_MIRROR',
  ).length
  assert(
    r1.dispositions.length === 5 &&
      r1ConflictCount === 4 &&
      r1CanonicalMirrorCount === 1 &&
      r1.dispositions.every((record) => record.unknownAuthority === false),
    'R1 fixed-five preservation assertion failed.',
  )

  const remainingStaticWork = incompleteRecords.map((record) => ({
    RESIDUAL_ID: record.residualId,
    ORIGIN_CLASS: record.originClass,
    STATIC_EVIDENCE_PATH: record.STATIC_EVIDENCE_ALREADY_AVAILABLE,
    WHY_NOT_ALREADY_CONSUMED: record.staticEvidencePathWhyNotConsumed,
  }))
  const result = {
    title: 'Phase 1B.1-R2N — Denominator Correction and Source-Ceiling Sufficiency Audit',
    auditMode: 'SAVED_METADATA_ONLY',
    sourceOnly: true,
    provenance: {
      historicalR2Artifact: r2Path,
      historicalR2Sha256: sha256(r2Path),
      frozenCensusArtifact: censusPath,
      frozenCensusSha256: sha256(censusPath),
      r1Artifact: r1Path,
      r1Sha256: sha256(r1Path),
      historicalR2PreservedUnmodified: true,
      originalPhase1aArtifactsModified: false,
      applicationSourceNewlyInspected: false,
      runtimeDatabaseInspected: false,
      migrationExecuted: false,
      databaseWritten: false,
    },
    denominator: {
      CURRENT_R2_RECORDS: originalRecords.length,
      EXPECTED_R2_RECORDS: 1282,
      ERRONEOUSLY_INCLUDED_FROZEN_PHASE1A_RECORDS: erroneousFrozenRecords.length,
      FROZEN_PHASE1A_IDS_REMOVED_FROM_R2_RECORDS: erroneousFrozenRecords.length,
      R2_INPUT_RESIDUALS: completeRecords.length,
      AUTHORITY_OBJECT_RESIDUALS: authorityRecords.length,
      UNRESOLVED_SCHEMA_IMPORT_RESIDUALS: importRecords.length,
      TARGETLESS_DATABASE_EFFECT_RESIDUALS: targetlessRecords.length,
      FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD: carryForward.length,
    },
    excludedCarryForward: {
      phase1AUnknownEffectChains: {
        count: carryForward.length,
        ids: carryForwardIds,
        records: [...carryForward].sort((a, b) => a.chainId.localeCompare(b.chainId)),
        excludedFromR2Records: true,
        adjudicationType: 'NOT_DATA_AUTHORITY_ADJUDICATION',
      },
    },
    removedFrozenPhase1AResidualIds: erroneousFrozenIds.map(
      (chainId) => `frozen-phase1a-effect::${chainId}`,
    ),
    residualOriginCounts: {
      AUTHORITY_OBJECT_RESIDUAL: authorityRecords.length,
      UNRESOLVED_SCHEMA_IMPORT_RESIDUAL: importRecords.length,
      TARGETLESS_DATABASE_EFFECT_RESIDUAL: targetlessRecords.length,
      SUM: completeRecords.length,
    },
    dispositionCounts: {
      ...dispositionCounts,
      SUM: dispositionSum,
    },
    sourceCeilingSufficiency: {
      STATIC_CEILING_ELIGIBLE: staticBreakdown.STATIC_CEILING_ELIGIBLE.TOTAL,
      STATIC_ADJUDICATION_INCOMPLETE: staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.TOTAL,
      sourceCeilingRecordsEligible: eligibleRecords.filter(
        (record) => record.finalDisposition === 'SOURCE_CEILING_UNKNOWN_AUTHORITY',
      ).length,
      terminalMigrationOnlyHistoricalRecords: eligibleRecords.filter(
        (record) => record.finalDisposition === 'MIGRATION_ONLY_HISTORICAL',
      ).length,
      SUM: completeRecords.length,
      byOriginClass: staticBreakdown,
      authorityObjectsWithNoStaticPathRemaining:
        staticBreakdown.STATIC_CEILING_ELIGIBLE.AUTHORITY_OBJECT,
      authorityObjectsWithStaticPathRemaining:
        staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.AUTHORITY_OBJECT,
      targetlessEffectsWithNoStaticPathRemaining:
        staticBreakdown.STATIC_CEILING_ELIGIBLE.TARGETLESS_DATABASE_EFFECT,
      targetlessEffectsWithStaticPathRemaining:
        staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.TARGETLESS_DATABASE_EFFECT,
      unresolvedSchemaImportResolutionClasses: importResolutionCounts,
      frozenPhase1aUnknownEffectsInR2SufficiencyAudit: completeRecords.filter(
        (record) => record.inputResidualCategory === 'OTHER_EXPLICIT_SOURCE_CEILING',
      ).length,
      remainingStaticWork,
    },
    R1Preservation: {
      R1_FINANCIAL_SERVICE_KNOWN_CONFLICTS: r1ConflictCount,
      R1_UNION_EYES_CANONICAL_WITH_LEGACY_MIRROR: r1CanonicalMirrorCount,
      R1_FIXED_FIVE_REINTRODUCED_AS_UNKNOWN: 0,
      defectIdsPreserved: r1.defectRegister.map((entry) => entry.defectId),
    },
    records: completeRecords,
    gate: {
      PHASE_1B_1_R2N_GATE:
        incompleteRecords.length === 0 ? 'PASS_TO_SOURCE_CEILING' : 'STATIC_WORK_REMAINS',
      PHASE_1B_1: incompleteRecords.length === 0 ? 'SOURCE_CEILING_ACCEPTED' : 'NOT YET CLOSED',
      PHASE_1B_2: incompleteRecords.length === 0 ? 'AUTHORIZED' : 'NOT AUTHORIZED',
      Phase1B2Started: false,
      Phase1CStarted: false,
      Phase1DStarted: false,
      Phase2Started: false,
    },
    validation: {
      correctedR2DenominatorIs1282: completeRecords.length === 1282,
      frozen247ExcludedFromR2Records: erroneousFrozenIds.length === 247,
      allCorrectedResidualsRepresentedOnce: uniqueIds.size === 1282,
      '260AuthorityObjectsRetained': authorityRecords.length === 260,
      '966ImportResidualsRetained': importRecords.length === 966,
      '56TargetlessEffectResidualsRetained': targetlessRecords.length === 56,
      R1FivePreserved:
        r1ConflictCount === 4 && r1CanonicalMirrorCount === 1 && r1.dispositions.length === 5,
      noApplicationSourceNewlyInspected: true,
      noRuntimeDatabaseInspected: true,
      noMigrationExecuted: true,
      noDatabaseWriteExecuted: true,
      noAuthorizationOrRlsClaimIntroduced: true,
    },
  }

  const md = [
    '# Phase 1B.1-R2N — Denominator Correction and Source-Ceiling Sufficiency Audit',
    '',
    '**Audit mode: saved metadata only.** No application source was newly inspected; the historical R2 closeout and original Phase 1A artifacts were not modified.',
    '',
    `**R2N gate: ${result.gate.PHASE_1B_1_R2N_GATE}**  `,
    `**Phase 1B.1: ${result.gate.PHASE_1B_1}**  `,
    `**Phase 1B.2: ${result.gate.PHASE_1B_2}**`,
    '',
    '## Corrected denominator',
    '',
    `Current historical R2 records: **${originalRecords.length}**; expected corrected R2 records: **${completeRecords.length}**; erroneously included frozen Phase 1A records removed: **${erroneousFrozenRecords.length}**.`,
    '',
    `${authorityRecords.length} authority-object residuals + ${importRecords.length} unresolved schema-import residuals + ${targetlessRecords.length} targetless database-effect residuals = **${completeRecords.length}** R2 authority residuals.`,
    '',
    `The ${carryForward.length} frozen Phase 1A unknown-effect chains are carried separately under \`excludedCarryForward.phase1AUnknownEffectChains\`; they are not authority adjudications and do not appear in the corrected R2 \`records[]\` array.`,
    '',
    '## Disposition arithmetic on corrected R2 records',
    '',
    ...renderTable(
      ['Disposition', 'Count'],
      [...Object.entries(dispositionCounts), ['SUM', dispositionSum]],
    ),
    '',
    '## Source-ceiling sufficiency',
    '',
    'A `NO` static-path result means the saved R2/census metadata contains no additional bounded path for the already-final migration-only historical disposition. These 53 records are not source-ceiling dispositions. `YES` means an exact declaration/import/source reference is present in saved metadata but no corresponding per-record adjudication is recorded. This audit does not follow any such path.',
    '',
    ...renderTable(
      [
        'Sufficiency state',
        'Authority object',
        'Unresolved schema import',
        'Targetless database effect',
        'Total',
      ],
      [
        [
          'STATIC_CEILING_ELIGIBLE',
          staticBreakdown.STATIC_CEILING_ELIGIBLE.AUTHORITY_OBJECT,
          staticBreakdown.STATIC_CEILING_ELIGIBLE.UNRESOLVED_SCHEMA_IMPORT,
          staticBreakdown.STATIC_CEILING_ELIGIBLE.TARGETLESS_DATABASE_EFFECT,
          staticBreakdown.STATIC_CEILING_ELIGIBLE.TOTAL,
        ],
        [
          'STATIC_ADJUDICATION_INCOMPLETE',
          staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.AUTHORITY_OBJECT,
          staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.UNRESOLVED_SCHEMA_IMPORT,
          staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.TARGETLESS_DATABASE_EFFECT,
          staticBreakdown.STATIC_ADJUDICATION_INCOMPLETE.TOTAL,
        ],
        ['SUM', 260, 966, 56, 1282],
      ],
    ),
    '',
    `Authority objects with no static path remaining: **${result.sourceCeilingSufficiency.authorityObjectsWithNoStaticPathRemaining}**; with a path remaining: **${result.sourceCeilingSufficiency.authorityObjectsWithStaticPathRemaining}**.`,
    '',
    `Targetless effects with no static path remaining: **${result.sourceCeilingSufficiency.targetlessEffectsWithNoStaticPathRemaining}**; with a path remaining: **${result.sourceCeilingSufficiency.targetlessEffectsWithStaticPathRemaining}**.`,
    '',
    `Among the ${dispositionCounts.SOURCE_CEILING_UNKNOWN_AUTHORITY} records still labeled \`SOURCE_CEILING_UNKNOWN_AUTHORITY\`, source-ceiling eligible: **${result.sourceCeilingSufficiency.sourceCeilingRecordsEligible}**; static adjudication incomplete: **${result.sourceCeilingSufficiency.STATIC_ADJUDICATION_INCOMPLETE}**. The 53 eligible records have the separate terminal \`MIGRATION_ONLY_HISTORICAL\` disposition.`,
    '',
    '### Import resolution gap classes',
    '',
    ...renderTable(
      ['Import resolution class', 'Count', 'Static path remaining'],
      Object.entries(importResolutionCounts).map(([name, count]) => [name, count, 'YES']),
    ),
    '',
    '### Finite remaining static work',
    '',
    ...renderTable(
      ['Residual ID', 'Origin class', 'Static evidence path', 'Why not already consumed'],
      remainingStaticWork.map((record) => [
        record.RESIDUAL_ID,
        record.ORIGIN_CLASS,
        record.STATIC_EVIDENCE_PATH.join('<br>'),
        record.WHY_NOT_ALREADY_CONSUMED,
      ]),
    ),
    '',
    'Only paths already named in the saved R2/census metadata are listed. They are not inspected or executed here.',
    '',
    '## Frozen Phase 1A carry-forward IDs removed from R2',
    '',
    ...erroneousFrozenIds.map((chainId) => `- \`frozen-phase1a-effect::${chainId}\``),
    '',
    '## R1 preservation and validation boundaries',
    '',
    `R1 remains **${r1ConflictCount}** financial-service known conflicts and **${r1CanonicalMirrorCount}** Union Eyes canonical-with-legacy-mirror record. R1 fixed-five reintroduced as unknown: **0**. Defect IDs preserved: ${result.R1Preservation.defectIdsPreserved.join(', ')}.`,
    '',
    '- Historical R2 closeout is retained unchanged as provenance.',
    '- Original Phase 1A artifacts were not modified.',
    '- No runtime database was inspected; no migration was executed; no database write was performed.',
    '- No authorization, organization-scope enforcement, or RLS correctness claim is made.',
    '- Phase 1B.2, Phase 1C, Phase 1D, and Phase 2 were not started.',
    '',
  ].join('\n')
  await writeFormatted(`${outputBase}.json`, `${JSON.stringify(result, null, 2)}\n`, 'json')
  await writeFormatted(`${outputBase}.md`, md, 'markdown')
  console.log(
    JSON.stringify(
      {
        gate: result.gate.PHASE_1B_1_R2N_GATE,
        correctedInput: completeRecords.length,
        excludedCarryForward: carryForward.length,
        eligible: result.sourceCeilingSufficiency.STATIC_CEILING_ELIGIBLE,
        incomplete: result.sourceCeilingSufficiency.STATIC_ADJUDICATION_INCOMPLETE,
        remainingStaticWork: remainingStaticWork.length,
        importResolutionClasses: importResolutionCounts,
        outputs: [`${outputBase}.json`, `${outputBase}.md`],
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
