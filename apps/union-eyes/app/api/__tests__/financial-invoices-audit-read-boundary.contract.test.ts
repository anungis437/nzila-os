import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRoute = (relative: string) => readFileSync(join(__dirname, '..', relative, 'route.ts'), 'utf8');

describe('Gate 0 financial and audit read boundaries', () => {
  it('external invoice customer names and balances require a live financial mandate and grant-scoped tenant read', () => {
    const source = readRoute('billing/invoices');
    const get = source.slice(source.indexOf('export const GET ='));
    expect(get).toContain('FINANCIAL_MEMBER_DATA_ROLES');
    expect(get).toContain('requireLiveFinancialMandate(tx,');
    expect(get).toContain("action: 'finance:view'");
    expect(get).toContain('withRLSContext({ organizationId, userId }');
    expect(get).toContain('rowsVisibleToGrant(grant, organizationId, externalInvoices.organizationId, externalInvoices.id)');
    expect(get).not.toMatch(/readRole:\s*['"]member['"]/);
  });

  it('organization audit records are administrator-only, tenant-scoped, and read-audited', () => {
    const source = readRoute('compliance/audit-logs');
    const get = source.slice(source.indexOf('export const GET ='), source.indexOf('export const POST ='));
    expect(get).toMatch(/minRole:\s*['"]admin['"]/);
    expect(get).toContain('withRLSContext({ organizationId, userId }');
    expect(get).toContain('eq(auditLogs.organizationId, organizationId)');
    expect(get).toContain('persistAtomicAudit(tx,');
    expect(get).toContain("action: 'compliance.audit_log.read'");
    expect(get).not.toMatch(/minRole:\s*['"]member['"]/);
  });
});
