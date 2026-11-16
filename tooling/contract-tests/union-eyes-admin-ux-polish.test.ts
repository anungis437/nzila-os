import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('Union Eyes admin UX polish contract', () => {
  it('normalizes pilot onboarding API checklist items for UI rendering', () => {
    const source = read('apps/union-eyes/app/[locale]/dashboard/pilot/onboarding/onboarding-console.tsx');

    expect(source).toContain('buildChecklistFromFlags');
    expect(source).toContain('result.data?.items');
  });

  it('connects organization invitations through direct administration in both entry and API', () => {
    const entry = read('apps/union-eyes/app/[locale]/dashboard/admin/members/page.tsx');
    const invitations = read('apps/union-eyes/components/admin/organization-invitations.tsx');
    const create = read('apps/union-eyes/app/api/auth/invite/create/route.ts');
    expect(entry).toContain('canManageOrganizationInvites(');
    expect(entry).toContain('<OrganizationInvitations');
    expect(invitations).toContain('/api/auth/invite/create');
    expect(invitations).toContain('/api/auth/invite/manage');
    expect(create).toContain('canManageOrganizationInvites(');
    expect(create).toContain('context.organizationId');
    expect(create).toContain('context.userId');
  });

  it('retains taxonomy management in the support console without advertising an unauthorized invitation flow', () => {
    const support = read('apps/union-eyes/components/admin/members-console.tsx');
    expect(support).toContain('JobClassificationManagement');
    expect(support).not.toContain('/api/auth/invite/create');
    expect(support).not.toContain('Invite user');
  });

  it('admin dashboard links to first-run onboarding and structure management', () => {
    const source = read('apps/union-eyes/app/[locale]/dashboard/admin/page.tsx');

    expect(source).toContain('/dashboard/admin/onboarding');
    expect(source).toContain('/dashboard/structure');
  });
});
