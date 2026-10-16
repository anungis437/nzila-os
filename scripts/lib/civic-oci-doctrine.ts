import { existsSync, readFileSync, readdirSync, statSync, lstatSync, type Stats } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, extname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

export const CIVIC_OCI_CONTRACT_PATH = 'governance/foundations/civic-oci-doctrine.contract.json'
export const CIVIC_SLICE1_REVIEW_PACKET =
  'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_AUTHORIZATION_PACKET.md'
export const CIVIC_SLICE2_REVIEW_PACKET =
  'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_AUTHORIZATION_PACKET.md'
export const CIVIC_HUMAN_VALIDATION_PLAN =
  'docs/public-service/operations/CIVIC_CONTROLLED_HUMAN_VALIDATION_PLAN.md'
const HUMAN_VALIDATION_PLAN_SHA256 =
  'ee65c0a785db2201064189f011b5b8703d00413bd9a7433cd4e6c2bb0f005bc0'
export const CIVIC_HUMAN_ROUND1_AUTHORIZATION =
  'docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_1_AUTHORIZATION.md'
export const CIVIC_HUMAN_ROUND1_MATERIALS =
  'docs/public-service/operations/CIVIC_HUMAN_VALIDATION_ROUND_1_MATERIALS.md'
const ROUND1_DOCUMENT_FINGERPRINTS = {
  [CIVIC_HUMAN_ROUND1_AUTHORIZATION]: {
    sha256: '370b4d25f067889ad77d88f88e75077f8ec489e8cf22c68eadfe2142f428140c',
  },
  [CIVIC_HUMAN_ROUND1_MATERIALS]: {
    sha256: '35cfab75645624659f6eb18d2696743a4883a6f344f4888dd4b39882758129d0',
  },
} as const
const ROUND1_AMENDMENT_HEADING = '## Round 1 evidence governance and plan reconciliation\n'
export const CIVIC_HUMAN_ROUND1_APPROVAL = {
  status: 'AUTHORIZED_WITH_CONDITIONS',
  effectiveAt: '2026-10-12T23:59:13.9553409+00:00',
  expiresAt: '2026-11-11T23:59:13.9553409+00:00',
  maximumSessions: 6,
  facilitator: 'Aubert Nungisa',
  custodian: 'Aubert Nungisa',
  accessModel: 'CUSTODIAN_ONLY',
  evidenceDirectory:
    'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-research\\round1',
  classification: 'CONTROLLED_HUMAN_VALIDATION_RESEARCH_EVIDENCE',
  scenarioBoundary: 'SYNTHETIC_SCENARIO_ONLY',
  recordingDefault: 'NO_AUDIO_VIDEO_RECORDING',
  retention: '90_DAYS_AFTER_ROUND_1_CLOSEOUT',
  retentionReview: 'HUMAN_ACTION_REQUIRED',
  withdrawal: 'STOP_USE_DELETE_OR_ISOLATE_BEFORE_FINAL_SYNTHESIS',
  runtimeAuthorized: false,
  productionAuthorized: false,
  realInstitutionalDataAuthorized: false,
  automaticRenewal: false,
  outboundMessagesAutonomous: false,
  participantSetRequiresMaintainerApproval: true,
  revokedAt: null,
} as const
const ROUND1_CODES = ['R1-D-01', 'R1-D-02', 'R1-R-01', 'R1-R-02', 'R1-T-01', 'R1-T-02']
const ROUND1_RESEARCH_DIRS = ['administration', 'sessions', 'observations', 'synthesis', 'consent']
const HUMAN_VALIDATION_AMENDMENT_HEADING =
  '## Human validation plan documentation-only archival gate amendment\n'
const RETAINED_EVIDENCE_INVENTORIES = {
  '.civic-runtime/slice1/checkpoints/retained-inventory.json':
    'd46a3f5b8d728f21776171e2b0123c5ac8f57afd41ce0f909dcdada935805da9',
  '.civic-runtime/slice2/final-retained-manifest.json':
    '6337a66bf7e23234716f4833fdf63f6b8dd43d6a279a42e7a450a25d711fb0c8',
  '.civic-runtime/slice2/final-source-inventory.json':
    '1baeb6dc8fa890e58770799b03a77195eaf96950626bf759d8a920f36300ccd3',
} as const
export const CIVIC_SLICE2_RECORDED_DECISION = [
  '**Decision:** `AUTHORIZE_WITH_CONDITIONS`',
  '**Maintainer:** Aubert Nungisa',
  '**Decision date:** 2026-10-12',
  '**Conditions:** Activation and bounded technical-hardening proof; `SLICE_2_DATA_BOUNDARY = SYNTHETIC_ONLY`; local-only; non-production; no deployment; no general runtime; Slice 0/1 remain terminated; no Slice 3; no controlled human-operator validation.',
  '**Authorized starting SHA:** `1c337567635bb86ea0df7831557d8d2d22df1e6f`',
  '**Authorized branch/worktree:** `civic/three-reality-hardening` / `C:\\APPS\\nzila-os.worktrees\\pasted-text-processing`',
  '**Effective:** `2026-10-12T14:38:49.5329498+00:00`',
  '**Expires:** `2026-10-19T14:38:49.5329498+00:00`',
  '**Storage locations:** `C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice2`',
  '**Checkpoint directory:** `C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice2\\checkpoints`',
  '**Adversarial copies:** `C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice2\\adversarial-copies`',
  '**Integrity-anchor custody/location:** Aubert Nungisa / `C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-anchor\\slice2`',
  '**Integrity-anchor custodian:** Aubert Nungisa',
  '**Proof owner:** Aubert Nungisa',
].join('\n\n')

const ARCHIVAL_AUTHORITY = 'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md'
const ARCHIVAL_DECISION = [
  '**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`',
  '**Maintainer:** Aubert Nungisa',
  '**Decision date:** 2026-10-10',
  `**Exact review path:** \`${CIVIC_SLICE1_REVIEW_PACKET}\``,
  '**Runtime execution:** `NOT_AUTHORIZED`',
]
const SLICE0_ARCHIVED_FILES: Readonly<Record<string, string>> = {
  'apps/civic/.env.example': '2a181f4d729c4d28782612aec73ee8941c4f3de62d5567b4ef8e0fba8c8466a9',
  'apps/civic/control-manifest.json':
    '0abba7656739f424e49628c0f808400a429005419230b9ebafbb5bd531f790bb',
  'apps/civic/maturity.json': '80f8d4522caa8cedac60342e9861af803eeb27223a76ac99537c1cd20aad2c67',
  'apps/civic/package.json': '7e73302cf427d94228fb692488aca20058ecfaa8a2f942a64da0cea84c4ee098',
  'apps/civic/tsconfig.json': '4921795c0a94b224a77cd7fd859b05af6c15085b685f884a32bde293eeb1a4bc',
  'apps/civic/vitest.config.ts': 'f59ec65696896bd1a0da502ac99729bbafa287ff502fdea39730219ebb178f71',
  'apps/civic/src/authorization.ts':
    '7721dda976c84d43fde64a62b8d43bdd9bfb82c65b774a714e049b855efe0095',
  'apps/civic/src/kernel.ts': '985ef3cb8c6dae693510ae8e4c14e1cbd8749a52bde62735c31b0d5ce1be0456',
  'apps/civic/src/proof.ts': '909f1b565afa8209d1d4d000a8b09fee12bf1bf0f20144964e78bc62c1e4b8fa',
  'apps/civic/src/scenario.ts': '601d59b7441d16a835195e07fa4858c94d32fd7acaa030ec8da67e6a453d6007',
  'apps/civic/tests/slice0.test.ts':
    '9034a038a5671c90bd069e81773e069b2bd6720c384e36948339a898bafa5776',
}
const SLICE1_ARCHIVED_FILES: Readonly<Record<string, string>> = {
  'apps/civic/src/slice1/authorization.ts':
    '49858632d8298a83cdc21f0334455d8bccbf4555ec00e3838e4cfbe5b9312e79',
  'apps/civic/src/slice1/model.ts':
    '0b7107c64889bf03e24f6eeccff2d5ba1b468375cc0cf6850bc1a16ccc4d5ee3',
  'apps/civic/src/slice1/scenario.ts':
    '6fc375c3e2f8976c3a20303b94bce492f9ce19421e2af0ac003b95c4fe4bdb5a',
  'apps/civic/src/slice1/store.ts':
    'c86b76b3c510d90db168a56d2d962a0dcf615ad95fe2046d7c5b18f348739063',
  'apps/civic/src/slice1/worker.ts':
    'd3e86bc70562792bd95bfc48d8914478da43e7c6359b05b82df3f754768caf71',
  'apps/civic/tests/slice1/boundaries.test.ts':
    '4219b57c7bf50a1bde291bb396139038b10bd2ee7aebcbc09bd5b3bd6db418e3',
  'apps/civic/tests/slice1/continuity.test.ts':
    '140910dbd4180639dc193ff0e4f22da76522ce8d3719b22b226d8a8c60846048',
  'apps/civic/slice1.tsconfig.json':
    'dad4da6e543ef66b9e8846d30d77be9a48e3ac33408761cf5a624567b747300f',
  'apps/civic/slice1.vitest.config.ts':
    'd0c7b03adb7b3015a7540c59773f50aa8627cc942266e5429a5c2c9b9c97a453',
}
const SLICE2_ARCHIVED_FILES: Readonly<Record<string, string>> = {
  'apps/civic/slice2.tsconfig.json':
    'f081bdf7320d17acdaf3e2c98074b4744cf29325ac53124e9bceee6115dd99d8',
  'apps/civic/slice2.vitest.config.ts':
    'a76113a180b01b4c2bfcd27d783d945382ac5a890dc3adfde35882183d5d7f94',
  'apps/civic/src/slice2/anchor.ts':
    'b60a53559b0dd2b56f34432b3f4e2048bda262b4b07ba5a1d1e0ab06a5d1276f',
  'apps/civic/src/slice2/authorization.ts':
    'de0795500643ab5ba3539fab82cf2fcc5a3a1ec7cc462683d6c62e0fa52e3c6c',
  'apps/civic/src/slice2/harness.ts':
    'baa9a0a681e7cc0308c419ac8d6d558cf7a4b5fa06a4a1e905ce8a753b53e304',
  'apps/civic/src/slice2/store.ts':
    'b6f59fbcb237610d5b4da03f47ccbe34a9eaee1d537f6f7d512fd3de5d4d5da3',
  'apps/civic/src/slice2/worker.ts':
    'be9698490c68dba465c6d348631169d496d9c19d877681f651ba5132b4f71902',
  'apps/civic/tests/slice2/boundary.test.ts':
    '5ee3279c4776624755f8cdb93b0f6e4572ac56c8c21fc89801a6429b91495ba1',
  'apps/civic/tests/slice2/grant-lifecycle.test.ts':
    '71259723bae8cc3751d955bdbc0904be2db82aced08d7ad29f7ca4c0f83199a3',
  'apps/civic/tests/slice2/hardening.test.ts':
    '32953836c8469794f0ec17077fe22f66601cea7e33ce596ebdc136c82500ec80',
  'apps/civic/tests/slice2/performance.test.ts':
    '0d3961e1a741ad3b32604adcfc6d907923210d1bbbcddab14c415108de559a88',
}

export interface DoctrineFinding {
  id: string
  artifact: string
  authority: string
  expected: string
  observed: string
}

interface DoctrineContract {
  schemaVersion: number
  identity: {
    canonicalMethod: string
    civicRole: string
    clearRole: string
    ocraRole: string
    authority: string[]
    rationale: string
  }
  methodStructure: {
    codeAuthority: string
    documentAuthority: string
    rationale: string
  }
  humanAuthority: {
    humanReviewAuthoritative: boolean
    institutionalAdoptionRequired: boolean
    autonomousInstitutionalDecisioningPermitted: boolean
    unreviewedAiMayBecomeInstitutionalOutput: boolean
    authority: string[]
    rationale: string
  }
  aiBoundary: {
    permitted: string[]
    prohibited: string[]
    authority: string[]
    rationale: string
  }
  antiSurveillance: {
    prohibited: string[]
    crossInstitutionAggregation: {
      optIn: boolean
      revocable: boolean
      minimumContributors: number
      ranked: boolean
    }
    authority: string[]
    rationale: string
  }
  frontDoor: {
    portfolioAuthority: string
    productId: string
    firstTouchSurfaces: string[]
    rationale: string
  }
  runtimeAuthorization: {
    authorized: boolean
    applicationRoot: string
    authority: string[]
    rationale: string
    slice0?: unknown
    slice1?: unknown
    slice2?: unknown
  }
  historicalScope: {
    excluded: string[]
    authority: string[]
    rationale: string
  }
}

interface PortfolioProduct {
  id: string
  gtm_posture?: string
  proof_level?: string
  customers?: number
  pilots?: number
}

const EXPECTED_IDENTITY = {
  canonicalMethod: 'OCI',
  civicRole: 'public-service-front-door',
  clearRole: 'public-service-articulation-of-oci-evidence-discipline',
  ocraRole: 'recognition-phase-instrument-within-oci',
}

const EXPECTED_HUMAN_AUTHORITY = {
  humanReviewAuthoritative: true,
  institutionalAdoptionRequired: true,
  autonomousInstitutionalDecisioningPermitted: false,
  unreviewedAiMayBecomeInstitutionalOutput: false,
}

const EXPECTED_AI_PERMITTED = ['classification', 'drafting', 'synthesis']
const EXPECTED_AI_PROHIBITED = [
  'authoritative-ai-findings',
  'autonomous-institutional-decisioning',
  'behavioural-inference',
  'individual-performance-scoring',
  'member-or-employee-profiling',
  'predictive-modelling-of-individuals',
]
const EXPECTED_SURVEILLANCE_PROHIBITED = [
  'behavioural-profiling',
  'individual-ranking',
  'institutional-leaderboards',
  'non-consensual-inference',
]

const REQUIRED_ANCHORS: Array<{
  id: string
  artifact: string
  authority: string
  text: string
}> = [
  {
    id: 'CIVIC_METHOD_AUTHORITY_DRIFT',
    artifact: 'docs/CIVIC_OCI_ALIGNMENT.md',
    authority: 'governance/foundations/civic-oci-doctrine.contract.json#identity',
    text: 'CIVIC is the public-service front door for OCI.',
  },
  {
    id: 'CIVIC_METHOD_AUTHORITY_DRIFT',
    artifact: 'docs/public-service/civic-thesis.md',
    authority: 'docs/CIVIC_OCI_ALIGNMENT.md',
    text: 'CIVIC is the **public-service front door for the OCI methodology**',
  },
  {
    id: 'CIVIC_METHOD_AUTHORITY_DRIFT',
    artifact: 'docs/public-service/clear-method-canonical.md',
    authority: 'docs/CIVIC_OCI_ALIGNMENT.md',
    text: 'CLEAR is the **public-service articulation of the OCI evidence',
  },
  {
    id: 'CIVIC_METHOD_AUTHORITY_DRIFT',
    artifact: 'docs/oci/OCI_METHOD.md',
    authority: 'docs/oci/CANON.md',
    text: 'OCRA is **Product 1** of OCI',
  },
  {
    id: 'CIVIC_HUMAN_AUTHORITY_DRIFT',
    artifact: 'docs/public-service/human-review-and-evidence-principles.md',
    authority: 'governance/foundations/civic-oci-doctrine.contract.json#humanAuthority',
    text: 'human review remains authoritative',
  },
  {
    id: 'CIVIC_HUMAN_AUTHORITY_DRIFT',
    artifact: 'docs/oci/OCI_AI_BOUNDARY.md',
    authority: 'governance/foundations/civic-oci-doctrine.contract.json#humanAuthority',
    text: "The facilitator's review is the authoritative event.",
  },
  {
    id: 'CIVIC_AI_BOUNDARY_DRIFT',
    artifact: 'docs/oci/OCI_AI_BOUNDARY.md',
    authority: 'governance/foundations/civic-oci-doctrine.contract.json#aiBoundary',
    text: 'There is no autonomous decisioning.',
  },
  {
    id: 'CIVIC_AI_BOUNDARY_DRIFT',
    artifact: 'docs/oci/OCI_AI_BOUNDARY.md',
    authority: 'governance/foundations/civic-oci-doctrine.contract.json#aiBoundary',
    text: 'Member or employee profiling.',
  },
  {
    id: 'CIVIC_ANTI_SURVEILLANCE_DRIFT',
    artifact: 'docs/oci/OCI_METHOD.md',
    authority: 'governance/foundations/civic-oci-doctrine.contract.json#antiSurveillance',
    text: 'No individual scores, no behavioural inference, no ranked institutional comparisons.',
  },
]

const RUNTIME_DIRECTORIES = new Set([
  'api',
  'app',
  'components',
  'drizzle',
  'lib',
  'migrations',
  'pages',
  'prisma',
  'public',
  'server',
  'src',
])
const RUNTIME_EXTENSIONS = new Set([
  '.cjs',
  '.go',
  '.js',
  '.jsx',
  '.mjs',
  '.py',
  '.rs',
  '.sql',
  '.ts',
  '.tsx',
])
const RUNTIME_CONFIG =
  /^(dockerfile|next\.config\.|nuxt\.config\.|svelte\.config\.|vite\.config\.|wrangler\.|azure\.yaml|vercel\.json|fly\.toml|drizzle\.config\.)/i
const RUNTIME_SCRIPTS = new Set(['build', 'db:migrate', 'deploy', 'dev', 'serve', 'start'])

function readText(root: string, artifact: string): string | null {
  const path = join(root, artifact)
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...value].sort())
  if (value && typeof value === 'object') {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
  }
  return JSON.stringify(value)
}

function valueAt(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, value)
}

function hasContractShape(value: unknown): boolean {
  const stringFields = [
    'identity.canonicalMethod',
    'identity.civicRole',
    'identity.clearRole',
    'identity.ocraRole',
    'identity.rationale',
    'methodStructure.codeAuthority',
    'methodStructure.documentAuthority',
    'methodStructure.rationale',
    'humanAuthority.rationale',
    'aiBoundary.rationale',
    'antiSurveillance.rationale',
    'frontDoor.portfolioAuthority',
    'frontDoor.productId',
    'frontDoor.rationale',
    'runtimeAuthorization.applicationRoot',
    'runtimeAuthorization.rationale',
    'historicalScope.rationale',
  ]
  const stringArrayFields = [
    'identity.authority',
    'humanAuthority.authority',
    'aiBoundary.permitted',
    'aiBoundary.prohibited',
    'aiBoundary.authority',
    'antiSurveillance.prohibited',
    'antiSurveillance.authority',
    'frontDoor.firstTouchSurfaces',
    'runtimeAuthorization.authority',
    'historicalScope.excluded',
    'historicalScope.authority',
  ]
  const booleanFields = [
    'humanAuthority.humanReviewAuthoritative',
    'humanAuthority.institutionalAdoptionRequired',
    'humanAuthority.autonomousInstitutionalDecisioningPermitted',
    'humanAuthority.unreviewedAiMayBecomeInstitutionalOutput',
    'antiSurveillance.crossInstitutionAggregation.optIn',
    'antiSurveillance.crossInstitutionAggregation.revocable',
    'antiSurveillance.crossInstitutionAggregation.ranked',
    'runtimeAuthorization.authorized',
  ]

  return (
    stringFields.every((path) => typeof valueAt(value, path) === 'string') &&
    stringArrayFields.every((path) => {
      const item = valueAt(value, path)
      return Array.isArray(item) && item.every((entry) => typeof entry === 'string')
    }) &&
    booleanFields.every((path) => typeof valueAt(value, path) === 'boolean') &&
    typeof valueAt(value, 'antiSurveillance.crossInstitutionAggregation.minimumContributors') ===
      'number'
  )
}

function finding(
  id: string,
  artifact: string,
  authority: string,
  expected: unknown,
  observed: unknown,
): DoctrineFinding {
  return {
    id,
    artifact,
    authority,
    expected: stable(expected),
    observed: stable(observed),
  }
}

function loadContract(root: string, findings: DoctrineFinding[]): DoctrineContract | null {
  const text = readText(root, CIVIC_OCI_CONTRACT_PATH)
  if (!text) {
    findings.push(
      finding(
        'CIVIC_CONTRACT_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
        'machine-readable contract',
        'missing',
      ),
    )
    return null
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const requiredSections = [
      'identity',
      'methodStructure',
      'humanAuthority',
      'aiBoundary',
      'antiSurveillance',
      'frontDoor',
      'runtimeAuthorization',
      'historicalScope',
    ]
    const missing = requiredSections.filter(
      (section) => !parsed[section] || typeof parsed[section] !== 'object',
    )
    if (missing.length > 0) {
      findings.push(
        finding(
          'CIVIC_CONTRACT_INVALID',
          CIVIC_OCI_CONTRACT_PATH,
          'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
          requiredSections,
          { missing },
        ),
      )
      return null
    }
    if (!hasContractShape(parsed)) {
      findings.push(
        finding(
          'CIVIC_CONTRACT_INVALID',
          CIVIC_OCI_CONTRACT_PATH,
          'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
          'complete typed contract',
          'missing or invalid field type',
        ),
      )
      return null
    }
    return parsed as unknown as DoctrineContract
  } catch (error) {
    findings.push(
      finding(
        'CIVIC_CONTRACT_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
        'valid JSON',
        error instanceof Error ? error.message : String(error),
      ),
    )
    return null
  }
}

function validateContract(contract: DoctrineContract, findings: DoctrineFinding[]): void {
  if (![1, 2].includes(contract.schemaVersion)) {
    findings.push(
      finding(
        'CIVIC_CONTRACT_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        CIVIC_OCI_CONTRACT_PATH,
        'schema version 1 or 2',
        contract.schemaVersion,
      ),
    )
  }

  const identity = {
    canonicalMethod: contract.identity?.canonicalMethod,
    civicRole: contract.identity?.civicRole,
    clearRole: contract.identity?.clearRole,
    ocraRole: contract.identity?.ocraRole,
  }
  if (stable(identity) !== stable(EXPECTED_IDENTITY)) {
    findings.push(
      finding(
        'CIVIC_METHOD_AUTHORITY_DRIFT',
        CIVIC_OCI_CONTRACT_PATH,
        contract.identity?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        EXPECTED_IDENTITY,
        identity,
      ),
    )
  }

  const humanAuthority = {
    humanReviewAuthoritative: contract.humanAuthority?.humanReviewAuthoritative,
    institutionalAdoptionRequired: contract.humanAuthority?.institutionalAdoptionRequired,
    autonomousInstitutionalDecisioningPermitted:
      contract.humanAuthority?.autonomousInstitutionalDecisioningPermitted,
    unreviewedAiMayBecomeInstitutionalOutput:
      contract.humanAuthority?.unreviewedAiMayBecomeInstitutionalOutput,
  }
  if (stable(humanAuthority) !== stable(EXPECTED_HUMAN_AUTHORITY)) {
    findings.push(
      finding(
        'CIVIC_HUMAN_AUTHORITY_DRIFT',
        CIVIC_OCI_CONTRACT_PATH,
        contract.humanAuthority?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        EXPECTED_HUMAN_AUTHORITY,
        humanAuthority,
      ),
    )
  }

  if (stable(contract.aiBoundary?.permitted) !== stable(EXPECTED_AI_PERMITTED)) {
    findings.push(
      finding(
        'CIVIC_AI_BOUNDARY_DRIFT',
        CIVIC_OCI_CONTRACT_PATH,
        contract.aiBoundary?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        EXPECTED_AI_PERMITTED,
        contract.aiBoundary?.permitted,
      ),
    )
  }
  if (stable(contract.aiBoundary?.prohibited) !== stable(EXPECTED_AI_PROHIBITED)) {
    findings.push(
      finding(
        'CIVIC_AI_BOUNDARY_DRIFT',
        CIVIC_OCI_CONTRACT_PATH,
        contract.aiBoundary?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        EXPECTED_AI_PROHIBITED,
        contract.aiBoundary?.prohibited,
      ),
    )
  }

  if (stable(contract.antiSurveillance?.prohibited) !== stable(EXPECTED_SURVEILLANCE_PROHIBITED)) {
    findings.push(
      finding(
        'CIVIC_ANTI_SURVEILLANCE_DRIFT',
        CIVIC_OCI_CONTRACT_PATH,
        contract.antiSurveillance?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        EXPECTED_SURVEILLANCE_PROHIBITED,
        contract.antiSurveillance?.prohibited,
      ),
    )
  }
  const aggregation = contract.antiSurveillance?.crossInstitutionAggregation
  const expectedAggregation = {
    optIn: true,
    revocable: true,
    minimumContributors: 5,
    ranked: false,
  }
  if (stable(aggregation) !== stable(expectedAggregation)) {
    findings.push(
      finding(
        'CIVIC_ANTI_SURVEILLANCE_DRIFT',
        CIVIC_OCI_CONTRACT_PATH,
        contract.antiSurveillance?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        expectedAggregation,
        aggregation,
      ),
    )
  }

  if (contract.runtimeAuthorization?.authorized !== false) {
    findings.push(
      finding(
        'CIVIC_RUNTIME_UNAUTHORIZED',
        CIVIC_OCI_CONTRACT_PATH,
        contract.runtimeAuthorization?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        false,
        contract.runtimeAuthorization?.authorized,
      ),
    )
  }
  if (stable(contract.historicalScope?.excluded) !== stable(['docs/oci/superseded/**'])) {
    findings.push(
      finding(
        'CIVIC_HISTORICAL_SCOPE_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        contract.historicalScope?.authority?.join(', ') ?? CIVIC_OCI_CONTRACT_PATH,
        ['docs/oci/superseded/**'],
        contract.historicalScope?.excluded,
      ),
    )
  }

  for (const [section, value] of Object.entries(contract)) {
    if (section === 'schemaVersion') continue
    if (
      !value ||
      typeof value !== 'object' ||
      !('rationale' in value) ||
      !String(value.rationale).trim()
    ) {
      findings.push(
        finding(
          'CIVIC_CONTRACT_INVALID',
          CIVIC_OCI_CONTRACT_PATH,
          CIVIC_OCI_CONTRACT_PATH,
          `${section}.rationale`,
          'missing',
        ),
      )
    }
  }
}

function validateAnchors(root: string, findings: DoctrineFinding[]): void {
  for (const anchor of REQUIRED_ANCHORS) {
    const text = readText(root, anchor.artifact)
    if (text === null || !text.includes(anchor.text)) {
      findings.push(
        finding(
          anchor.id,
          anchor.artifact,
          anchor.authority,
          anchor.text,
          text === null ? 'missing artifact' : 'required anchor missing',
        ),
      )
    }
  }
}

function validateAuthorityPaths(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
): void {
  const paths = new Set([
    ...contract.identity.authority,
    contract.methodStructure.codeAuthority,
    contract.methodStructure.documentAuthority,
    ...contract.humanAuthority.authority,
    ...contract.aiBoundary.authority,
    ...contract.antiSurveillance.authority,
    contract.frontDoor.portfolioAuthority,
    ...contract.frontDoor.firstTouchSurfaces,
    contract.runtimeAuthorization.applicationRoot,
    ...contract.runtimeAuthorization.authority,
    ...contract.historicalScope.authority,
  ])
  for (const artifact of paths) {
    if (!existsSync(join(root, artifact))) {
      findings.push(
        finding(
          'CIVIC_AUTHORITY_MISSING',
          artifact,
          CIVIC_OCI_CONTRACT_PATH,
          'declared authority present',
          'missing',
        ),
      )
    }
  }
}

interface MethodPhase {
  id: string
  ordinal: number
  name: string
  productLayer: string
}

function extractCodePhases(source: string): MethodPhase[] {
  const sourceFile = ts.createSourceFile(
    'oci-method.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  let methodObject: ts.ObjectLiteralExpression | undefined
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'OCI_METHOD') continue
      const initializer = declaration.initializer
      const expression =
        initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer
      if (expression && ts.isObjectLiteralExpression(expression)) methodObject = expression
    }
  })
  if (!methodObject) return []
  const phasesProperty = methodObject.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ((ts.isIdentifier(property.name) && property.name.text === 'phases') ||
        (ts.isStringLiteral(property.name) && property.name.text === 'phases')),
  )
  if (!phasesProperty) return []
  const phasesExpression = ts.isAsExpression(phasesProperty.initializer)
    ? phasesProperty.initializer.expression
    : phasesProperty.initializer
  if (!ts.isArrayLiteralExpression(phasesExpression)) return []

  const propertyValue = (
    object: ts.ObjectLiteralExpression,
    name: string,
  ): ts.Expression | undefined => {
    const property = object.properties.find(
      (item): item is ts.PropertyAssignment =>
        ts.isPropertyAssignment(item) &&
        ((ts.isIdentifier(item.name) && item.name.text === name) ||
          (ts.isStringLiteral(item.name) && item.name.text === name)),
    )
    return property?.initializer
  }
  const phases: MethodPhase[] = []
  for (const element of phasesExpression.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue
    const idNode = propertyValue(element, 'id')
    const ordinalNode = propertyValue(element, 'ordinal')
    const nameNode = propertyValue(element, 'name')
    const productLayerNode = propertyValue(element, 'productLayer')
    const id = idNode && ts.isStringLiteral(idNode) ? idNode.text : undefined
    const ordinal = ordinalNode && ts.isNumericLiteral(ordinalNode) ? Number(ordinalNode.text) : 0
    const name = nameNode && ts.isStringLiteral(nameNode) ? nameNode.text : undefined
    const productLayer =
      productLayerNode && ts.isStringLiteral(productLayerNode) ? productLayerNode.text : undefined
    if (id && ordinal && name && productLayer) phases.push({ id, ordinal, name, productLayer })
  }
  return phases
}

function extractDocumentPhases(markdown: string): MethodPhase[] {
  const section = markdown.split('## 2. The five phases')[1]?.split('\n## ')[0] ?? ''
  const phases: MethodPhase[] = []
  for (const line of section.split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim())
    if (!/^\d+$/.test(cells[1] ?? '')) continue
    const ordinal = Number(cells[1])
    const name = (cells[2] ?? '').replace(/\*\*/g, '')
    const productLayer = (cells[4] ?? '').match(/P\d/)?.[0] ?? ''
    if (name && productLayer) {
      phases.push({ id: name.toLowerCase(), ordinal, name, productLayer })
    }
  }
  return phases
}

function validateMethodStructure(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
): void {
  const code = readText(root, contract.methodStructure.codeAuthority)
  const document = readText(root, contract.methodStructure.documentAuthority)
  if (code === null || document === null) {
    findings.push(
      finding(
        'OCI_METHOD_STRUCTURE_DRIFT',
        code === null
          ? contract.methodStructure.codeAuthority
          : contract.methodStructure.documentAuthority,
        'governance/foundations/civic-oci-doctrine.contract.json#methodStructure',
        'both authorities present',
        'authority missing',
      ),
    )
    return
  }
  const codePhases = extractCodePhases(code)
  const documentPhases = extractDocumentPhases(document)
  if (codePhases.length !== 5 || stable(codePhases) !== stable(documentPhases)) {
    findings.push(
      finding(
        'OCI_METHOD_STRUCTURE_DRIFT',
        contract.methodStructure.codeAuthority,
        contract.methodStructure.documentAuthority,
        documentPhases,
        codePhases,
      ),
    )
  }
}

const PRODUCTIZATION_PATTERNS: Array<{ label: string; expression: RegExp }> = [
  {
    label: 'active product or service claim',
    expression: /\b(active|available|live)\s+(assessment|pilot|platform|software)\b/i,
  },
  {
    label: 'demo, trial, assessment, or pilot call to action',
    expression:
      /\b(book|buy|request|schedule|start)\s+(?:a|an|your)?\s*(assessment|demo|pilot|trial)\b/i,
  },
  {
    label: 'current commercial engagement claim',
    expression: /\b(current|open|active)\s+commercial engagement\b/i,
  },
]
const INDEPENDENT_SCORING_PATTERN =
  /\bCIVIC\b[^.\n]{0,100}\b(?:introduces?|defines?|owns?)\b[^.\n]{0,80}\b(?:dimension|maturity band|ranking|score|scoring framework)\b/i

function validateFrontDoor(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
): void {
  const catalogText = readText(root, contract.frontDoor.portfolioAuthority)
  if (catalogText === null) {
    findings.push(
      finding(
        'CIVIC_AUTHORITY_MISSING',
        contract.frontDoor.portfolioAuthority,
        CIVIC_OCI_CONTRACT_PATH,
        'portfolio authority',
        'missing',
      ),
    )
    return
  }
  let catalog: { products?: PortfolioProduct[] }
  try {
    catalog = JSON.parse(catalogText) as { products?: PortfolioProduct[] }
  } catch (error) {
    findings.push(
      finding(
        'CIVIC_AUTHORITY_MISSING',
        contract.frontDoor.portfolioAuthority,
        CIVIC_OCI_CONTRACT_PATH,
        'valid portfolio authority JSON',
        error instanceof Error ? error.message : String(error),
      ),
    )
    return
  }
  const civic = catalog.products?.find((product) => product.id === contract.frontDoor.productId)
  if (!civic) {
    findings.push(
      finding(
        'CIVIC_AUTHORITY_MISSING',
        contract.frontDoor.portfolioAuthority,
        CIVIC_OCI_CONTRACT_PATH,
        `product ${contract.frontDoor.productId}`,
        'missing',
      ),
    )
    return
  }

  const preProduct =
    civic.gtm_posture !== 'sell-now' &&
    civic.proof_level === 'none' &&
    civic.customers === 0 &&
    civic.pilots === 0

  for (const artifact of contract.frontDoor.firstTouchSurfaces) {
    const text = readText(root, artifact)
    if (text === null) {
      findings.push(
        finding(
          'CIVIC_AUTHORITY_MISSING',
          artifact,
          contract.frontDoor.portfolioAuthority,
          'declared first-touch surface',
          'missing',
        ),
      )
      continue
    }
    if (INDEPENDENT_SCORING_PATTERN.test(text)) {
      findings.push(
        finding(
          'CIVIC_INDEPENDENT_SCORING_DRIFT',
          artifact,
          'docs/CIVIC_OCI_ALIGNMENT.md',
          'no CIVIC-owned score, dimension, band, or ranking',
          'independent scoring claim',
        ),
      )
    }
    if (!preProduct) continue
    for (const pattern of PRODUCTIZATION_PATTERNS) {
      if (pattern.expression.test(text)) {
        findings.push(
          finding(
            'CIVIC_FRONT_DOOR_POSTURE_DRIFT',
            artifact,
            contract.frontDoor.portfolioAuthority,
            'pre-product first-touch language',
            pattern.label,
          ),
        )
      }
    }
  }
}

function walkFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory() && !['node_modules', '.git', '.turbo'].includes(entry.name))
      files.push(...walkFiles(path))
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(path)
  }
  return files
}

export function scanCivicProofStorageSymlinks(
  root: string,
  inspect: (path: string) => Stats = lstatSync,
): string | undefined {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    let attributes: Stats
    try {
      attributes = inspect(path)
    } catch (error) {
      // SQLite removes transaction sidecars while other proof processes scan.
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT' &&
        entry.isFile() &&
        /-(journal|wal|shm)$/.test(entry.name)
      )
        continue
      throw error
    }
    if (attributes.isSymbolicLink()) return path
    if (attributes.isDirectory()) {
      const nested = scanCivicProofStorageSymlinks(path, inspect)
      if (nested) return nested
    }
  }
  return undefined
}

export const CIVIC_SLICE0_APPROVAL = {
  enabled: true,
  scope: 'synthetic-runtime-slice-0',
  decisionArtifact: 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md',
  startingSha: '1c337567635bb86ea0df7831557d8d2d22df1e6f',
  branch: 'civic/three-reality-hardening',
  worktree: 'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing',
  effectiveAt: '2026-10-10T16:17:50Z',
  expiresAt: '2026-10-17T16:17:50Z',
  revokedAt: null,
  dataBoundary: 'SYNTHETIC_ONLY',
  production: false,
  deployment: false,
  slice1: false,
  runtimeRoot: 'apps/civic',
  proofOwner: 'Aubert Nungisa',
  sharedReuse: [
    '@nzila/platform-contracts/identity',
    '@nzila/platform-contracts/org-scope',
    '@nzila/platform-contracts/role',
    '@nzila/platform-contracts/audit-event',
  ],
  writablePaths: [
    'apps/civic/src',
    'apps/civic/tests',
    'apps/civic/fixtures',
    'apps/civic/package.json',
    'apps/civic/README.md',
    'apps/civic/tsconfig.json',
    'apps/civic/vitest.config.ts',
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md',
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md',
    CIVIC_OCI_CONTRACT_PATH,
    'scripts/lib/civic-oci-doctrine.ts',
    'tooling/contract-tests/civic-oci-doctrine-integrity.test.ts',
    'docs/oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md',
  ],
} as const

export interface CivicDoctrineValidationContext {
  now: Date
  branch: string
  worktree: string
  descendsFromApprovedSha: boolean
  changedPaths: readonly string[]
}

function gitContext(root: string): CivicDoctrineValidationContext {
  if (!existsSync(join(root, '.git'))) throw new Error('A worktree root is required')
  const status = execFileSync(
    'git',
    ['-C', root, 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'],
    { encoding: 'utf8' },
  )
  const changedPaths: string[] = []
  const entries = status.split('\0').filter(Boolean)
  let branch = ''
  let head = ''
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.startsWith('# branch.head ')) branch = entry.slice(14).trim()
    else if (entry.startsWith('# branch.oid ')) head = entry.slice(13).trim()
    else if (entry.startsWith('# ')) continue
    else if (entry.startsWith('? ')) changedPaths.push(entry.slice(2))
    else if (entry.startsWith('1 ')) changedPaths.push(entry.split(' ').slice(8).join(' '))
    else if (entry.startsWith('2 ')) {
      changedPaths.push(entry.split(' ').slice(9).join(' '))
      changedPaths.push(entries[++i])
    } else throw new Error('Unresolved conflict or unsupported Git status record')
  }
  if (!branch || !/^[a-f0-9]{40}$/.test(head) || changedPaths.some((path) => !path))
    throw new Error('Missing branch, revision or changed-path context')
  const ancestry =
    head === CIVIC_SLICE0_APPROVAL.startingSha
      ? head
      : execFileSync('git', ['-C', root, 'rev-list', head], { encoding: 'utf8' })
  if (head !== CIVIC_SLICE0_APPROVAL.startingSha) {
    changedPaths.push(
      ...execFileSync(
        'git',
        [
          '-C',
          root,
          'diff',
          '--name-only',
          '--no-renames',
          '-z',
          CIVIC_SLICE0_APPROVAL.startingSha,
          head,
        ],
        { encoding: 'utf8' },
      )
        .split('\0')
        .filter(Boolean),
    )
  }
  return {
    now: new Date(),
    branch,
    worktree: resolve(root),
    descendsFromApprovedSha: ancestry.split(/\r?\n/).includes(CIVIC_SLICE0_APPROVAL.startingSha),
    changedPaths: changedPaths.map((path) => path.replace(/\\/g, '/')),
  }
}

function slice0Allowed(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
  context?: CivicDoctrineValidationContext,
  execution = true,
): boolean {
  const grant = contract.runtimeAuthorization.slice0
  if (grant === undefined) return false
  const deny = (observed: unknown) => {
    findings.push(
      finding(
        'CIVIC_SLICE0_AUTHORIZATION_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        CIVIC_SLICE0_APPROVAL.decisionArtifact,
        'exact, current, human-approved isolated Slice 0',
        observed,
      ),
    )
    return false
  }
  if (execution && process.env.NODE_ENV === 'production')
    return deny('production execution prohibited')
  if (
    contract.schemaVersion !== 2 ||
    contract.runtimeAuthorization.authorized !== false ||
    contract.runtimeAuthorization.applicationRoot !== 'apps/civic' ||
    Object.keys(contract.runtimeAuthorization).some(
      (key) =>
        ![
          'authorized',
          'applicationRoot',
          'authority',
          'rationale',
          'slice0',
          'slice1',
          'slice2',
        ].includes(key),
    ) ||
    stable(grant) !== stable(CIVIC_SLICE0_APPROVAL)
  )
    return deny('approval shape/value mismatch or revocation')
  const decision = readText(root, CIVIC_SLICE0_APPROVAL.decisionArtifact)
  const required = [
    '**Decision:** `AUTHORIZE_WITH_CONDITIONS`',
    '**Maintainer:** Aubert Nungisa',
    '**Decision date:** 2026-10-10',
    '**CIVIC Slice 0 Proof Owner:** Aubert Nungisa',
    '**Effective:** `2026-10-10T16:17:50Z`',
    '**Expires:** `2026-10-17T16:17:50Z`',
    '**Authorized starting SHA:** `1c337567635bb86ea0df7831557d8d2d22df1e6f`',
    '**Authorized branch/worktree:** `civic/three-reality-hardening` /',
    '`C:\\APPS\\nzila-os.worktrees\\pasted-text-processing`',
    '**Platform-contract reuse accountability:**',
  ]
  const decisionBlock =
    decision?.split('## MAINTAINER DECISION\n')[1]?.replace(/\r/g, '') ??
    decision?.replace(/\r/g, '').split('## MAINTAINER DECISION\n')[1]
  if (
    !decisionBlock ||
    required.some((text) => !decisionBlock.includes(text)) ||
    decisionBlock.includes('PENDING')
  )
    return deny('human decision missing, pending or inconsistent')
  const proof = readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md')
  const terminated = proof?.includes('**Authorization terminated:** YES') === true
  if (execution && terminated) return deny('bounded proof authorization terminated')
  const archivalDecision = readText(root, ARCHIVAL_AUTHORITY)
    ?.replace(/\r/g, '')
    .split('## Documentation-only archival gate amendment\n')[1]
    ?.split('\n## ')[0]
  const amendmentRecorded =
    !!archivalDecision && ARCHIVAL_DECISION.every((text) => archivalDecision.includes(text))
  if (execution && amendmentRecorded) return deny('archival review only; runtime remains closed')
  let documentationReviewAllowed = false
  if (existsSync(join(root, CIVIC_SLICE1_REVIEW_PACKET))) {
    let parent = root
    for (const segment of CIVIC_SLICE1_REVIEW_PACKET.split('/')) {
      parent = join(parent, segment)
      if (lstatSync(parent).isSymbolicLink())
        return deny('review artifact must not traverse symlinks')
    }
    if (!statSync(parent).isFile()) return deny('review artifact must be a regular Markdown file')
    const packet = readText(root, CIVIC_SLICE1_REVIEW_PACKET)?.replace(/\r/g, '')
    const pendingDecision = packet?.split('## MAINTAINER DECISION\n')
    const recordedBlockedDecision =
      pendingDecision?.length === 2 &&
      /^\s*\*\*Decision:\*\* `AUTHORIZE_WITH_CONDITIONS`\s*(?:\n|$)/.test(pendingDecision[1]) &&
      [
        '**Maintainer:** Aubert Nungisa',
        '**Decision date:** 2026-10-10',
        '**Conditions:** Runtime Slice 1 only; `SLICE_1_DATA_BOUNDARY = SYNTHETIC_ONLY`.',
        '**Authorized starting SHA:** `1c337567635bb86ea0df7831557d8d2d22df1e6f`',
        '**Authorized branch/worktree:** `civic/three-reality-hardening` /',
        '`C:\\APPS\\nzila-os.worktrees\\pasted-text-processing`',
        '**Effective:** `2026-10-10T17:56:14Z`',
        '**Expires:** `2026-10-17T17:56:14Z`',
        '**Slice 1 proof owner:** Aubert Nungisa',
      ].every((text) => pendingDecision[1].includes(text)) &&
      !pendingDecision[1].includes('PENDING') &&
      packet?.includes('**Activation disposition:** `CIVIC_SLICE_1_ACTIVATION_BLOCKED`')
    const reviewOnlyDecision =
      pendingDecision?.length === 2 &&
      (/^\s*\*\*Decision:\*\* `PENDING_HUMAN_MAINTAINER`\s*(?:\n|$)/.test(pendingDecision[1]) ||
        recordedBlockedDecision ||
        (contract.runtimeAuthorization.slice1 !== undefined && slice1DecisionRecorded(root)))
    if (
      !terminated ||
      !amendmentRecorded ||
      !proof?.includes(
        '**Human proof-owner acceptance:** `CIVIC_RUNTIME_SLICE_0_ACCEPTED_WITH_LIMITATIONS`',
      ) ||
      !reviewOnlyDecision ||
      !packet?.includes('**Implementation authorization:** NONE') ||
      !packet.includes('**Proposed data boundary:** `SYNTHETIC_ONLY`')
    )
      return deny(
        'documentation review requires accepted terminated proof, exact amendment and pending or recorded activation-blocked packet',
      )
    documentationReviewAllowed = !execution
  }
  let current: CivicDoctrineValidationContext
  try {
    current = context ?? gitContext(root)
  } catch (error) {
    return deny(error instanceof Error ? error.message : String(error))
  }
  const time = current.now.getTime()
  if (
    !(terminated && !execution) &&
    (!Number.isFinite(time) ||
      time < Date.parse(CIVIC_SLICE0_APPROVAL.effectiveAt) ||
      time >= Date.parse(CIVIC_SLICE0_APPROVAL.expiresAt))
  )
    return deny('not effective or expired')
  if (
    current.branch !== CIVIC_SLICE0_APPROVAL.branch ||
    resolve(current.worktree).toLowerCase() !==
      resolve(CIVIC_SLICE0_APPROVAL.worktree).toLowerCase() ||
    !current.descendsFromApprovedSha
  )
    return deny('wrong branch/worktree/approved ancestry')
  const protectedBaseline = 'docs/public-service/operations/three-reality-hardening-report.md'
  const outside = current.changedPaths.filter(
    (path) =>
      path !== protectedBaseline &&
      !(documentationReviewAllowed && path === CIVIC_SLICE1_REVIEW_PACKET) &&
      !CIVIC_SLICE0_APPROVAL.writablePaths.some(
        (allowed) =>
          path === allowed ||
          (['apps/civic/src', 'apps/civic/tests', 'apps/civic/fixtures'].includes(allowed) &&
            path.startsWith(`${allowed}/`)),
      ),
  )
  if (outside.length) return deny({ unauthorizedChangedPaths: outside })
  return true
}

function validateArchivedSlice0(
  root: string,
  findings: DoctrineFinding[],
  slice1 = false,
  slice2 = false,
): void {
  const deny = (artifact: string, observed: string) =>
    findings.push(
      finding(
        'CIVIC_SLICE0_ARCHIVE_INVALID',
        artifact,
        ARCHIVAL_AUTHORITY,
        'exact retained Slice 0 proof file (SHA-256, CRLF normalized to LF)',
        observed,
      ),
    )
  const closedSlice1 =
    slice1 &&
    readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md')?.includes(
      '**Authorization terminated:** YES',
    )
  const closedSlice2 =
    slice2 &&
    readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md')?.includes(
      '**Authorization terminated:** YES',
    ) === true
  const prior = closedSlice1
    ? { ...SLICE0_ARCHIVED_FILES, ...SLICE1_ARCHIVED_FILES }
    : SLICE0_ARCHIVED_FILES
  const archived = closedSlice2 ? { ...prior, ...SLICE2_ARCHIVED_FILES } : prior
  for (const [artifact, expected] of Object.entries(archived)) {
    const path = join(root, artifact)
    if (!existsSync(path) || !lstatSync(path).isFile()) {
      deny(artifact, 'missing or non-regular archived file')
      continue
    }
    const observed = createHash('sha256')
      .update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'))
      .digest('hex')
    if (observed !== expected) deny(artifact, 'archived contents changed')
  }
  for (const file of walkFiles(join(root, 'apps/civic'))) {
    const artifact = relative(root, file).replace(/\\/g, '/')
    if (
      !(artifact in archived) &&
      artifact !== 'apps/civic/README.md' &&
      !(slice2 && !closedSlice2 && slice2Surface(artifact)) &&
      !(slice1 && !closedSlice1 && slice1Surface(artifact))
    )
      deny(artifact, 'new file is not retained Slice 0 proof source')
  }
}

export const CIVIC_SLICE1_APPROVAL = {
  enabled: true,
  scope: 'synthetic-local-runtime-slice-1',
  decisionArtifact: CIVIC_SLICE1_REVIEW_PACKET,
  startingSha: CIVIC_SLICE0_APPROVAL.startingSha,
  branch: CIVIC_SLICE0_APPROVAL.branch,
  worktree: CIVIC_SLICE0_APPROVAL.worktree,
  effectiveAt: '2026-10-10T17:56:14Z',
  expiresAt: '2026-10-17T17:56:14Z',
  revokedAt: null,
  dataBoundary: 'SYNTHETIC_ONLY',
  production: false,
  deployment: false,
  slice2: false,
  proofOwner: 'Aubert Nungisa',
  checkpointCustodian: 'Aubert Nungisa',
  storageDirectory: 'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice1',
  checkpointDirectory:
    'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice1\\checkpoints',
  writablePaths: [
    'apps/civic/src/slice1',
    'apps/civic/tests/slice1',
    'apps/civic/slice1.tsconfig.json',
    'apps/civic/slice1.vitest.config.ts',
    CIVIC_SLICE1_REVIEW_PACKET,
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md',
    CIVIC_OCI_CONTRACT_PATH,
    'scripts/lib/civic-oci-doctrine.ts',
    'tooling/contract-tests/civic-oci-doctrine-integrity.test.ts',
    ARCHIVAL_AUTHORITY,
  ],
  sharedReuse: [...CIVIC_SLICE0_APPROVAL.sharedReuse],
} as const

function slice1Surface(artifact: string): boolean {
  return /^(apps\/civic\/src\/slice1\/[a-z0-9-]+\.ts|apps\/civic\/tests\/slice1\/[a-z0-9-]+\.test\.ts|apps\/civic\/slice1\.(tsconfig\.json|vitest\.config\.ts))$/.test(
    artifact,
  )
}

function slice1DecisionRecorded(root: string): boolean {
  const text = readText(root, CIVIC_SLICE1_REVIEW_PACKET)?.replace(/\r/g, '')
  const blocks = text?.split('## MAINTAINER DECISION\n')
  return (
    blocks?.length === 2 &&
    /^\s*\*\*Decision:\*\* `AUTHORIZE_WITH_CONDITIONS`\s*(?:\n|$)/.test(blocks[1]) &&
    [
      '**Maintainer:** Aubert Nungisa',
      '**Decision date:** 2026-10-10',
      '**Conditions:** Runtime Slice 1 only; `SLICE_1_DATA_BOUNDARY = SYNTHETIC_ONLY`.',
      `**Authorized starting SHA:** \`${CIVIC_SLICE1_APPROVAL.startingSha}\``,
      '**Authorized branch/worktree:** `civic/three-reality-hardening` /',
      `\`${CIVIC_SLICE1_APPROVAL.worktree}\``,
      `**Effective:** \`${CIVIC_SLICE1_APPROVAL.effectiveAt}\``,
      `**Expires:** \`${CIVIC_SLICE1_APPROVAL.expiresAt}\``,
      '**Slice 1 proof owner:** Aubert Nungisa',
      `**Approved storage directory:** \`${CIVIC_SLICE1_APPROVAL.storageDirectory}\``,
      `**Approved checkpoint directory:** \`${CIVIC_SLICE1_APPROVAL.checkpointDirectory}\``,
      '**Checkpoint custodian:** Aubert Nungisa',
    ].every((required) => blocks[1].includes(required)) &&
    !blocks[1].includes('PENDING')
  )
}

function slice2DocumentationReviewAllowed(root: string, contract: DoctrineContract): boolean {
  if (
    contract.runtimeAuthorization.authorized !== false ||
    valueAt(contract, 'runtimeAuthorization.slice2') !== undefined
  )
    return false
  for (const slice of [0, 1]) {
    const proof = readText(
      root,
      `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`,
    )
    if (
      !proof?.includes('**Authorization terminated:** YES') ||
      !proof.includes(
        `**Human proof-owner acceptance:** \`CIVIC_RUNTIME_SLICE_${slice}_ACCEPTED_WITH_LIMITATIONS\``,
      )
    )
      return false
  }
  const amendment = readText(root, ARCHIVAL_AUTHORITY)
    ?.replace(/\r/g, '')
    .split('## Slice 2 documentation-only archival gate amendment\n')
  if (
    amendment?.length !== 2 ||
    ![
      '**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`',
      '**Maintainer:** Aubert Nungisa',
      '**Decision date:** 2026-10-12',
      `**Exact review path:** \`${CIVIC_SLICE2_REVIEW_PACKET}\``,
      '**Runtime execution:** `NOT_AUTHORIZED`',
    ].every((text) => amendment[1].includes(text))
  )
    return false
  let parent = root
  for (const segment of CIVIC_SLICE2_REVIEW_PACKET.split('/')) {
    parent = join(parent, segment)
    if (!existsSync(parent) || lstatSync(parent).isSymbolicLink()) return false
  }
  if (!lstatSync(parent).isFile()) return false
  const packet = readText(root, CIVIC_SLICE2_REVIEW_PACKET)?.replace(/\r/g, '')
  const blocks = packet?.split('## MAINTAINER DECISION\n')
  if (
    !packet ||
    blocks?.length !== 2 ||
    !/^\*\*Implementation authorization:\*\* NONE$/m.test(blocks[0]) ||
    !/^\*\*Execution state:\*\* NOT_AUTHORIZED$/m.test(blocks[0]) ||
    !/^\*\*Proposed data boundary:\*\* `SLICE_2_DATA_BOUNDARY = SYNTHETIC_ONLY`$/m.test(
      blocks[0],
    ) ||
    blocks[1].split('\n').filter((line) => line.startsWith('**Decision:**')).length !== 1
  )
    return false
  const recordedBlockedDecision =
    blocks[1].trim() === CIVIC_SLICE2_RECORDED_DECISION &&
    blocks[0].split('\n').includes('**Activation disposition:** `CIVIC_SLICE_2_ACTIVATION_BLOCKED`')
  if (
    !recordedBlockedDecision &&
    !/^\s*\*\*Decision:\*\* `PENDING_HUMAN_MAINTAINER`\s*(?:\n|$)/.test(blocks[1])
  )
    return false
  for (const field of [
    'Implementation authorization',
    'Execution state',
    'Proposed data boundary',
  ]) {
    if (blocks[0].split('\n').filter((line) => line.startsWith(`**${field}:**`)).length !== 1)
      return false
  }
  for (const field of [
    'Maintainer',
    'Decision date',
    'Conditions',
    'Authorized starting SHA',
    'Authorized branch/worktree',
    'Storage locations',
    'Integrity-anchor custody/location',
    'Proof owner',
  ]) {
    if (
      blocks[1].split('\n').filter((line) => line.startsWith(`**${field}:**`)).length !== 1 ||
      (!recordedBlockedDecision && !blocks[1].split('\n').includes(`**${field}:** PENDING`))
    )
      return false
  }
  const archiveFindings: DoctrineFinding[] = []
  validateArchivedSlice0(root, archiveFindings, true)
  return archiveFindings.length === 0
}

function readRegularArchivalArtifact(root: string, artifact: string): Buffer {
  const segments = artifact.replace(/\\/g, '/').split('/')
  if (
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || segment.includes(':'),
    )
  )
    throw new Error(`Invalid archival path: ${artifact}`)
  let path = root
  if (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
    throw new Error('Archival root must be a regular directory')
  for (let index = 0; index < segments.length; index++) {
    path = join(path, segments[index])
    const stats = lstatSync(path)
    if (
      stats.isSymbolicLink() ||
      (index < segments.length - 1 ? !stats.isDirectory() : !stats.isFile())
    )
      throw new Error(`Non-regular archival path: ${artifact}`)
  }
  return readFileSync(path)
}

function verifyHumanValidationRetainedEvidence(root: string): void {
  for (const [artifact, expected] of Object.entries(RETAINED_EVIDENCE_INVENTORIES)) {
    const content = readRegularArchivalArtifact(root, artifact)
    if (createHash('sha256').update(content).digest('hex') !== expected)
      throw new Error(`Retained inventory changed: ${artifact}`)
    const inventory: unknown = JSON.parse(content.toString('utf8'))
    const slice1 = artifact.includes('/slice1/')
    const sources = artifact.endsWith('final-source-inventory.json')
    const entries = valueAt(inventory, slice1 ? 'files' : 'entries')
    if (
      valueAt(inventory, 'classification') !== 'LOCAL_SYNTHETIC_PROOF_ARTIFACT' ||
      !Array.isArray(entries) ||
      entries.length !== (slice1 ? 22 : sources ? 11 : 204)
    )
      throw new Error(`Invalid retained inventory: ${artifact}`)
    for (const entry of entries) {
      const name = valueAt(entry, slice1 ? 'path' : 'file')
      const digest = valueAt(entry, sources ? 'normalizedLfSha256' : 'sha256')
      const bytes = valueAt(entry, 'bytes')
      if (typeof name !== 'string' || typeof digest !== 'string')
        throw new Error(`Invalid retained entry: ${artifact}`)
      const path = (slice1 ? `.civic-runtime/slice1/${name}` : name).replace(/\\/g, '/')
      if (
        sources
          ? !(path in SLICE2_ARCHIVED_FILES) || SLICE2_ARCHIVED_FILES[path] !== digest
          : !['.civic-runtime/slice1/', '.civic-runtime/slice2/', '.civic-anchor/slice2/'].some(
              (prefix) => path.startsWith(prefix),
            )
      )
        throw new Error(`Unapproved retained payload path: ${path}`)
      const payload = readRegularArchivalArtifact(root, path)
      const input = sources ? payload.toString('utf8').replace(/\r\n/g, '\n') : payload
      if (
        createHash('sha256').update(input).digest('hex') !== digest ||
        (!sources && (typeof bytes !== 'number' || payload.length !== bytes))
      )
        throw new Error(`Retained payload changed: ${path}`)
    }
  }
}

function humanValidationDocumentationReviewAllowed(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
): boolean {
  const deny = (observed: string) => {
    findings.push(
      finding(
        'CIVIC_HUMAN_VALIDATION_DOC_GATE_BLOCKED',
        CIVIC_HUMAN_VALIDATION_PLAN,
        ARCHIVAL_AUTHORITY,
        'exact reviewed plan; three accepted terminated slices; intact archives; no execution permissions',
        observed,
      ),
    )
    return false
  }
  const contractFields = [
    'schemaVersion',
    'identity',
    'methodStructure',
    'humanAuthority',
    'aiBoundary',
    'antiSurveillance',
    'frontDoor',
    'runtimeAuthorization',
    'historicalScope',
  ]
  const runtimeFields = [
    'authorized',
    'applicationRoot',
    'authority',
    'rationale',
    'slice0',
    'slice1',
    'slice2',
  ]
  if (
    contract.runtimeAuthorization.authorized !== false ||
    Object.keys(contract).some((key) => !contractFields.includes(key)) ||
    Object.keys(contract.runtimeAuthorization).some((key) => !runtimeFields.includes(key)) ||
    stable(contract.runtimeAuthorization.slice0) !== stable(CIVIC_SLICE0_APPROVAL) ||
    stable(contract.runtimeAuthorization.slice1) !== stable(CIVIC_SLICE1_APPROVAL) ||
    stable(contract.runtimeAuthorization.slice2) !==
      stable({ ...CIVIC_SLICE2_APPROVAL, revokedAt: CIVIC_SLICE2_TERMINATED_AT })
  )
    return deny(
      'closed grants required; no additional runtime, session, outreach or data authority',
    )
  for (const slice of [0, 1, 2]) {
    const proof = readText(
      root,
      `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`,
    )
    for (const required of [
      '**Authorization terminated:** YES',
      `**Human proof-owner acceptance:** \`CIVIC_RUNTIME_SLICE_${slice}_ACCEPTED_WITH_LIMITATIONS\``,
    ]) {
      if (
        proof
          ?.replace(/\r/g, '')
          .split('\n')
          .filter((line) => line === required).length !== 1 ||
        proof?.split('\n').filter((line) => line.startsWith(required.split(':')[0] + ':'))
          .length !== 1
      )
        return deny(`Slice ${slice} acceptance/termination missing or contradictory`)
    }
    if (slice === 2 && !proof?.includes('`CIVIC_SYNTHETIC_TECHNICAL_HARDENING_COMPLETE`'))
      return deny('synthetic hardening completion not recorded')
  }
  const amendment = readText(root, ARCHIVAL_AUTHORITY)
    ?.replace(/\r/g, '')
    .split(HUMAN_VALIDATION_AMENDMENT_HEADING)
  const decision = [
    '**Amendment:** `DOCUMENTATION_REVIEW_ALLOWED`',
    '**Maintainer:** Aubert Nungisa',
    '**Decision date:** 2026-10-12',
    `**Exact review path:** \`${CIVIC_HUMAN_VALIDATION_PLAN}\``,
    '**Runtime execution:** `NOT_AUTHORIZED`',
    '**Human session execution:** `NOT_AUTHORIZED`',
    '**Outreach:** `NOT_AUTHORIZED`',
    '**Real data:** `NOT_AUTHORIZED`',
  ]
  const section = amendment?.[1]?.split('\n## ')[0]
  if (
    amendment?.length !== 2 ||
    !section ||
    decision.some((required) => {
      const lines = section.split('\n')
      return (
        lines.filter((line) => line === required).length !== 1 ||
        lines.filter((line) => line.startsWith(required.split(':')[0] + ':')).length !== 1
      )
    })
  )
    return deny('exact documentation-only human amendment missing or converted')
  try {
    const plan = readRegularArchivalArtifact(root, CIVIC_HUMAN_VALIDATION_PLAN)
      .toString('utf8')
      .replace(/\r\n/g, '\n')
    if (createHash('sha256').update(plan).digest('hex') !== HUMAN_VALIDATION_PLAN_SHA256)
      return deny(
        'reviewed VALIDATION_PLAN changed; findings or permission conversion cannot inherit review',
      )
    const archiveFindings: DoctrineFinding[] = []
    validateArchivedSlice0(root, archiveFindings, true, true)
    if (archiveFindings.length) {
      findings.push(...archiveFindings)
      return deny('retained Slice 0/1/2 source fingerprint or surface changed')
    }
    verifyHumanValidationRetainedEvidence(root)
  } catch (error) {
    return deny(error instanceof Error ? error.message : String(error))
  }
  return true
}

function requireResearchObject(
  value: unknown,
  allowed: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    throw new Error('Invalid research record or unapproved fields')
}

function parseRound1ResearchJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    throw new Error('Invalid research JSON; custodian review required')
  }
}

function checkRound1Observations(records: unknown): void {
  if (!Array.isArray(records)) throw new Error('Research observations must be an array')
  const counts = [
    'activeSeconds',
    'manualEntries',
    'duplicateEntries',
    'externalLookups',
    'reconciliationSteps',
    'clarifications',
    'facilitatorInterventions',
  ]
  for (const record of records) {
    requireResearchObject(record, [
      'task',
      'basis',
      'gate',
      'severity',
      'outcome',
      'note',
      ...counts,
    ])
    if (
      typeof record.task !== 'string' ||
      !/^T(0[1-9]|10)$/.test(record.task) ||
      !['OBSERVED_BEHAVIOR', 'PARTICIPANT_OPINION', 'FACILITATOR_INTERPRETATION'].includes(
        String(record.basis),
      ) ||
      !['D_GATE', 'R_GATE', 'T_GATE'].includes(String(record.gate)) ||
      !['BLOCKING', 'MATERIAL', 'MODERATE', 'MINOR', 'POSITIVE_SIGNAL'].includes(
        String(record.severity),
      ) ||
      ![0, 1, 2].includes(Number(record.outcome)) ||
      typeof record.outcome !== 'number' ||
      counts.some(
        (field) =>
          typeof record[field] !== 'number' ||
          !Number.isFinite(record[field]) ||
          Number(record[field]) < 0 ||
          (field !== 'activeSeconds' && !Number.isInteger(record[field])),
      ) ||
      typeof record.note !== 'string'
    )
      throw new Error('Invalid coded observation rubric')
  }
}

function verifyRound1Research(root: string, actualContext: boolean): void {
  const local = '.civic-research/round1'
  const storage = join(root, local)
  for (let parent = storage; ; parent = dirname(parent)) {
    const stats = lstatSync(parent)
    if (!stats.isDirectory() || stats.isSymbolicLink())
      throw new Error('Research root/ancestors must be regular directories without reparse points')
    if (dirname(parent) === parent) break
  }
  const top = readdirSync(storage, { withFileTypes: true })
  if (
    top.length !== ROUND1_RESEARCH_DIRS.length ||
    top.some((entry) => !entry.isDirectory() || !ROUND1_RESEARCH_DIRS.includes(entry.name)) ||
    scanCivicProofStorageSymlinks(storage)
  )
    throw new Error('CIVIC_HUMAN_VALIDATION_RESEARCH_STORAGE_COLLISION')
  for (const directory of ROUND1_RESEARCH_DIRS) {
    if (
      readdirSync(join(storage, directory), { withFileTypes: true }).some(
        (entry) => !entry.isFile(),
      )
    )
      throw new Error('Research subdirectories may contain only approved regular JSON files')
  }
  if (actualContext) {
    if (resolve(root).toLowerCase() !== resolve(CIVIC_SLICE0_APPROVAL.worktree).toLowerCase())
      throw new Error('Unapproved research worktree')
    if (execFileSync('git', ['-C', root, 'ls-files', '--', local], { encoding: 'utf8' }).trim())
      throw new Error('Participant research evidence is repository tracked')
    execFileSync('git', ['-C', root, 'check-ignore', '--quiet', `${local}/sessions/probe.json`])
    const aclCheck = [
      "$ErrorActionPreference='Stop';",
      `$root='${CIVIC_HUMAN_ROUND1_APPROVAL.evidenceDirectory}';`,
      '$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent();',
      "if($identity.Name -ne 'AzureAD\\AubertNungisa'){throw 'Unapproved custodian account'};",
      '$paths=@($root)+(Get-ChildItem -LiteralPath $root -Force -Recurse).FullName;',
      'foreach($path in $paths){$acl=Get-Acl -LiteralPath $path;',
      "if($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $identity.User.Value){throw 'Custodian owner mismatch'};",
      "if($path -eq $root -and -not $acl.AreAccessRulesProtected){throw 'Inherited root ACL prohibited'};",
      '$rules=$acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]);',
      "if($rules.Count -eq 0){throw 'Custodian access missing'};",
      "foreach($rule in $rules){if($rule.IdentityReference.Value -ne $identity.User.Value -or $rule.AccessControlType -ne 'Allow'){throw 'Non-custodian research access'}}};",
      "Write-Output 'CUSTODIAN_ONLY_ACL_PASS'",
    ].join('')
    if (
      execFileSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', aclCheck], {
        encoding: 'utf8',
      }).trim() !== 'CUSTODIAN_ONLY_ACL_PASS'
    )
      throw new Error('Custodian-only ACL verification failed')
  }
  const sessions = new Map<string, Record<string, unknown>>()
  const consents = new Map<string, Record<string, unknown>>()
  const indices = new Set<number>()
  const common = ['participantCode', 'classification', 'scenarioBoundary', 'identityTreatment']
  const files = walkFiles(storage)
  for (const file of files) {
    const artifact = relative(storage, file).replace(/\\/g, '/')
    const [category, name, extra] = artifact.split('/')
    const code = name?.replace(/\.json$/, '')
    if (
      extra ||
      !ROUND1_RESEARCH_DIRS.includes(category) ||
      (category === 'synthesis'
        ? name !== 'round1.json'
        : !ROUND1_CODES.includes(code) || !name.endsWith('.json'))
    )
      throw new Error('Unapproved research file; no arbitrary evidence path')
    const text = readRegularArchivalArtifact(root, `${local}/${artifact}`).toString('utf8')
    const record = parseRound1ResearchJson(text)
    const fields =
      category === 'administration'
        ? ['contactName', 'contactChannel']
        : category === 'consent'
          ? ['consentState', 'noticeVersion', 'recording']
          : category === 'sessions'
            ? ['sessionIndex', 'sessionDate', 'lens', 'status', 'consentState']
            : category === 'observations'
              ? ['records']
              : ['participantCodes', 'findings', 'disposition']
    requireResearchObject(record, [
      ...(category === 'synthesis' ? common.slice(1) : common),
      ...fields,
    ])
    if (
      record.classification !== CIVIC_HUMAN_ROUND1_APPROVAL.classification ||
      record.scenarioBoundary !== 'SYNTHETIC_SCENARIO_ONLY' ||
      (category !== 'synthesis' && record.participantCode !== code) ||
      (category !== 'administration' && record.identityTreatment !== 'CODED_ONLY')
    )
      throw new Error('Research identity, classification or synthetic boundary mismatch')
    if (
      category !== 'administration' &&
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:Daphne Osborne|Richard Sharpe|Tom Osborne)\b|\+\d[\d ()-]{8,}\d|\(\d{3}\)[ -]?\d{3}[- ]?\d{4}/i.test(
        text,
      )
    )
      throw new Error('Detectable participant identifier in coded research evidence')
    if (category === 'administration') {
      if (
        ['contactName', 'contactChannel'].some(
          (key) => record[key] !== undefined && typeof record[key] !== 'string',
        )
      )
        throw new Error('Invalid minimal administration contact')
    } else if (category === 'consent') {
      if (
        !['GRANTED', 'WITHDRAWN'].includes(String(record.consentState)) ||
        record.noticeVersion !== 'R1-STATIC-1' ||
        record.recording !== false
      )
        throw new Error('Affirmative notice-versioned consent/no-recording required')
      consents.set(code, record)
    } else if (category === 'sessions') {
      const index = record.sessionIndex
      const instant = typeof record.sessionDate === 'string' ? Date.parse(record.sessionDate) : NaN
      if (
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 1 ||
        index > 6 ||
        indices.has(index) ||
        !Number.isFinite(instant) ||
        typeof record.sessionDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/.test(
          record.sessionDate,
        ) ||
        slice2InstantNanoseconds(record.sessionDate) <
          slice2InstantNanoseconds(CIVIC_HUMAN_ROUND1_APPROVAL.effectiveAt) ||
        slice2InstantNanoseconds(record.sessionDate) >=
          slice2InstantNanoseconds(CIVIC_HUMAN_ROUND1_APPROVAL.expiresAt) ||
        record.lens !== `${code.slice(3, 4)}_GATE` ||
        !['COMPLETED', 'STOPPED'].includes(String(record.status)) ||
        record.consentState !== 'GRANTED'
      )
        throw new Error('Session count, ordering, exact window, lens or consent invalid')
      indices.add(index)
      sessions.set(code, record)
    } else if (category === 'observations') {
      checkRound1Observations(record.records)
    } else {
      checkRound1Observations(record.findings)
      if (
        !Array.isArray(record.participantCodes) ||
        record.participantCodes.length === 0 ||
        record.participantCodes.some(
          (item) => typeof item !== 'string' || !ROUND1_CODES.includes(item),
        ) ||
        new Set(record.participantCodes).size !== record.participantCodes.length ||
        ![
          'HUMAN_VALIDATION_PASS',
          'HUMAN_VALIDATION_PASS_WITH_LIMITATIONS',
          'HUMAN_VALIDATION_FAIL',
          'HUMAN_VALIDATION_INCONCLUSIVE',
        ].includes(String(record.disposition))
      )
        throw new Error('Invalid future synthesis coverage or disposition')
    }
  }
  if (sessions.size > CIVIC_HUMAN_ROUND1_APPROVAL.maximumSessions)
    throw new Error('Maximum six participant sessions')
  for (const [code] of sessions) {
    if (consents.get(code)?.consentState !== 'GRANTED')
      throw new Error(
        'Session requires granted consent; withdrawn evidence must be isolated from active research',
      )
  }
  for (const file of files) {
    const artifact = relative(storage, file).replace(/\\/g, '/')
    if (artifact.startsWith('observations/') && !sessions.has(artifact.slice(13, -5)))
      throw new Error('Observations cannot precede consented sessions')
    if (artifact === 'synthesis/round1.json') {
      const record = parseRound1ResearchJson(readFileSync(file, 'utf8'))
      const codes = valueAt(record, 'participantCodes')
      if (!Array.isArray(codes) || codes.some((code) => sessions.get(code)?.status !== 'COMPLETED'))
        throw new Error('No synthesis before completed consented sessions')
      if (
        String(valueAt(record, 'disposition')).startsWith('HUMAN_VALIDATION_PASS') &&
        (sessions.size !== 6 ||
          codes.length !== 6 ||
          codes.some((code) => !existsSync(join(storage, 'observations', `${code}.json`))))
      )
        throw new Error('Incomplete lens evidence cannot PASS')
    }
  }
}

function round1DocumentationReviewAllowed(
  root: string,
  findings: DoctrineFinding[],
  context?: CivicDoctrineValidationContext,
): boolean {
  const deny = (observed: string) => {
    findings.push(
      finding(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
        CIVIC_HUMAN_ROUND1_AUTHORIZATION,
        ARCHIVAL_AUTHORITY,
        'exact finite six-session human grant; approved custodian-only research; runtime closed',
        observed,
      ),
    )
    return false
  }
  const amendment = readText(root, ARCHIVAL_AUTHORITY)
    ?.replace(/\r/g, '')
    .split(ROUND1_AMENDMENT_HEADING)
  const section = amendment?.[1]?.split('\n## ')[0]
  const decision = [
    '**Amendment:** `ROUND_1_EVIDENCE_GOVERNANCE_AND_PLAN_RECONCILIATION`',
    '**Maintainer:** Aubert Nungisa',
    '**Human decision date:** 2026-10-12',
    `**Exact authorization path:** \`${CIVIC_HUMAN_ROUND1_AUTHORIZATION}\``,
    `**Exact materials path:** \`${CIVIC_HUMAN_ROUND1_MATERIALS}\``,
    `**Exact revised plan:** \`${CIVIC_HUMAN_VALIDATION_PLAN}\``,
    `**Research path:** \`${CIVIC_HUMAN_ROUND1_APPROVAL.evidenceDirectory}\``,
    '**Custodian / facilitator:** Aubert Nungisa',
    '**Access:** `CUSTODIAN_ONLY`',
    '**Retention:** `90 DAYS AFTER ROUND_1_CLOSEOUT`; human review, no silent extension.',
    '**Recording default:** `NO_AUDIO_VIDEO_RECORDING`',
    '**Data boundary:** `SYNTHETIC_SCENARIO_ONLY`',
    '**Runtime execution:** `NOT_AUTHORIZED`',
  ]
  if (
    amendment?.length !== 2 ||
    !section ||
    decision.some(
      (required) =>
        section.split('\n').filter((line) => line === required).length !== 1 ||
        section.split('\n').filter((line) => line.startsWith(required.split(':')[0] + ':'))
          .length !== 1,
    )
  )
    return deny('exact Round 1 reconciliation amendment missing or converted')
  try {
    for (const [artifact, expected] of Object.entries(ROUND1_DOCUMENT_FINGERPRINTS)) {
      const text = readRegularArchivalArtifact(root, artifact)
        .toString('utf8')
        .replace(/\r\n/g, '\n')
      if (createHash('sha256').update(text).digest('hex') !== expected.sha256)
        return deny(
          'reviewed Round 1 authority/materials changed; no permission or findings conversion',
        )
      if (artifact === CIVIC_HUMAN_ROUND1_AUTHORIZATION) {
        const blocks = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)]
        if (
          blocks.length !== 1 ||
          stable(JSON.parse(blocks[0][1])) !== stable(CIVIC_HUMAN_ROUND1_APPROVAL)
        )
          return deny('finite human grant mismatch or revoked')
      }
    }
    verifyRound1Research(root, !context)
  } catch (error) {
    return deny(error instanceof Error ? error.message : String(error))
  }
  return true
}

function slice1Allowed(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
  context?: CivicDoctrineValidationContext,
  execution = false,
  slice2 = false,
  humanPlanReview = false,
  round1Review = false,
): boolean {
  if (contract.runtimeAuthorization.slice1 === undefined) return false
  const deny = (observed: unknown) => {
    findings.push(
      finding(
        'CIVIC_SLICE1_AUTHORIZATION_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        CIVIC_SLICE1_REVIEW_PACKET,
        'exact human-approved finite synthetic local Slice 1',
        observed,
      ),
    )
    return false
  }
  if (
    contract.schemaVersion !== 2 ||
    contract.runtimeAuthorization.authorized !== false ||
    stable(contract.runtimeAuthorization.slice1) !== stable(CIVIC_SLICE1_APPROVAL) ||
    stable(contract.runtimeAuthorization.slice0) !== stable(CIVIC_SLICE0_APPROVAL) ||
    !slice1DecisionRecorded(root)
  )
    return deny('grant or recorded human decision mismatch')
  if (
    !readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md')?.includes(
      '**Authorization terminated:** YES',
    )
  )
    return deny('Slice 0 must remain terminated')
  const terminated =
    readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_1_PROOF.md')?.includes(
      '**Authorization terminated:** YES',
    ) === true
  if (execution && terminated) return deny('Slice 1 authorization terminated')
  if (execution && process.env.NODE_ENV === 'production') return deny('production prohibited')
  const slice2PacketPresent = existsSync(join(root, CIVIC_SLICE2_REVIEW_PACKET))
  const slice2Review =
    !execution && slice2PacketPresent && slice2DocumentationReviewAllowed(root, contract)
  if (slice2PacketPresent && !slice2Review && !slice2)
    return deny(
      'Slice 2 packet requires exact documentation amendment, accepted terminated archives and pending non-executable decision',
    )
  let current: CivicDoctrineValidationContext
  try {
    current = context ?? gitContext(root)
  } catch (error) {
    return deny(error instanceof Error ? error.message : String(error))
  }
  const now = current.now.getTime()
  if (
    !(terminated && !execution) &&
    (!Number.isFinite(now) ||
      now < Date.parse(CIVIC_SLICE1_APPROVAL.effectiveAt) ||
      now >= Date.parse(CIVIC_SLICE1_APPROVAL.expiresAt))
  )
    return deny('ineffective or expired')
  if (
    current.branch !== CIVIC_SLICE1_APPROVAL.branch ||
    resolve(current.worktree).toLowerCase() !==
      resolve(CIVIC_SLICE1_APPROVAL.worktree).toLowerCase() ||
    !current.descendsFromApprovedSha
  )
    return deny('wrong isolation context')
  const paths = [
    ...CIVIC_SLICE0_APPROVAL.writablePaths,
    ...CIVIC_SLICE1_APPROVAL.writablePaths,
    'docs/public-service/operations/three-reality-hardening-report.md',
    ...(slice2 ? CIVIC_SLICE2_APPROVAL.writablePaths : []),
    ...(slice2 && !execution && humanPlanReview ? [CIVIC_HUMAN_VALIDATION_PLAN] : []),
    ...(slice2 && !execution && round1Review ? Object.keys(ROUND1_DOCUMENT_FINGERPRINTS) : []),
  ]
  const outside = current.changedPaths.filter(
    (path) =>
      !(slice2Review && path === CIVIC_SLICE2_REVIEW_PACKET) &&
      !paths.some(
        (allowed) =>
          path === allowed ||
          ([
            'apps/civic/src/slice1',
            'apps/civic/tests/slice1',
            ...(slice2 ? ['apps/civic/src/slice2', 'apps/civic/tests/slice2'] : []),
          ].includes(allowed) &&
            path.startsWith(`${allowed}/`)) ||
          path in SLICE0_ARCHIVED_FILES,
      ),
  )
  if (outside.length) return deny({ unauthorizedChangedPaths: outside })
  const storage = join(root, '.civic-runtime', 'slice1')
  for (const path of [join(root, '.civic-runtime'), storage, join(storage, 'checkpoints')]) {
    if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink()))
      return deny('storage must be local regular directories, no symlinks')
  }
  if (!context) {
    if (!existsSync(join(storage, 'checkpoints'))) return deny('approved storage structure missing')
    if (
      execFileSync('git', ['-C', root, 'ls-files', '--', '.civic-runtime/slice1'], {
        encoding: 'utf8',
      }).trim()
    )
      return deny('runtime artifacts tracked')
    try {
      execFileSync('git', [
        '-C',
        root,
        'check-ignore',
        '--quiet',
        '.civic-runtime/slice1/probe.sqlite',
      ])
    } catch (error) {
      return deny(`storage exclusion missing: ${String(error)}`)
    }
    if (scanCivicProofStorageSymlinks(storage)) return deny('storage symlink prohibited')
  }
  return true
}

export function assertCivicSlice1Authorized(root: string): void {
  const findings: DoctrineFinding[] = []
  const contract = loadContract(root, findings)
  if (!contract || !slice1Allowed(root, contract, findings, undefined, true))
    throw new Error(
      `CIVIC_RUNTIME_SLICE_1_STOP_REQUIRED: ${findings.map(formatDoctrineFinding).join('\n')}`,
    )
  validateRuntime(root, contract, findings)
  if (findings.length)
    throw new Error(
      `CIVIC_RUNTIME_SLICE_1_STOP_REQUIRED: ${findings.map(formatDoctrineFinding).join('\n')}`,
    )
}

export const CIVIC_SLICE2_APPROVAL = {
  enabled: true,
  scope: 'synthetic-local-runtime-slice-2',
  decisionArtifact: CIVIC_SLICE2_REVIEW_PACKET,
  startingSha: CIVIC_SLICE0_APPROVAL.startingSha,
  branch: CIVIC_SLICE0_APPROVAL.branch,
  worktree: CIVIC_SLICE0_APPROVAL.worktree,
  effectiveAt: '2026-10-12T14:38:49.5329498+00:00',
  expiresAt: '2026-10-19T14:38:49.5329498+00:00',
  revokedAt: null,
  dataBoundary: 'SYNTHETIC_ONLY',
  production: false,
  deployment: false,
  slice3: false,
  proofOwner: 'Aubert Nungisa',
  anchorCustodian: 'Aubert Nungisa',
  storageDirectory: 'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice2',
  checkpointDirectory:
    'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice2\\checkpoints',
  adversarialDirectory:
    'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-runtime\\slice2\\adversarial-copies',
  anchorDirectory: 'C:\\APPS\\nzila-os.worktrees\\pasted-text-processing\\.civic-anchor\\slice2',
  writablePaths: [
    'apps/civic/src/slice2',
    'apps/civic/tests/slice2',
    'apps/civic/slice2.tsconfig.json',
    'apps/civic/slice2.vitest.config.ts',
    CIVIC_SLICE2_REVIEW_PACKET,
    'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md',
    CIVIC_OCI_CONTRACT_PATH,
    'scripts/lib/civic-oci-doctrine.ts',
    'tooling/contract-tests/civic-oci-doctrine-integrity.test.ts',
    ARCHIVAL_AUTHORITY,
  ],
  sharedReuse: [...CIVIC_SLICE0_APPROVAL.sharedReuse],
} as const
export const CIVIC_SLICE2_TERMINATED_AT: string | null = '2026-10-12T20:28:37.5704126+00:00'

function slice2Surface(artifact: string): boolean {
  return /^(apps\/civic\/src\/slice2\/[a-z0-9-]+\.ts|apps\/civic\/tests\/slice2\/[a-z0-9-]+\.test\.ts|apps\/civic\/slice2\.(tsconfig\.json|vitest\.config\.ts))$/.test(
    artifact,
  )
}

function slice2InstantNanoseconds(value: string): bigint {
  const fraction = /\.(\d+)(?:Z|[+-]\d\d:\d\d)$/.exec(value)?.[1] ?? ''
  return BigInt(Date.parse(value)) * 1_000_000n + BigInt(fraction.slice(3).padEnd(6, '0'))
}

function slice2Allowed(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
  context?: CivicDoctrineValidationContext,
  execution = false,
  humanPlanReview = false,
  round1Review = false,
): boolean {
  if (contract.runtimeAuthorization.slice2 === undefined) return false
  const deny = (observed: unknown) => {
    findings.push(
      finding(
        'CIVIC_SLICE2_AUTHORIZATION_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        CIVIC_SLICE2_REVIEW_PACKET,
        'exact amended finite synthetic local Slice 2',
        observed,
      ),
    )
    return false
  }
  if (
    contract.schemaVersion !== 2 ||
    contract.runtimeAuthorization.authorized !== false ||
    (stable(contract.runtimeAuthorization.slice2) !== stable(CIVIC_SLICE2_APPROVAL) &&
      (CIVIC_SLICE2_TERMINATED_AT === null ||
        stable(contract.runtimeAuthorization.slice2) !==
          stable({ ...CIVIC_SLICE2_APPROVAL, revokedAt: CIVIC_SLICE2_TERMINATED_AT })))
  )
    return deny('grant mismatch or revoked')
  const packet = readText(root, CIVIC_SLICE2_REVIEW_PACKET)?.replace(/\r/g, '')
  const blocks = packet?.split('## MAINTAINER DECISION\n')
  if (
    blocks?.length !== 2 ||
    blocks[1].trim() !== CIVIC_SLICE2_RECORDED_DECISION ||
    !blocks[0].includes('**Immediate activation amendment:** HUMAN_MAINTAINER_APPROVED') ||
    !blocks[0].includes('**Proposed data boundary:** `SLICE_2_DATA_BOUNDARY = SYNTHETIC_ONLY`')
  )
    return deny('recorded amended human decision mismatch')
  for (const slice of [0, 1]) {
    const proof = readText(
      root,
      `docs/public-service/operations/CIVIC_RUNTIME_SLICE_${slice}_PROOF.md`,
    )
    if (
      !proof?.includes('**Authorization terminated:** YES') ||
      !proof.includes(
        `**Human proof-owner acceptance:** \`CIVIC_RUNTIME_SLICE_${slice}_ACCEPTED_WITH_LIMITATIONS\``,
      )
    )
      return deny('accepted Slice 0/1 must remain terminated')
  }
  const terminated =
    readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_2_PROOF.md')?.includes(
      '**Authorization terminated:** YES',
    ) === true
  if (execution && process.env.NODE_ENV === 'production') return deny('production prohibited')
  if (execution && terminated) return deny('Slice 2 authorization terminated')
  let current: CivicDoctrineValidationContext
  try {
    current = context ?? gitContext(root)
  } catch (error) {
    return deny(error instanceof Error ? error.message : String(error))
  }
  const now = current.now.getTime()
  const closureInEffect =
    CIVIC_SLICE2_TERMINATED_AT !== null &&
    (!context || now >= Date.parse(CIVIC_SLICE2_TERMINATED_AT))
  if (closureInEffect && execution) return deny('Slice 2 authorization terminated')
  if (
    closureInEffect &&
    (!terminated ||
      stable(contract.runtimeAuthorization.slice2) !==
        stable({ ...CIVIC_SLICE2_APPROVAL, revokedAt: CIVIC_SLICE2_TERMINATED_AT }))
  )
    return deny('terminated grant and proof must remain recorded')
  if (
    !(terminated && !execution) &&
    (!Number.isFinite(now) ||
      BigInt(now) * 1_000_000n < slice2InstantNanoseconds(CIVIC_SLICE2_APPROVAL.effectiveAt) ||
      BigInt(now) * 1_000_000n >= slice2InstantNanoseconds(CIVIC_SLICE2_APPROVAL.expiresAt))
  )
    return deny('ineffective or expired')
  if (!slice1Allowed(root, contract, findings, current, false, true, humanPlanReview, round1Review))
    return deny('archival isolation context invalid')
  const archiveFindings: DoctrineFinding[] = []
  validateArchivedSlice0(root, archiveFindings, true, true)
  if (archiveFindings.length) {
    findings.push(...archiveFindings)
    return deny('archive invalid')
  }
  for (const approved of [
    CIVIC_SLICE2_APPROVAL.storageDirectory,
    CIVIC_SLICE2_APPROVAL.checkpointDirectory,
    CIVIC_SLICE2_APPROVAL.adversarialDirectory,
    CIVIC_SLICE2_APPROVAL.anchorDirectory,
  ]) {
    const local = approved.slice(CIVIC_SLICE2_APPROVAL.worktree.length + 1)
    let parent = root
    for (const segment of local.split('\\')) {
      parent = join(parent, segment)
      if (
        existsSync(parent) &&
        (!lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink())
      )
        return deny('storage/anchor must be regular directories without symlinks')
    }
    if (!context && !existsSync(parent)) return deny('approved storage structure missing')
  }
  if (!context) {
    for (const subtree of ['.civic-runtime/slice2', '.civic-anchor/slice2']) {
      if (execFileSync('git', ['-C', root, 'ls-files', '--', subtree], { encoding: 'utf8' }).trim())
        return deny('generated artifacts tracked')
      try {
        execFileSync('git', ['-C', root, 'check-ignore', '--quiet', `${subtree}/probe.json`])
      } catch (error) {
        return deny(`source-control exclusion missing: ${String(error)}`)
      }
      if (scanCivicProofStorageSymlinks(join(root, subtree)))
        return deny('artifact symlink prohibited')
    }
  }
  return true
}

export function validateCivicSlice2Admission(
  root: string,
  context: CivicDoctrineValidationContext,
): DoctrineFinding[] {
  const findings: DoctrineFinding[] = []
  const contract = loadContract(root, findings)
  if (contract && !slice2Allowed(root, contract, findings, context, true) && !findings.length)
    findings.push(
      finding(
        'CIVIC_SLICE2_AUTHORIZATION_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        CIVIC_SLICE2_REVIEW_PACKET,
        'exact Slice 2 grant',
        'no scoped Slice 2 grant',
      ),
    )
  return findings
}

export function assertCivicSlice2Authorized(root: string): void {
  const findings: DoctrineFinding[] = []
  const contract = loadContract(root, findings)
  if (!contract || !slice2Allowed(root, contract, findings, undefined, true))
    throw new Error(
      `CIVIC_RUNTIME_SLICE_2_STOP_REQUIRED: ${findings.map(formatDoctrineFinding).join('\n')}`,
    )
  validateRuntime(root, contract, findings)
  if (findings.length)
    throw new Error(
      `CIVIC_RUNTIME_SLICE_2_STOP_REQUIRED: ${findings.map(formatDoctrineFinding).join('\n')}`,
    )
}

function scanSlice1File(
  root: string,
  artifact: string,
  findings: DoctrineFinding[],
  slice2 = false,
): void {
  const deny = (observed: string) =>
    findings.push(
      finding(
        slice2 ? 'CIVIC_SLICE2_SURFACE_INVALID' : 'CIVIC_SLICE1_SURFACE_INVALID',
        artifact,
        CIVIC_SLICE1_REVIEW_PACKET,
        'bounded synthetic local continuity source',
        observed,
      ),
    )
  if (!(slice2 ? slice2Surface(artifact) : slice1Surface(artifact))) {
    deny('unapproved surface')
    return
  }
  const text = readText(root, artifact)!
  if (artifact.endsWith('.json')) {
    try {
      JSON.parse(text)
    } catch (error) {
      deny(String(error))
    }
    return
  }
  const source = ts.createSourceFile(artifact, text, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const specifier = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : ''
      const local = specifier.startsWith('.')
        ? relative(join(root, 'apps/civic'), resolve(root, artifact, '..', specifier)).replace(
            /\\/g,
            '/',
          )
        : ''
      const allowedLocal =
        (slice2 &&
          (/^(src\/slice2|tests\/slice2)\//.test(local) ||
            ['src/slice1/model', 'src/slice1/scenario'].includes(local) ||
            (artifact === 'apps/civic/slice2.vitest.config.ts' &&
              specifier === './vitest.config'))) ||
        (!slice2 &&
          (/^(src\/slice1|tests\/slice1)\//.test(local) ||
            local === 'src/scenario' ||
            local === 'src/kernel' ||
            (artifact === 'apps/civic/slice1.vitest.config.ts' && specifier === './vitest.config')))
      const adapter =
        (artifact === 'apps/civic/src/slice2/authorization.ts' &&
          specifier === '../../../../scripts/lib/civic-oci-doctrine') ||
        (artifact === 'apps/civic/src/slice1/authorization.ts' &&
          specifier === '../../../../scripts/lib/civic-oci-doctrine')
      const nodeAllowed =
        (slice2 &&
          ((['apps/civic/src/slice2/store.ts', 'apps/civic/src/slice2/anchor.ts'].includes(
            artifact,
          ) &&
            ['node:sqlite', 'node:crypto', 'node:fs', 'node:path'].includes(specifier)) ||
            (artifact === 'apps/civic/src/slice2/authorization.ts' && specifier === 'node:path') ||
            (['apps/civic/src/slice2/worker.ts', 'apps/civic/src/slice2/harness.ts'].includes(
              artifact,
            ) &&
              [
                'node:child_process',
                'node:fs',
                'node:path',
                'node:sqlite',
                'node:crypto',
                'node:os',
                'node:perf_hooks',
              ].includes(specifier)) ||
            (artifact.startsWith('apps/civic/tests/slice2/') &&
              [
                'vitest',
                'node:child_process',
                'node:fs',
                'node:path',
                'node:sqlite',
                'node:crypto',
              ].includes(specifier)) ||
            (artifact === 'apps/civic/slice2.vitest.config.ts' &&
              specifier === 'vitest/config'))) ||
        (artifact === 'apps/civic/src/slice1/store.ts' &&
          ['node:sqlite', 'node:crypto', 'node:fs', 'node:path'].includes(specifier)) ||
        (artifact === 'apps/civic/src/slice1/authorization.ts' && specifier === 'node:path') ||
        (artifact.startsWith('apps/civic/tests/slice1/') &&
          ['node:child_process', 'node:fs', 'node:path', 'node:sqlite', 'vitest'].includes(
            specifier,
          )) ||
        (artifact === 'apps/civic/slice1.vitest.config.ts' && specifier === 'vitest/config')
      if (
        !allowedLocal &&
        !adapter &&
        !nodeAllowed &&
        !CIVIC_SLICE1_APPROVAL.sharedReuse.some((item) => item === specifier)
      )
        deny(`unapproved import ${specifier}`)
    }
    if (
      ts.isImportEqualsDeclaration(node) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
    )
      deny('dynamic import prohibited')
    if (
      ts.isIdentifier(node) &&
      [
        'fetch',
        'WebSocket',
        'XMLHttpRequest',
        'eval',
        'Function',
        'require',
        'globalThis',
        'Deno',
        'Bun',
      ].includes(node.text)
    )
      deny(`prohibited capability ${node.text}`)
    if (
      ts.isIdentifier(node) &&
      node.text === 'process' &&
      !artifact.startsWith('apps/civic/tests/slice1/') &&
      artifact !== 'apps/civic/src/slice1/worker.ts' &&
      !(
        slice2 &&
        (artifact.startsWith('apps/civic/tests/slice2/') ||
          ['apps/civic/src/slice2/worker.ts', 'apps/civic/src/slice2/harness.ts'].includes(
            artifact,
          ))
      )
    )
      deny('process only allowed in bounded proof worker')
    ts.forEachChild(node, visit)
  }
  visit(source)
}

export function assertCivicSlice0Authorized(root: string): void {
  const findings: DoctrineFinding[] = []
  const contract = loadContract(root, findings)
  if (!contract || !slice0Allowed(root, contract, findings)) {
    throw new Error(
      `CIVIC_RUNTIME_SLICE_0_STOP_REQUIRED: ${findings.map(formatDoctrineFinding).join('\n') || 'no scoped grant'}`,
    )
  }
}

function scanSlice0File(root: string, artifact: string, findings: DoctrineFinding[]): void {
  const deny = (observed: unknown) =>
    findings.push(
      finding(
        'CIVIC_SLICE0_SURFACE_INVALID',
        artifact,
        CIVIC_OCI_CONTRACT_PATH,
        'local synthetic-only allowlisted surface',
        observed,
      ),
    )
  if (
    !/^(apps\/civic\/(src|tests)\/[^.].*\.ts|apps\/civic\/fixtures\/[^.].*\.json|apps\/civic\/(vitest\.config\.ts|tsconfig\.json))$/.test(
      artifact,
    )
  ) {
    deny('runtime artifact outside approved path/extension')
    return
  }
  const text = readText(root, artifact)!
  if (artifact.endsWith('.json')) {
    try {
      const data: unknown = JSON.parse(text)
      if (artifact.includes('/fixtures/') && valueAt(data, 'syntheticOnly') !== true)
        deny('fixture must declare syntheticOnly=true')
    } catch (error) {
      deny(error instanceof Error ? error.message : String(error))
    }
    return
  }
  const source = ts.createSourceFile(artifact, text, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) {
        deny('nonliteral import')
        return
      }
      const specifier = node.moduleSpecifier.text
      const testFile = artifact.includes('/tests/') || artifact.endsWith('vitest.config.ts')
      const local =
        specifier.startsWith('.') &&
        relative(join(root, 'apps/civic'), resolve(root, artifact, '..', specifier)).replace(
          /\\/g,
          '/',
        )
      const allowedLocal =
        local &&
        !local.startsWith('..') &&
        !local.startsWith('/') &&
        /^(src|tests|fixtures)\//.test(local)
      const governanceGuard =
        specifier === '../../../scripts/lib/civic-oci-doctrine' &&
        artifact === 'apps/civic/src/authorization.ts'
      const allowedShared = CIVIC_SLICE0_APPROVAL.sharedReuse.some((item) => item === specifier)
      if (
        !allowedLocal &&
        !allowedShared &&
        !governanceGuard &&
        !(testFile && ['vitest', 'vitest/config'].includes(specifier))
      )
        deny(`disallowed import: ${specifier}`)
    }
    if (
      ts.isImportEqualsDeclaration(node) ||
      (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
    )
      deny('dynamic/module import prohibited')
    if (
      ts.isIdentifier(node) &&
      [
        'fetch',
        'WebSocket',
        'XMLHttpRequest',
        'eval',
        'Function',
        'require',
        'globalThis',
        'process',
        'Deno',
        'Bun',
      ].includes(node.text)
    )
      deny(`prohibited runtime capability: ${node.text}`)
    ts.forEachChild(node, visit)
  }
  visit(source)
}
function validateRuntimeAliases(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
): void {
  const appsRoot = join(root, 'apps')
  if (!existsSync(appsRoot) || !statSync(appsRoot).isDirectory()) return

  const canonicalRoot = contract.runtimeAuthorization.applicationRoot.replace(/\\/g, '/')
  for (const file of walkFiles(appsRoot)) {
    const artifact = relative(root, file).replace(/\\/g, '/')
    if (artifact === canonicalRoot || artifact.startsWith(`${canonicalRoot}/`)) continue

    const segments = artifact.toLowerCase().split('/')
    if (!segments.includes('civic')) continue

    const name = segments.at(-1) ?? ''
    const isRuntimeArtifact =
      RUNTIME_EXTENSIONS.has(extname(file).toLowerCase()) ||
      RUNTIME_CONFIG.test(name) ||
      name === 'package.json'
    if (!isRuntimeArtifact) continue

    findings.push(
      finding(
        'CIVIC_RUNTIME_UNAUTHORIZED',
        artifact,
        CIVIC_OCI_CONTRACT_PATH,
        `CIVIC runtime confined to ${canonicalRoot} and explicitly authorized`,
        'runtime-bearing CIVIC alias outside the canonical application root',
      ),
    )
  }
}

function validateRuntime(
  root: string,
  contract: DoctrineContract,
  findings: DoctrineFinding[],
  context?: CivicDoctrineValidationContext,
  humanPlanReview = false,
  round1Review = false,
): void {
  validateRuntimeAliases(root, contract, findings)
  const slice2 = slice2Allowed(
    root,
    contract,
    findings,
    context,
    false,
    humanPlanReview,
    round1Review,
  )
  const slice1 =
    contract.runtimeAuthorization.slice2 !== undefined
      ? slice2
      : slice1Allowed(root, contract, findings, context)
  const permitted =
    contract.runtimeAuthorization.slice1 !== undefined
      ? slice1
      : slice0Allowed(root, contract, findings, context, false)
  const appRoot = join(root, contract.runtimeAuthorization.applicationRoot)
  if (!existsSync(appRoot) || !statSync(appRoot).isDirectory()) {
    findings.push(
      finding(
        'CIVIC_AUTHORITY_MISSING',
        contract.runtimeAuthorization.applicationRoot,
        CIVIC_OCI_CONTRACT_PATH,
        'CIVIC application root',
        'missing',
      ),
    )
    return
  }

  if (
    permitted &&
    readText(root, 'docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md')?.includes(
      '**Authorization terminated:** YES',
    )
  )
    validateArchivedSlice0(root, findings, slice1, slice2)

  for (const entry of readdirSync(appRoot, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      RUNTIME_DIRECTORIES.has(entry.name.toLowerCase()) &&
      !(permitted && entry.name === 'src')
    ) {
      findings.push(
        finding(
          'CIVIC_RUNTIME_UNAUTHORIZED',
          relative(root, join(appRoot, entry.name)).replace(/\\/g, '/'),
          CIVIC_OCI_CONTRACT_PATH,
          'placeholder/governance metadata only',
          `runtime directory ${entry.name}`,
        ),
      )
    }
  }

  for (const file of walkFiles(appRoot)) {
    const artifact = relative(root, file).replace(/\\/g, '/')
    const name = file.split(/[\\/]/).pop() ?? ''
    if (slice2 && slice2Surface(artifact)) {
      if (lstatSync(file).isSymbolicLink())
        findings.push(
          finding(
            'CIVIC_SLICE2_SURFACE_INVALID',
            artifact,
            CIVIC_SLICE2_REVIEW_PACKET,
            'regular local source',
            'symlink',
          ),
        )
      scanSlice1File(root, artifact, findings, true)
      continue
    }
    if (slice1 && slice1Surface(artifact)) {
      if (lstatSync(file).isSymbolicLink())
        findings.push(
          finding(
            'CIVIC_SLICE1_SURFACE_INVALID',
            artifact,
            CIVIC_SLICE1_REVIEW_PACKET,
            'regular local source',
            'symlink',
          ),
        )
      scanSlice1File(root, artifact, findings)
      continue
    }
    if (permitted) {
      const metadata = [
        'apps/civic/README.md',
        'apps/civic/package.json',
        'apps/civic/maturity.json',
        'apps/civic/control-manifest.json',
        'apps/civic/.env.example',
      ]
      let nonRuntimeMetadata = false
      if (/^apps\/civic\/[^/]+\.json$/.test(artifact) && !metadata.includes(artifact)) {
        try {
          nonRuntimeMetadata = valueAt(JSON.parse(readFileSync(file, 'utf8')), 'runtime') === false
        } catch (error) {
          findings.push(
            finding(
              'CIVIC_SLICE0_SURFACE_INVALID',
              artifact,
              CIVIC_OCI_CONTRACT_PATH,
              'valid non-runtime metadata',
              error instanceof Error ? error.message : String(error),
            ),
          )
        }
      }
      if (
        lstatSync(file).isSymbolicLink() ||
        (!metadata.includes(artifact) &&
          !nonRuntimeMetadata &&
          !/^(apps\/civic\/(src|tests)\/.+\.ts|apps\/civic\/fixtures\/.+\.json|apps\/civic\/(tsconfig\.json|vitest\.config\.ts))$/.test(
            artifact,
          ))
      ) {
        findings.push(
          finding(
            'CIVIC_SLICE0_SURFACE_INVALID',
            artifact,
            CIVIC_OCI_CONTRACT_PATH,
            'only allowlisted files, no symbolic links',
            artifact,
          ),
        )
      }
      if (artifact.includes('/fixtures/') && extname(file) === '.json')
        scanSlice0File(root, artifact, findings)
    }
    if (RUNTIME_EXTENSIONS.has(extname(file).toLowerCase()) || RUNTIME_CONFIG.test(name)) {
      if (permitted) {
        scanSlice0File(root, artifact, findings)
        continue
      }
      findings.push(
        finding(
          'CIVIC_RUNTIME_UNAUTHORIZED',
          artifact,
          CIVIC_OCI_CONTRACT_PATH,
          'placeholder/governance metadata only',
          'runtime source or configuration',
        ),
      )
    }
  }

  const packagePath = join(appRoot, 'package.json')
  if (!existsSync(packagePath)) return
  let packageJson: {
    dependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  try {
    packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as typeof packageJson
  } catch (error) {
    findings.push(
      finding(
        'CIVIC_RUNTIME_UNAUTHORIZED',
        `${contract.runtimeAuthorization.applicationRoot}/package.json`,
        CIVIC_OCI_CONTRACT_PATH,
        'valid placeholder package metadata',
        error instanceof Error ? error.message : String(error),
      ),
    )
    return
  }
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
  }
  if (
    Object.keys(dependencies).some((name) => !permitted || name !== '@nzila/platform-contracts')
  ) {
    findings.push(
      finding(
        'CIVIC_RUNTIME_UNAUTHORIZED',
        `${contract.runtimeAuthorization.applicationRoot}/package.json`,
        CIVIC_OCI_CONTRACT_PATH,
        'no runtime dependencies',
        Object.keys(dependencies),
      ),
    )
  }
  if (permitted) {
    const permittedScripts: Record<string, string> = {
      test: 'vitest run --config vitest.config.ts',
      typecheck: 'tsc --noEmit -p tsconfig.json',
      proof: 'tsx --tsconfig tsconfig.json src/proof.ts',
    }
    if (
      Object.entries(packageJson.scripts ?? {}).some(
        ([key, value]) => permittedScripts[key] !== value,
      )
    ) {
      findings.push(
        finding(
          'CIVIC_SLICE0_SURFACE_INVALID',
          'apps/civic/package.json',
          CIVIC_OCI_CONTRACT_PATH,
          permittedScripts,
          packageJson.scripts,
        ),
      )
    }
  }
  const runtimeScripts = Object.keys(packageJson.scripts ?? {}).filter((script) =>
    RUNTIME_SCRIPTS.has(script),
  )
  if (runtimeScripts.length > 0) {
    findings.push(
      finding(
        'CIVIC_RUNTIME_UNAUTHORIZED',
        `${contract.runtimeAuthorization.applicationRoot}/package.json`,
        CIVIC_OCI_CONTRACT_PATH,
        'no executable runtime scripts',
        runtimeScripts,
      ),
    )
  }
}

export function validateCivicOciDoctrine(
  root: string,
  context?: CivicDoctrineValidationContext,
): DoctrineFinding[] {
  const findings: DoctrineFinding[] = []
  const contract = loadContract(root, findings)
  if (!contract) return findings

  validateContract(contract, findings)
  validateAuthorityPaths(root, contract, findings)
  validateAnchors(root, findings)
  validateMethodStructure(root, contract, findings)
  validateFrontDoor(root, contract, findings)
  const humanPlanPresent =
    existsSync(join(root, CIVIC_HUMAN_VALIDATION_PLAN)) ||
    context?.changedPaths.includes(CIVIC_HUMAN_VALIDATION_PLAN) === true
  const humanPlanReview =
    humanPlanPresent && humanValidationDocumentationReviewAllowed(root, contract, findings)
  const round1Present = Object.keys(ROUND1_DOCUMENT_FINGERPRINTS).some(
    (artifact) => existsSync(join(root, artifact)) || context?.changedPaths.includes(artifact),
  )
  const round1Review =
    round1Present && humanPlanReview && round1DocumentationReviewAllowed(root, findings, context)
  if (round1Present && !humanPlanReview)
    findings.push(
      finding(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
        CIVIC_HUMAN_ROUND1_AUTHORIZATION,
        ARCHIVAL_AUTHORITY,
        'accepted closed archives and exact reviewed plan',
        'human plan archival gate denied',
      ),
    )
  validateRuntime(root, contract, findings, context, humanPlanReview, round1Review)
  return findings
}

export function validateCivicHumanRound1Admission(
  root: string,
  context?: CivicDoctrineValidationContext,
): DoctrineFinding[] {
  const findings = validateCivicOciDoctrine(root, context)
  if (findings.length) return findings
  let observed: string | undefined
  if (!existsSync(join(root, CIVIC_HUMAN_ROUND1_AUTHORIZATION)))
    observed = 'no bounded Round 1 human authorization record'
  else {
    const now = (context?.now ?? new Date()).getTime()
    if (
      !Number.isFinite(now) ||
      BigInt(now) * 1_000_000n <
        slice2InstantNanoseconds(CIVIC_HUMAN_ROUND1_APPROVAL.effectiveAt) ||
      BigInt(now) * 1_000_000n >= slice2InstantNanoseconds(CIVIC_HUMAN_ROUND1_APPROVAL.expiresAt)
    )
      observed = 'Round 1 human authorization ineffective or expired'
  }
  if (observed)
    findings.push(
      finding(
        'CIVIC_HUMAN_ROUND1_AUTHORIZATION_INVALID',
        CIVIC_HUMAN_ROUND1_AUTHORIZATION,
        ARCHIVAL_AUTHORITY,
        'active finite Round 1 window for outreach preparation and controlled research only',
        observed,
      ),
    )
  return findings
}

export function formatDoctrineFinding(item: DoctrineFinding): string {
  return [
    `[${item.id}] ${item.artifact}`,
    `  authority: ${item.authority}`,
    `  expected: ${item.expected}`,
    `  observed: ${item.observed}`,
  ].join('\n')
}
