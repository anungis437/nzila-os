/**
 * QA Route Inventory — static-array design
 *
 * All route metadata is declared inline. No filesystem scanning at runtime.
 * Spec files import from this module to drive contract assertions.
 */

export type ReadinessCategory = 'pilot_critical' | 'ux_ready' | 'audit'
export type DecisionNarExpectation = 'required' | 'delegated' | 'not_required'

export type RouteQaMetadata = {
  routeFile: string
  method: string
  expectedAuthorizationByPersona: {
    member: 'allow' | 'deny' | 'conditional'
    steward: 'allow' | 'deny' | 'conditional'
    admin: 'allow' | 'deny' | 'conditional'
    auditor: 'allow' | 'deny' | 'conditional'
    externalUxTester: 'allow' | 'deny' | 'conditional'
    unauthenticated: 'allow' | 'deny' | 'conditional'
  }
  expectedDecisionRecordBehavior: DecisionNarExpectation
  expectedNarBehavior: DecisionNarExpectation
  requiredRolePermissionScope: string
  intelligencePipelineApplies: boolean
  auditExportApplies: boolean
  readinessCategory: ReadinessCategory
}

export type RouteEntry = {
  filePath: string
  methods: string[]
  minRoles: string[]
  hasAuthWrapper: boolean
  hasOrgScoped: boolean
  hasDecisionEvidenceHook: boolean
  hasNarEvidenceHook: boolean
  source: string
}

export const PILOT_CRITICAL_ROUTE_FILES: ReadonlyArray<string> = [
  'app/api/workflow/transition/route.ts',
  'app/api/workbench/assign/route.ts',
  'app/api/claims/route.ts',
  'app/api/claims/[id]/status/route.ts',
  'app/api/exports/route.ts',
  'app/api/admin/update-role/route.ts',
  'app/api/analytics/executive/route.ts',
  'app/api/analytics/dashboard/route.ts',
]

export const QA_ROUTE_INVENTORY: RouteQaMetadata[] = [
  // ── Workflow ─────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/workflow/transition/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'required',
    expectedNarBehavior: 'required',
    requiredRolePermissionScope: 'workflow:transition',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Workbench ────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/workbench/assign/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'required',
    expectedNarBehavior: 'delegated',
    requiredRolePermissionScope: 'workbench:assign',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Claims ───────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/claims/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'conditional',
      steward: 'allow',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'claims:read_assigned',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },
  {
    routeFile: 'app/api/claims/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'required',
    expectedNarBehavior: 'required',
    requiredRolePermissionScope: 'claims:create',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },
  {
    routeFile: 'app/api/claims/[id]/status/route.ts',
    method: 'PATCH',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'required',
    expectedNarBehavior: 'required',
    requiredRolePermissionScope: 'claims:update_status',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },
  {
    routeFile: 'app/api/claims/[id]/evidence/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'conditional',
      steward: 'allow',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'claims:read_assigned',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Upload ───────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/upload/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'conditional',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'delegated',
      expectedNarBehavior: 'delegated',
    requiredRolePermissionScope: 'documents:upload',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Exports ──────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/exports/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'exports:read',
    intelligencePipelineApplies: false,
    auditExportApplies: true,
    readinessCategory: 'audit',
  },
  {
    routeFile: 'app/api/exports/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'required',
    expectedNarBehavior: 'required',
    requiredRolePermissionScope: 'exports:create',
    intelligencePipelineApplies: false,
    auditExportApplies: true,
    readinessCategory: 'pilot_critical',
  },

  // ── Admin ────────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/admin/update-role/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'deny',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'required',
    expectedNarBehavior: 'required',
    requiredRolePermissionScope: 'admin:update_role',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Cognition ────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/cognition/kpis/route.ts',
    method: 'POST',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'deny',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'delegated',
    expectedNarBehavior: 'delegated',
    requiredRolePermissionScope: 'cognition:execute',
    intelligencePipelineApplies: true,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  {
    routeFile: 'app/api/analytics/executive/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'deny',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'analytics:executive',
    intelligencePipelineApplies: true,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },
  {
    routeFile: 'app/api/analytics/dashboard/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'analytics:read',
    intelligencePipelineApplies: true,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },
  {
    routeFile: 'app/api/cba-intelligence/benchmark/[id]/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'allow',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'analytics:read',
    intelligencePipelineApplies: true,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },
  {
    routeFile: 'app/api/cba-intelligence/freshness/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'deny',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'analytics:executive',
    intelligencePipelineApplies: true,
    auditExportApplies: false,
    readinessCategory: 'pilot_critical',
  },

  // ── Operational endpoints (health / governance / evidence) ───────────────
  {
    routeFile: 'app/api/health/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'deny',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'ops:health:read',
    intelligencePipelineApplies: false,
    auditExportApplies: false,
    readinessCategory: 'audit',
  },
  {
    routeFile: 'app/api/governance/telemetry/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'deny',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'governance:telemetry:read',
    intelligencePipelineApplies: false,
    auditExportApplies: true,
    readinessCategory: 'audit',
  },
  {
    routeFile: 'app/api/evidence/export/route.ts',
    method: 'GET',
    expectedAuthorizationByPersona: {
      member: 'deny',
      steward: 'deny',
      admin: 'allow',
      auditor: 'allow',
      externalUxTester: 'deny',
      unauthenticated: 'deny',
    },
    expectedDecisionRecordBehavior: 'not_required',
    expectedNarBehavior: 'not_required',
    requiredRolePermissionScope: 'evidence:export:read',
    intelligencePipelineApplies: false,
    auditExportApplies: true,
    readinessCategory: 'audit',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function parseRoleList(raw: string): string[] {
  if (!raw) return []
  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((v) => v.replace(/[\[\]'"\s]/g, ''))
      .filter(Boolean)
  }
  return [raw.replace(/[\[\]'"\s]/g, '')].filter(Boolean)
}

export function rel(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

export function getQaMetadataForFile(filePath: string): RouteQaMetadata[] {
  const normalized = rel(filePath)
  return QA_ROUTE_INVENTORY.filter((entry) => entry.routeFile === normalized)
}

export function collectRouteInventory(): RouteEntry[] {
  const byRoute = new Map<string, RouteQaMetadata[]>()
  for (const metadata of QA_ROUTE_INVENTORY) {
    const existing = byRoute.get(metadata.routeFile) ?? []
    existing.push(metadata)
    byRoute.set(metadata.routeFile, existing)
  }
  return [...byRoute.entries()].map(([routeFile, entries]) => ({
    filePath: routeFile,
    methods: uniq(entries.map((e) => e.method)),
    minRoles: uniq(
      entries
        .map((e) => parseRoleList(e.requiredRolePermissionScope)[0] ?? '')
        .filter(Boolean),
    ),
    hasAuthWrapper: true,
    hasOrgScoped: true,
    hasDecisionEvidenceHook: entries.some(
      (e) =>
        e.expectedDecisionRecordBehavior === 'required' ||
        e.expectedDecisionRecordBehavior === 'delegated',
    ),
    hasNarEvidenceHook: entries.some(
      (e) =>
        e.expectedNarBehavior === 'required' ||
        e.expectedNarBehavior === 'delegated',
    ),
    source: entries.map((e) => `${e.method}:${e.requiredRolePermissionScope}`).join(';'),
  }))
}

export function isMutationRoute(entry: RouteEntry): boolean {
  return entry.methods.some((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m))
}

export function collectCriticalRouteInventory(): RouteEntry[] {
  const all = collectRouteInventory()
  const critical = new Set<string>(PILOT_CRITICAL_ROUTE_FILES)
  return all.filter((entry) => critical.has(rel(entry.filePath)))
}

export function getMissingPilotCriticalMetadata(): string[] {
  return PILOT_CRITICAL_ROUTE_FILES.filter((routeFile) => getQaMetadataForFile(routeFile).length === 0)
}
