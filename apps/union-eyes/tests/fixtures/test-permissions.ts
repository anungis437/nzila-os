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
