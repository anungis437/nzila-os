/**
 * Independent evidence qualification for Gate 0C.4. Each function re-derives a fact from the route source, the frozen
 * defect register or the repository, and compares it with what a Gate 0C.3 register states. The Gate 0C.3 register is
 * the claim under test and is never the source of the check.
 */
import { posix } from 'node:path'
import { defectHash } from './ue-gate0b7-release-dispositions.mjs'
import { sha256Of, sorted, unique } from './ue-gate0c3-reconcile.mjs'
import { API_ROOT, CARBON_SERVICE_FILES, PER_CAPITA, RETENTION_DEFECT, REVIEWER_ROLE, REVIEW_INDEPENDENCE, REVIEW_LIMITATION, RUNTIME_ONLY_PROOFS } from './ue-gate0c4-ids.mjs'
import { FLOOR, TENANT_TOKENS, analyseRouteFile, roleNamedByFloor } from './ue-gate0c4-source.mjs'

const DISCLOSURE = ['CROSS_TENANT_DISCLOSURE', 'SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT']
const MUTATION = ['UNAUTHORIZED_MUTATION', 'FINANCIAL_INTEGRITY', 'DATA_QUALITY', 'AVAILABILITY_OR_DATA_LOSS']
const READ_METHODS = ['GET', 'HEAD']

/** A file reader that remembers every file it was asked for, so the register can pin the exact blobs it read. */
export function recordingReader(app) {
  const used = new Map()
  return {
    read(file) {
      const text = app.read(file)
      used.set(file, text === null ? null : app.sha(file))
      return text
    },
    pins: () => Object.fromEntries([...used].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  }
}

const memo = (map, key, make) => {
  if (!map.has(key)) map.set(key, make())
  return map.get(key)
}

const ALWAYS_TRUE_GUARD = /function\s+(\w*(?:Access|Auth|Guard|Permission)\w*)\s*\([^)]*\)[^{]*\{\s*return\s+true\s*;?\s*\}/

/** Recomputes the wrapper and floor of one `route|METHOD` operation, following one level of import delegation. */
export function analyseOperation(reader, operation, cache = new Map()) {
  const [route, method] = operation.split('|')
  const file = `${API_ROOT}/${route}`
  const text = reader.read(file)
  if (text === null) return { operation, file, exists: false, declared: false, wrapper: null, role: null, floor: FLOOR.UNDETERMINED, delegatedTo: null, inertLocalGuard: null }
  const analysis = memo(cache, file, () => analyseRouteFile(text))
  let declaration = analysis.methods[method] ?? null
  let delegatedTo = null
  const inertLocalGuard = (ALWAYS_TRUE_GUARD.exec(text) ?? [])[1] ?? null
  if (declaration && declaration.wrapper === 'FUNCTION_DECLARATION') {
    const target = Object.entries(analysis.delegates).find(([alias, entry]) => entry.method === method && text.includes(`${alias}(`))
    if (target) {
      const base = target[1].path
      const candidates = [`${posix.normalize(posix.join(posix.dirname(file), base))}.ts`, `${posix.normalize(posix.join(posix.dirname(file), base))}/route.ts`]
      for (const candidate of candidates) {
        const targetText = reader.read(candidate)
        if (targetText === null) continue
        const inner = memo(cache, candidate, () => analyseRouteFile(targetText)).methods[method]
        if (inner && inner.floor !== FLOOR.UNDETERMINED) {
          declaration = { ...inner, wrapper: `${inner.wrapper}(delegate)` }
          delegatedTo = candidate
          break
        }
      }
    }
  }
  return {
    operation,
    file,
    exists: true,
    declared: declaration !== null,
    wrapper: declaration?.wrapper ?? null,
    role: declaration?.role ?? null,
    floor: declaration?.floor ?? FLOOR.UNDETERMINED,
    delegatedTo,
    inertLocalGuard,
    factory: declaration?.factory ?? null,
  }
}

const tally = (items) => Object.fromEntries(sorted(unique(items)).map((key) => [key, items.filter((item) => item === key).length]))

/** Chooses the operations a defect's impact is about: reads for pure disclosure, writes for pure mutation, otherwise all. */
export function relevantOperations(classes, operations) {
  const isRead = (operation) => READ_METHODS.includes(operation.operation.split('|')[1])
  const pure = (family) => classes.length > 0 && classes.every((name) => family.includes(name))
  let selected = operations
  if (pure(DISCLOSURE)) selected = operations.filter(isRead)
  else if (pure(MUTATION) || (classes.includes('UNAUTHORIZED_MUTATION') && !DISCLOSURE.some((name) => classes.includes(name)))) selected = operations.filter((operation) => !isRead(operation))
  return selected.length > 0 ? selected : operations
}

/** Compares a stated activation state with the recomputed floors of the relevant operations. */
export function floorVerdict(state, floors) {
  const count = (name) => floors.filter((floor) => floor === name).length
  const any = count(FLOOR.ANY_AUTHENTICATED)
  const role = count(FLOOR.ROLE_RESTRICTED)
  const custom = count(FLOOR.CUSTOM_CHECK)
  const open = count(FLOOR.UNAUTHENTICATED)
  if (floors.length === 0 || floors.every((floor) => floor === FLOOR.UNDETERMINED)) return 'UNDETERMINED'
  if (state === 'REACHABLE_ANY_AUTHENTICATED') {
    if (any > 0) return 'CONSISTENT'
    if (open > 0) return 'UNDERSTATED'
    if (custom > 0) return 'CUSTOM_CHECK_UNPROVEN'
    return role > 0 ? 'OVERSTATED' : 'UNDETERMINED'
  }
  if (state === 'REACHABLE_ROLE_RESTRICTED') {
    if (any > 0 || open > 0) return role > 0 || custom > 0 ? 'MIXED' : 'UNDERSTATED'
    if (role > 0) return 'CONSISTENT'
    return custom > 0 ? 'CUSTOM_CHECK_UNPROVEN' : 'UNDETERMINED'
  }
  if (state === 'REACHABLE_UNAUTHENTICATED') {
    if (open > 0) return 'CONSISTENT'
    return any + role > 0 ? 'OVERSTATED' : 'UNDETERMINED'
  }
  return 'UNDETERMINED'
}

/**
 * What each Gate 0C.3 rubric key requires of the record it is applied to. A key with no machine-checkable precondition
 * is reported as such and never as satisfied.
 */
export const RUBRIC_PRECONDITIONS = {
  RB_XT: { needs: 'The impact classes include CROSS_TENANT_DISCLOSURE.', check: ({ classes }) => classes.includes('CROSS_TENANT_DISCLOSURE') },
  RB_MF: { needs: 'A member-floor operation and an over-disclosure or privacy impact.', check: ({ classes, verdict, floors }) => (floors.includes(FLOOR.ANY_AUTHENTICATED) || floors.includes(FLOOR.UNAUTHENTICATED) || verdict === 'UNDETERMINED') && (classes.includes('SAME_TENANT_OVER_DISCLOSURE') || classes.includes('PRIVACY_OR_CONSENT')) },
  RB_FALSE: { needs: 'The impact classes include FALSE_ATTESTATION_OR_OUTCOME.', check: ({ classes }) => classes.includes('FALSE_ATTESTATION_OR_OUTCOME') },
  RB_CRED: { needs: 'The impact classes include PRIVACY_OR_CONSENT.', check: ({ classes }) => classes.includes('PRIVACY_OR_CONSENT') },
  RB_SHARED: { needs: 'Cross-organization impact and a write operation.', check: ({ classes, operations }) => classes.includes('CROSS_TENANT_DISCLOSURE') && operations.some((operation) => !READ_METHODS.includes(operation.operation.split('|')[1])) },
  RB_ANYMUT: { needs: 'The impact classes include UNAUTHORIZED_MUTATION and a write operation.', check: ({ classes, operations }) => classes.includes('UNAUTHORIZED_MUTATION') && operations.some((operation) => !READ_METHODS.includes(operation.operation.split('|')[1])) },
  CB_AUD: { needs: 'The impact classes include SAME_TENANT_OVER_DISCLOSURE.', check: ({ classes }) => classes.includes('SAME_TENANT_OVER_DISCLOSURE') },
  CB_PLAT: { needs: 'A platform role title floor and cross-organization impact.', check: ({ classes, floor }) => /platform/i.test(floor) && classes.includes('CROSS_TENANT_DISCLOSURE') },
  CB_INERT: { needs: null, check: null },
  CB_DEP: { needs: 'A deployment-configuration proof among the proofs the disposition depends on.', check: ({ proofs }) => proofs.includes('DEPLOYMENT_CONFIGURATION') },
  CB_INT: { needs: 'A role-restricted floor.', check: ({ state }) => state === 'REACHABLE_ROLE_RESTRICTED' },
  RR: { needs: null, check: null },
}

const ABSENCE = /\b(?:no|without|never|nothing)\b[^.;:]{0,80}?\b(predicate|scheduler|guard|check|audit|filter|validation|authority|constraint|projection|subscriber|mandate)\b/gi

function absenceClaims(reader, assessment) {
  const text = `${assessment.title} ${assessment.sourceExposure.statement}`
  const claims = []
  const seen = new Set()
  for (const match of text.matchAll(ABSENCE)) {
    const phrase = match[0].replace(/\s+/g, ' ').trim()
    if (seen.has(phrase.toLowerCase())) continue
    seen.add(phrase.toLowerCase())
    const subject = match[1].toLowerCase()
    if (subject !== 'predicate') {
      claims.push({ subject, phrase, status: 'NOT_MACHINE_CHECKABLE', contestedBy: [] })
      continue
    }
    const contestedBy = []
    for (const quote of assessment.evidence.sourceQuotes) {
      const source = reader.read(quote.ref)
      if (source === null) continue
      const at = source.indexOf(quote.quote)
      const window = at < 0 ? '' : source.slice(at, at + 6000)
      const token = TENANT_TOKENS.exec(window)
      if (token) contestedBy.push({ ref: quote.ref, token: token[1] })
    }
    claims.push({ subject, phrase, status: contestedBy.length > 0 ? 'CONTESTED_BY_CITED_SOURCE' : 'NOT_CONTRADICTED_BY_CITED_SOURCE', contestedBy: sorted(unique(contestedBy.map((entry) => JSON.stringify(entry)))).map((entry) => JSON.parse(entry)) })
  }
  return claims.slice(0, 6)
}

const finding = (code, severity, statement) => ({ code, severity, statement })

/** Qualifies one assessment against the route source. The result is a qualification record and carries no approval. */
export function qualifyAssessment({ assessment, defect, reader, cache, operationsInInventory }) {
  const classes = assessment.impact.classes
  const proofs = assessment.runtimeQualification.proofs
  const findings = []

  const quotes = assessment.evidence.sourceQuotes.map((quote) => {
    const text = reader.read(quote.ref)
    return { ref: quote.ref, present: text !== null && text.includes(quote.quote) }
  })
  const missingQuotes = quotes.filter((quote) => !quote.present)
  if (missingQuotes.length > 0) findings.push(finding('QUOTE_NOT_FOUND', 'QUALIFYING', `${missingQuotes.length} of ${quotes.length} cited quotations are not present in the cited file.`))

  const operations = assessment.affected.operations.map((operation) => analyseOperation(reader, operation, cache))
  const missingOperations = operations.filter((operation) => !operation.exists || !operation.declared).map((operation) => operation.operation)
  const notInInventory = assessment.affected.operations.filter((operation) => !operationsInInventory.has(operation))
  if (missingOperations.length > 0) findings.push(finding('OPERATION_NOT_DECLARED', 'QUALIFYING', `${missingOperations.length} listed operations are not declared by their route file.`))
  if (notInInventory.length > 0) findings.push(finding('OPERATION_NOT_IN_CLASSIFIED_INVENTORY', 'QUALIFYING', `${notInInventory.length} listed operations are absent from the classified inventory.`))

  const relevant = relevantOperations(classes, operations)
  const floors = relevant.map((operation) => operation.floor)
  const verdict = floorVerdict(assessment.sourceExposure.activationState, floors)
  if (verdict === 'OVERSTATED') findings.push(finding('FLOOR_OVERSTATED', 'QUALIFYING', `The stated state ${assessment.sourceExposure.activationState} overstates reachability: every relevant operation is declared at a higher floor.`))
  if (verdict === 'MIXED' || verdict === 'UNDERSTATED') findings.push(finding('FLOOR_UNDERSTATED', 'QUALIFYING', `The stated state ${assessment.sourceExposure.activationState} understates reachability: ${verdict === 'MIXED' ? 'some' : 'every'} relevant operation is declared at a lower floor.`))
  if (verdict === 'CUSTOM_CHECK_UNPROVEN') findings.push(finding('FLOOR_RESTS_ON_HANDLER_BODY', 'INFO', 'The wrapper authenticates the caller and the handler body names its own role or credential check, so the wrapper alone does not establish the floor.'))
  for (const operation of operations) if (operation.inertLocalGuard) findings.push(finding('LOCAL_GUARD_RETURNS_TRUE', 'QUALIFYING', `${operation.file} defines ${operation.inertLocalGuard}, which returns true unconditionally.`))

  const named = roleNamedByFloor(assessment.sourceExposure.floor)
  const declaredRoles = sorted(unique(relevant.map((operation) => operation.role).filter(Boolean)))
  const nameSatisfied = named === null || declaredRoles.includes(named) || (named === 'member' && floors.includes(FLOOR.ANY_AUTHENTICATED))
  if (!nameSatisfied) findings.push(finding('STATED_FLOOR_ROLE_NOT_DECLARED', 'QUALIFYING', `The stated floor names ${named}; the relevant operations declare ${declaredRoles.length > 0 ? declaredRoles.join(', ') : 'no role'}.`))

  const rubric = RUBRIC_PRECONDITIONS[assessment.proposedDisposition.rubricKey]
  let rubricResult
  if (!rubric || rubric.check === null) rubricResult = { key: assessment.proposedDisposition.rubricKey, result: 'NOT_MACHINE_CHECKABLE', needs: rubric?.needs ?? null }
  else {
    const holds = rubric.check({ classes, proofs, state: assessment.sourceExposure.activationState, floor: assessment.sourceExposure.floor, floors, verdict, operations })
    rubricResult = { key: assessment.proposedDisposition.rubricKey, result: holds ? 'PRECONDITION_MET' : 'PRECONDITION_NOT_MET', needs: rubric.needs }
    if (!holds) findings.push(finding('RUBRIC_PRECONDITION_NOT_MET', 'CHALLENGE', `The rubric ${assessment.proposedDisposition.rubricKey} requires: ${rubric.needs} The record does not show it.`))
  }
  if (classes.includes('CROSS_TENANT_DISCLOSURE') && assessment.proposedDisposition.value !== 'RELEASE_BLOCKING' && assessment.proposedDisposition.value !== 'REVIEW_REQUIRED') {
    findings.push(finding('RUBRIC_PRECEDENCE_AMBIGUOUS', 'CHALLENGE', `The impact includes cross-organization disclosure and no executed containment proof is on file, which is the rubric RB_XT test, yet the proposal applies ${assessment.proposedDisposition.rubricKey}. The proposal stays as proposed; the precedence between the two rubric keys needs an authorized reviewer.`))
  }

  const absence = absenceClaims(reader, assessment)
  for (const claim of absence) {
    if (claim.status === 'CONTESTED_BY_CITED_SOURCE') findings.push(finding('ABSENCE_CLAIM_CONTESTED', 'QUALIFYING', `The claim "${claim.phrase}" is contested: cited source names ${claim.contestedBy.map((entry) => entry.token).join(', ')}.`))
  }

  const frozenMatches = defect !== undefined && defectHash(defect) === assessment.frozenRecord.defectSha256
  if (!frozenMatches) findings.push(finding('FROZEN_RECORD_MISMATCH', 'QUALIFYING', 'The frozen defect record does not hash to the value the assessment carries.'))

  const sensitivity = []
  if (findings.some((entry) => entry.code === 'FLOOR_UNDERSTATED') && assessment.proposedDisposition.value !== 'RELEASE_BLOCKING') sensitivity.push('POSSIBLY_TOO_LENIENT')
  if (findings.some((entry) => entry.code === 'FLOOR_OVERSTATED') && assessment.proposedDisposition.value === 'RELEASE_BLOCKING') sensitivity.push('POSSIBLY_TOO_STRICT')
  if (findings.some((entry) => entry.code === 'RUBRIC_PRECEDENCE_AMBIGUOUS' || entry.code === 'RUBRIC_PRECONDITION_NOT_MET')) sensitivity.push('RUBRIC_APPLICATION_UNCLEAR')

  const recomputable = floors.some((floor) => floor !== FLOOR.UNDETERMINED)
  let sourceVerification
  if (!recomputable) sourceVerification = 'INFERENCE_ONLY'
  else if (findings.some((entry) => entry.severity === 'QUALIFYING' || entry.severity === 'CHALLENGE') || absence.length > 0) sourceVerification = 'PARTIALLY_VERIFIED'
  else sourceVerification = 'SOURCE_VERIFIED'
  const runtimeProofs = proofs.filter((proof) => RUNTIME_ONLY_PROOFS.includes(proof))
  const reviewStatus = runtimeProofs.length > 0 ? 'REQUIRES_RUNTIME_PROOF' : sourceVerification

  return {
    defectId: assessment.defectId,
    tranche: assessment.tranche,
    assessmentRecordSha256: sha256Of(assessment),
    proposedDisposition: {
      value: assessment.proposedDisposition.value,
      rubricKey: assessment.proposedDisposition.rubricKey,
      state: assessment.proposedDisposition.state,
      acceptedBy: null,
      acceptedOn: null,
      severityChanged: false,
    },
    sourceChecks: {
      frozenRecordMatches: frozenMatches,
      quotes: { total: quotes.length, present: quotes.length - missingQuotes.length, missing: missingQuotes },
      operations: {
        declared: assessment.affected.operationCount,
        recomputed: operations.filter((operation) => operation.exists && operation.declared).length,
        missing: missingOperations,
        floorsByClass: tally(operations.map((operation) => operation.floor)),
        relevant: relevant.length,
        relevantFloorsByClass: tally(floors),
        declaredRoles,
        delegated: operations.filter((operation) => operation.delegatedTo).map((operation) => ({ operation: operation.operation, to: operation.delegatedTo })),
      },
      activation: { stated: assessment.sourceExposure.activationState, statedFloor: assessment.sourceExposure.floor, verdict },
      rubric: rubricResult,
      absenceClaims: absence,
    },
    independentFindings: findings.filter((entry, index) => findings.findIndex((other) => other.code === entry.code && other.statement === entry.statement) === index),
    dispositionSensitivity: sensitivity,
    sourceVerification,
    runtimeDependency: { required: runtimeProofs.length > 0, proofs: runtimeProofs },
    reviewStatus,
    executedProof: [],
    runtimeEvidence: null,
    review: {
      reviewerRole: REVIEWER_ROLE,
      independence: REVIEW_INDEPENDENCE,
      authorityIndependent: false,
      approval: null,
      acceptedBy: null,
      acceptedOn: null,
    },
  }
}

export function qualifyAll(src, reader) {
  const cache = new Map()
  const defects = new Map(src.base.classification.defectRegister.map((defect) => [defect.id, defect]))
  const operationsInInventory = new Set(src.base.tranches.flatMap((tranche) => tranche.operations.map((operation) => operation.id)))
  const items = src.reg.assessment.assessments.map((assessment) => qualifyAssessment({ assessment, defect: defects.get(assessment.defectId), reader, cache, operationsInInventory }))
  const findingCodes = tally(items.flatMap((item) => item.independentFindings.map((entry) => entry.code)))
  return {
    items,
    totals: {
      assessed: items.length,
      byReviewStatus: tally(items.map((item) => item.reviewStatus)),
      bySourceVerification: tally(items.map((item) => item.sourceVerification)),
      byActivationVerdict: tally(items.map((item) => item.sourceChecks.activation.verdict)),
      byProposedDisposition: tally(items.map((item) => item.proposedDisposition.value)),
      findingCodes,
      byDispositionSensitivity: tally(items.flatMap((item) => item.dispositionSensitivity)),
      withQualifyingOrChallengeFinding: items.filter((item) => item.independentFindings.some((entry) => entry.severity !== 'INFO')).length,
      accepted: items.filter((item) => item.proposedDisposition.acceptedBy !== null).length,
      executedProofs: items.reduce((sum, item) => sum + item.executedProof.length, 0),
    },
  }
}

/** Recomputes the 150-item index from the frozen defect register, the review queue and the handoff register alone. */
export function verifyDeduplication(src) {
  const defects = src.base.classification.defectRegister
  const idsOf = (predicate) => sorted(defects.filter(predicate).map((defect) => defect.id))
  const releaseBlocking = idsOf((defect) => defect.releaseDisposition?.disposition === 'RELEASE_BLOCKING')
  const conditional = idsOf((defect) => defect.releaseDisposition?.disposition === 'CONDITIONALLY_BLOCKING')
  const awaiting = sorted(src.base.queue.entries.map((entry) => entry.defectId))
  const exposureDefects = idsOf((defect) => defect.releaseBlocking === true && !defect.releaseDisposition)
  const tracked = sorted(src.base.handoff.obligations.filter((entry) => /TRACKED/.test(entry.id)).flatMap((entry) => entry.defects.map((item) => item.id)))
  const groups = { releaseBlocking, conditional, awaiting, exposureDefects, tracked }
  const all = Object.values(groups).flat()
  const union = sorted(unique(all))
  const indexed = sorted(src.reg.debt.items.map((item) => item.sourceId))
  const overlaps = union.filter((id) => all.filter((entry) => entry === id).length > 1)
  return {
    method: 'The sets are rebuilt from the frozen defect register (release dispositions and the release-blocking flag), the review queue and the handoff register. The Gate 0C.3 debt index is read only to compare.',
    groups: Object.fromEntries(Object.entries(groups).map(([name, ids]) => [name, ids.length])),
    sumOfGroups: all.length,
    uniqueRecomputed: union.length,
    overlapsBetweenGroups: overlaps,
    indexedItems: indexed.length,
    indexedItemsDuplicated: indexed.length - unique(indexed).length,
    missingFromIndex: union.filter((id) => !indexed.includes(id)),
    notInRecomputedSets: indexed.filter((id) => !union.includes(id)),
    listedInstances: src.reg.debt.totals.listedInstances,
    duplicateInflationAvoided: src.reg.debt.totals.duplicateInflationAvoided,
    matches: union.length === indexed.length && union.every((id, index) => id === indexed[index]) && overlaps.length === 0,
    status: 'SOURCE_VERIFIED',
    limitation: 'This verifies that the index counts each frozen record once. It does not verify that the frozen records are complete: a defect never recorded in the register cannot appear in either count.',
  }
}

const allowlistEntries = (text) => [...(text ?? '').matchAll(/^\s*'(\/api\/[^']*)'/gm)].map((match) => match[1])
const allowlisted = (entries, path) => entries.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : entry === path))

/** The three public exposures: handler declaration, proxy allowlist membership and any recorded justification. */
export function verifyExposures(src, reader) {
  const allowlistFile = 'apps/union-eyes/lib/public-routes.ts'
  const proxyFile = 'apps/union-eyes/proxy.ts'
  const allowlistText = reader.read(allowlistFile)
  const proxyText = reader.read(proxyFile)
  const entries = allowlistEntries(allowlistText)
  const paths = { 'docs/openapi/route.ts|GET': '/api/docs/openapi', 'docs/route.ts|GET': '/api/docs', 'version/route.ts|GET': '/api/version' }
  const cache = new Map()
  const operations = Object.entries(paths).map(([operation, path]) => {
    const analysed = analyseOperation(reader, operation, cache)
    const inAllowlist = allowlisted(entries, path)
    const commentNear = (allowlistText ?? '').split('\n').some((line) => line.includes(`'${path}'`) && /\/\//.test(line))
    return {
      operation,
      path,
      handlerFloor: analysed.floor,
      handlerWrapper: analysed.wrapper,
      inProxyAllowlist: inAllowlist,
      allowlistJustification: commentNear ? 'COMMENT_PRESENT' : 'NONE_RECORDED',
      handlerDeclaresNoAuth: analysed.floor === FLOOR.UNDETERMINED && analysed.wrapper === 'FUNCTION_DECLARATION',
      statuses: {
        handlerDeclaration: analysed.wrapper === 'FUNCTION_DECLARATION' ? 'SOURCE_VERIFIED' : 'PARTIALLY_VERIFIED',
        publicReachability: 'REQUIRES_RUNTIME_PROOF',
        justification: commentNear ? 'PARTIALLY_VERIFIED' : 'SOURCE_VERIFIED',
      },
    }
  })
  return {
    allowlistFile,
    allowlistEntries: entries.length,
    proxyConsultsAllowlist: proxyText !== null && /isPublicRoute as isPublicApiRoute/.test(proxyText) && /isPublicApiRoute\(/.test(proxyText),
    operations,
    finding:
      'Each of the three handlers is a plain exported function with no authentication wrapper, so the handler itself does not restrict the caller. None of the three paths is in the proxy allowlist the proxy consults (only /api/docs/openapi.json is), so whether an unauthenticated caller reaches them is decided by the proxy and the deployment, which the repository cannot show. The record keeps the exposure contract as release blocking and does not rely on either reading.',
    limitation: 'The proxy matcher and the deployment edge are not executed here.',
  }
}

/** The two OPL challenges: whether the cited source changed, and what the flag evidence supports. */
export function verifyChallenges(src) {
  const evidence = src.base.challengeEvidence
  return {
    method: 'The files the two challenges cite are compared by blob between the challenge commit and the working tree, and every file that names the flag is compared by name.',
    anchorCommit: evidence.anchorCommit,
    citedFiles: evidence.cited.length,
    citedFilesChanged: evidence.cited.filter((entry) => entry.anchorBlob === null || entry.anchorBlob !== entry.liveBlob).map((entry) => entry.file),
    flagFilesAtAnchor: evidence.flagFilesAtAnchor.length,
    flagFilesNow: evidence.flagFilesLive.length,
    flagFilesAdded: evidence.flagFilesLive.filter((file) => !evidence.flagFilesAtAnchor.includes(file)),
    flagFilesRemoved: evidence.flagFilesAtAnchor.filter((file) => !evidence.flagFilesLive.includes(file)),
    challenges: src.reg.challenges.challenges.map((challenge) => ({
      challengeId: challenge.challengeId,
      challengedDefectId: challenge.challengedDefectId,
      frozenDisposition: challenge.frozenRecord.disposition,
      challengePosition: challenge.challengePosition,
      relationToDisposition: 'CHALLENGE_OF_FROZEN_DISPOSITION',
      isAdditionalDefect: false,
      supersedesFrozenDisposition: false,
      statuses: {
        sourceCitedByChallenge: 'SOURCE_VERIFIED',
        flagNotEnforcedInEveryReleasePath: 'PARTIALLY_VERIFIED',
        containment: 'REQUIRES_RUNTIME_PROOF',
      },
      requiredProof: challenge.containment.requiredProof,
      executedProofOnFile: challenge.containment.executedProofOnFile,
    })),
    limitation: 'Row-level-security enforcement for the connecting database role and the deployed flag value cannot be read from the repository.',
  }
}

/** Reads the five per-capita route files and compares table, factory and floors. */
export function verifyPerCapita(src, reader) {
  const defects = src.base.classification.defectRegister
  const medium = defects.find((defect) => defect.id === PER_CAPITA.mediumDefect)
  const high = defects.find((defect) => defect.id === PER_CAPITA.highDefect)
  const cache = new Map()
  const routes = PER_CAPITA.routes.map((route) => {
    const operation = analyseOperation(reader, `${route}|GET`, cache)
    return { route, wrapper: operation.wrapper, table: operation.factory?.table ?? null, orgScoped: operation.factory?.orgScoped ?? null, ownerColumn: operation.factory?.ownerColumn ?? null, readFloor: operation.floor, readRole: operation.role }
  })
  const sameTable = routes.every((route) => route.table === PER_CAPITA.table)
  const sameFloor = unique(routes.map((route) => route.readRole)).length === 1
  const debtIds = new Set(src.reg.debt.items.map((item) => item.sourceId))
  return {
    sharedTable: PER_CAPITA.table,
    routes,
    allRoutesBindSharedTable: sameTable,
    allRoutesShareReadFloor: sameFloor,
    records: [
      { defectId: medium.id, severity: medium.severity, releaseBlocking: medium.releaseBlocking, path: 'healthwelfare/plans', inReleaseDebtIndex: debtIds.has(medium.id) },
      { defectId: high.id, severity: high.severity, releaseBlocking: high.releaseBlocking, paths: ['tax/slips', 'tax/t106', 'tax/rl-1/generate', 'tax/cope/receipts'], inReleaseDebtIndex: debtIds.has(high.id) },
    ],
    finding: sameTable && sameFloor
      ? 'The health-and-welfare path and the four tax paths are separate advertised paths over the same table at the same member read floor. The source shows the same exposure on both. The difference between the MEDIUM and the HIGH rating is therefore not explained by the route source.'
      : 'The five routes do not all bind the same table at the same floor; the shared-exposure reading is not supported.',
    severityChanged: false,
    reratedHere: false,
    carriedGap: debtIds.has(medium.id) ? null : 'The MEDIUM record is not an item of the 150-item index although the route it describes exposes the same ledger at the same floor as the indexed HIGH record. It is cross-referenced here and remains an obligation of its engineering owner; it is not added to the index by this gate.',
    status: sameTable && sameFloor ? 'SOURCE_VERIFIED' : 'PARTIALLY_VERIFIED',
    runtimeStatus: 'REQUIRES_RUNTIME_PROOF',
  }
}

/** Recomputes what the repository shows about carbon accounting and whether any of it reaches the four routes. */
export function verifyCarbon(src, reader) {
  const routeFiles = sorted(unique(src.reg.carbon.operations.map((operation) => `${API_ROOT}/${operation.operationId.split('|')[0]}`)))
  const importsByRoute = routeFiles.map((file) => {
    const text = reader.read(file) ?? ''
    return { file, importsCarbonService: /carbon-accounting-(service|integration)/.test(text), importsAnyServiceOrDatabase: /from\s+['"]@\/(services|db|lib\/db)/.test(text) }
  })
  const importers = src.greps.carbonServiceImports.filter((file) => !CARBON_SERVICE_FILES.includes(file))
  const reachableFromRoutes = importers.filter((file) => routeFiles.includes(file))
  const components = CARBON_SERVICE_FILES.map((file) => {
    const text = reader.read(file)
    return {
      file,
      exists: text !== null,
      recordsEstimateOrCallerEnteredFigures: text !== null && /estimated|mock data|For now|Estimated from|estimate|Required fields:|amount_kg/i.test(text),
      statesMeasured: text !== null && /\bmeasured\b/i.test(text),
    }
  })
  return {
    method: 'The files that name carbon accounting are listed from the repository, each is read for an estimate or measurement statement, and the four route files are read for an import of any carbon component.',
    filesNamingCarbonAccounting: src.greps.carbonNames,
    components,
    routeFiles: importsByRoute,
    filesImportingACarbonService: importers,
    reachableFromTheFourRoutes: reachableFromRoutes,
    supersededStatement: 'No table, service, persona source, register entry or product caller names carbon accounting or Azure emissions monitoring.',
    narrowerSupportedFinding:
      'Sources outside the four route files do name carbon accounting. None of them has been demonstrated to supply measured evidence to the four classified routes: no route file imports a carbon component, and the components record their figures as estimates or caller-entered amounts.',
    narrowerFindingHolds: importsByRoute.every((entry) => !entry.importsCarbonService) && reachableFromRoutes.length === 0,
    notEstablished: [
      'That no measured carbon data source exists anywhere in the platform.',
      'That the backend recording path is outside the released scope.',
      'That a source citation is absent from every register for the four operations.',
    ],
    status: 'PARTIALLY_VERIFIED',
    limitation: 'Absence of an import in the four files shows no source-level link. It does not show that the components are unused at runtime or that no measured feed exists in a deployment.',
  }
}

/** The retention scheduler: what the repository search shows and what it cannot show. */
export function verifyRetentionScheduler(src, reader) {
  const route = `${API_ROOT}/cron/location-retention/route.ts`
  const analysed = analyseOperation(reader, 'cron/location-retention/route.ts|GET', new Map())
  const references = src.greps.retentionRouteReferences.filter((file) => file !== route && !file.endsWith('.test.ts') && !file.includes('__tests__'))
  return {
    defectId: RETENTION_DEFECT,
    route,
    routeDeclaresCronAuth: analysed.role === 'cron',
    referencesToTheRouteOutsideItsOwnFile: references,
    repositorySearchFinding: references.length === 0 ? 'No scheduler configuration in the searched paths names the route.' : 'Files outside the route name it; each needs reading to decide whether it schedules the route.',
    establishes: 'What the searched repository paths contain.',
    doesNotEstablish: [
      'That no retention mechanism exists. A scheduler can be configured in a deployment, a platform console or another repository, none of which is searched.',
      'That location data is or is not deleted in any deployment.',
    ],
    dispositionTreatment: 'REVIEW_REQUIRED stays undecided; the search result is evidence of repository content only.',
    status: 'REQUIRES_RUNTIME_PROOF',
  }
}

export function reviewProvenance() {
  return {
    reviewerRole: REVIEWER_ROLE,
    independence: REVIEW_INDEPENDENCE,
    authorityIndependent: false,
    limitation: REVIEW_LIMITATION,
    method: [
      'Route wrappers and role floors are re-extracted from each route file by a separate extractor that does not read any Gate 0C.3 register.',
      'Each cited quotation is searched in its cited file.',
      'Each affected operation is looked up in the classified inventory and in its route file.',
      'Each proposed disposition is tested against the rubric precondition the Gate 0C.3 register itself states.',
      'Each absence claim is searched for a contradicting token in the cited source.',
      'The 150-item index is rebuilt from the frozen registers and compared.',
    ],
    notDone: ['No test, database, browser, deployment or role-title check was run.', 'No disposition, severity, owner or decision was changed.', 'No authority-independent reviewer has accepted any record.'],
  }
}
