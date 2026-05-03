export const UE_QA_REQUIRED_AUTHORITY_SCOPES = {
  caseCreate: 'claims:create',
  caseUpdate: 'claims:update',
  caseAssign: 'claims:assign',
  caseEscalate: 'claims:escalate',
  auditRead: 'audit:read',
  narVerify: 'nar:verify',
  exportAuditPack: 'audit:export',
  intelligenceRead: 'intelligence:read',
  pipelineMaterialize: 'pipeline:materialize',
} as const

export const UE_QA_MIN_ROLE_ENDPOINTS = [
  { route: '/api/workflow/transition', minRole: 'steward' },
  { route: '/api/workbench/assign', minRole: 'steward' },
  { route: '/api/cognition/kpis', minRole: 'steward' },
  { route: '/api/cognition/executive-summary', minRole: 'admin' },
  { route: '/api/admin/users', minRole: 'platform_lead' },
] as const

export const UE_QA_MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const

export const UE_EXTERNAL_TESTER_CONTAINMENT = {
  userId: 'ue-qa-ux-tester-001',
  isolatedOrgId: '33333333-3333-4333-8333-333333333333',
  allowedRoutes: ['/api/auth/user-role', '/api/claims', '/api/claims/[id]', '/api/claims/[id]/updates'],
  deniedRoutes: [
    '/api/admin/update-role',
    '/api/admin/users',
    '/api/exports',
    '/api/audits',
    '/api/workbench/assign',
  ],
  allowedUiFlows: ['login', 'submit-intake', 'view-own-case', 'view-own-updates'],
  blockedUiFlows: ['admin-user-management', 'cross-org-audit-export', 'role-management', 'platform-settings'],
  auditTrackingExpectation:
    'Every external tester mutation must emit request id, org id, actor id, and route-level authorization decision evidence.',
  revocationChecklist: [
    'Disable auth user account',
    'Remove org membership in isolated UX org',
    'Rotate test credential and invalidate sessions',
    'Export post-run audit pack and attach to QA evidence',
  ],
} as const
