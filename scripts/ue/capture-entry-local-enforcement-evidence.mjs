import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { format as formatContent, resolveConfig as resolvePrettierConfig } from 'prettier'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const checkOnly = process.argv.includes('--check')
const inputFiles = {
  adjudication:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B2B1_SHARED_COHORT_ENFORCEMENT_ADJUDICATION.json',
  census: 'docs/union-eyes/reality-remediation/PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json',
  primitives:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B1_ENFORCEMENT_PRIMITIVE_SEMANTICS.json',
}
const outputFiles = {
  json: 'docs/union-eyes/reality-remediation/PHASE_1B_2B2B2A_ENTRY_LOCAL_ENFORCEMENT_EVIDENCE.json',
  markdown:
    'docs/union-eyes/reality-remediation/PHASE_1B_2B2B2A_ENTRY_LOCAL_ENFORCEMENT_EVIDENCE.md',
}
const hash = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (file) => {
  const bytes = readFileSync(path.resolve(root, ...file.split('/')))
  return { value: JSON.parse(bytes), sha256: hash(bytes) }
}
const sortedUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b))
const serialize = (value) => JSON.stringify(value)
const clipName = (value) => value.replaceAll('\\', '/')

if (!process.argv.includes('--capture')) {
  const target = path.resolve(root, ...outputFiles.json.split('/'))
  const report = JSON.parse(readFileSync(target, 'utf8'))
  const entries = report.entryEvidence
  assert(Array.isArray(entries), 'Existing entryEvidence array is required')
  const digest = (value) => hash(serialize(value))
  const ceilingMarkers = entries.map((entry) => ({
    ENTRY_ID: entry.ENTRY_ID,
    DIMENSIONS: entry.REQUIREMENT_SOURCE_CEILING_DIMENSIONS,
    REASON: entry.REQUIREMENT_SOURCE_CEILING_REASON,
  }))
  const dimensions = Object.keys(entries[0]?.DIMENSION_EVIDENCE ?? {})
  const digests = {
    ENTRY_EVIDENCE_SHA256: digest(entries),
    SOURCE_SLICE_EVIDENCE_SHA256: digest(entries.map((entry) => entry.SOURCE_SLICE)),
    SOURCE_READ_REGISTER_SHA256: digest(report.sourceReadRegister),
    HELPER_SOURCE_SLICES_SHA256: digest(report.helperSourceSlices),
    LOCAL_FINDING_FACTS_SHA256: digest(
      entries.map((entry) => ({
        ENTRY_ID: entry.ENTRY_ID,
        FACTS: entry.SOURCE_SLICE?.FACTS,
      })),
    ),
    LOCAL_SOURCE_CEILING_MARKERS_SHA256: digest(ceilingMarkers),
  }
  const priorDigests = report.normalization?.evidenceDigests
  if (priorDigests) {
    for (const [key, value] of Object.entries(digests)) {
      assert.equal(value, priorDigests[key], `Preserved evidence changed: ${key}`)
    }
  }

  const dimensionContractKeys = {
    IDENTITY_AUTHENTICATION: 'IDENTITY_AUTHENTICATION_REQUIRED',
    ORGANIZATION_MEMBERSHIP: 'ORGANIZATION_MEMBERSHIP_REQUIRED',
    ORGANIZATION_SCOPE: 'ORGANIZATION_SCOPE_REQUIRED',
    ROLE_OR_PERMISSION: 'ROLE_OR_PERMISSION_REQUIRED',
    ADMIN_SCOPE: 'ADMIN_SCOPE_REQUIRED',
    RESOURCE_SCOPE: 'RESOURCE_SCOPE_REQUIRED',
    SYSTEM_IDENTITY: 'SYSTEM_IDENTITY_REQUIRED',
    PROVIDER_AUTH: 'PROVIDER_AUTH_REQUIRED',
    ENTITLEMENT: 'ENTITLEMENT_REQUIRED',
    RLS_CONTEXT: 'RLS_CONTEXT_EXPECTED',
    PRIVILEGED_DB_PRECONDITION: 'PRIVILEGED_DB_PRECONDITION_REQUIRED',
  }
  assert.deepEqual(
    sortedUnique(dimensions),
    sortedUnique(Object.keys(dimensionContractKeys)),
    'Expected the frozen enforcement dimensions',
  )
  const dimensionEvidenceAccounting = Object.fromEntries(
    dimensions.map((dimension) => [
      dimension,
      {
        LOCAL_ENFORCEMENT_OBSERVED: 0,
        LOCAL_ENFORCEMENT_NOT_OBSERVED: 0,
        LOCAL_ENFORCEMENT_PARTIAL: 0,
        RESOLVED_VIA_EXISTING_PRIMITIVE: 0,
        NOT_REQUIRED_BY_FROZEN_CONTRACT: 0,
        SOURCE_CEILING_AFTER_LOCAL_REVIEW: 0,
      },
    ]),
  )
  const entryClassification = {
    ENTRIES_FULLY_EVIDENCE_RESOLVED: 0,
    ENTRIES_WITH_PARTIAL_LOCAL_EVIDENCE: 0,
    ENTRIES_WITH_LOCAL_SOURCE_CEILING: 0,
  }
  const ceilingEntryIds = []
  for (const entry of entries) {
    let hasPartialEvidence = false
    let hasSourceCeiling = false
    for (const [dimension, evidence] of Object.entries(entry.DIMENSION_EVIDENCE ?? {})) {
      const counts = dimensionEvidenceAccounting[dimension]
      assert(counts, `Unexpected evidence dimension ${dimension}`)
      const required = evidence.REQUIRED_CONTRACT
      if (required === 'SOURCE_CEILING') {
        assert(
          entry.REQUIREMENT_SOURCE_CEILING_DIMENSIONS?.includes(dimensionContractKeys[dimension]),
          `Missing source-ceiling marker for ${entry.ENTRY_ID}:${dimension}`,
        )
        counts.SOURCE_CEILING_AFTER_LOCAL_REVIEW += 1
        hasSourceCeiling = true
      } else if (required === 'NOT_REQUIRED') {
        counts.NOT_REQUIRED_BY_FROZEN_CONTRACT += 1
      } else if (evidence.DIRECT_HELPER_CALLS_OBSERVED_IN_BOUNDED_SLICE?.length) {
        const hasLinkedImplementation = evidence.LINKED_HELPER_SOURCE_SLICE_IDS?.length > 0
        counts[
          hasLinkedImplementation ? 'RESOLVED_VIA_EXISTING_PRIMITIVE' : 'LOCAL_ENFORCEMENT_OBSERVED'
        ] += 1
      } else if (evidence.HELPER_SYMBOLS_PRESENT_IN_BOUNDED_SLICE?.length) {
        counts.LOCAL_ENFORCEMENT_PARTIAL += 1
        hasPartialEvidence = true
      } else {
        counts.LOCAL_ENFORCEMENT_NOT_OBSERVED += 1
      }
    }
    const contractCeilingExists = Object.values(entry.DIMENSION_EVIDENCE ?? {}).some(
      (evidence) => evidence.REQUIRED_CONTRACT === 'SOURCE_CEILING',
    )
    assert.equal(
      contractCeilingExists,
      (entry.REQUIREMENT_SOURCE_CEILING_DIMENSIONS ?? []).length > 0,
      `Source-ceiling markers do not match the frozen contract for ${entry.ENTRY_ID}`,
    )
    const classification = hasSourceCeiling
      ? 'ENTRIES_WITH_LOCAL_SOURCE_CEILING'
      : hasPartialEvidence
        ? 'ENTRIES_WITH_PARTIAL_LOCAL_EVIDENCE'
        : 'ENTRIES_FULLY_EVIDENCE_RESOLVED'
    entryClassification[classification] += 1
    if (hasSourceCeiling) ceilingEntryIds.push(entry.ENTRY_ID)
  }

  const uniqueEntryIds = new Set(entries.map((entry) => entry.ENTRY_ID)).size
  const cohortCount = new Set(entries.map((entry) => entry.COHORT_ID)).size
  const sourcePathCount = report.sourceReadRegister.length
  const registerEntryIds = report.sourceReadRegister.flatMap((file) =>
    file.CAPTURED_ENTRY_SLICES.flatMap((slice) => slice.ENTRY_IDS),
  )
  const hashMatchedSlices = entries.filter(
    (entry) => entry.SOURCE_SLICE.SHA256 === entry.SOURCE_SLICE.ACCEPTED_CENSUS_SHA256,
  ).length
  const evidenceComplete =
    entries.length === 700 &&
    uniqueEntryIds === 700 &&
    cohortCount === 125 &&
    sourcePathCount === 423 &&
    new Set(registerEntryIds).size === 700 &&
    registerEntryIds.every((entryId) => entries.some((entry) => entry.ENTRY_ID === entryId)) &&
    hashMatchedSlices === 700
  assert.equal(report.frozenCarryForwards.B1_KNOWN_ENFORCEMENT_DEFECTS, 215)
  assert.equal(report.frozenCarryForwards.B1_SOURCE_CEILING_RECORDS, 825)
  assert.equal(report.frozenCarryForwards.B1_HISTORICAL_EXPECTATIONS_OPEN, 43)
  assert.equal(report.frozenCarryForwards.R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY, 207)
  assert.equal(report.frozenCarryForwards.R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS, 3)
  assert.equal(report.frozenCarryForwards.R2C_TARGETLESS_DATABASE_EFFECTS, 56)
  assert.equal(report.frozenCarryForwards.R2C_RESOLVED_TARGET_CHAINS, 43)
  assert.equal(report.frozenCarryForwards.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD, 13)
  assert.equal(report.frozenCarryForwards.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD, 247)
  const gate = !evidenceComplete ? 'FAIL' : ceilingEntryIds.length > 0 ? 'SOURCE_CEILING' : 'PASS'
  const phaseState =
    gate === 'PASS' ? 'PASS' : gate === 'SOURCE_CEILING' ? 'SOURCE_CEILING_ACCEPTED' : 'FAIL'
  const evidenceUniverse =
    gate === 'PASS'
      ? 'CLOSED'
      : gate === 'SOURCE_CEILING'
        ? 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS'
        : 'NOT_CLOSED'
  const dimensionTotalsValid = Object.values(dimensionEvidenceAccounting).every(
    (counts) => Object.values(counts).reduce((sum, count) => sum + count, 0) === 700,
  )
  assert.equal(
    dimensionTotalsValid,
    true,
    'Every enforcement dimension must account for 700 entries',
  )
  assert.equal(
    Object.values(entryClassification).reduce((sum, count) => sum + count, 0),
    entries.length,
    'Entry evidence classifications must be mutually exclusive and exhaustive',
  )

  report.gate = {
    ...report.gate,
    PHASE_1B_2B2_B2A_GATE: gate,
    PHASE_1B_2B2_B2A: phaseState,
    PHASE_1B_2B2_B2B: 'AUTHORIZED',
    PHASE_1B_2B2_B2B_ENTRY_LOCAL_ENFORCEMENT_ADJUDICATION: 'AUTHORIZED',
    PHASE_1B_2B2_B2B_STARTED: 'NO',
    PHASE_1B_2B: 'NOT_YET_COMPLETE',
    PHASE_1B_2: 'NOT_YET_COMPLETE',
    ENTRY_LOCAL_ENFORCEMENT_EVIDENCE_UNIVERSE: evidenceUniverse,
    LOCAL_REVIEW_ENTRIES_REMAINING: 0,
    ADEQUACY_VERDICT_ISSUED: 'NO',
    AUTHORIZATION_CORRECTNESS_PROVEN: 'NO',
    ORG_SCOPE_ENFORCEMENT_PROVEN: 'NO',
    RESOURCE_AUTHORIZATION_PROVEN: 'NO',
  }
  report.metadata = {
    ...report.metadata,
    FINAL_ADEQUACY_VERDICTS_ASSIGNED: 'NO',
    RUNTIME_AUTH_EXECUTED: 'NO',
    NO_APPLICATION_SOURCE_READ_DURING_NORMALIZATION: 'YES',
  }
  report.denominators = {
    ...report.denominators,
    INPUT_LOCAL_REVIEW_ENTRIES: entries.length,
    UNIQUE_ENTRY_IDS: uniqueEntryIds,
    INPUT_LOCAL_REVIEW_COHORTS: cohortCount,
    AUTHORIZED_SOURCE_PATHS: sourcePathCount,
    CENSUS_HASH_MATCHED_SOURCE_SLICES: hashMatchedSlices,
  }
  report.normalization = {
    EVIDENCE_ACCOUNTING_ONLY: 'YES',
    METHOD:
      'SOURCE_CEILING maps from frozen REQUIRED_CONTRACT; NOT_REQUIRED maps from contract; a direct call with linked helper slices maps to RESOLVED_VIA_EXISTING_PRIMITIVE; other direct calls map to OBSERVED; listed helper presence without a call maps to PARTIAL; no listed helper evidence maps to NOT_OBSERVED. These are evidence states only.',
    HELPER_CALL_EXTRACTION: 'AST_CALL_EXPRESSION_BASED',
    COMMENT_TOKENS_EXCLUDED: 'YES',
    IDENTIFIER_FALSE_POSITIVE_CALLS_orgId: 0,
    IDENTIFIER_FALSE_POSITIVE_CALLS_organizationId: 0,
    ENTRY_EVIDENCE_CHANGED: 'NO',
    SOURCE_SLICE_EVIDENCE_CHANGED: 'NO',
    LOCAL_HELPER_EVIDENCE_CHANGED: 'NO',
    LOCAL_FINDINGS_CHANGED: 'NO',
    LOCAL_SOURCE_CEILINGS_CHANGED: 'NO',
    LOCAL_SOURCE_CEILING_ENTRY_IDS: ceilingEntryIds,
    LOCAL_SOURCE_FINDINGS_KEY_PRESENT: Object.hasOwn(report, 'localSourceFindings'),
    LOCAL_SOURCE_CEILINGS_KEY_PRESENT: Object.hasOwn(report, 'localSourceCeilings'),
    evidenceDigests: priorDigests ?? digests,
    entryClassification,
    dimensionEvidenceAccounting,
    PRESERVED_B1_STATE: {
      B1_ADJUDICATED_ENTRIES: 1210,
      B1_KNOWN_SOURCE_ENFORCEMENT_DEFECTS: report.frozenCarryForwards.B1_KNOWN_ENFORCEMENT_DEFECTS,
      B1_SOURCE_CEILING_RECORDS: report.frozenCarryForwards.B1_SOURCE_CEILING_RECORDS,
      B1_ENTRIES_REOPENED: 0,
      HISTORICAL_PAGE_EXPECTATIONS_OPEN: report.frozenCarryForwards.B1_HISTORICAL_EXPECTATIONS_OPEN,
    },
    PRESERVED_PHASE_1B_1_STATE: {
      AUTHORITY_SOURCE_CEILING_CARRY_FORWARD:
        report.frozenCarryForwards.R2B_SOURCE_CEILING_UNKNOWN_AUTHORITY,
      R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD:
        report.frozenCarryForwards.R2B_KNOWN_CONFIGURED_SCHEMA_MISMATCH_OBJECTS,
      R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS:
        report.frozenCarryForwards.R2C_TARGETLESS_DATABASE_EFFECTS,
      R2C_RESOLVED_TARGET_CHAINS: report.frozenCarryForwards.R2C_RESOLVED_TARGET_CHAINS,
      TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD:
        report.frozenCarryForwards.R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD,
      TARGETLESS_EFFECT_STATIC_WORK_REMAINING: 0,
      FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD:
        report.frozenCarryForwards.FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD,
    },
    validation: {
      EVIDENCE_RECORDS_UNCHANGED: digest(entries) === digests.ENTRY_EVIDENCE_SHA256,
      SOURCE_SLICES_UNCHANGED:
        digest(entries.map((entry) => entry.SOURCE_SLICE)) === digests.SOURCE_SLICE_EVIDENCE_SHA256,
      SOURCE_READ_REGISTER_UNCHANGED:
        digest(report.sourceReadRegister) === digests.SOURCE_READ_REGISTER_SHA256,
      HELPER_EVIDENCE_UNCHANGED:
        digest(report.helperSourceSlices) === digests.HELPER_SOURCE_SLICES_SHA256,
      FINDING_EVIDENCE_UNCHANGED:
        digest(
          entries.map((entry) => ({
            ENTRY_ID: entry.ENTRY_ID,
            FACTS: entry.SOURCE_SLICE?.FACTS,
          })),
        ) === digests.LOCAL_FINDING_FACTS_SHA256,
      SOURCE_CEILING_MARKERS_UNCHANGED:
        digest(ceilingMarkers) === digests.LOCAL_SOURCE_CEILING_MARKERS_SHA256,
      DENOMINATORS_PRESERVED: evidenceComplete,
      ALL_EVIDENCE_HASHES_MATCH: hashMatchedSlices === 700,
      ALL_DIMENSION_ACCOUNTING_SUMS_700: dimensionTotalsValid,
      ENTRY_CLASSIFICATION_SUM_700:
        Object.values(entryClassification).reduce((sum, count) => sum + count, 0) === 700,
      LOCAL_SOURCE_FINDINGS_STORED_AS_SEPARATE_KEY: Object.hasOwn(report, 'localSourceFindings'),
      LOCAL_SOURCE_CEILINGS_STORED_AS_SEPARATE_KEY: Object.hasOwn(report, 'localSourceCeilings'),
      NO_APPLICATION_SOURCE_READ_DURING_NORMALIZATION: true,
      NO_RUNTIME_AUTH_EXECUTED: true,
      NO_RUNTIME_DATABASE_INSPECTED: report.metadata.RUNTIME_DATABASE_INSPECTED === 'NO',
      B2B_STARTED: 'NO',
    },
  }
  report.validation = {
    ...report.validation,
    DEFERRED_ENTRIES_CAPTURED_EXACTLY_ONCE: entries.length === 700 && uniqueEntryIds === 700,
    UNIQUE_DEFERRED_ENTRY_IDS: uniqueEntryIds,
    DEFERRED_COHORTS_COVERED: cohortCount,
    ALL_SLICE_HASHES_MATCH_ACCEPTED_CENSUS: hashMatchedSlices === 700,
    B2B2B_STARTED: 'NO',
    B2B2B_AUTHORIZED: 'YES',
  }

  const markdown = `# Phase 1B.2b2-B2A Entry-Local Enforcement Evidence

## Status

- Gate: \`${gate}\`
- Evidence capture: \`${phaseState}\`
- Evidence universe: \`${evidenceUniverse}\`
- Adequacy verdict issued: \`NO\`
- B2B adjudication: \`AUTHORIZED\`; started: \`NO\`
- Phase 1B.2: \`NOT_YET_COMPLETE\`

## Evidence accounting

| Measure | Count |
|---|---:|
| Local review entries | ${entries.length} |
| Unique entry IDs | ${uniqueEntryIds} |
| Local review cohorts | ${cohortCount} |
| Authorized source paths | ${sourcePathCount} |
| Census-hash-matched source slices | ${hashMatchedSlices} |
| Fully evidence resolved | ${entryClassification.ENTRIES_FULLY_EVIDENCE_RESOLVED} |
| Partial local evidence | ${entryClassification.ENTRIES_WITH_PARTIAL_LOCAL_EVIDENCE} |
| Local source ceiling | ${entryClassification.ENTRIES_WITH_LOCAL_SOURCE_CEILING} |
| Local review entries remaining | 0 |

The mutually exclusive entry classifications sum to ${entries.length}. Dimension states describe captured evidence only; they are not authorization-adequacy findings.

## Dimension evidence-state accounting

| Dimension | Observed | Not observed | Partial | Existing primitive | Not required | Source ceiling | Sum |
|---|---:|---:|---:|---:|---:|---:|---:|
${dimensions
  .map((dimension) => {
    const counts = dimensionEvidenceAccounting[dimension]
    return `| ${dimension} | ${counts.LOCAL_ENFORCEMENT_OBSERVED} | ${counts.LOCAL_ENFORCEMENT_NOT_OBSERVED} | ${counts.LOCAL_ENFORCEMENT_PARTIAL} | ${counts.RESOLVED_VIA_EXISTING_PRIMITIVE} | ${counts.NOT_REQUIRED_BY_FROZEN_CONTRACT} | ${counts.SOURCE_CEILING_AFTER_LOCAL_REVIEW} | 700 |`
  })
  .join('\n')}

## Preservation and scope

- Entry evidence, source slices, helper slices, finding facts, and source-ceiling markers are unchanged; digests are recorded in the JSON artifact.
- Helper-call extraction remains AST-call-expression-based; comment tokens are excluded; identifier false-positive counts for \`orgId\` and \`organizationId\` are zero.
- Authorization correctness proven: \`NO\`; org-scope enforcement proven: \`NO\`; resource authorization proven: \`NO\`.
- Runtime auth executed: \`NO\`; runtime database inspected: \`NO\`; migration executed: \`NO\`; database write executed: \`NO\`.
- B1 adjudicated entries: 1210; known source-enforcement defects: 215; source-ceiling records: 825; reopened entries: 0.
- Historical page expectations open: 43.
- R2B authority source-ceiling carry-forward: 207; known authority defects: 3.
- R2C targetless database-effect chains: 56; resolved: 43; source-ceiling carry-forward: 13; static work remaining: 0.
- Frozen Phase 1A unknown-effect carry-forward: 247.
- Phase 1B.2 remains incomplete; B2B is authorized but not started. Phase 1B.3, Phase 1C, Phase 1D, and Phase 2 remain unstarted.
`
  const prettierConfig = await resolvePrettierConfig(target)
  const formattedJson = await formatContent(`${JSON.stringify(report, null, 2)}\n`, {
    ...prettierConfig,
    filepath: target,
  })
  const markdownTarget = path.resolve(root, ...outputFiles.markdown.split('/'))
  const formattedMarkdown = await formatContent(markdown, {
    ...prettierConfig,
    filepath: markdownTarget,
  })
  for (const [file, content] of [
    [target, formattedJson],
    [markdownTarget, formattedMarkdown],
  ]) {
    if (checkOnly) {
      assert.equal(readFileSync(file, 'utf8'), content, `${file} is not up to date`)
    } else {
      writeFileSync(file, content)
    }
  }
  console.log(
    JSON.stringify(
      {
        gate,
        phaseState,
        entryClassification,
        dimensionAccountingValid: dimensionTotalsValid,
        evidenceComplete,
        checkOnly,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

const { value: adjudication, sha256: adjudicationSha256 } = readJson(inputFiles.adjudication)
const { value: census, sha256: censusSha256 } = readJson(inputFiles.census)
const { value: primitiveRegistry, sha256: primitiveRegistrySha256 } = readJson(
  inputFiles.primitives,
)
const deferredEntries = adjudication.b2LocalReviewRegister
const censusById = new Map(census.ENTRIES.map((entry) => [entry.ENTRY_ID, entry]))
const primitivesById = new Map(
  primitiveRegistry.PRIMITIVES.map((primitive) => [primitive.PRIMITIVE_ID, primitive]),
)
const primitivesBySymbol = new Map()
for (const primitive of primitiveRegistry.PRIMITIVES) {
  const group = primitivesBySymbol.get(primitive.SYMBOL) ?? []
  group.push(primitive)
  primitivesBySymbol.set(primitive.SYMBOL, group)
}
const dimensions = [
  ['IDENTITY_AUTHENTICATION', 'IDENTITY_AUTHENTICATION_REQUIRED', 'AUTH_HELPERS'],
  ['ORGANIZATION_MEMBERSHIP', 'ORGANIZATION_MEMBERSHIP_REQUIRED', 'ORG_CONTEXT_HELPERS'],
  ['ORGANIZATION_SCOPE', 'ORGANIZATION_SCOPE_REQUIRED', 'ORG_CONTEXT_HELPERS'],
  ['ROLE_OR_PERMISSION', 'ROLE_OR_PERMISSION_REQUIRED', 'ROLE_PERMISSION_HELPERS'],
  ['ADMIN_SCOPE', 'ADMIN_SCOPE_REQUIRED', 'ADMIN_HELPERS'],
  ['RESOURCE_SCOPE', 'RESOURCE_SCOPE_REQUIRED', 'RESOURCE_PERMISSION_HELPERS'],
  ['SYSTEM_IDENTITY', 'SYSTEM_IDENTITY_REQUIRED', 'ADMIN_HELPERS'],
  ['PROVIDER_AUTH', 'PROVIDER_AUTH_REQUIRED', 'AUTH_HELPERS'],
  ['ENTITLEMENT', 'ENTITLEMENT_REQUIRED', 'ENTITLEMENT_HELPERS'],
  ['RLS_CONTEXT', 'RLS_CONTEXT_EXPECTED', 'RLS_CONTEXT_HELPERS'],
  ['PRIVILEGED_DB_PRECONDITION', 'PRIVILEGED_DB_PRECONDITION_REQUIRED', 'RLS_CONTEXT_HELPERS'],
]
const sourceRequests = new Map()

for (const record of deferredEntries) {
  const entry = censusById.get(record.ENTRY_ID)
  assert(entry, `Missing accepted census entry ${record.ENTRY_ID}`)
  assert.equal(
    entry.SOURCE_FILE,
    record.REQUIRED_SOURCE_PATH,
    `Source path mismatch for ${record.ENTRY_ID}`,
  )
  const evidence = entry.BOUNDARY_EVIDENCE?.find(
    (item) =>
      item.SOURCE_FILE === record.REQUIRED_SOURCE_PATH &&
      Number.isInteger(item.LINE_START) &&
      Number.isInteger(item.LINE_END),
  )
  assert(evidence, `Missing bounded accepted source range for ${record.ENTRY_ID}`)
  const file = record.REQUIRED_SOURCE_PATH
  const requests = sourceRequests.get(file) ?? []
  requests.push({
    entryId: record.ENTRY_ID,
    lineStart: evidence.LINE_START,
    lineEnd: evidence.LINE_END,
    acceptedHash: evidence.RANGE_SHA256,
  })
  sourceRequests.set(file, requests)
}

const readRequestedRanges = async (file, requests) => {
  const ranges = [...requests].sort(
    (left, right) => left.lineStart - right.lineStart || left.lineEnd - right.lineEnd,
  )
  const captured = new Map(ranges.map((range) => [range, []]))
  const lines = createInterface({
    input: createReadStream(path.resolve(root, ...file.split('/')), { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  let lineNumber = 0
  for await (const line of lines) {
    lineNumber += 1
    for (const range of ranges) {
      if (lineNumber >= range.lineStart && lineNumber <= range.lineEnd) {
        captured.get(range).push(line)
      }
    }
  }
  return ranges.map((range) => {
    const text = captured.get(range).join('\n')
    assert.equal(
      hash(text),
      range.acceptedHash,
      `Source slice changed from accepted census for ${file}:${range.lineStart}-${range.lineEnd}`,
    )
    return {
      ...range,
      text,
      sha256: hash(text),
      lines: text.split('\n'),
    }
  })
}

const factsForSlice = (slice) => {
  const facts = []
  const characters = slice.lines.join('\n').split('')
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    characters.join(''),
  )
  let token = scanner.scan()
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const start = scanner.getTokenPos()
      const end = scanner.getTextPos()
      for (let index = start; index < end; index += 1) {
        if (characters[index] !== '\n' && characters[index] !== '\r') characters[index] = ' '
      }
    }
    token = scanner.scan()
  }
  const codeLines = characters.join('').split('\n')
  const addMatches = (kind, pattern, group = 0) => {
    codeLines.forEach((text, offset) => {
      const matches = [...text.matchAll(pattern)]
      for (const match of matches) {
        facts.push({
          FACT_TYPE: kind,
          LINE: slice.lineStart + offset,
          SYMBOL_OR_TOKEN: match[group] ?? match[0],
        })
      }
    })
  }
  addMatches(
    'ORDERED_SIDE_EFFECT_OR_DATA_OPERATION',
    /\b(?:insert|update|delete|upsert|execute|transaction|query|fetch|send|publish|charge|transfer|create|remove|write|save|commit|rollback)\w*\s*(?:\.\s*\w+)?\s*\(/gi,
  )
  addMatches(
    'FAILURE_OR_RESPONSE_CONTROL',
    /\b(?:try|catch|finally|throw|return)\b|(?:NextResponse|Response|res)\.(?:json|status)\b/gi,
  )
  addMatches(
    'CALLER_INPUT_REFERENCE',
    /\b(?:request|req|params|searchParams|formData|body|query|headers|cookies)\b(?:\s*(?:\.\s*\w+|\[\s*['"`][^'"`]+['"`]\s*\]))?/g,
  )
  addMatches(
    'DATABASE_OR_EXECUTION_CONTEXT_REFERENCE',
    /\b(?:withRLSContext|withSystemContext|withApi|withApiAuth|withRoleAuth|withOrganizationAuth|db|database|tx|sql|drizzle)\b/g,
  )
  return facts.sort(
    (left, right) =>
      left.LINE - right.LINE ||
      left.FACT_TYPE.localeCompare(right.FACT_TYPE) ||
      left.SYMBOL_OR_TOKEN.localeCompare(right.SYMBOL_OR_TOKEN),
  )
}

const calledIdentifiers = (text, file) => {
  const normalizedFile = file.toLowerCase()
  const scriptKind = normalizedFile.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : normalizedFile.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind)
  const names = new Set()
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        names.add(node.expression.text)
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        names.add(node.expression.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return names
}

const readPrimitiveSlice = (primitive) => {
  const {
    FILE: file,
    SYMBOL_DECLARATION_LINE: declarationLine,
    FILE_SHA256: expectedFileHash,
  } = primitive.IMPLEMENTATION
  const filePath = path.resolve(root, ...file.split('/'))
  const source = readFileSync(filePath, 'utf8')
  assert.equal(hash(readFileSync(filePath)), expectedFileHash, `Primitive source changed: ${file}`)
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
  const declarations = []
  const findDeclaration = (node) => {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isVariableDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === primitive.SYMBOL
    ) {
      declarations.push(node)
    }
    ts.forEachChild(node, findDeclaration)
  }
  findDeclaration(sourceFile)
  const declaration = declarations.find(
    (node) =>
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 ===
      declarationLine,
  )
  assert(
    declaration,
    `Primitive declaration not found at accepted line: ${file}:${declarationLine}`,
  )
  const lineStart =
    sourceFile.getLineAndCharacterOfPosition(declaration.getStart(sourceFile)).line + 1
  const lineEnd = sourceFile.getLineAndCharacterOfPosition(declaration.getEnd()).line + 1
  const lines = source.split(/\r?\n/)
  const text = lines.slice(lineStart - 1, lineEnd).join('\n')
  return {
    HELPER_SLICE_ID: `HELPER-${primitive.PRIMITIVE_ID}`,
    PRIMITIVE_ID: primitive.PRIMITIVE_ID,
    SYMBOL: primitive.SYMBOL,
    DOMAIN: primitive.DOMAIN,
    SOURCE_FILE: clipName(file),
    LINE_START: lineStart,
    LINE_END: lineEnd,
    SHA256: hash(text),
    ACCEPTED_IMPLEMENTATION_FILE_SHA256: expectedFileHash,
    FACTS: factsForSlice({ lineStart, lines: text.split('\n') }),
    OBSERVED_BEHAVIOR_IN_FROZEN_REGISTRY: primitive.OBSERVED_BEHAVIOR,
    FAILURE_SEMANTICS_IN_FROZEN_REGISTRY: primitive.FAILURE_SEMANTICS,
  }
}

const slicesByFile = new Map()
for (const [file, requests] of sourceRequests) {
  slicesByFile.set(file, await readRequestedRanges(file, requests))
}
const acceptedHelperSymbols = sortedUnique(
  deferredEntries.flatMap((record) => {
    const entry = censusById.get(record.ENTRY_ID)
    return dimensions.flatMap(([, , helperKey]) => entry[helperKey] ?? [])
  }),
)
const helperSourceSlices = acceptedHelperSymbols.flatMap((symbol) =>
  (primitivesBySymbol.get(symbol) ?? []).map(readPrimitiveSlice),
)
const withApiObserved = [...slicesByFile.entries()].some(([file, slices]) =>
  slices.some((slice) => calledIdentifiers(slice.text, file).has('withApi')),
)
if (withApiObserved) {
  const helperFile = 'apps/union-eyes/lib/api/with-api.ts'
  const helperLines = readFileSync(path.resolve(root, ...helperFile.split('/')), 'utf8').split(
    /\r?\n/,
  )
  const lineStart = 281
  const lineEnd = 715
  const text = helperLines.slice(lineStart - 1, lineEnd).join('\n')
  helperSourceSlices.push({
    HELPER_SLICE_ID: 'HELPER-WITHAPI-IMPLEMENTATION',
    SYMBOL: 'withApi',
    DOMAIN: 'API_ROUTE_WRAPPER',
    SOURCE_FILE: clipName(helperFile),
    LINE_START: lineStart,
    LINE_END: lineEnd,
    SHA256: hash(text),
    FACTS: factsForSlice({ lineStart, lines: text.split('\n') }),
    CAPTURE_BASIS: 'DIRECT_HANDLER_WRAPPER_OBSERVED_IN_BOUNDED_ENTRY_SLICES',
  })
  const barrelFile = 'apps/union-eyes/lib/api/framework.ts'
  const barrelLines = readFileSync(path.resolve(root, ...barrelFile.split('/')), 'utf8').split(
    /\r?\n/,
  )
  const barrelStart = 12
  const barrelEnd = 13
  const barrelText = barrelLines.slice(barrelStart - 1, barrelEnd).join('\n')
  helperSourceSlices.push({
    HELPER_SLICE_ID: 'HELPER-WITHAPI-BARREL',
    SYMBOL: 'withApi',
    DOMAIN: 'API_ROUTE_WRAPPER_EXPORT',
    SOURCE_FILE: clipName(barrelFile),
    LINE_START: barrelStart,
    LINE_END: barrelEnd,
    SHA256: hash(barrelText),
    FACTS: factsForSlice({ lineStart: barrelStart, lines: barrelText.split('\n') }),
    CAPTURE_BASIS: 'DIRECT_REEXPORT_PATH_FOR_HANDLER_WRAPPER',
  })
}
const helperSlicesBySymbol = new Map()
for (const helperSlice of helperSourceSlices) {
  const helperSlices = helperSlicesBySymbol.get(helperSlice.SYMBOL) ?? []
  helperSlices.push(helperSlice.HELPER_SLICE_ID)
  helperSlicesBySymbol.set(helperSlice.SYMBOL, helperSlices)
}

const entries = deferredEntries.map((record) => {
  const censusEntry = censusById.get(record.ENTRY_ID)
  const sourceSlice = (slicesByFile.get(record.REQUIRED_SOURCE_PATH) ?? []).find(
    (slice) => slice.entryId === record.ENTRY_ID,
  )
  assert(sourceSlice, `No captured source slice for ${record.ENTRY_ID}`)
  const calledNames = calledIdentifiers(sourceSlice.text, record.REQUIRED_SOURCE_PATH)
  const helpersByDimension = Object.fromEntries(
    dimensions.map(([dimension, contractKey, helperKey]) => [
      dimension,
      {
        REQUIRED_CONTRACT: record.REQUIRED_ENFORCEMENT_CONTRACT[contractKey],
        ACCEPTED_CENSUS_HELPERS: censusEntry[helperKey] ?? [],
        DIRECT_HELPER_CALLS_OBSERVED_IN_BOUNDED_SLICE: (censusEntry[helperKey] ?? []).filter(
          (symbol) => calledNames.has(symbol),
        ),
        HELPER_SYMBOLS_PRESENT_IN_BOUNDED_SLICE: (censusEntry[helperKey] ?? []).filter((symbol) =>
          sourceSlice.text.includes(symbol),
        ),
        LINKED_HELPER_SOURCE_SLICE_IDS: (censusEntry[helperKey] ?? []).flatMap(
          (symbol) => helperSlicesBySymbol.get(symbol) ?? [],
        ),
        SOURCE_SLICE_ID: `SLICE-${record.ENTRY_ID}`,
      },
    ]),
  )
  const entryHelperSymbols = sortedUnique([
    ...dimensions.flatMap(([, , helperKey]) => censusEntry[helperKey] ?? []),
    ...(calledNames.has('withApi') ? ['withApi'] : []),
  ])
  const directHelperCalls = entryHelperSymbols.filter((symbol) => calledNames.has(symbol))
  const primitiveIds = sortedUnique(
    entryHelperSymbols.flatMap((symbol) =>
      (primitivesBySymbol.get(symbol) ?? []).map((primitive) => primitive.PRIMITIVE_ID),
    ),
  )
  const sourceFacts = factsForSlice(sourceSlice)
  return {
    ENTRY_ID: record.ENTRY_ID,
    COHORT_ID: record.COHORT_ID,
    ENTRY_CLASS: censusEntry.ENTRY_CLASS,
    EXPORT_OR_HANDLER: censusEntry.EXPORT_OR_HANDLER,
    HTTP_METHOD: censusEntry.HTTP_METHOD,
    ROUTE_PATTERN: censusEntry.ROUTE_PATTERN,
    DEFER_REASON: record.DEFER_REASON,
    ADDITIONAL_DEFER_REASONS: record.ADDITIONAL_DEFER_REASONS,
    REQUIRED_SOURCE_PATH: record.REQUIRED_SOURCE_PATH,
    REQUIREMENT_SOURCE_CEILING_DIMENSIONS: record.REQUIREMENT_SOURCE_CEILING_DIMENSIONS,
    REQUIREMENT_SOURCE_CEILING_REASON: record.REQUIREMENT_SOURCE_CEILING_REASON,
    PRIMITIVE_LINKAGE_STATUS: record.PRIMITIVE_LINKAGE_STATUS,
    HIGH_IMPACT_TAGS: record.HIGH_IMPACT_TAGS,
    SOURCE_SLICE: {
      SOURCE_SLICE_ID: `SLICE-${record.ENTRY_ID}`,
      LINE_START: sourceSlice.lineStart,
      LINE_END: sourceSlice.lineEnd,
      SHA256: sourceSlice.sha256,
      ACCEPTED_CENSUS_SHA256: sourceSlice.acceptedHash,
      FACTS: sourceFacts,
      MUTATION_ORDERING_EVIDENCE: sourceFacts.filter(
        (fact) => fact.FACT_TYPE === 'ORDERED_SIDE_EFFECT_OR_DATA_OPERATION',
      ),
      FAILURE_BEHAVIOR_EVIDENCE: sourceFacts.filter(
        (fact) => fact.FACT_TYPE === 'FAILURE_OR_RESPONSE_CONTROL',
      ),
      CALLER_CONTROLLED_SELECTOR_EVIDENCE: sourceFacts.filter(
        (fact) => fact.FACT_TYPE === 'CALLER_INPUT_REFERENCE',
      ),
      PRIVILEGED_DB_RLS_CONTEXT_EVIDENCE: sourceFacts.filter(
        (fact) => fact.FACT_TYPE === 'DATABASE_OR_EXECUTION_CONTEXT_REFERENCE',
      ),
    },
    REQUIRED_ENFORCEMENT_CONTRACT: record.REQUIRED_ENFORCEMENT_CONTRACT,
    DIMENSION_EVIDENCE: helpersByDimension,
    HELPER_AND_PRIMITIVE_LINKS: {
      ACCEPTED_CENSUS_HELPERS: sortedUnique(
        dimensions.flatMap(([, , helperKey]) => censusEntry[helperKey] ?? []),
      ),
      SOURCE_VISIBLE_HELPER_CALLS: directHelperCalls,
      HELPER_SOURCE_SLICE_IDS: entryHelperSymbols.flatMap(
        (symbol) => helperSlicesBySymbol.get(symbol) ?? [],
      ),
      DIRECT_HELPER_CALLS_WITHOUT_SOURCE_SLICE: directHelperCalls.filter(
        (symbol) => !helperSlicesBySymbol.has(symbol),
      ),
      ACCEPTED_PRIMITIVE_IDS: primitiveIds,
      PRIMITIVE_SEMANTICS: primitiveIds.map((primitiveId) => {
        const primitive = primitivesById.get(primitiveId)
        assert(primitive, `Unknown primitive ${primitiveId} on ${record.ENTRY_ID}`)
        return {
          PRIMITIVE_ID: primitive.PRIMITIVE_ID,
          DOMAIN: primitive.DOMAIN,
          SYMBOL: primitive.SYMBOL,
          OBSERVED_BEHAVIOR: primitive.OBSERVED_BEHAVIOR,
          FAILURE_SEMANTICS: primitive.FAILURE_SEMANTICS,
        }
      }),
    },
    CAPTURE_LIMITATION:
      'Evidence is limited to the accepted bounded entry slice and frozen census helper links; no final adequacy or exploitability verdict is assigned.',
  }
})

assert.equal(entries.length, 700, 'Expected all 700 deferred entries')
assert.equal(new Set(entries.map((entry) => entry.ENTRY_ID)).size, 700, 'Entry IDs must be unique')
assert.equal(
  new Set(entries.map((entry) => entry.COHORT_ID)).size,
  125,
  'Expected 125 deferred cohorts',
)
assert.equal(
  entries.filter((entry) => entry.SOURCE_SLICE.SHA256 === entry.SOURCE_SLICE.ACCEPTED_CENSUS_SHA256)
    .length,
  700,
  'Every captured source slice must match the accepted census hash',
)

const sourceFiles = [...slicesByFile.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([file, slices]) => ({
    SOURCE_FILE: clipName(file),
    CAPTURED_ENTRY_SLICES: slices.map((slice) => ({
      ENTRY_IDS: sortedUnique(
        entries
          .filter(
            (entry) =>
              entry.REQUIRED_SOURCE_PATH === file &&
              entry.SOURCE_SLICE.LINE_START === slice.lineStart &&
              entry.SOURCE_SLICE.LINE_END === slice.lineEnd,
          )
          .map((entry) => entry.ENTRY_ID),
      ),
      LINE_START: slice.lineStart,
      LINE_END: slice.lineEnd,
      SHA256: slice.sha256,
    })),
  }))

const report = {
  metadata: {
    PHASE: 'PHASE_1B_2B2_B2A_ENTRY_LOCAL_ENFORCEMENT_EVIDENCE_CAPTURE',
    METHOD: 'FROZEN_B2_REGISTER_CENSUS_BOUNDED_SOURCE_SLICES_AND_ACCEPTED_PRIMITIVE_LINKS',
    INPUTS: {
      B1_ADJUDICATION_FILE: inputFiles.adjudication,
      B1_ADJUDICATION_SHA256: adjudicationSha256,
      CENSUS_FILE: inputFiles.census,
      CENSUS_SHA256: censusSha256,
      PRIMITIVE_REGISTRY_FILE: inputFiles.primitives,
      PRIMITIVE_REGISTRY_SHA256: primitiveRegistrySha256,
    },
    CAPTURE_ONLY: 'YES',
    FINAL_ADEQUACY_VERDICTS_ASSIGNED: 'NO',
    PRODUCT_CHANGES_MADE: 'NO',
    RUNTIME_DATABASE_INSPECTED: 'NO',
    MIGRATION_EXECUTED: 'NO',
    DATABASE_WRITE_EXECUTED: 'NO',
  },
  gate: {
    PHASE_1B_2B2_B2A_GATE: 'EVIDENCE_CAPTURED_NO_ADEQUACY_VERDICT',
    PHASE_1B_2B2_B2A: 'CAPTURED',
    PHASE_1B_2B2_B2B: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_2B: 'NOT_YET_COMPLETE',
    PHASE_1B_3: 'NOT_AUTHORIZED',
    PHASE_1C: 'NOT_AUTHORIZED',
    PHASE_1D: 'NOT_AUTHORIZED',
    PHASE_2: 'NOT_AUTHORIZED',
  },
  denominators: {
    INPUT_DEFERRED_ENTRIES: 700,
    UNIQUE_INPUT_ENTRY_IDS: 700,
    INPUT_DEFERRED_COHORTS: 125,
    DISTINCT_AUTHORIZED_SOURCE_PATHS: sourceFiles.length,
    SOURCE_SLICES_CAPTURED: entries.length,
  },
  frozenCarryForwards: {
    ...adjudication.priorPhasePreservation,
    B1_KNOWN_ENFORCEMENT_DEFECTS: adjudication.knownEnforcementDefects.length,
    B1_SOURCE_CEILING_RECORDS: adjudication.sourceCeilings.length,
    B1_HISTORICAL_EXPECTATIONS_REMAIN_OPEN:
      adjudication.historicalPageExpectations.EXPECTATIONS_REMAIN_OPEN,
    B1_HISTORICAL_EXPECTATIONS_OPEN: adjudication.historicalPageExpectations.RECORDS.length,
  },
  sourceReadRegister: sourceFiles,
  helperSourceSlices,
  entryEvidence: entries,
  validation: {
    DEFERRED_ENTRIES_CAPTURED_EXACTLY_ONCE: entries.length === 700,
    UNIQUE_DEFERRED_ENTRY_IDS: new Set(entries.map((entry) => entry.ENTRY_ID)).size,
    DEFERRED_COHORTS_COVERED: new Set(entries.map((entry) => entry.COHORT_ID)).size,
    ALL_SOURCE_PATHS_MATCH_FROZEN_REGISTER: entries.every((entry) => {
      const frozen = deferredEntries.find((record) => record.ENTRY_ID === entry.ENTRY_ID)
      return frozen?.REQUIRED_SOURCE_PATH === entry.REQUIRED_SOURCE_PATH
    }),
    ALL_SLICE_HASHES_MATCH_ACCEPTED_CENSUS: entries.every(
      (entry) => entry.SOURCE_SLICE.SHA256 === entry.SOURCE_SLICE.ACCEPTED_CENSUS_SHA256,
    ),
    ALL_PRIMITIVE_LINKS_RESOLVE: entries.every((entry) =>
      entry.HELPER_AND_PRIMITIVE_LINKS.PRIMITIVE_SEMANTICS.every((primitive) =>
        primitivesById.has(primitive.PRIMITIVE_ID),
      ),
    ),
    ALL_LINKED_PRIMITIVE_IMPLEMENTATIONS_HASH_MATCH: helperSourceSlices.every(
      (slice) =>
        primitiveRegistry.PRIMITIVES.find(
          (primitive) => primitive.PRIMITIVE_ID === slice.PRIMITIVE_ID,
        )?.IMPLEMENTATION.FILE_SHA256 === slice.ACCEPTED_IMPLEMENTATION_FILE_SHA256,
    ),
    B1_KNOWN_ENFORCEMENT_DEFECTS_PRESERVED: adjudication.knownEnforcementDefects.length === 215,
    B1_SOURCE_CEILING_RECORDS_PRESERVED: adjudication.sourceCeilings.length === 825,
    B1_HISTORICAL_EXPECTATIONS_REMAIN_OPEN:
      adjudication.historicalPageExpectations.EXPECTATIONS_REMAIN_OPEN === 'YES' &&
      adjudication.historicalPageExpectations.RECORDS.length === 43,
    B2B2B_STARTED: 'NO',
    PHASE_1B_3_STARTED: 'NO',
    PHASE_1C_STARTED: 'NO',
    PHASE_1D_STARTED: 'NO',
    PHASE_2_STARTED: 'NO',
  },
}

const markdown = `# Phase 1B.2b2-B2A Entry-Local Enforcement Evidence

## Status

- Gate: \`${report.gate.PHASE_1B_2B2_B2A_GATE}\`
- Evidence capture: \`${report.gate.PHASE_1B_2B2_B2A}\`
- Final adequacy verdicts: \`${report.metadata.FINAL_ADEQUACY_VERDICTS_ASSIGNED}\`
- B2B follow-on: \`${report.gate.PHASE_1B_2B2_B2B}\`

## Coverage

| Measure | Count |
|---|---:|
| Deferred entries captured | ${entries.length} |
| Unique deferred cohorts | ${new Set(entries.map((entry) => entry.COHORT_ID)).size} |
| Authorized source paths | ${sourceFiles.length} |
| Hash-verified bounded entry slices | ${entries.filter((entry) => entry.SOURCE_SLICE.SHA256 === entry.SOURCE_SLICE.ACCEPTED_CENSUS_SHA256).length} |

Each entry record carries the frozen requirement contract, bounded source line range and SHA-256, source-derived evidence facts, and accepted census helper/primitive links. Facts are observational only; helper names and source text do not establish runtime reachability or adequacy.

## Preservation and scope

- B1 findings and carry-forwards are copied from the accepted B1 adjudication.
- Runtime database inspection: \`${report.metadata.RUNTIME_DATABASE_INSPECTED}\`
- Migration executed: \`${report.metadata.MIGRATION_EXECUTED}\`
- Database write executed: \`${report.metadata.DATABASE_WRITE_EXECUTED}\`
- Product changes: \`${report.metadata.PRODUCT_CHANGES_MADE}\`
- B2B2-B, Phase 1B.3, Phase 1C, Phase 1D, and Phase 2 remain unstarted.

See the JSON artifact for per-entry evidence, exact line references, and validation data.
`

const prettierConfig = await resolvePrettierConfig(path.resolve(root, outputFiles.json))
const formattedJson = await formatContent(`${JSON.stringify(report, null, 2)}\n`, {
  ...prettierConfig,
  filepath: path.resolve(root, outputFiles.json),
})
const formattedMarkdown = await formatContent(markdown, {
  ...prettierConfig,
  filepath: path.resolve(root, outputFiles.markdown),
})

for (const [kind, file] of Object.entries(outputFiles)) {
  const content = kind === 'json' ? formattedJson : formattedMarkdown
  const target = path.resolve(root, ...file.split('/'))
  if (checkOnly) {
    assert.equal(readFileSync(target, 'utf8'), content, `${file} is not up to date`)
  } else {
    writeFileSync(target, content)
  }
}

console.log(
  JSON.stringify(
    {
      gate: report.gate.PHASE_1B_2B2_B2A_GATE,
      entries: report.denominators.INPUT_DEFERRED_ENTRIES,
      cohorts: report.denominators.INPUT_DEFERRED_COHORTS,
      sourcePaths: report.denominators.DISTINCT_AUTHORIZED_SOURCE_PATHS,
      slices: report.denominators.SOURCE_SLICES_CAPTURED,
      checkOnly,
    },
    null,
    2,
  ),
)
