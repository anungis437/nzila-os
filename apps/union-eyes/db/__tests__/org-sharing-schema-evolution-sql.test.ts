import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const src = readFileSync(resolve(__dirname, '../migrations-platform/0038_org_sharing_settings_shape.sql'), 'utf8');

describe('organization sharing stub migration 0038 — unqualified additive shape only', () => {
  it('has thirteen exact missing columns and matching nullable/default additions', () => {
    const names = [
      'allow_congress_sharing', 'allow_federation_sharing', 'allow_province_sharing',
      'allow_sector_sharing', 'allowed_sharing_levels', 'auto_share_clauses',
      'auto_share_precedents', 'default_sharing_level', 'max_shared_clauses',
      'max_shared_precedents', 'require_anonymization', 'sharing_approval_required',
      'sharing_approver_role',
    ];
    for(const name of names) expect(src).toContain('ADD COLUMN IF NOT EXISTS ' + name + ' ');
    expect((src.match(/ADD COLUMN IF NOT EXISTS/g) ?? [])).toHaveLength(13);
  });
  it('fails on duplicate or missing owners and records an authority fingerprint before altering', () => {
    expect(src).toContain('HAVING count(*) > 1');
    expect(src).toContain('organization_id IS NULL');
    expect(src).toContain('ue0038_authority_guard');
    expect(src).toContain('IF before_value IS DISTINCT FROM after_value');
    expect(src).toContain('relrowsecurity');
    expect(src).toContain('role_table_grants');
  });
  it('never silently enables sharing or issues permissions, keys, policies, or ownership changes', () => {
    expect(src).toContain('UNQUALIFIED / NO APPLY');
    const mutations = src.split('--> statement-breakpoint').slice(1).join('\n');
    expect(mutations).not.toMatch(/(?:CREATE POLICY|GRANT\s+SELECT|CREATE UNIQUE INDEX|ADD CONSTRAINT|DROP TABLE|DISABLE ROW LEVEL SECURITY)/i);
    for (const column of ['allow_congress_sharing','allow_federation_sharing','allow_province_sharing','allow_sector_sharing','auto_share_clauses','auto_share_precedents']) {
      expect(src).toContain('ADD COLUMN IF NOT EXISTS ' + column + ' boolean DEFAULT false');
    }
    for (const column of ['require_anonymization','sharing_approval_required']) {
      expect(src).toContain('ADD COLUMN IF NOT EXISTS ' + column + ' boolean DEFAULT true');
    }
  });
});
