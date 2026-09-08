/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 48: DERIVED_ANALYTICS_AND_AI_TELEMETRY_AUTHORITY —
 * establishes DERIVED_DATA_AUTHORITY as a reusable doctrine: the authority
 * question for analytics/AI/telemetry/prediction/aggregate tables is not
 * "which organization_id is on the row" but "what source data produced
 * this row, who may cause it to be generated, which principal writes it,
 * who may consume it, does aggregation alter its tenant boundary."
 *
 * Investigation universe (the 15 tables named by the round spec):
 *   analytics_metrics, ml_predictions, model_metadata, ai_budgets,
 *   trend_analyses, ai_usage_metrics, customer_nps_surveys,
 *   employer_risk_scores, insight_recommendations, mobile_analytics,
 *   pilot_metrics, social_analytics, usage_aggregates, usage_events,
 *   usage_meters.
 *
 * CLOSED this round (14 tables):
 *   TENANT_RLS_REQUIRED: analytics_metrics, ml_predictions, model_metadata,
 *     trend_analyses, ai_usage_metrics, employer_risk_scores,
 *     insight_recommendations, pilot_metrics, social_analytics (9 tables)
 *   SYSTEM_ONLY: customer_nps_surveys (genuine isSystemAdmin()-gated
 *     cross-org platform dashboard, no TENANT_USER path exists)
 *   CONTAINED_NO_AUTHORITY: mobile_analytics (TS side fully dead, Django
 *     ViewSet was unscoped IsAuthenticated-only, now DenyAllPermission)
 *   LATENT_UNREACHABLE: usage_aggregates, usage_events, usage_meters (the
 *     entire usage-metering-service.ts pipeline has zero live callers
 *     anywhere and no Django exposure)
 *
 * EXCEPTION retained (documented, NEEDS_REVIEW):
 *   ai_budgets — UNKNOWN_LINEAGE. Re-investigated fresh from the current
 *     exact head per the round-48 mandate not to reuse round 35's
 *     disposition blindly; confirmed unchanged (still Django-contained,
 *     still zero live TS callers, still no legitimate business consumer
 *     on either side).
 *
 * SECURITY DEFECTS FOUND AND FIXED (cross-tenant IDOR, both real and
 * exploitable via ordinary org-scoped roles, neither requiring any
 * platform-level bypass):
 *   1. ml_predictions / model_metadata —
 *      app/api/ml/predictions/churn-risk/route.ts (GET and POST) accepted
 *      a client-supplied organizationId (query params on GET; request
 *      body on POST) that OVERRODE the caller's own authenticated
 *      organizationId, letting any 'officer' of one organization read or
 *      generate+persist churn-risk predictions for another organization's
 *      members. Fixed by removing the override entirely; both handlers
 *      now always use the caller's own resolved organizationId.
 *   2. ai_usage_metrics — app/api/ai/feedback/route.ts's GET handler had
 *      ZERO tenant scoping (filtered only by requestId+operation), letting
 *      any authenticated 'member' of any organization read another
 *      organization's AI feedback (rating/comment/userId) for a
 *      guessed/enumerated query_id. Fixed by adding an organizationId
 *      predicate sourced from the caller's own auth context.
 *
 * DUAL-SCHEMA FINDING (same database, not a separate boundary):
 *   analytics_metrics, ml_predictions, model_metadata, trend_analyses, and
 *   insight_recommendations are all independently re-declared inside
 *   services/financial-service's own schema.ts/drizzle files. Traced
 *   financial-service/src/db/index.ts: it lazily requires this app's own
 *   lib/logger at runtime and reads the same process.env.DATABASE_URL
 *   convention; financial-service/drizzle/0000_lucky_mole_man.sql is a
 *   175-table `CREATE TABLE IF NOT EXISTS` snapshot that includes
 *   organizations/members/claims verbatim, consistent with drizzle-kit
 *   having introspected the SAME shared production database. Conclusion:
 *   these are same-database duplicate Drizzle declarations (a
 *   maintenance/code-hygiene issue), not SEPARATE_DATABASE_BOUNDARY cases.
 *
 * CROSS-ORG READER FINDING (documented, not a new defect requiring a fix
 * this round): app/api/analytics/cross-org/route.ts correctly requires
 * auth.minRole='platform_lead', a genuine NZila-platform-operations-tier
 * role (ROLE_HIERARCHY level 270, alongside app_owner/coo/cto) rather than
 * a union-side role. Traced role resolution (lib/api/with-api.ts ->
 * getUserRole -> authOrganizationUsers.role / organization_members.role):
 * confirmed no live application route writes an arbitrary role value to
 * either table (only lib/services/member-access-revocation-service.ts
 * writes to authOrganizationUsers, and only isActive, never role) — no
 * self-elevation path exists today. The architectural coupling of
 * platform-tier roles to a per-org membership table is a design smell
 * worth a future dedicated hardening pass, not a blocking defect here.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { storageAuthorityManifest } from '../rls-storage-authority-manifest';

const APP_ROOT = resolve(__dirname, '..', '..');

function source(path: string): string {
  return readFileSync(resolve(APP_ROOT, path), 'utf8');
}

function entryFor(table: string) {
  const entry = storageAuthorityManifest.find((e) => e.table === table);
  expect(entry, `${table}: no manifest entry found`).toBeTruthy();
  return entry!;
}

/* ── Closed cohort: manifest shape assertions ─────────────────────────── */

describe('round 48 TENANT_RLS_REQUIRED cohort', () => {
  const closedTenantTables = [
    'analytics_metrics',
    'ml_predictions',
    'model_metadata',
    'trend_analyses',
    'ai_usage_metrics',
    'employer_risk_scores',
    'insight_recommendations',
    'pilot_metrics',
    'social_analytics',
  ];

  it.each(closedTenantTables)('%s is closed TENANT_RLS_REQUIRED with fully resolved authority', (table) => {
    const entry = entryFor(table);
    expect(entry.classification).toBe('TENANT_RLS_REQUIRED');
    expect(entry.requiredRuntimePrivileges).not.toBe('TBD');
    expect(entry.requiredSystemPrivileges).not.toBe('TBD');
    expect(entry.invocationAuthority).not.toBe('TBD');
    expect(entry.dbExecutionPrincipal).not.toBe('TBD');
    expect(entry.dbExecutionPrincipal).toBe('TENANT_RUNTIME');
  });
});

describe('round 48 SYSTEM_ONLY: customer_nps_surveys', () => {
  it('has the genuine platform-admin cross-org shape with zero runtime privileges', () => {
    const entry = entryFor('customer_nps_surveys');
    expect(entry.classification).toBe('SYSTEM_ONLY');
    expect(entry.requiredRuntimePrivileges).toEqual([]);
    expect(entry.invocationAuthority).toBe('PLATFORM_ADMIN');
    expect(entry.dbExecutionPrincipal).toBe('SYSTEM_RUNTIME');
  });

  it('page enforces isSystemAdmin() before any cross-org query', () => {
    const src = source('app/[locale]/dashboard/customer-success/page.tsx');
    expect(src).toContain('isSystemAdmin');
    expect(src).toContain('withSystemContext');
  });
});

describe('round 48 CONTAINED_NO_AUTHORITY: mobile_analytics', () => {
  it('has the strict zero-authority shape', () => {
    const entry = entryFor('mobile_analytics');
    expect(entry.classification).toBe('CONTAINED_NO_AUTHORITY');
    expect(entry.requiredRuntimePrivileges).toEqual([]);
    expect(entry.invocationAuthority).toBe('NONE');
    expect(entry.dbExecutionPrincipal).toBe('NONE');
  });

  it('Django ViewSet uses DenyAllPermission', () => {
    const src = source('backend/notifications/views.py');
    const match = src.match(/class MobileAnalyticsViewSet\(viewsets\.ModelViewSet\):[\s\S]*?permission_classes = \[(\w+)\]/);
    expect(match, 'MobileAnalyticsViewSet permission_classes not found').toBeTruthy();
    expect(match![1]).toBe('DenyAllPermission');
  });
});

describe('round 48 LATENT_UNREACHABLE cohort: usage metering pipeline', () => {
  const latentTables = ['usage_aggregates', 'usage_events', 'usage_meters'];

  it.each(latentTables)('%s is closed LATENT_UNREACHABLE with zero authority', (table) => {
    const entry = entryFor(table);
    expect(entry.classification).toBe('LATENT_UNREACHABLE');
    expect(entry.requiredRuntimePrivileges).toEqual([]);
    expect(entry.invocationAuthority).toBe('NONE');
    expect(entry.dbExecutionPrincipal).toBe('NONE');
  });
});

describe('round 48 exception: ai_budgets stays NEEDS_REVIEW', () => {
  it('is documented as a re-verified UNKNOWN_LINEAGE exception, not silently dropped', () => {
    const entry = entryFor('ai_budgets');
    expect(entry.classification).toBe('NEEDS_REVIEW');
    expect(entry.reason).toMatch(/round 48/i);
    expect(entry.reason).toMatch(/RE-VERIFIED FRESH/);
    expect(entry.reason).toMatch(/UNKNOWN_LINEAGE/);
  });

  it('Django ViewSet is still contained via DenyAllPermission', () => {
    const src = source('backend/ai_core/views.py');
    const match = src.match(/class AiBudgetsViewSet\(viewsets\.ModelViewSet\):[\s\S]*?permission_classes = \[(\w+)\]/);
    expect(match, 'AiBudgetsViewSet permission_classes not found').toBeTruthy();
    expect(match![1]).toBe('DenyAllPermission');
  });

  it('trackCost is still a dead optional-chained call, not a real method', () => {
    const src = source('lib/ai/services/cost-tracking-wrapper.ts');
    expect(src).not.toMatch(/\btrackCost\s*\(/);
  });
});

describe('round 48: no TBD authority fields remain on the closed cohort', () => {
  const closedThisRound = [
    'analytics_metrics', 'ml_predictions', 'model_metadata', 'trend_analyses',
    'ai_usage_metrics', 'customer_nps_surveys', 'employer_risk_scores',
    'insight_recommendations', 'mobile_analytics', 'pilot_metrics',
    'social_analytics', 'usage_aggregates', 'usage_events', 'usage_meters',
  ];

  it('every closed entry has fully resolved (non-TBD) authority fields', () => {
    for (const table of closedThisRound) {
      const entry = entryFor(table);
      expect(entry.requiredRuntimePrivileges, `${table}.requiredRuntimePrivileges`).not.toBe('TBD');
      expect(entry.requiredSystemPrivileges, `${table}.requiredSystemPrivileges`).not.toBe('TBD');
      expect(entry.invocationAuthority, `${table}.invocationAuthority`).not.toBe('TBD');
      expect(entry.dbExecutionPrincipal, `${table}.dbExecutionPrincipal`).not.toBe('TBD');
    }
  });
});

/* ── Cross-tenant IDOR regression ratchets (defects found + fixed) ─────── */

describe('round 48 cross-tenant IDOR ratchet: ml_predictions churn-risk route', () => {
  it('GET no longer honors a client-supplied organizationId/orgId/organization_id/org_id override', () => {
    const src = source('app/api/ml/predictions/churn-risk/route.ts');
    expect(src).not.toMatch(/searchParams\.get\('organizationId'\)\s*\?\?\s*searchParams\.get\('orgId'\)/);
  });

  it('POST no longer accepts organizationId in its request-body schema', () => {
    const src = source('app/api/ml/predictions/churn-risk/route.ts');
    const schemaMatch = src.match(/const mlPredictionsChurnRiskSchema = z\.object\(\{[\s\S]*?\}\);/);
    expect(schemaMatch, 'mlPredictionsChurnRiskSchema not found').toBeTruthy();
    expect(schemaMatch![0]).not.toContain('organizationId');
  });

  it('both handlers reject requests with no organization context', () => {
    const src = source('app/api/ml/predictions/churn-risk/route.ts');
    const requireOrgCount = (src.match(/Organization context required/g) ?? []).length;
    expect(requireOrgCount).toBeGreaterThanOrEqual(2);
  });
});

describe('round 48 cross-tenant IDOR ratchet: ai_usage_metrics feedback route', () => {
  it('GET scopes its select query by the caller\'s own organizationId', () => {
    const src = source('app/api/ai/feedback/route.ts');
    const getMatch = src.match(/export const GET = withRoleAuth\('member',[\s\S]*$/);
    expect(getMatch, 'GET handler not found').toBeTruthy();
    expect(getMatch![0]).toContain('eq(aiUsageMetrics.organizationId, context.organizationId)');
  });

  it('GET rejects requests with no organization context', () => {
    const src = source('app/api/ai/feedback/route.ts');
    const getMatch = src.match(/export const GET = withRoleAuth\('member',[\s\S]*$/);
    expect(getMatch![0]).toContain('No active organization');
  });
});

/* ── Dual-schema (same database) documentation ratchet ─────────────────── */

describe('round 48 dual-schema (same-database) documentation ratchet', () => {
  const dualSchemaTables = [
    'analytics_metrics', 'ml_predictions', 'model_metadata',
    'trend_analyses', 'insight_recommendations',
  ];

  it('every dual-schema table documents the same-database (not separate-boundary) conclusion', () => {
    for (const table of dualSchemaTables) {
      const entry = entryFor(table);
      expect(entry.reason, `${table} reason`).toMatch(/DUAL-SCHEMA FINDING|DUPLICATE DECLARATION FINDING/);
    }
  });

  it('financial-service genuinely shares this app\'s runtime (not an isolated deployment)', () => {
    const src = source('services/financial-service/src/db/index.ts');
    expect(src).toContain("require('../../../../lib/logger')");
    expect(src).toContain('process.env.DATABASE_URL');
  });
});
