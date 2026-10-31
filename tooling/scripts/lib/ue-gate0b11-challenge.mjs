/**
 * Gate 0B.11 independent challenge of two frozen Gate 0B.10 release dispositions.
 *
 * The challenged defects (DEF-0B10-OPL-01 and DEF-0B10-OPL-07) stay exactly as Gate 0B.10 froze them. This register is
 * additional review evidence: it records, with verbatim source quotations, why a legacy code path is not containment,
 * what the two organization-directory reads expose, which audience the source actually establishes, and the reviewer's
 * provisional position. It does not change a defect, a disposition, a hash or a queue entry, and it claims no
 * remediation. Containment is not recorded as verified because Gate 0B.11 executes no runtime role or policy proof.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defectHash } from './ue-gate0b7-release-dispositions.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const FILE_CHALLENGES = 'docs/union-eyes/convergence/register/ue-release-disposition-challenges.json'
export const CHALLENGE_REGISTER = 'INDEPENDENT_RELEASE_DISPOSITION_CHALLENGES'
export const CHALLENGE_TRANCHE = 'GATE-0B.11'
export const CHALLENGED_TRANCHE = '0B.10'
export const PROVISIONAL_POSITION = 'RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF'
export const CHALLENGE_STATUS = 'AWAITING_CONTAINMENT_PROOF_AND_INSTITUTIONAL_DECISION'
export const CHALLENGE_BLOCKER_KIND = 'INDEPENDENT_REVIEW_CHALLENGE'

const LIST_ROUTE = 'apps/union-eyes/app/api/organizations/route.ts'
const TREE_ROUTE = 'apps/union-eyes/app/api/organizations/tree/route.ts'
const RLS_CONTEXT = 'apps/union-eyes/lib/db/with-rls-context.ts'
const BOOTSTRAP = 'apps/union-eyes/lib/auth/canonical-bootstrap.ts'
const POLICY = 'apps/union-eyes/db/migrations/0108_rls_tenant_isolation_foundation.sql'
const BICEP = 'infrastructure/bicep/ue-v2/modules/apps.bicep'
const E2E = '.github/workflows/e2e.yml'
const RELEASE_PLAN = 'docs/union-eyes/production/UE_RELEASE_PLAN_REFREEZE.md'
const SELECTION = 'apps/union-eyes/lib/auth/canonical-organization-selection.ts'

const ev = (ref, quote) => ({ ref, quote })
const field = (name, ref, quote) => ({ field: name, ref, quote })

const FLAG_NAME = 'UE_CANONICAL_BOOTSTRAP_V2'
const FLAG_EVIDENCE = [
  ev(BOOTSTRAP, "if (flag !== undefined && flag !== '0' && flag !== '1')"),
  ev(BOOTSTRAP, "return flag === '1'"),
]

const RELEASE_CONFIGURATION = {
  summary: 'Nothing in the source excludes the legacy path from a released runtime. The Azure container-app template sets the flag to 1, but that is a deployment parameter and not a code guard: the flag reader accepts an unset flag and 0, no startup check refuses them in production, and the repository CI workflows deliberately run the union-eyes application with the flag at 0.',
  canonicalValueInDeploymentTemplate: ev(BICEP, "{ name: 'UE_CANONICAL_BOOTSTRAP_V2', value: '1' }"),
  legacyValueInRepositoryWorkflows: [ev(E2E, "UE_CANONICAL_BOOTSTRAP_V2: '0'")],
  legacyValueDocumentedAsRuntime: ev(RELEASE_PLAN, '`UE_CANONICAL_BOOTSTRAP_V2=0`, no configured canonical auth database credentials,'),
  flagReaderAcceptsLegacyValues: ev(BOOTSTRAP, "if (flag !== undefined && flag !== '0' && flag !== '1')"),
  startupRefusalOfLegacyValue: 'NOT_FOUND',
  legacyBranchExcludedFromReleasedRuntime: false,
}

const COMMON_REQUIRED_PROOF = [
  'An executed proof, on a database that carries migration 0108, that the role the released DATABASE_URL connects as is subject to the organizations row-level-security policy (the policy is bypassed by a superuser, a table owner and any role with BYPASSRLS, and a policy that is not enabled and forced for the connecting role confines nothing).',
  'An executed proof that a caller of one organization receives no row of another organization from the route in the intended release configuration, including the case of the flag unset and the flag at 0.',
  'Either a code or deployment guard that makes the released runtime refuse to start with the flag unset or 0, or removal of the legacy branch; the deployment template alone is not a guard.',
  'An institutional decision naming which organization fields a signed-in user of another organization may read and the audience that holds that permission, followed by a field projection that returns only those fields.',
]

export const CHALLENGES = [
  {
    id: 'CHALLENGE-0B10-OPL-01',
    challengedDefectId: 'DEF-0B10-OPL-01',
    impactedOperations: ['organizations/route.ts|GET'],
    legacyBranch: {
      description: 'GET /api/organizations has one code path and no canonical branch. It authenticates a session user and reads the organizations table inside withRLSContext. When the flag is 1, withRLSContext switches the transaction to the union_eyes_runtime role; when the flag is unset or 0 the same call only sets the app.current_org_id setting and stays on the connection role, so the legacy mode is the same route with the role switch absent, not a separate handler that can be removed or proven unreachable.',
      featureFlag: { name: FLAG_NAME, legacyValues: ['unset', '0'], canonicalValue: '1', evidence: FLAG_EVIDENCE },
      evidence: [
        ev(LIST_ROUTE, 'const rows = await db.select().from(organizations).where(where);'),
        ev(LIST_ROUTE, 'const mapped = await withRLSContext(async () => {'),
        ev(RLS_CONTEXT, 'await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)'),
        ev(RLS_CONTEXT, "await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`)"),
      ],
    },
    reachabilityInIntendedReleaseConfiguration: RELEASE_CONFIGURATION,
    dataFieldsExposed: [
      field('email', LIST_ROUTE, 'email: row.email,'),
      field('phone', LIST_ROUTE, 'phone: row.phone,'),
      field('website', LIST_ROUTE, 'website: row.website,'),
      field('address', LIST_ROUTE, 'address: row.address,'),
      field('charter_number', LIST_ROUTE, 'charter_number: row.charterNumber,'),
      field('subscription_tier', LIST_ROUTE, 'subscription_tier: row.subscriptionTier,'),
      field('billing_contact_id', LIST_ROUTE, 'billing_contact_id: row.billingContactId,'),
      field('settings', LIST_ROUTE, 'settings: row.settings ?? {},'),
      field('features_enabled', LIST_ROUTE, 'features_enabled: row.featuresEnabled ?? [],'),
      field('member_count', LIST_ROUTE, 'member_count: row.memberCount,'),
      field('created_by', LIST_ROUTE, 'created_by: row.createdBy,'),
      field('legacy_org_id', LIST_ROUTE, 'legacy_org_id: row.legacyOrgId,'),
      field('activeClaims', LIST_ROUTE, 'activeClaims: claimsByOrg[row.id] ?? 0,'),
    ],
    scopeActuallyEnforced: {
      routeLevelOrganizationPredicate: 'NONE: the only filters are the optional parent and status query parameters, both caller supplied.',
      routeLevelHierarchyPredicate: 'NONE: the parent query parameter selects the children of any organization id the caller names; no ancestor or descendant relation to the caller organization is tested.',
      confinementDependsOn: 'The database role of the connection and the 0108 organizations policy (a tenant sees only its own organization row) in the canonical mode; in the legacy mode only the role of the connection.',
      evidence: [
        ev(LIST_ROUTE, 'if (parentId) conditions.push(eq(organizations.parentId, parentId));'),
        ev(POLICY, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
      ],
    },
    existingAuthenticatedAudience: {
      audience: 'Any caller holding a session user id: no role floor, no membership test and no mandate.',
      evidence: [ev(LIST_ROUTE, "if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });")],
    },
    requiredAudience: {
      statement: 'The source does not establish an audience for another organization record. Cross-organization visibility can be legitimate only if an adopted decision names the audience and the permitted fields; until it does, the required audience is the caller own organization and the permitted fields are the operational minimum.',
      decisionIds: ['UE-INST-ORGANIZATION-RECORD-AUTHORITY', 'UE-INST-FEDERATION-AFFILIATE-DATA-SHARING'],
      sourceEstablishesAudienceAndFields: false,
    },
    containment: {
      verified: false,
      executedProof: [],
      claimedMechanisms: [
        'withRLSContext switches to union_eyes_runtime when the flag is 1.',
        'Migration 0108 restricts a tenant to its own organization row.',
      ],
      whyTheClaimedMechanismsAreNotContainment: [
        'The role switch is conditional on a deployment flag the code accepts unset or 0.',
        'The policy confines only a connection role that is subject to row-level security; no executed proof on file shows the released role is.',
        'A legacy path that exists is reachable by definition until it is removed or the runtime refuses to start with it.',
      ],
      requiredProof: COMMON_REQUIRED_PROOF,
    },
    reviewerPosition: PROVISIONAL_POSITION,
    status: CHALLENGE_STATUS,
    blocksGate: 14,
    modifiesFrozenDefect: false,
    remediationClaimed: false,
  },
  {
    id: 'CHALLENGE-0B10-OPL-07',
    challengedDefectId: 'DEF-0B10-OPL-07',
    impactedOperations: ['organizations/tree/route.ts|GET'],
    legacyBranch: {
      description: 'GET /api/organizations/tree has an explicit legacy branch selected by the flag: with the flag at 1 it returns the active organizations of the private memberships of the caller; with the flag unset or 0 it authenticates a session user and returns every organization row through the shared db client, with no withRLSContext, no membership test and no limit. The route comment states the flag-off behavior as intended: it retains the legacy flat organization list.',
      featureFlag: { name: FLAG_NAME, legacyValues: ['unset', '0'], canonicalValue: '1', evidence: FLAG_EVIDENCE },
      evidence: [
        ev(TREE_ROUTE, 'if (currentStateContextEnabled()) {'),
        ev(TREE_ROUTE, 'return NextResponse.json(await getCanonicalOrganizationTree())'),
        ev(TREE_ROUTE, ' * Flag-off retains the legacy flat organization list.'),
        ev(TREE_ROUTE, '.from(organizations)'),
        ev(SELECTION, "eq(organizations.status, 'active'),"),
      ],
    },
    reachabilityInIntendedReleaseConfiguration: RELEASE_CONFIGURATION,
    dataFieldsExposed: [
      field('id', TREE_ROUTE, 'id: o.id,'),
      field('name', TREE_ROUTE, 'name: o.name,'),
      field('slug', TREE_ROUTE, 'slug: o.slug,'),
      field('organization_type', TREE_ROUTE, "organization_type: o.organizationType ?? 'union',"),
      field('parentId', TREE_ROUTE, 'parentId: o.parentId ?? null,'),
      field('sector', TREE_ROUTE, 'sector: (o.sectors ?? [])[0] ?? null,'),
      field('jurisdiction', TREE_ROUTE, 'jurisdiction: o.provinceTerritory ?? null,'),
      field('description', TREE_ROUTE, 'description: o.description ?? null,'),
      field('hierarchyLevel', TREE_ROUTE, 'hierarchyLevel: o.hierarchyLevel ?? 0,'),
      field('memberCount', TREE_ROUTE, 'memberCount: o.memberCount ?? 0,'),
      field('status', TREE_ROUTE, "status: o.status ?? 'active',"),
      field('createdAt', TREE_ROUTE, 'createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),'),
    ],
    scopeActuallyEnforced: {
      routeLevelOrganizationPredicate: 'NONE in the legacy branch: the select has no where clause, no limit and no filter on type or status, so platform, archived, suspended and inactive organizations are included. The canonical branch lists only the active organizations of the private memberships of the caller.',
      routeLevelHierarchyPredicate: 'NONE in the legacy branch: the whole parent and child hierarchy is returned; the hierarchy relation between organizations is treated as visibility and authorizes nothing.',
      confinementDependsOn: 'The row-level-security role of the shared db client, with no organization context set; a confined connection with no organization context would return an empty tree for every caller, which is a different defect and not containment.',
      evidence: [
        ev(TREE_ROUTE, '.orderBy(asc(organizations.hierarchyLevel), asc(organizations.name));'),
        ev(POLICY, "SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row"),
      ],
    },
    existingAuthenticatedAudience: {
      audience: 'Any caller holding a session user id in the legacy branch: no role floor, no membership test and no mandate.',
      evidence: [ev(TREE_ROUTE, 'const { userId } = await auth();'), ev(TREE_ROUTE, 'if (!userId) {')],
    },
    requiredAudience: {
      statement: 'The source does not establish that a signed-in user may see the identity, size, jurisdiction, description and parent affiliation of organizations they do not belong to. The canonical branch shows the intended boundary (own memberships); an organization directory open to every signed-in user is legitimate only if an adopted decision declares it a public directory and names its fields.',
      decisionIds: ['UE-INST-ORGANIZATION-RECORD-AUTHORITY', 'UE-INST-FEDERATION-AFFILIATE-DATA-SHARING', 'UE-INST-ONBOARDING-CROSS-ORGANIZATION-DISCLOSURE'],
      sourceEstablishesAudienceAndFields: false,
    },
    containment: {
      verified: false,
      executedProof: [],
      claimedMechanisms: [
        'The canonical branch is membership scoped when the flag is 1.',
        'Migration 0108 restricts a tenant to its own organization row.',
      ],
      whyTheClaimedMechanismsAreNotContainment: [
        'The legacy branch is selected by a flag the code accepts unset or 0, and the repository CI runs the application at 0.',
        'The legacy branch sets no organization context at all, so the policy has no tenant identity to confine the read to.',
        'A legacy path that exists is reachable by definition until it is removed or the runtime refuses to start with it.',
      ],
      requiredProof: COMMON_REQUIRED_PROOF,
    },
    reviewerPosition: PROVISIONAL_POSITION,
    status: CHALLENGE_STATUS,
    blocksGate: 14,
    modifiesFrozenDefect: false,
    remediationClaimed: false,
  },
]

const frozenDefectOf = (classification, id) => (classification?.defectRegister ?? []).find((defect) => defect.id === id)

export function buildChallengeRegister({ classification0b10, anchorCommit }) {
  return {
    schemaVersion: 1,
    register: CHALLENGE_REGISTER,
    tranche: CHALLENGE_TRANCHE,
    anchorCommit,
    note: 'Independent reviewer challenge of the Gate 0B.10 dispositions of DEF-0B10-OPL-01 and DEF-0B10-OPL-07. It is additional review evidence: no frozen defect, disposition, hash or review queue entry is changed, no remediation is claimed, and containment is recorded as not verified because Gate 0B.11 executes no runtime role or row-level-security proof. A challenge stays open until executed containment proof and the named institutional decisions are on file.',
    provisionalPositions: [PROVISIONAL_POSITION],
    challenges: CHALLENGES.map((challenge) => {
      const defect = frozenDefectOf(classification0b10, challenge.challengedDefectId)
      return {
        ...challenge,
        challengedDefectSha256: defect ? defectHash(defect) : null,
        frozenDisposition: defect?.releaseDisposition?.disposition ?? null,
        frozenReleaseBlocking: defect?.releaseBlocking ?? null,
        challengedTranche: CHALLENGED_TRANCHE,
      }
    }),
  }
}

const quoteProblems = (label, item, readText, exists) => {
  const out = []
  if (!item || typeof item.ref !== 'string' || typeof item.quote !== 'string' || item.quote.length === 0) {
    return [`${label} needs a ref and a non-empty quote`]
  }
  if (!exists(item.ref)) return [`${label} cites ${item.ref}, which does not exist`]
  if (!readText(item.ref).includes(item.quote)) out.push(`${label} quotes text that is not in ${item.ref}: ${JSON.stringify(item.quote.slice(0, 80))}`)
  return out
}

/**
 * Validates the challenge register against the frozen Gate 0B.10 classification. `classification0b11` is the cumulative
 * register that carries every earlier defect forward; when it is supplied the challenged defects must be unchanged there.
 */
export function validateChallengeRegister({ register, classification0b10, classification0b11, readText, exists }) {
  const problems = []
  if (!register || register.register !== CHALLENGE_REGISTER || register.tranche !== CHALLENGE_TRANCHE) {
    return ['release disposition challenge register is missing or is not the Gate 0B.11 challenge register']
  }
  if (!Array.isArray(register.challenges)) return ['release disposition challenge register has no challenges array']
  const required = new Set(CHALLENGES.map((challenge) => challenge.challengedDefectId))
  const seen = new Set()
  const decisions = new Map((classification0b10?.institutionalDecisions ?? []).map((decision) => [decision.id, decision]))

  for (const challenge of register.challenges) {
    const label = `challenge ${challenge.id ?? '(no id)'}`
    if (seen.has(challenge.challengedDefectId)) problems.push(`${label} duplicates the challenge of ${challenge.challengedDefectId}`)
    seen.add(challenge.challengedDefectId)

    const defect = frozenDefectOf(classification0b10, challenge.challengedDefectId)
    if (!defect) {
      problems.push(`${label} challenges ${challenge.challengedDefectId}, which is not in the frozen Gate 0B.10 classification`)
      continue
    }
    if (defect.tranche !== CHALLENGED_TRANCHE) problems.push(`${label} challenges a defect of tranche ${defect.tranche}; only Gate 0B.10 dispositions are challenged here`)
    if (challenge.challengedDefectSha256 !== defectHash(defect)) problems.push(`${label} records a hash that does not match the frozen defect ${defect.id}; the challenge cannot refer to an altered defect`)
    if (challenge.frozenDisposition !== defect.releaseDisposition?.disposition) problems.push(`${label} misstates the frozen disposition of ${defect.id}`)
    if (challenge.frozenReleaseBlocking !== defect.releaseBlocking) problems.push(`${label} misstates the frozen releaseBlocking mark of ${defect.id}`)
    if (challenge.modifiesFrozenDefect !== false) problems.push(`${label} must state modifiesFrozenDefect false; a challenge never mutates a frozen defect`)
    if (challenge.remediationClaimed !== false) problems.push(`${label} must state remediationClaimed false; a challenge is not a remediation`)
    if (challenge.reviewerPosition !== PROVISIONAL_POSITION) problems.push(`${label} reviewer position must be ${PROVISIONAL_POSITION}`)
    if (challenge.status !== CHALLENGE_STATUS) problems.push(`${label} status must be ${CHALLENGE_STATUS}`)

    if (classification0b11) {
      const carried = frozenDefectOf(classification0b11, challenge.challengedDefectId)
      if (!carried || defectHash(carried) !== defectHash(defect)) problems.push(`${label}: the cumulative register no longer carries ${defect.id} unchanged`)
    }

    const citing = (classification0b10?.operations ?? []).filter((operation) => (operation.defects ?? []).includes(defect.id)).map((operation) => operation.id).sort()
    const impacted = [...(challenge.impactedOperations ?? [])].sort()
    if (JSON.stringify(citing) !== JSON.stringify(impacted)) {
      problems.push(`${label} impacted operations ${JSON.stringify(impacted)} are not exactly the operations that cite ${defect.id} ${JSON.stringify(citing)}`)
    }

    const legacy = challenge.legacyBranch
    if (!legacy || typeof legacy.description !== 'string' || legacy.featureFlag?.name !== FLAG_NAME) problems.push(`${label} must describe the legacy branch and name the flag ${FLAG_NAME}`)
    for (const item of [...(legacy?.featureFlag?.evidence ?? []), ...(legacy?.evidence ?? [])]) problems.push(...quoteProblems(`${label} legacy branch evidence`, item, readText, exists))
    if (!(legacy?.evidence ?? []).length) problems.push(`${label} legacy branch records no source evidence`)

    const reach = challenge.reachabilityInIntendedReleaseConfiguration
    if (!reach || reach.legacyBranchExcludedFromReleasedRuntime !== false) {
      problems.push(`${label} may not state that the legacy branch is excluded from the released runtime: no source guard excludes it`)
    }
    for (const item of [reach?.canonicalValueInDeploymentTemplate, reach?.legacyValueDocumentedAsRuntime, reach?.flagReaderAcceptsLegacyValues, ...(reach?.legacyValueInRepositoryWorkflows ?? [])]) {
      problems.push(...quoteProblems(`${label} release configuration evidence`, item, readText, exists))
    }

    if (!Array.isArray(challenge.dataFieldsExposed) || challenge.dataFieldsExposed.length === 0) problems.push(`${label} must list the data fields exposed`)
    for (const item of challenge.dataFieldsExposed ?? []) {
      if (typeof item.field !== 'string' || item.field.length === 0) problems.push(`${label} has a data field with no name`)
      problems.push(...quoteProblems(`${label} data field ${item.field}`, item, readText, exists))
    }

    const scope = challenge.scopeActuallyEnforced
    if (!scope || !scope.routeLevelOrganizationPredicate || !scope.routeLevelHierarchyPredicate || !scope.confinementDependsOn) problems.push(`${label} must state the organization and hierarchy scope actually enforced`)
    for (const item of scope?.evidence ?? []) problems.push(...quoteProblems(`${label} scope evidence`, item, readText, exists))

    const audience = challenge.existingAuthenticatedAudience
    if (!audience || typeof audience.audience !== 'string') problems.push(`${label} must record the existing authenticated audience`)
    for (const item of audience?.evidence ?? []) problems.push(...quoteProblems(`${label} audience evidence`, item, readText, exists))

    const required$ = challenge.requiredAudience
    if (!required$ || typeof required$.statement !== 'string') problems.push(`${label} must record the required audience`)
    if (required$?.sourceEstablishesAudienceAndFields !== false) problems.push(`${label} may not state that source establishes the audience and permitted fields; no adopted decision does`)
    if (!(required$?.decisionIds ?? []).length) problems.push(`${label} must name the institutional decisions that would establish the audience`)
    for (const id of required$?.decisionIds ?? []) {
      const decision = decisions.get(id)
      if (!decision) problems.push(`${label} names the decision ${id}, which is not in the Gate 0B.10 register`)
      else if (decision.status !== 'OUTSTANDING') problems.push(`${label} relies on ${id} as ${decision.status}; a challenge cannot adopt a decision, only an authorized adoption can`)
    }

    const containment = challenge.containment
    if (!containment) problems.push(`${label} must record containment`)
    else {
      if (containment.verified !== false || (containment.executedProof ?? []).length > 0) {
        problems.push(`${label} records containment as verified; Gate 0B.11 executes no runtime role or policy proof, so verified containment cannot be recorded`)
      }
      if (!(containment.requiredProof ?? []).length) problems.push(`${label} must state the proof that would establish containment`)
      if (!(containment.whyTheClaimedMechanismsAreNotContainment ?? []).length) problems.push(`${label} must state why the claimed mechanisms are not containment`)
    }
  }
  for (const id of required) if (!seen.has(id)) problems.push(`the challenge register has no challenge of ${id}`)
  if (JSON.stringify(register.provisionalPositions) !== JSON.stringify([PROVISIONAL_POSITION])) problems.push('the challenge register may permit only the provisional position RELEASE_BLOCKING_PENDING_CONTAINMENT_PROOF')
  return problems
}

export const challengeBlockers = (register) => (register?.challenges ?? []).map((challenge) => ({
  capabilityId: 'UE-OMIT-ORGANIZATION-ADMINISTRATION',
  id: challenge.id,
  kind: CHALLENGE_BLOCKER_KIND,
  file: challenge.challengedDefectId,
  blocksGates: [challenge.blocksGate],
  releaseBlocking: true,
}))

export const challengeRegisterHash = (register) => createHash('sha256').update(JSON.stringify(register)).digest('hex')

export function writeChallengeRegister({ root = ROOT, anchorCommit } = {}) {
  const classification0b10 = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-route-classification-0b10.json'), 'utf8'))
  const classification0b11 = JSON.parse(readFileSync(join(root, 'docs/union-eyes/convergence/register/ue-route-classification-0b11.json'), 'utf8'))
  const register = buildChallengeRegister({ classification0b10, anchorCommit })
  const problems = validateChallengeRegister({
    register,
    classification0b10,
    classification0b11,
    readText: (file) => readFileSync(join(root, file), 'utf8'),
    exists: (file) => existsSync(join(root, file)),
  })
  if (problems.length > 0) throw new Error(`Gate 0B.11 challenge register has ${problems.length} problem(s):\n${problems.join('\n')}`)
  writeFileSync(join(root, FILE_CHALLENGES), `${JSON.stringify(register, null, 2)}\n`)
  return register
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ANCHOR_COMMIT } = await import('./ue-gate0b11-ids.mjs')
  const register = writeChallengeRegister({ anchorCommit: ANCHOR_COMMIT })
  console.log(`wrote ${register.challenges.length} challenges to ${FILE_CHALLENGES}`)
}
