import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import ts from 'typescript'

export const CIVIC_OCI_CONTRACT_PATH = 'governance/foundations/civic-oci-doctrine.contract.json'

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
  if (contract.schemaVersion !== 1) {
    findings.push(
      finding(
        'CIVIC_CONTRACT_INVALID',
        CIVIC_OCI_CONTRACT_PATH,
        CIVIC_OCI_CONTRACT_PATH,
        1,
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
    if (entry.isDirectory()) files.push(...walkFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
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
): void {
  if (contract.runtimeAuthorization.authorized) return
  validateRuntimeAliases(root, contract, findings)
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

  for (const entry of readdirSync(appRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && RUNTIME_DIRECTORIES.has(entry.name.toLowerCase())) {
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
    if (RUNTIME_EXTENSIONS.has(extname(file).toLowerCase()) || RUNTIME_CONFIG.test(name)) {
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
  if (Object.keys(dependencies).length > 0) {
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

export function validateCivicOciDoctrine(root: string): DoctrineFinding[] {
  const findings: DoctrineFinding[] = []
  const contract = loadContract(root, findings)
  if (!contract) return findings

  validateContract(contract, findings)
  validateAuthorityPaths(root, contract, findings)
  validateAnchors(root, findings)
  validateMethodStructure(root, contract, findings)
  validateFrontDoor(root, contract, findings)
  validateRuntime(root, contract, findings)
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
