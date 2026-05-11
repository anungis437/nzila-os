// cognition-governance-ci: allow-route-bypass — Wrapper not yet present in kernel-bridge-foundational; tracked for migration.
/**
 * GET /api/exit-interviews/continuity-risk
 *
 * Returns an org-level operational continuity risk report.
 * Analyzes all published exit interviews for knowledge fragility signals.
 *
 * This evaluates ORGANIZATIONAL RISK — not individual employees.
 *
 * Access: officer+
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { ROLE_HIERARCHY, normalizeRole } from '@/lib/api-auth-guard';
import { detectContinuityRisks } from '@/lib/knowledge-transfer/continuity-risk/risk-detector';

export const dynamic = 'force-dynamic';

function hasOfficerPrivileges(role: string | null): boolean {
  const normalized = normalizeRole((role ?? 'member') as never);
  return (ROLE_HIERARCHY[normalized] ?? 0) >= ROLE_HIERARCHY.officer;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Get continuity risk report',
      description: 'Organizational continuity risk analysis based on published exit interviews.',
    },
  },
  async ({ organizationId, user }) => {
    if (!hasOfficerPrivileges(user?.role ?? null)) {
      throw ApiError.forbidden('Officer-level access required');
    }

    const report = await detectContinuityRisks(organizationId!);
    return { data: report };
  },
);
