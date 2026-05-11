import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readWorkspaceFile(...segments: string[]): string {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', ...segments), 'utf8');
}

describe('CUPE pilot readiness source audit', () => {
  it('routes the member new-claim page through the hardened case intake API', () => {
    const source = readWorkspaceFile('app', '[locale]', 'dashboard', 'claims', 'new', 'page.tsx');

    expect(source).toContain('fetch("/api/cases/intake"');
    expect(source).not.toContain('fetch("/api/claims"');
    expect(source).toContain('memberId:');
  });

  it('routes member attachments through the dedicated case evidence API', () => {
    const source = readWorkspaceFile('app', '[locale]', 'dashboard', 'claims', 'new', 'page.tsx');
    const uploaderSource = readWorkspaceFile('components', 'file-upload.tsx');

    expect(source).toContain('fetch(`/api/cases/${claimId}/evidence`');
    expect(uploaderSource).toContain('fetch(`/api/cases/${claimId}/evidence`');
    expect(uploaderSource).toContain('method: \'DELETE\'');
    expect(uploaderSource).not.toContain('/api/upload');
  });

  it('implements case evidence GET, POST, and DELETE in the dedicated route', () => {
    const source = readWorkspaceFile('app', 'api', 'cases', '[caseId]', 'evidence', 'route.ts');

    expect(source).toContain('export const GET = withApi');
    expect(source).toContain('export const POST = withApi');
    expect(source).toContain('export const DELETE = withApi');
    expect(source).toContain('CaseAuditEvent.CASE_ATTACHMENT_UPLOADED');
    expect(source).toContain('CaseAuditEvent.CASE_ATTACHMENT_DELETED');
  });

  it('documents that the hardened intake route exists separately and resolves org scope via getOrganizationIdForUser', () => {
    const source = readWorkspaceFile('app', 'api', 'cases', 'intake', 'route.ts');

    expect(source).toContain('getOrganizationIdForUser(userId)');
    expect(source).toContain("requireEntitlement(orgId, 'grievance_case_suite')");
  });

  it('requires real organization access instead of allowing any existing organization', () => {
    const source = readWorkspaceFile('lib', 'organization-middleware.ts');

    expect(source).toContain('userHasOrganizationAccess');
    expect(source).toContain('getUserRoleInOrganization');
    expect(source).not.toContain('allow access if organization exists');
  });

  it('resolves org-scoped API auth from getOrganizationIdForUser instead of auth().orgId', () => {
    const source = readWorkspaceFile('lib', 'api-auth-guard.ts');

    expect(source).toContain('const { userId } = await auth()');
    expect(source).toContain('await getOrganizationIdForUser(userId)');
    expect(source).not.toContain('organizationId: options.orgScoped ? (orgId || null) : null');
  });

  it('removes password-bearing PostgreSQL outputs from the deployment template', () => {
    const source = readWorkspaceFile('infra', 'main.bicep');

    expect(source).toContain('@secure()');
    expect(source).toContain('administratorLoginPassword: postgresAdminPassword');
    expect(source).not.toContain('output postgresConnectionString string');
    expect(source).toContain('output postgresServerFqdn string');
  });
});