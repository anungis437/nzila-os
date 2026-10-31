import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// DEF-0B1-CRUD-FACADE-ORG-MEMBERS and DEF-0B2-CRUD-FACADE-SEGMENTS-SETTINGS: a route must not advertise an operation of its own while
// being the generic CRUD factory over organization_members. Only the roster item route may bind that table through the factory;
// every other path either implements its operation or answers 501.

const API = path.resolve(__dirname, '../../../app/api');
const ROSTER_ROUTES = new Set(['members/[id]']);

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}
const rel = (file: string) => path.relative(API, path.dirname(file)).split(path.sep).join('/');

describe('roster facade routes', () => {
  const files = routeFiles(API).map((file) => ({ route: rel(file), text: readFileSync(file, 'utf8') }));

  it('no route other than the roster item route is the generic factory over organization_members', () => {
    const offenders = files
      .filter(({ route, text }) => !ROSTER_ROUTES.has(route) && /crudRoutes\(\{[^}]*table:\s*organizationMembers\b/s.test(text))
      .map(({ route }) => route);
    expect(offenders).toEqual([]);
  });

  it('the former facades answer 501 for every method they export, behind their original role floor', () => {
    const converted = [
      'admin/segments', 'admin/segments/[id]', 'admin/segments/[id]/execute', 'admin/system/settings', 'admin/update-role', 'admin/roles/batch',
      'admin/pki/certificates', 'admin/pki/certificates/[id]', 'admin/pki/signatures', 'admin/pki/workflows', 'auth/role', 'debug/user-role',
      'bulk-import', 'member/ai-feedback', 'members/search', 'members/[id]/roles',
      'equity/monitoring', 'equity/self-identify', 'equity/snapshots', 'support/metrics', 'support/sla', 'support/tickets',
      'support/tickets/[id]', 'support/tickets/[id]/assign', 'support/tickets/[id]/comments', 'organizing/assignments',
      'organizing/assignments/[id]', 'organizing/card-check', 'organizing/committee', 'organizing/forms/generate', 'organizing/labour-board',
      'organizing/nlrb-filings', 'organizing/notes', 'organizing/notes/[id]', 'organizing/sequences', 'organizing/sequences/[id]',
      'organizing/sequences/[id]/enroll', 'organizing/support-percentage', 'organizing/workplace-mapping', 'continuity/inheritance',
      'onboarding/readiness', 'onboarding/transfers', 'reports/[id]/share', 'upload', 'enterprise/integrations', 'events/[id]/occurrences',
      'ml/monitoring/drift', 'ml/monitoring/usage', 'ml/predictions/claim-outcome', 'ml/predictions/timeline', 'ml/predictions/workload-forecast',
      'clc/dashboard', 'clc/remittances', 'clc/sync', 'cope/canvassing', 'cope/officials', 'education/certifications/generate',
      'education/certifications/renewal-reminders', 'education/completions/certificates', 'education/notification-preferences', 'exports', 'exports/[id]',
      'exports/csv', 'exports/excel', 'exports/pdf', 'federations/[id]/affiliates', 'federations/[id]/dashboard', 'federations/[id]/meetings',
      'federations/[id]/remittances', 'federations/benchmark/grievances', 'jurisdiction/clc-compliance', 'jurisdiction/validate-deadline', 'locals',
      'locals/[id]', 'organizer/impact', 'portal/documents', 'portal/documents/upload', 'storage/cleanup', 'storage/usage', 'clauses/search',
      'movement-insights/trends', 'arbitration/precedents/[id]/citations', 'arbitration/precedents/[id]/documents', 'arbitration/precedents/search',
      'reports/[id]/execute', 'reports/[id]/run', 'communications/templates/[id]/duplicate', 'communications/campaigns/[id]/schedule', 'communications/campaigns/[id]/send-test', 'onboarding', 'wcb/claims', 'wcb/claims/[id]', 'social-media/feed', 'external-data', 'external-data/lrb', 'integrations/api-keys', 'reports/builder', 'reports/scheduled', 'reports/scheduled/[id]', 'reports/datasources/sample', 'healthwelfare/plans', 'reconciliation/bank', 'reconciliation/upload',
      'ml/recommendations', 'ml/predictions/churn-risk', 'ml/monitoring/alerts', 'billing/send-invoice', 'compliance/data-classification-policy', 'onboarding/smart-defaults', 'continuity/archives', 'continuity/docs',
    ];
    for (const route of converted) {
      const file = files.find((f) => f.route === route);
      expect(file, `${route} exists`).toBeTruthy();
      expect(file!.text).toContain('ApiError.notImplemented');
      expect(file!.text).toMatch(/auth: \{ required: true, minRole: '[a-z_]+' \}/);
      expect(file!.text).toMatch(/export const (GET|POST|PATCH|DELETE) = handler;/);
    }
  });

  // DEF-0B3-EXTERNAL-INVOICES-WRITE-ADVERTISED: an external invoice is a copy of a provider record; the collection keeps its mandate-checked read and no longer writes through the factory.
  it('the external invoice collection keeps its read and answers 501 to a write', () => {
    const file = files.find((f) => f.route === 'billing/invoices');
    expect(file, 'billing/invoices exists').toBeTruthy();
    expect(file!.text).toContain('ApiError.notImplemented');
    expect(file!.text).not.toContain('crudRoutes');
    expect(file!.text).toContain('requireLiveFinancialMandate');
    expect(file!.text).toMatch(/export const POST = withApi/);
    expect(file!.text).toMatch(/export const GET = withApi/);
  });
});
