import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ue = 'apps/union-eyes/'
const outputDirectory = 'docs/union-eyes/reality-remediation/'
const jsonPath = `${outputDirectory}PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json`
const markdownPath = `${outputDirectory}PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.md`
const pageIndexPath = 'docs/union-eyes/PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json'
const r2cPath = `${outputDirectory}PHASE_1B_1_R2C_TARGETLESS_EFFECT_CLOSEOUT.json`
const pageIndexHash = '12e792326068865f7903a21105b26db8549d69d9110e849f5207546184d71353'
const digest = (value) => createHash('sha256').update(value).digest('hex')
const sourcePath = (relative) => path.resolve(root, ...relative.split('/'))
const readText = (relative) => readFileSync(sourcePath(relative), 'utf8')
const toPosix = (value) => value.split(path.sep).join('/')
const excludedDirectory = new Set([
  '.next',
  'coverage',
  'dist',
  'node_modules',
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'tests',
])

function walk(directory, predicate = () => true) {
  if (!existsSync(directory)) return []
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excludedDirectory.has(entry.name))
        files.push(...walk(path.join(directory, entry.name), predicate))
    } else if (entry.isFile() && predicate(entry.name)) {
      files.push(path.join(directory, entry.name))
    }
  }
  return files.sort((a, b) => a.localeCompare(b))
}

function parse(relative, text = readText(relative)) {
  const kind = relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, kind)
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function lineEndOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.end).line + 1
}

function textOf(sourceFile, node) {
  return sourceFile.text.slice(node.getStart(sourceFile), node.end)
}

function hasModifier(node, modifier) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((item) => item.kind === modifier)
  )
}

function stringLiteral(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null
}

function walkNodes(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walkNodes(child, visit))
}

function declarationName(node) {
  return node.name && ts.isIdentifier(node.name) ? node.name.text : null
}

function exportedNames(statement) {
  const names = []
  if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
    if (statement.name) names.push(statement.name.text)
  }
  if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      if (ts.isObjectBindingPattern(declaration.name)) {
        for (const element of declaration.name.elements) {
          if (ts.isIdentifier(element.name)) names.push(element.name.text)
        }
      }
    }
  }
  if (
    ts.isExportDeclaration(statement) &&
    statement.exportClause &&
    ts.isNamedExports(statement.exportClause)
  ) {
    for (const element of statement.exportClause.elements) names.push(element.name.text)
  }
  return names
}

function functionLikeInitializer(initializer) {
  if (!initializer) return false
  if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return true
  if (ts.isCallExpression(initializer)) {
    return initializer.arguments.some(
      (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
    )
  }
  return false
}

function isAsyncExport(statement, name) {
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === name)
    return !!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
  if (!ts.isVariableStatement(statement)) return false
  return statement.declarationList.declarations.some((declaration) => {
    const names = ts.isIdentifier(declaration.name)
      ? [declaration.name.text]
      : ts.isObjectBindingPattern(declaration.name)
        ? declaration.name.elements.flatMap((element) =>
            ts.isIdentifier(element.name) ? [element.name.text] : [],
          )
        : []
    if (!names.includes(name)) return false
    const initializer = declaration.initializer
    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
      return !!initializer.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
    if (ts.isCallExpression(initializer))
      return initializer.arguments.some(
        (argument) =>
          (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) &&
          !!argument.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
      )
    return false
  })
}

function evidence(relative, start, end, purpose, tokens = []) {
  const content = readText(relative)
  const lines = content.split(/\r?\n/)
  assert(
    start >= 1 && end >= start && end <= lines.length,
    `Invalid evidence range ${relative}:${start}-${end}`,
  )
  const excerpt = lines.slice(start - 1, end).join('\n')
  for (const token of tokens)
    assert(excerpt.includes(token), `Evidence token missing: ${relative}:${start}-${end}: ${token}`)
  return {
    SOURCE_FILE: relative,
    LINE_START: start,
    LINE_END: end,
    PURPOSE: purpose,
    RANGE_SHA256: digest(excerpt),
  }
}

function normalizedPath(relative) {
  return toPosix(path.relative(sourcePath(ue), sourcePath(relative)))
}

function routePattern(relative) {
  const appRelative = normalizedPath(relative)
  const segments = appRelative
    .split('/')
    .slice(0, -1)
    .filter((segment) => !/^\([^/]+\)$/.test(segment))
  const route = `/${segments.join('/')}`.replace(/\/+/g, '/')
  return route === '/' ? '/' : route.replace(/\/$/, '')
}

const entries = []
const evidenceIndex = new Map()
const sourceCache = new Map()
function getSource(relative) {
  if (!sourceCache.has(relative)) sourceCache.set(relative, parse(relative))
  return sourceCache.get(relative)
}

const wrapperFiles = [
  'lib/api/with-api.ts',
  'lib/api/route-policy.ts',
  'lib/api-auth-guard.ts',
  'lib/organization-middleware.ts',
  'lib/org-scope-middleware.ts',
  'lib/role-middleware.ts',
  'lib/enterprise-role-middleware.ts',
  'lib/db/with-rls-context.ts',
  'services/platform-economics/entitlement-guard.ts',
  'lib/services/platform-economics/entitlement-guard.ts',
]

function helperGraph() {
  const graph = []
  for (const relative of wrapperFiles) {
    if (!existsSync(sourcePath(relative))) continue
    const sourceFile = getSource(relative)
    const declarations = new Map()
    for (const statement of sourceFile.statements) {
      if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        declarations.set(statement.name.text, statement)
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const name = declarationName(declaration)
          if (name && functionLikeInitializer(declaration.initializer))
            declarations.set(name, declaration)
        }
      }
    }
    for (const [symbol, declaration] of declarations) {
      const implementation = textOf(sourceFile, declaration)
      const calls = new Set()
      walkNodes(declaration, (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
          calls.add(node.expression.text)
      })
      const directCalls = [...calls].filter((name) => name !== symbol).sort()
      const line = lineOf(sourceFile, declaration)
      const graphNode = {
        BOUNDARY_ID: `UE-BOUNDARY-${digest(`${relative}:${symbol}`).slice(0, 12)}`,
        SOURCE_FILE: relative,
        SYMBOL: symbol,
        DIRECT_FUNCTIONS_CALLED: directCalls,
        AUTHENTICATION_FUNCTION:
          /auth|session|token|jwt|currentuser|requireuser|verify/i.test(symbol) ||
          /getCurrentUser|requireUser|verifyToken|auth\(/i.test(implementation),
        ORG_RESOLUTION_FUNCTION:
          /org|tenant/i.test(symbol) ||
          /organizationId|getOrganizationId|tenantId/i.test(implementation),
        ROLE_PERMISSION_FUNCTION:
          /role|permission|admin/i.test(symbol) ||
          /requireRole|hasRole|permission|ROLE_HIERARCHY|enforceAdminOnly/i.test(implementation),
        RESOURCE_PERMISSION_FUNCTION:
          /resource|ownership|scope/i.test(symbol) ||
          /resourcePermission|assertOwnership|belongsToOrganization|ownerId/i.test(implementation),
        ADMIN_FUNCTION:
          /admin/i.test(symbol) ||
          /requireSystemAdmin|isSystemAdmin|platform-admin-only/i.test(implementation),
        ENTITLEMENT_FUNCTION:
          /entitlement/i.test(symbol) ||
          /requireEntitlement|checkEntitlement/i.test(implementation),
        RLS_CONTEXT_FUNCTION:
          /rlscontext|systemcontext/i.test(symbol) ||
          /withRLSContext|withSystemRLSContext/i.test(implementation),
        FAILURE_BEHAVIOR_SOURCE_SIGNAL: [
          ...new Set(
            [
              /status\(\s*401\s*\)/.test(implementation) && 'HTTP_401',
              /status\(\s*403\s*\)/.test(implementation) && 'HTTP_403',
              /throw new Error/.test(implementation) && 'THROWS_ERROR',
              /standardErrorResponse/.test(implementation) && 'STANDARD_ERROR_RESPONSE',
              /return null/.test(implementation) && 'RETURNS_NULL',
              /return false/.test(implementation) && 'RETURNS_FALSE',
            ].filter(Boolean),
          ),
        ],
        SOURCE_EVIDENCE: [
          evidence(
            relative,
            line,
            lineEndOf(sourceFile, declaration),
            'Exported boundary/helper implementation',
          ),
        ],
      }
      graph.push(graphNode)
    }
  }
  return graph.sort(
    (a, b) => a.SOURCE_FILE.localeCompare(b.SOURCE_FILE) || a.SYMBOL.localeCompare(b.SYMBOL),
  )
}

const wrappers = helperGraph()
const wrapperByName = new Map(wrappers.map((wrapper) => [wrapper.SYMBOL, wrapper]))
const authWrapperNames = new Set([
  'withApi',
  'withApiAuth',
  'withApiAuthOptional',
  'withRoleAuth',
  'withMinRole',
  'authenticate',
  'requireUser',
])
const explicitPublicNames = [
  'PUBLIC_ROUTE',
  'public route',
  'unauthenticated',
  'public access',
  'auth: { required: false }',
]
const authPatterns =
  /\b(auth|currentUser|getCurrentUser|getServerSession|getSession|requireUser|withApiAuth|withRoleAuth|withMinRole|verifyToken|authenticate|assertAuthenticated|requireAuth)\s*\(/i
const rolePatterns =
  /\b(requireRole|hasRole|hasMinRole|requireSystemAdmin|isSystemAdmin|requirePermission|hasPermission|checkPermission|canAccess)\s*\(/i
const adminPatterns =
  /\b(requireSystemAdmin|isSystemAdmin|requireAdmin|isAdmin|platformAdmin)\s*\(/i
const entitlementPatterns =
  /\b(requireEntitlement|checkEntitlement|hasEntitlement|withEntitlement)\s*\(/i
const orgPatterns =
  /\b(organizationId|orgId|tenantId|getOrganizationIdForUser|requireUserForOrganization|withOrganization)\b/i
const resourcePatterns =
  /\b(assertOwnership|belongsToOrganization|resourcePermission|canAccessResource|ownerColumn|ownerId|createdBy|organizationId\s*[,)]|organization_id\s*=|organization_id:)\b/i
const rlsPatterns =
  /\b(withRLSContext|withSystemRLSContext|withPlatformAdminRLSContext|systemDb|serviceRole|bypassRls)\b/i
const providerPatterns =
  /stripe-signature|x-hub-signature|webhook.*secret|signature.*verify|verify.*signature|WEBHOOK_SECRET|STRIPE_WEBHOOK_SECRET/i
const userAuthPatterns =
  /\b(401|unauthorized|authentication required|missing.*authorization|invalid.*token)\b/i

function findSignals(content, pattern) {
  return [...new Set(content.match(pattern) ?? [])].sort()
}

function wrapperNames(content) {
  const names = new Set()
  for (const wrapper of wrappers) {
    if (new RegExp(`\\b${wrapper.SYMBOL}\\b`).test(content)) names.add(wrapper.SYMBOL)
  }
  return [...names].sort()
}

function literalOptions(content, option) {
  const match = content.match(new RegExp(`\\b${option}\\s*:\\s*(true|false)`))
  return match?.[1] === 'true' ? true : match?.[1] === 'false' ? false : null
}

function registryAudience(content) {
  const match = content.match(/registry\s*:\s*\{[\s\S]{0,700}?\baudience\s*:\s*['"]([^'"]+)['"]/)
  return match?.[1] ?? null
}

function declaredAudience(content, file, entryClass, authClass) {
  const registry = registryAudience(content)
  const mapped = {
    member: 'MEMBER',
    steward: 'STAFF',
    officer: 'STAFF',
    governance: 'GOVERNANCE',
    admin: 'ADMIN',
    platform: 'ADMIN',
    public: 'PUBLIC_INTENTIONAL',
    webhook: 'PROVIDER_CALLBACK',
    cron: 'SYSTEM_INTERNAL',
  }[registry]
  if (mapped) return mapped
  const lower = `${file} ${content}`.toLowerCase()
  if (
    /webhook|callback/.test(lower) &&
    (providerPatterns.test(content) || entryClass === 'NEXTAUTH_AUTH_HANDLER')
  )
    return 'PROVIDER_CALLBACK'
  if (/health|readiness|liveness/.test(lower) && /health|readiness|liveness/.test(file))
    return 'PUBLIC_INTENTIONAL'
  if (/\badmin\b/.test(file)) return 'ADMIN'
  if (/governance|board|election|trustee/.test(file)) return 'GOVERNANCE'
  if (/executive|president|vice-president|treasurer/.test(file)) return 'EXECUTIVE'
  if (/staff|steward|officer/.test(file)) return 'STAFF'
  if (/member|profile/.test(file)) return 'MEMBER'
  if (
    entryClass === 'SCHEDULED_OR_CRON_HANDLER' ||
    entryClass === 'JOB_OR_QUEUE_HANDLER' ||
    entryClass === 'BACKGROUND_WORKER_ENTRY'
  )
    return 'SYSTEM_INTERNAL'
  if (authClass === 'AUTH_REQUIRED_DIRECT' || authClass === 'AUTH_REQUIRED_VIA_WRAPPER')
    return 'AUTHENTICATED_GENERAL'
  if (entryClass === 'SERVER_ACTION') return 'MIXED_OR_CONTEXTUAL'
  return 'MIXED_OR_CONTEXTUAL'
}

function classifyAuth(content, options = {}) {
  const wrappersUsed = wrapperNames(content)
  const explicitPublic =
    options.explicitPublic ||
    explicitPublicNames.some((marker) => content.toLowerCase().includes(marker.toLowerCase()))
  const cron = literalOptions(content, 'cron') === true
  const requiredFalse = literalOptions(content, 'required') === false
  const requiredTrue = literalOptions(content, 'required') === true
  const providerAuth = providerPatterns.test(content)
  const directAuth = authPatterns.test(content) || userAuthPatterns.test(content)
  const usesKnownAuthWrapper = wrappersUsed.some((name) => authWrapperNames.has(name))

  if (options.providerSignature || providerAuth)
    return { classification: 'PROVIDER_SIGNATURE_OR_SECRET', wrappersUsed, explicitPublic: false }
  if (cron && wrappersUsed.includes('withApi'))
    return { classification: 'SYSTEM_TO_SYSTEM_AUTH', wrappersUsed, explicitPublic: false }
  if (requiredFalse || explicitPublic)
    return { classification: 'PUBLIC_EXPLICIT', wrappersUsed, explicitPublic: true }
  if (requiredTrue)
    return { classification: 'AUTH_REQUIRED_VIA_WRAPPER', wrappersUsed, explicitPublic: false }
  if (usesKnownAuthWrapper)
    return { classification: 'AUTH_REQUIRED_VIA_WRAPPER', wrappersUsed, explicitPublic: false }
  if (directAuth)
    return { classification: 'AUTH_REQUIRED_DIRECT', wrappersUsed, explicitPublic: false }
  if (options.internal)
    return { classification: 'INTERNAL_TRUST_BOUNDARY', wrappersUsed, explicitPublic: false }
  return { classification: 'NO_AUTH_BOUNDARY_OBSERVED', wrappersUsed, explicitPublic: false }
}

function classifyOrg(content, authClass, wrappersUsed, isSystem) {
  if (isSystem || authClass === 'PROVIDER_SIGNATURE_OR_SECRET' || authClass === 'PUBLIC_EXPLICIT')
    return 'ORG_CONTEXT_NOT_APPLICABLE'
  if (orgPatterns.test(content)) return 'ORG_CONTEXT_DIRECT'
  if (wrappersUsed.includes('withApi') && literalOptions(content, 'requireOrg') !== false)
    return 'ORG_CONTEXT_VIA_WRAPPER'
  if (wrappersUsed.includes('withRLSContext') || wrappersUsed.includes('withRLSContext'))
    return 'ORG_CONTEXT_VIA_WRAPPER'
  if (
    authClass === 'AUTH_REQUIRED_VIA_WRAPPER' &&
    /\bauthenticate\b/.test(content) &&
    /\btenantId\b/.test(content)
  )
    return 'ORG_CONTEXT_VIA_WRAPPER'
  return 'NO_ORG_CONTEXT_OBSERVED'
}

function roleSignals(content, wrappersUsed) {
  const roleDirect = rolePatterns.test(content)
  const adminDirect = adminPatterns.test(content)
  const roleVia =
    wrappersUsed.includes('withApi') && /(?:minRole|roles\s*:|platform-admin-only)/.test(content)
  const adminVia = wrappersUsed.includes('withApi') && /platform-admin-only/.test(content)
  const permissionDirect =
    /\b(requirePermission|hasPermission|checkPermission|canAccess)\s*\(/i.test(content)
  const permissionVia = wrappersUsed.includes('withApi') && /permission/.test(content)
  return {
    role: roleDirect || roleVia,
    roleClass: roleDirect
      ? 'ROLE_CHECK_DIRECT'
      : roleVia
        ? 'ROLE_CHECK_VIA_WRAPPER'
        : 'NO_ROLE_OR_PERMISSION_CHECK_OBSERVED',
    permission: permissionDirect || permissionVia,
    permissionClass: permissionDirect
      ? 'PERMISSION_CHECK_DIRECT'
      : permissionVia
        ? 'PERMISSION_CHECK_VIA_WRAPPER'
        : 'NO_ROLE_OR_PERMISSION_CHECK_OBSERVED',
    admin: adminDirect || adminVia,
    adminClass: adminDirect
      ? 'ADMIN_CHECK_DIRECT'
      : adminVia
        ? 'ADMIN_CHECK_VIA_WRAPPER'
        : 'NO_ROLE_OR_PERMISSION_CHECK_OBSERVED',
  }
}

function classifyResource(content, systemEntry) {
  if (systemEntry) return 'RESOURCE_CHECK_NOT_APPLICABLE'
  if (
    /\b(assertOwnership|belongsToOrganization|canAccessResource|resourcePermission|checkResourceAccess|ensureOrgOwnership)\s*\(/i.test(
      content,
    ) ||
    /where\([^)]*(organizationId|tenantId|ownerId)/i.test(content)
  )
    return 'RESOURCE_CHECK_DIRECT'
  if (
    /\b(service|Service|repository|Repository)\.[A-Za-z_$][\w$]*\s*\(/.test(content) &&
    /\b(organizationId|tenantId|resourceId|memberId|caseId|ownerId)\b/.test(content)
  )
    return 'RESOURCE_CHECK_VIA_SERVICE'
  if (/health|readiness|liveness|webhook|callback|login|logout|token|auth/i.test(content))
    return 'RESOURCE_CHECK_NOT_APPLICABLE'
  return 'NO_RESOURCE_CHECK_OBSERVED'
}

function classifyRls(content, wrappersUsed, systemEntry) {
  if (/\bsystemDb\b|\bserviceRole\b|\bbypassRls\b/i.test(content))
    return 'SYSTEM_DB_BYPASS_EXPLICIT'
  if (/\bwithRLSContext\s*\(|\bwithSystemRLSContext\s*\(/.test(content)) return 'RLS_CONTEXT_DIRECT'
  if (wrappersUsed.includes('withApi') && /rlsOrgContext\s*:\s*true/.test(content))
    return 'RLS_CONTEXT_VIA_WRAPPER'
  if (systemEntry) return 'NOT_APPLICABLE'
  return /\b(db|sql|drizzle|query)\b/.test(content) ? 'NO_RLS_CONTEXT_OBSERVED' : 'NOT_APPLICABLE'
}

function makeEntry({
  entryClass,
  file,
  name,
  method = null,
  route = null,
  node,
  sourceFile,
  content,
  start,
  end,
  options = {},
}) {
  const relative = file
  const entryId = `UE-SERVER-${digest(`${entryClass}:${relative}:${method ?? ''}:${route ?? ''}:${name}:${start}`).slice(0, 16)}`
  const signals = classifyAuth(content, options)
  const audience = declaredAudience(content, relative, entryClass, signals.classification)
  const orgClass = classifyOrg(
    content,
    signals.classification,
    signals.wrappersUsed,
    options.systemEntry === true,
  )
  const role = roleSignals(content, signals.wrappersUsed)
  const resourceClass = classifyResource(content, options.systemEntry === true)
  const rlsClass = classifyRls(content, signals.wrappersUsed, options.systemEntry === true)
  const authHelpers = findSignals(
    content,
    /\b(?:auth|currentUser|getCurrentUser|getServerSession|getSession|requireUser|withApiAuth|withRoleAuth|withMinRole|verifyToken|authenticate|assertAuthenticated|requireAuth)\b/g,
  )
  const orgHelpers = findSignals(
    content,
    /\b(?:organizationId|orgId|tenantId|getOrganizationIdForUser|requireUserForOrganization|withOrganization)\b/g,
  )
  const roleHelpers = findSignals(
    content,
    /\b(?:requireRole|hasRole|hasMinRole|requireSystemAdmin|isSystemAdmin|requirePermission|hasPermission|checkPermission|canAccess|ROLE_HIERARCHY)\b/g,
  )
  const resourceHelpers = findSignals(
    content,
    /\b(?:assertOwnership|belongsToOrganization|resourcePermission|canAccessResource|checkResourceAccess|ensureOrgOwnership|ownerColumn|ownerId)\b/g,
  )
  const adminHelpers = findSignals(
    content,
    /\b(?:requireSystemAdmin|isSystemAdmin|requireAdmin|isAdmin|platformAdmin)\b/g,
  )
  const entitlementHelpers = findSignals(
    content,
    /\b(?:requireEntitlement|checkEntitlement|hasEntitlement|withEntitlement)\b/g,
  )
  const rlsHelpers = findSignals(
    content,
    /\b(?:withRLSContext|withSystemRLSContext|withPlatformAdminRLSContext|systemDb|serviceRole|bypassRls)\b/g,
  )
  const publicEvidence = signals.explicitPublic
    ? [
        evidence(
          relative,
          start,
          Math.min(end, start + 10),
          'Explicit public route declaration or health contract',
        ),
      ]
    : []
  const directDb = /\b(?:systemDb|db|sql)\s*(?:\.|\()|\bfetch\s*\(/.test(content)
  const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const directBoundary =
    (directDb || mutation) &&
    signals.wrappersUsed.length === 0 &&
    ![
      'AUTH_REQUIRED_DIRECT',
      'AUTH_REQUIRED_VIA_WRAPPER',
      'PROVIDER_SIGNATURE_OR_SECRET',
      'SYSTEM_TO_SYSTEM_AUTH',
    ].includes(signals.classification)
  const evidenceRecord = evidence(
    relative,
    start,
    end,
    'Executable entry declaration and bounded handler source',
  )
  const sourceEvidence = [evidenceRecord]

  entries.push({
    ENTRY_ID: entryId,
    ENTRY_CLASS: entryClass,
    SOURCE_FILE: relative,
    EXPORT_OR_HANDLER: name,
    HTTP_METHOD: method,
    ROUTE_PATTERN: route,
    AUDIENCE: audience,
    AUTH_BOUNDARY_CLASS: signals.classification,
    AUTH_HELPERS: authHelpers,
    ORG_CONTEXT_HELPERS: orgHelpers,
    ROLE_PERMISSION_HELPERS: roleHelpers,
    RESOURCE_PERMISSION_HELPERS: resourceHelpers,
    ADMIN_HELPERS: adminHelpers,
    ENTITLEMENT_HELPERS: entitlementHelpers,
    RLS_CONTEXT_HELPERS: rlsHelpers,
    PUBLIC_DECLARATION_EVIDENCE: publicEvidence,
    SPECIAL_BOUNDARY: options.specialBoundary ?? null,
    SOURCE_STATUS: options.sourceStatus ?? 'PRODUCTION_SOURCE',
    ORG_CONTEXT_CLASS: orgClass,
    ROLE_CHECK_CLASS: role.roleClass,
    PERMISSION_CHECK_CLASS: role.permissionClass,
    ADMIN_CHECK_CLASS: role.adminClass,
    RESOURCE_CHECK_CLASS: resourceClass,
    ENTITLEMENT_CHECK_CLASS: entitlementHelpers.length
      ? 'ENTITLEMENT_CHECK_DIRECT'
      : 'NO_ENTITLEMENT_CHECK_OBSERVED',
    RLS_CONTEXT_CLASS: rlsClass,
    DIRECT_HANDLER_SECURITY_BOUNDARY: directBoundary ? 'YES' : 'NO',
    DIRECT_DATABASE_ACCESS_OBSERVED: directDb,
    DIRECT_PROVIDER_CALL_OBSERVED: /\bfetch\s*\(|stripe|sendgrid|twilio|entra/i.test(content),
    BOUNDARY_EVIDENCE: sourceEvidence,
    PHASE_1A_BINDING_IDS: null,
    PHASE_1A_EFFECT_CHAIN_IDS: null,
    PHASE_1B_1_TARGET_OBJECT_IDS: null,
    PAGE_LINKS: [],
    DIRECT_SOURCE_SIGNALS: {
      roleCheck: role.role,
      permissionCheck: role.permission,
      adminCheck: role.admin,
      organizationContext: orgClass === 'ORG_CONTEXT_DIRECT',
      resourceCheck: resourceClass === 'RESOURCE_CHECK_DIRECT',
      wrapperNames: signals.wrappersUsed,
    },
    _sourceNode: node,
    _sourceFile: sourceFile,
    _content: content,
    _start: start,
    _end: end,
  })
}

function routeNodeFor(sourceFile, statement, method) {
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === method) return statement
  if (!ts.isVariableStatement(statement)) return statement
  const declaration = statement.declarationList.declarations.find((item) => {
    if (ts.isIdentifier(item.name)) return item.name.text === method
    if (ts.isObjectBindingPattern(item.name))
      return item.name.elements.some(
        (element) => ts.isIdentifier(element.name) && element.name.text === method,
      )
    return false
  })
  return declaration ?? statement
}

const apiRoot = sourcePath(`${ue}app/api`)
const appRoot = sourcePath(`${ue}app`)
const routeFiles = walk(appRoot, (name) => name === 'route.ts')
const apiRouteFiles = routeFiles.filter(
  (file) =>
    path.relative(apiRoot, file) !== '..' &&
    !path.relative(apiRoot, file).startsWith(`..${path.sep}`),
)
const outsideApiRouteFiles = routeFiles.filter((file) => !apiRouteFiles.includes(file))
const routeMethods = new Map()
const appRouteMethodEntries = []
const methodNames = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
for (const absolute of routeFiles) {
  const relative = toPosix(path.relative(root, absolute))
  const sourceFile = getSource(relative)
  const route = routePattern(relative)
  const methodExports = []
  for (const statement of sourceFile.statements) {
    for (const name of exportedNames(statement)) {
      if (methodNames.has(name))
        methodExports.push({ name, statement, node: routeNodeFor(sourceFile, statement, name) })
    }
  }
  const seen = new Set()
  for (const item of methodExports) {
    const key = `${item.name}:${lineOf(sourceFile, item.statement)}`
    if (seen.has(key)) continue
    seen.add(key)
    const method = item.name
    const content = textOf(sourceFile, item.node)
    const whole = textOf(sourceFile, item.statement)
    const combined = `${whole}\n${content}`
    const isNextAuth = /nextauth|NextAuth|handlers\s*=\s*NextAuth/.test(
      `${relative}\n${sourceFile.text}`,
    )
    const isWebhook = /webhook|stripe-signature|x-hub-signature/i.test(`${relative}\n${combined}`)
    const isRpc = /\/(trpc|rpc)(\/|$)/i.test(route)
    const entryClass = isNextAuth
      ? 'NEXTAUTH_AUTH_HANDLER'
      : isWebhook
        ? 'WEBHOOK_HANDLER'
        : isRpc
          ? 'SERVER_RPC_OR_PROCEDURE_ENTRY'
          : 'APP_ROUTER_ROUTE_METHOD'
    const node = item.node
    const start = lineOf(sourceFile, item.statement)
    const end = lineEndOf(sourceFile, item.statement)
    makeEntry({
      entryClass,
      file: relative,
      name: method,
      method,
      route,
      node,
      sourceFile,
      content: combined,
      start,
      end,
      options: {
        explicitPublic:
          /auth\s*:\s*\{\s*required\s*:\s*false|audience\s*:\s*['"]public['"]|PUBLIC_ROUTE|public route/i.test(
            combined,
          ),
        providerSignature: isWebhook && providerPatterns.test(combined),
        specialBoundary: isNextAuth
          ? 'NextAuth handler export'
          : isWebhook
            ? 'HTTP webhook/callback route'
            : isRpc
              ? 'RPC/procedure route exposed through App Router'
              : null,
        sourceStatus: 'PRODUCTION_APP_ROUTER_EXPORT',
      },
    })
    appRouteMethodEntries.push({ file: relative, method, route, entryClass, start })
    routeMethods.set(`${relative}:${method}:${start}`, entryClass)
  }
}

const serverActionFiles = walk(sourcePath(ue), (name) => /\.(ts|tsx)$/.test(name))
  .map((absolute) => toPosix(path.relative(root, absolute)))
  .filter(
    (relative) =>
      !relative.includes('/__') && !relative.includes('/test') && !relative.includes('.test.'),
  )
const actionCountByFile = new Map()
for (const relative of serverActionFiles) {
  const sourceFile = getSource(relative)
  const directive = sourceFile.statements.find(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === 'use server',
  )
  if (!directive) continue
  const exported = sourceFile.statements.flatMap((statement) =>
    exportedNames(statement).map((name) => ({ statement, name })),
  )
  for (const item of exported) {
    if (!isAsyncExport(item.statement, item.name)) continue
    const start = lineOf(sourceFile, item.statement)
    const end = lineEndOf(sourceFile, item.statement)
    const content = textOf(sourceFile, item.statement)
    makeEntry({
      entryClass: 'SERVER_ACTION',
      file: relative,
      name: item.name,
      node: item.statement,
      sourceFile,
      content,
      start,
      end,
      options: { sourceStatus: 'PRODUCTION_FILE_LEVEL_USE_SERVER_ACTION' },
    })
    actionCountByFile.set(relative, (actionCountByFile.get(relative) ?? 0) + 1)
  }
}

const functionExposedFiles = walk(sourcePath(ue), (name) => /\.(ts|tsx)$/.test(name))
  .map((absolute) => toPosix(path.relative(root, absolute)))
  .filter((relative) => !relative.includes('/__') && !relative.includes('.test.'))
for (const relative of functionExposedFiles) {
  const sourceFile = getSource(relative)
  for (const statement of sourceFile.statements) {
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue
    const content = textOf(sourceFile, statement)
    if (!/createServerFn|serverFunction|exposeToClient/.test(content)) continue
    const name = declarationName(statement) ?? 'EXPLICIT_SERVER_FUNCTION'
    if (entries.some((entry) => entry.SOURCE_FILE === relative && entry.EXPORT_OR_HANDLER === name))
      continue
    const start = lineOf(sourceFile, statement)
    const end = lineEndOf(sourceFile, statement)
    makeEntry({
      entryClass: 'SERVER_FUNCTION_EXPLICITLY_EXPOSED_TO_CLIENT',
      file: relative,
      name,
      node: statement,
      sourceFile,
      content,
      start,
      end,
      options: { sourceStatus: 'PRODUCTION_EXPLICIT_SERVER_FUNCTION' },
    })
  }
}

const financialRoot = `${ue}services/financial-service/src/`
const serviceIndexPath = `${financialRoot}index.ts`
const serviceIndex = getSource(serviceIndexPath)
const importBindings = new Map()
for (const statement of serviceIndex.statements) {
  if (!ts.isImportDeclaration(statement) || !statement.importClause) continue
  const module = stringLiteral(statement.moduleSpecifier)
  if (!module) continue
  const { importClause } = statement
  if (importClause.name) {
    importBindings.set(importClause.name.text, { module, exported: 'default' })
  }
  if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
    for (const element of importClause.namedBindings.elements) {
      importBindings.set(element.name.text, {
        module,
        exported: element.propertyName?.text ?? element.name.text,
      })
    }
  }
}
const routerMounts = new Map()
const serviceContent = serviceIndex.text
const mountRegex =
  /app\.use\(\s*(['"`])([^'"`]+)\1\s*,\s*(?:(authenticate)\s*,\s*)?([A-Za-z_$][\w$]*)\s*\)/g
for (const match of serviceContent.matchAll(mountRegex)) {
  const [, , prefix, authMiddleware, importedName] = match
  const binding = importBindings.get(importedName)
  if (!binding) continue
  const modulePath = path.posix.normalize(
    path.posix.join(path.posix.dirname(serviceIndexPath), binding.module),
  )
  const routerFile = `${modulePath}.ts`
  routerMounts.set(routerFile, {
    prefix,
    authenticated: Boolean(authMiddleware),
    line: serviceIndex.getLineAndCharacterOfPosition(match.index).line + 1,
  })
}

function handlerContentForCall(sourceFile, call) {
  const nodeText = textOf(sourceFile, call)
  return nodeText
}

function extractExpressRouteEntries(relative, prefix, authenticatedMount) {
  const sourceFile = getSource(relative)
  const routes = []
  walkNodes(sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    const method = node.expression.name.text.toUpperCase()
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ALL'].includes(method)) return
    const base = node.expression.expression
    if (!ts.isIdentifier(base) || base.text !== 'router') return
    const route = stringLiteral(node.arguments[0])
    if (route === null) return
    const fullRoute = `${prefix}/${route}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    const content = handlerContentForCall(sourceFile, node)
    const start = lineOf(sourceFile, node)
    const end = lineEndOf(sourceFile, node)
    const auth = classifyAuth(content, { providerSignature: providerPatterns.test(content) })
    const sourceContent = authenticatedMount ? `${content}\nauthenticate` : content
    makeEntry({
      entryClass: /webhook|callback/i.test(fullRoute)
        ? 'WEBHOOK_HANDLER'
        : 'OTHER_EXPLICIT_SERVER_ENTRY',
      file: relative,
      name: `router.${method.toLowerCase()} ${route}`,
      method,
      route: fullRoute,
      node,
      sourceFile,
      content: sourceContent,
      start,
      end,
      options: {
        explicitPublic: /public donation|no auth required|public access/i.test(
          sourceFile.text.slice(
            Math.max(0, node.getStart(sourceFile) - 240),
            node.getStart(sourceFile),
          ),
        ),
        providerSignature: providerPatterns.test(content),
        internal: false,
        sourceStatus: 'PRODUCTION_EXPRESS_ROUTER_MOUNT',
        specialBoundary: authenticatedMount
          ? 'Express authenticate middleware on router mount'
          : null,
      },
    })
    const entry = entries.at(-1)
    if (authenticatedMount) {
      entry.AUTH_BOUNDARY_CLASS = 'AUTH_REQUIRED_VIA_WRAPPER'
      entry.AUTH_HELPERS = [...new Set([...entry.AUTH_HELPERS, 'authenticate'])].sort()
      entry.DIRECT_SOURCE_SIGNALS.wrapperNames = [
        ...new Set([...entry.DIRECT_SOURCE_SIGNALS.wrapperNames, 'authenticate']),
      ].sort()
      entry.ORG_CONTEXT_CLASS = /\btenantId\b/.test(
        serviceIndex.text.slice(
          serviceIndex.text.indexOf('const authenticate'),
          serviceIndex.text.indexOf('const _requireRole'),
        ),
      )
        ? 'ORG_CONTEXT_VIA_WRAPPER'
        : entry.ORG_CONTEXT_CLASS
      entry.AUDIENCE = declaredAudience(
        content,
        relative,
        entry.ENTRY_CLASS,
        'AUTH_REQUIRED_VIA_WRAPPER',
      )
      entry.SPECIAL_BOUNDARY = 'Express authenticate middleware on router mount'
    }
    if (/^\/(health|ready|live)$/.test(fullRoute)) {
      entry.AUTH_BOUNDARY_CLASS = 'PUBLIC_EXPLICIT'
      entry.AUDIENCE = 'PUBLIC_INTENTIONAL'
      entry.PUBLIC_DECLARATION_EVIDENCE = [
        evidence(serviceIndexPath, 250, 255, 'Explicit service health endpoint source', [
          'app.get',
          '/health',
        ]),
      ]
      entry.SPECIAL_BOUNDARY = 'Health endpoint'
    }
    routes.push(entry)
  })
  return routes
}

for (const [relative, mount] of routerMounts) {
  for (const entry of extractExpressRouteEntries(relative, mount.prefix, mount.authenticated)) {
    void entry
  }
}

for (const statement of serviceIndex.statements) {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue
  const call = statement.expression
  if (
    !ts.isPropertyAccessExpression(call.expression) ||
    !ts.isIdentifier(call.expression.expression) ||
    call.expression.expression.text !== 'app'
  )
    continue
  const method = call.expression.name.text.toUpperCase()
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue
  const route = stringLiteral(call.arguments[0])
  if (!route) continue
  const content = textOf(serviceIndex, call)
  const start = lineOf(serviceIndex, call)
  const end = lineEndOf(serviceIndex, call)
  const isPublicHealth = /^\/(health|ready|live)$/.test(route)
  const hasAuth = call.arguments
    .slice(1, -1)
    .some((argument) => ts.isIdentifier(argument) && argument.text === 'authenticate')
  makeEntry({
    entryClass: 'OTHER_EXPLICIT_SERVER_ENTRY',
    file: serviceIndexPath,
    name: `app.${method.toLowerCase()} ${route}`,
    method,
    route,
    node: call,
    sourceFile: serviceIndex,
    content,
    start,
    end,
    options: {
      explicitPublic: isPublicHealth,
      sourceStatus: 'PRODUCTION_EXPRESS_APP_HANDLER',
      specialBoundary: isPublicHealth
        ? 'Explicit health endpoint'
        : hasAuth
          ? 'Express authenticate middleware on handler'
          : null,
    },
  })
  const entry = entries.at(-1)
  if (hasAuth) {
    entry.AUTH_BOUNDARY_CLASS = 'AUTH_REQUIRED_VIA_WRAPPER'
    entry.AUTH_HELPERS = [...new Set([...entry.AUTH_HELPERS, 'authenticate'])].sort()
    entry.AUDIENCE = 'AUTHENTICATED_GENERAL'
  }
  if (isPublicHealth) {
    entry.AUTH_BOUNDARY_CLASS = 'PUBLIC_EXPLICIT'
    entry.AUDIENCE = 'PUBLIC_INTENTIONAL'
    entry.PUBLIC_DECLARATION_EVIDENCE = [
      evidence(serviceIndexPath, start, end, 'Explicit health endpoint declaration', [
        'app.get',
        route,
      ]),
    ]
  }
}

const activeScheduleModules = [
  { file: `${financialRoot}jobs/analytics-processor.ts`, start: 'startAnalyticsJobs' },
  {
    file: `${financialRoot}jobs/dues-calculation-workflow.ts`,
    start: 'startDuesCalculationWorkflow',
  },
  {
    file: `${financialRoot}jobs/arrears-management-workflow.ts`,
    start: 'startArrearsManagementWorkflow',
  },
  {
    file: `${financialRoot}jobs/payment-collection-workflow.ts`,
    start: 'startPaymentCollectionWorkflow',
  },
  {
    file: `${financialRoot}jobs/stipend-processing-workflow.ts`,
    start: 'startStipendProcessingWorkflow',
  },
]
for (const { file, start: startFunction } of activeScheduleModules) {
  const sourceFile = getSource(file)
  const jobs = []
  walkNodes(sourceFile, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isIdentifier(node.name) ||
      !node.initializer ||
      !ts.isCallExpression(node.initializer)
    )
      return
    const expression = node.initializer.expression
    if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'schedule') return
    jobs.push({ node, name: node.name.text, call: node.initializer })
  })
  for (const job of jobs) {
    const jobSource = textOf(sourceFile, job.node)
    const line = lineOf(sourceFile, job.node)
    const startDecl = sourceFile.statements.find(
      (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === startFunction,
    )
    const startBody = startDecl ? textOf(sourceFile, startDecl) : ''
    if (!startBody.includes(job.name) || !serviceIndex.text.includes(`${startFunction}()`)) continue
    makeEntry({
      entryClass: 'SCHEDULED_OR_CRON_HANDLER',
      file,
      name: job.name,
      node: job.node,
      sourceFile,
      content: `${jobSource}\n${startBody}`,
      start: line,
      end: lineEndOf(sourceFile, job.node),
      options: {
        internal: true,
        systemEntry: true,
        sourceStatus: 'PRODUCTION_SCHEDULE_STARTED_BY_FINANCIAL_SERVICE',
        specialBoundary: `cron.schedule registered and started via ${startFunction}() from financial-service/src/index.ts`,
      },
    })
    entries.at(-1).SOURCE_EVIDENCE_STARTUP = evidence(
      serviceIndexPath,
      376,
      383,
      'Service startup invokes the schedule start function',
      [`${startFunction}()`],
    )
  }
}

function stripInternalFields(entry) {
  const { _sourceNode, _sourceFile, _content, _start, _end, ...publicEntry } = entry
  return publicEntry
}

const publicEntries = entries
  .map(stripInternalFields)
  .sort(
    (a, b) =>
      a.SOURCE_FILE.localeCompare(b.SOURCE_FILE) ||
      a.LINE_START - b.LINE_START ||
      a.ENTRY_ID.localeCompare(b.ENTRY_ID),
  )

function pageExpectationRecords(pageIndex) {
  const records = pageIndex.pageAudienceIndex.records
  const auth = records.filter((record) =>
    [
      'NOT_ESTABLISHED_BY_PAGE_OR_ANCESTOR_SOURCE',
      'AUTH_CONTEXT_READ; PAGE_LEVEL_ENFORCEMENT_NOT_ESTABLISHED',
    ].includes(record.authExpectation),
  )
  const org = records.filter((record) =>
    [
      'NOT_ESTABLISHED_BY_PAGE_OR_ANCESTOR_SOURCE',
      'PAGE_SOURCE_REFERENCES_ORGANIZATION_CONTEXT; REQUIREMENT_NOT_PROVEN_BY_THIS_INDEX',
    ].includes(record.orgContextExpectation),
  )
  return { auth, org }
}

const pageIndex = JSON.parse(readText(pageIndexPath))
assert.equal(
  digest(JSON.stringify(pageIndex.pageAudienceIndex.records)),
  pageIndexHash,
  'Accepted Phase 1A page index content changed',
)
const carryForward = pageExpectationRecords(pageIndex)
assert.equal(carryForward.auth.length, 22)
assert.equal(carryForward.org.length, 21)
const carryForwardRecords = []
const actionEntryByName = new Map()
for (const entry of publicEntries.filter((row) => row.ENTRY_CLASS === 'SERVER_ACTION')) {
  const ids = actionEntryByName.get(entry.EXPORT_OR_HANDLER) ?? []
  ids.push(entry.ENTRY_ID)
  actionEntryByName.set(entry.EXPORT_OR_HANDLER, ids)
}
const methodEntries = publicEntries.filter(
  (entry) => entry.HTTP_METHOD && entry.ENTRY_CLASS !== 'SCHEDULED_OR_CRON_HANDLER',
)
function routeMatches(route, apiPath) {
  const expression = route
    .split('/')
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return '(?:[^/]+(?:/[^/]+)*)?'
      if (/^\[\.\.\..+\]$/.test(segment)) return '.+'
      if (/^\[.+\]$/.test(segment)) return '[^/]+'
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return new RegExp(`^${expression}/?$`).test(apiPath)
}

const pageExpectations = [
  ...carryForward.auth.map((expectation) => ({
    expectation,
    type: 'PAGE_AUTH_EXPECTATION_UNPROVEN',
    field: 'authExpectation',
    original: expectation.authExpectation,
    prefix: 'AUTH',
  })),
  ...carryForward.org.map((expectation) => ({
    expectation,
    type: 'PAGE_ORG_CONTEXT_EXPECTATION_UNPROVEN',
    field: 'orgContextExpectation',
    original: expectation.orgContextExpectation,
    prefix: 'ORG',
  })),
]
for (const { expectation, type, field, original, prefix } of pageExpectations) {
  const relative = `${ue}${expectation.sourceFile}`
  const content = existsSync(sourcePath(relative)) ? readText(relative) : ''
  const linkedIds = new Set()
  let ambiguousActionReference = false
  for (const [action, ids] of actionEntryByName) {
    if (!containsReference(action, content)) continue
    if (ids.length === 1) linkedIds.add(ids[0])
    else ambiguousActionReference = true
  }
  const apiPaths = [...content.matchAll(/['"`](\/api\/[^'"`?]+)['"`]/g)].map((match) => match[1])
  for (const apiPath of apiPaths) {
    const candidates = methodEntries.filter((entry) => routeMatches(entry.ROUTE_PATTERN, apiPath))
    for (const candidate of candidates) linkedIds.add(candidate.ENTRY_ID)
  }
  const dynamic = /fetch\(|useSWR|useQuery|apiClient|server action|Action\b/.test(content)
  const disposition = linkedIds.size
    ? 'SERVER_BOUNDARY_LINKED'
    : dynamic || ambiguousActionReference
      ? 'DEFER_TO_1B_2B'
      : content
        ? 'NO_SERVER_BOUNDARY_LINK_FOUND'
        : 'PAGE_SOURCE_UNAVAILABLE'
  const record = {
    CARRY_FORWARD_ID: `UE-1A1-${prefix}-${digest(`${type}:${expectation.route}:${expectation.sourceFile}:${original}`).slice(0, 12)}`,
    EXPECTATION_TYPE: type,
    ROUTE: expectation.route,
    SOURCE_FILE: expectation.sourceFile,
    SOURCE_EXPECTATION_FIELD: field,
    ORIGINAL_EXPECTATION: original,
    SERVER_ENTRY_DISPOSITION: disposition,
    LINKED_SERVER_ENTRY_IDS: [...linkedIds].sort(),
    SOURCE_EVIDENCE: existsSync(sourcePath(relative))
      ? [
          evidence(
            relative,
            1,
            readText(relative).split(/\r?\n/).length,
            'Page source inspected for direct server boundary references',
          ),
        ]
      : [],
    HISTORICAL_PAGE_INDEX_RECORD: expectation,
  }
  const duplicates = carryForwardRecords.find(
    (prior) => prior.CARRY_FORWARD_ID === record.CARRY_FORWARD_ID,
  )
  if (!duplicates) carryForwardRecords.push(record)
}

function containsReference(name, content) {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(content)
}

assert.equal(
  carryForwardRecords.length,
  43,
  'All 43 historical expectations must be preserved separately',
)
assert.equal(
  new Set(carryForwardRecords.map((record) => record.CARRY_FORWARD_ID)).size,
  43,
  'Historical expectation IDs must be unique',
)

const frozenR2C = JSON.parse(readText(r2cPath))
assert.equal(frozenR2C.PHASE, 'PHASE_1B_1_R2C_TARGETLESS_EFFECT_RECONCILIATION')
assert.equal(frozenR2C.STATE.PHASE_1B_1, 'SOURCE_CEILING_ACCEPTED')
assert.equal(frozenR2C.STATE.PHASE_1B_2_AUTHORIZATION_CENSUS, 'AUTHORIZED')
assert.equal(frozenR2C.STATE.PHASE_1B_2_STARTED, 'NO')
assert.equal(frozenR2C.STATE.STATIC_WORK_REMAINING, 0)
assert.equal(frozenR2C.EXCLUSIVE_ACCOUNTING.INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS, 56)
assert.equal(frozenR2C.EXCLUSIVE_ACCOUNTING.EFFECT_TARGET_STATIC_WORK_REMAINING, 0)
assert.equal(frozenR2C.CARRY_FORWARD_REGISTERS.AUTHORITY_SOURCE_CEILINGS.length, 207)
assert.equal(frozenR2C.CARRY_FORWARD_REGISTERS.KNOWN_AUTHORITY_DEFECT_OBJECTS.length, 3)

function countBy(rows, field) {
  return Object.fromEntries(
    [...new Set(rows.map((row) => row[field]))]
      .sort()
      .map((value) => [value, rows.filter((row) => row[field] === value).length]),
  )
}

const classificationFields = [
  'AUDIENCE',
  'AUTH_BOUNDARY_CLASS',
  'ORG_CONTEXT_CLASS',
  'ROLE_CHECK_CLASS',
  'PERMISSION_CHECK_CLASS',
  'ADMIN_CHECK_CLASS',
  'RESOURCE_CHECK_CLASS',
  'ENTITLEMENT_CHECK_CLASS',
  'RLS_CONTEXT_CLASS',
]
const unclassifiedEntries = publicEntries.filter((entry) =>
  classificationFields.some((field) => typeof entry[field] !== 'string' || !entry[field].trim()),
)
assert.equal(
  unclassifiedEntries.length,
  0,
  'Every entry must have an explicit source classification',
)
const entryIds = publicEntries.map((entry) => entry.ENTRY_ID)
assert.equal(new Set(entryIds).size, entryIds.length, 'Executable entry IDs must be exact-once')

const directBoundaryEntries = publicEntries.filter(
  (entry) => entry.DIRECT_HANDLER_SECURITY_BOUNDARY === 'YES',
)
const privilegedDatabaseEntries = publicEntries.filter(
  (entry) =>
    entry.RLS_CONTEXT_CLASS === 'SYSTEM_DB_BYPASS_EXPLICIT' ||
    entry.RLS_CONTEXT_HELPERS.some((helper) => /systemDb|serviceRole|bypassRls/i.test(helper)),
)
const sourceFiles = [...new Set(publicEntries.map((entry) => entry.SOURCE_FILE))].sort()
const priorState = frozenR2C.STATE
const state = {
  PHASE_1A: priorState.PHASE_1A,
  PHASE_1B_1: priorState.PHASE_1B_1,
  PHASE_1B_2A: 'CENSUS_COMPLETE',
  PHASE_1B_2A_GATE: 'PASS',
  PHASE_1B_2B: 'AUTHORIZED',
  PHASE_1B_2B_STARTED: 'NO',
  PHASE_1C_STARTED: priorState.PHASE_1C_STARTED,
  PHASE_1D_STARTED: priorState.PHASE_1D_STARTED,
  PHASE_2_STARTED: priorState.PHASE_2_STARTED,
  STATIC_WORK_REMAINING: priorState.STATIC_WORK_REMAINING,
  TARGETLESS_DATABASE_EFFECTS_REMAINING: 56,
  R2B_AUTHORITY_SOURCE_CEILING_CARRY_FORWARD: 207,
  R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD: 3,
  AUTHORIZATION_PROVEN: 'NO',
  ORG_SCOPE_ENFORCEMENT_PROVEN: 'NO',
  RLS_CORRECTNESS_PROVEN: 'NO',
  AUDIT_COMPLETENESS_PROVEN: 'NO',
  RUNTIME_PROVEN: 'NO',
  PRODUCT_READY: 'NO',
}

const result = {
  PHASE: 'PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS',
  STATE: state,
  METHOD: {
    SCOPE:
      'Source-only inventory of executable Union Eyes App Router HTTP exports, file-level server actions, explicitly client-exposed server functions, production-mounted financial-service Express handlers, and financial-service scheduled jobs.',
    SOURCE_READ_POLICY:
      'TypeScript AST and bounded source-text classification only. No application launch, runtime authentication, runtime database, migration, or database write.',
    CLASSIFICATION_POLICY:
      'Classifications record observable source signals and their boundary location; NO_*_OBSERVED and MIXED_OR_CONTEXTUAL are explicit classifications, not proof of public access or sufficient enforcement.',
    PAGE_EXPECTATION_POLICY:
      'The 22 historical auth expectations and 21 historical organization-context expectations are retained as 43 category-specific records. Overlapping page records remain separate obligations.',
    SERVER_ENTRY_SCOPE:
      'App Router route.ts files, exported HTTP methods, file-level use server async exports, explicit client-exposed server functions, financial-service routers actually mounted by its entry point, direct financial-service app handlers, and registered cron callbacks started by that service.',
    EXCLUSIONS: [
      'Unmounted financial-service router modules are excluded from the executable-entry denominator.',
      'Queue worker modules without production bootstrap/import evidence are not counted as executable entries.',
      'Framework gateways, deployment configuration, runtime identity, database policies, and runtime authorization behavior are not evaluated.',
    ],
    LIMITATIONS: [
      'Static source references do not establish that authentication, organization scope, role/permission, resource ownership, entitlement, or RLS checks are correct or sufficient.',
      'Absence of a source-level boundary signal does not establish anonymous reachability; external middleware and deployment controls are outside this census.',
      'The page-to-entry links are bounded static references and do not prove runtime journey reachability.',
    ],
  },
  ACCEPTED_INPUT_SHA256: {
    [pageIndexPath]: digest(JSON.stringify(pageIndex.pageAudienceIndex.records)),
    [r2cPath]: digest(readText(r2cPath)),
  },
  SOURCE_COVERAGE: {
    APP_ROUTER_ROUTE_FILES: routeFiles.length,
    APP_API_ROUTE_FILES: apiRouteFiles.length,
    NON_API_ROUTE_FILES: outsideApiRouteFiles.length,
    FINANCIAL_SERVICE_MOUNTED_ROUTER_FILES: routerMounts.size,
    PRODUCTION_SOURCE_FILES_WITH_ENTRIES: sourceFiles.length,
    PRODUCTION_ENTRY_SOURCE_FILES: sourceFiles,
    ACTIVE_FINANCIAL_SERVICE_SCHEDULE_MODULES: activeScheduleModules.map(({ file, start }) => ({
      SOURCE_FILE: file,
      START_FUNCTION: start,
    })),
  },
  ENTRY_ACCOUNTING: {
    TOTAL_EXECUTABLE_ENTRIES: publicEntries.length,
    UNIQUE_ENTRY_IDS: new Set(entryIds).size,
    APP_ROUTER_METHOD_ENTRIES: publicEntries.filter(
      (entry) => entry.ENTRY_CLASS === 'APP_ROUTER_ROUTE_METHOD',
    ).length,
    NEXTAUTH_HANDLER_ENTRIES: publicEntries.filter(
      (entry) => entry.ENTRY_CLASS === 'NEXTAUTH_AUTH_HANDLER',
    ).length,
    WEBHOOK_HANDLER_ENTRIES: publicEntries.filter(
      (entry) => entry.ENTRY_CLASS === 'WEBHOOK_HANDLER',
    ).length,
    SERVER_ACTION_ENTRIES: publicEntries.filter((entry) => entry.ENTRY_CLASS === 'SERVER_ACTION')
      .length,
    EXPLICIT_SERVER_FUNCTION_ENTRIES: publicEntries.filter(
      (entry) => entry.ENTRY_CLASS === 'SERVER_FUNCTION_EXPLICITLY_EXPOSED_TO_CLIENT',
    ).length,
    FINANCIAL_SERVICE_EXPRESS_ENTRIES: publicEntries.filter(
      (entry) =>
        entry.SOURCE_STATUS.startsWith('PRODUCTION_EXPRESS_') ||
        entry.SOURCE_STATUS === 'PRODUCTION_EXPRESS_ROUTER_MOUNT',
    ).length,
    SCHEDULED_OR_CRON_ENTRIES: publicEntries.filter(
      (entry) => entry.ENTRY_CLASS === 'SCHEDULED_OR_CRON_HANDLER',
    ).length,
    BY_ENTRY_CLASS: countBy(publicEntries, 'ENTRY_CLASS'),
    BY_SOURCE_STATUS: countBy(publicEntries, 'SOURCE_STATUS'),
  },
  BOUNDARY_CLASSIFICATION_COUNTS: Object.fromEntries(
    classificationFields.map((field) => [field, countBy(publicEntries, field)]),
  ),
  CLASSIFICATION_COMPLETENESS: {
    REQUIRED_FIELDS: classificationFields,
    ENTRIES_WITH_MISSING_CLASSIFICATION: unclassifiedEntries.length,
    RESULT: unclassifiedEntries.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
  },
  OBSERVED_SECURITY_BOUNDARY_SIGNALS: {
    DIRECT_HANDLER_SECURITY_BOUNDARY_ENTRIES: directBoundaryEntries.length,
    DIRECT_HANDLER_SECURITY_BOUNDARY_ENTRY_IDS: directBoundaryEntries.map(
      (entry) => entry.ENTRY_ID,
    ),
    PRIVILEGED_DATABASE_PATHS: privilegedDatabaseEntries.map((entry) => ({
      ENTRY_ID: entry.ENTRY_ID,
      ENTRY_CLASS: entry.ENTRY_CLASS,
      SOURCE_FILE: entry.SOURCE_FILE,
      EXPORT_OR_HANDLER: entry.EXPORT_OR_HANDLER,
      ROUTE_PATTERN: entry.ROUTE_PATTERN,
      RLS_CONTEXT_CLASS: entry.RLS_CONTEXT_CLASS,
      RLS_CONTEXT_HELPERS: entry.RLS_CONTEXT_HELPERS,
      SOURCE_EVIDENCE: entry.BOUNDARY_EVIDENCE,
    })),
    INTERPRETATION:
      'Observed paths are source-census records for Phase 1B.2 follow-up; they are not vulnerability findings or enforcement conclusions.',
  },
  WRAPPER_BOUNDARY_GRAPH: wrappers.map((wrapper) => ({
    ...wrapper,
    DIRECT_BOUNDARY_IDS: wrapper.DIRECT_FUNCTIONS_CALLED.flatMap((name) => {
      const target = wrapperByName.get(name)
      return target ? [target.BOUNDARY_ID] : []
    }),
  })),
  HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD: {
    INPUT_AUTH_EXPECTATIONS: carryForward.auth.length,
    INPUT_ORG_CONTEXT_EXPECTATIONS: carryForward.org.length,
    EXPECTATION_RECORDS_PRESERVED: carryForwardRecords.length,
    UNIQUE_EXPECTATION_IDS: new Set(carryForwardRecords.map((record) => record.CARRY_FORWARD_ID))
      .size,
    DISTINCT_PAGE_FILES: new Set(carryForwardRecords.map((record) => record.SOURCE_FILE)).size,
    BY_EXPECTATION_TYPE: countBy(carryForwardRecords, 'EXPECTATION_TYPE'),
    RECORDS: carryForwardRecords.sort((a, b) =>
      a.CARRY_FORWARD_ID.localeCompare(b.CARRY_FORWARD_ID),
    ),
  },
  PHASE_1B_1_FROZEN_STATE: {
    PHASE_1B_1: priorState.PHASE_1B_1,
    AUTHORITY_OBJECT_SOURCE_CEILINGS:
      frozenR2C.CARRY_FORWARD_REGISTERS.AUTHORITY_SOURCE_CEILINGS.length,
    KNOWN_AUTHORITY_DEFECT_OBJECTS:
      frozenR2C.CARRY_FORWARD_REGISTERS.KNOWN_AUTHORITY_DEFECT_OBJECTS.length,
    TARGETLESS_DATABASE_EFFECT_CHAINS:
      frozenR2C.EXCLUSIVE_ACCOUNTING.INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS,
    TARGETLESS_EFFECT_SOURCE_CEILINGS:
      frozenR2C.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_TARGET_SOURCE_CEILING,
    STATIC_WORK_REMAINING: priorState.STATIC_WORK_REMAINING,
    RUNTIME_PROVEN: priorState.RUNTIME_PROVEN,
    PHASE_1B_2_STARTED: priorState.PHASE_1B_2_STARTED,
  },
  GATE: {
    PHASE_1B_2A_CENSUS_GATE: 'PASS',
    PASS_CRITERIA: [
      'Every executable entry has a unique stable ID.',
      'Every executable entry has explicit audience, auth, organization-context, role, permission, admin, resource, entitlement, and RLS-context classifications.',
      'All 43 historical page expectation records are preserved exactly once.',
      'The frozen Phase 1B.1 source-ceiling and static-work state is carried forward unchanged.',
    ],
    RESULT:
      'The source census is complete for its declared static scope only; this is not a finding that enforcement is sufficient.',
    NEXT_PHASE: 'PHASE_1B_2B_AUTHORIZATION_AND_ORG_RESOURCE_ENFORCEMENT_CENSUS',
    NEXT_PHASE_AUTHORIZED: 'YES',
    NEXT_PHASE_STARTED: 'NO',
  },
  ENTRIES: publicEntries,
}

function renderMarkdown() {
  const lines = [
    '# Phase 1B.2a - Server authentication and boundary census',
    '',
    'Source-only inventory of executable server entries and observable boundaries. This report does not prove runtime reachability, authentication correctness, organization isolation, authorization, RLS correctness, or product readiness.',
    '',
    '## Gate and phase state',
    '',
    '```text',
    ...Object.entries(state).map(([key, value]) => `${key} = ${value}`),
    'PHASE_1B_2A_CENSUS_GATE = PASS',
    'PHASE_1B_2B_AUTHORIZATION_AND_ORG_RESOURCE_ENFORCEMENT_CENSUS = AUTHORIZED',
    'PHASE_1B_2B_STARTED = NO',
    '```',
    '',
    '## Scope and accounting',
    '',
    result.METHOD.SCOPE,
    '',
    `- App Router route files: ${result.SOURCE_COVERAGE.APP_ROUTER_ROUTE_FILES} (${result.SOURCE_COVERAGE.APP_API_ROUTE_FILES} under App API; ${result.SOURCE_COVERAGE.NON_API_ROUTE_FILES} outside App API).`,
    `- Executable entries: ${result.ENTRY_ACCOUNTING.TOTAL_EXECUTABLE_ENTRIES}; unique IDs: ${result.ENTRY_ACCOUNTING.UNIQUE_ENTRY_IDS}.`,
    `- Financial-service mounted router files: ${result.SOURCE_COVERAGE.FINANCIAL_SERVICE_MOUNTED_ROUTER_FILES}.`,
    `- Production source files represented: ${result.SOURCE_COVERAGE.PRODUCTION_SOURCE_FILES_WITH_ENTRIES}.`,
    '',
    '| Entry class | Entries |',
    '| --- | ---: |',
    ...Object.entries(result.ENTRY_ACCOUNTING.BY_ENTRY_CLASS).map(
      ([name, total]) => `| ${name} | ${total} |`,
    ),
    '',
    '## Observable boundary classifications',
    '',
    ...classificationFields.flatMap((field) => [
      `### ${field}`,
      '',
      '| Classification | Entries |',
      '| --- | ---: |',
      ...Object.entries(result.BOUNDARY_CLASSIFICATION_COUNTS[field]).map(
        ([value, total]) => `| ${value} | ${total} |`,
      ),
      '',
    ]),
    `Entries missing a required classification: ${result.CLASSIFICATION_COMPLETENESS.ENTRIES_WITH_MISSING_CLASSIFICATION}.`,
    '',
    'These values describe source signals only. `NO_*_OBSERVED` does not mean that a route is intentionally public or reachable without controls; `MIXED_OR_CONTEXTUAL` does not prove an audience boundary.',
    '',
    '## Follow-up signals',
    '',
    `- Entries marked as direct security-boundary follow-up: ${directBoundaryEntries.length}.`,
    `- Explicit privileged database paths: ${privilegedDatabaseEntries.length}.`,
    '- These are census signals for Phase 1B.2b, not security findings or proof of an exploitable condition.',
    '',
    '## Historical page expectations',
    '',
    `- Auth expectations preserved: ${carryForward.auth.length}.`,
    `- Organization-context expectations preserved: ${carryForward.org.length}.`,
    `- Separate category-specific records preserved: ${carryForwardRecords.length} across ${new Set(carryForwardRecords.map((record) => record.SOURCE_FILE)).size} page files.`,
    '- Overlapping page expectations remain separate obligations; server-entry links are bounded static references only.',
    '',
    '| Expectation type | Records |',
    '| --- | ---: |',
    ...Object.entries(result.HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD.BY_EXPECTATION_TYPE).map(
      ([type, total]) => `| ${type} | ${total} |`,
    ),
    '',
    '## Frozen prior-phase state',
    '',
    `- Phase 1B.1: \`${priorState.PHASE_1B_1}\`; static work remaining: ${priorState.STATIC_WORK_REMAINING}.`,
    `- R2B authority source ceilings: ${frozenR2C.CARRY_FORWARD_REGISTERS.AUTHORITY_SOURCE_CEILINGS.length}; known authority defects: ${frozenR2C.CARRY_FORWARD_REGISTERS.KNOWN_AUTHORITY_DEFECT_OBJECTS.length}.`,
    `- R2C targetless effects: ${frozenR2C.EXCLUSIVE_ACCOUNTING.INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS}; explicit target ceilings: ${frozenR2C.EXCLUSIVE_ACCOUNTING.CHAINS_WITH_TARGET_SOURCE_CEILING}.`,
    '- Phase 1B.2b is authorized but not started.',
    '',
    '## Limitations and handoff',
    '',
    ...result.METHOD.LIMITATIONS.map((limitation) => `- ${limitation}`),
    '',
    result.METHOD.SOURCE_READ_POLICY,
    '',
    '## Determinism and validation',
    '',
    '```text',
    'node --check scripts/ue/census-server-auth-boundaries.mjs',
    'node scripts/ue/census-server-auth-boundaries.mjs',
    'node scripts/ue/census-server-auth-boundaries.mjs --check',
    'pnpm exec prettier --check scripts/ue/census-server-auth-boundaries.mjs docs/union-eyes/reality-remediation/PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json docs/union-eyes/reality-remediation/PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.md',
    'pnpm validate:docs',
    '```',
    '',
    'No application, runtime authentication, runtime database, migration, or database write was executed.',
    '',
  ]
  return lines.join('\n')
}

const json = `${JSON.stringify(result, null, 2)}\n`
const markdown = renderMarkdown()
const [jsonConfig, markdownConfig] = await Promise.all([
  resolveConfig(sourcePath(jsonPath)),
  resolveConfig(sourcePath(markdownPath)),
])
const formattedJson = await format(json, {
  ...jsonConfig,
  filepath: sourcePath(jsonPath),
  parser: 'json',
})
const formattedMarkdown = await format(markdown, {
  ...markdownConfig,
  filepath: sourcePath(markdownPath),
  parser: 'markdown',
})
const check = process.argv.includes('--check')
assert(
  process.argv.slice(2).every((argument) => argument === '--check'),
  'Only --check is supported',
)
if (check) {
  assert.equal(
    readFileSync(sourcePath(jsonPath), 'utf8'),
    formattedJson,
    'JSON differs from deterministic regeneration',
  )
  assert.equal(
    readFileSync(sourcePath(markdownPath), 'utf8'),
    formattedMarkdown,
    'Markdown differs from deterministic regeneration',
  )
} else {
  writeFileSync(sourcePath(jsonPath), formattedJson)
  writeFileSync(sourcePath(markdownPath), formattedMarkdown)
}
console.log(
  JSON.stringify(
    {
      mode: check ? 'check' : 'generate',
      entries: result.ENTRY_ACCOUNTING.TOTAL_EXECUTABLE_ENTRIES,
      entryClassCounts: result.ENTRY_ACCOUNTING.BY_ENTRY_CLASS,
      carryForwardRecords:
        result.HISTORICAL_PAGE_EXPECTATION_CARRY_FORWARD.EXPECTATION_RECORDS_PRESERVED,
      classificationsComplete: result.CLASSIFICATION_COMPLETENESS.RESULT,
      phaseState: result.STATE,
    },
    null,
    2,
  ),
)
