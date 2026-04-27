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
    expect(source).toContain('payload?.items');
  });

  it('members admin console includes invite flow and taxonomy management surface', () => {
    const source = read('apps/union-eyes/components/admin/members-console.tsx');

    expect(source).toContain('/api/auth/invite/create');
    expect(source).toContain('Invite user');
    expect(source).toContain('JobClassificationManagement');
  });

  it('admin dashboard links to first-run onboarding and structure management', () => {
    const source = read('apps/union-eyes/app/[locale]/dashboard/admin/page.tsx');

    expect(source).toContain('/dashboard/admin/onboarding');
    expect(source).toContain('/dashboard/structure');
  });
});
