import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOT_ENFORCED_SETTING_KEYS, notEnforcedKeysIn } from '@/lib/settings/unenforced-settings';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');

describe('Gate 0: stored organization security settings must not masquerade as enforced controls', () => {
  it('classifies persisted security keys without treating ordinary preferences as security controls', () => {
    expect(notEnforcedKeysIn({
      requireMFA: true,
      enforceStrongPasswords: true,
      sessionTimeout: 15,
      ipWhitelist: '192.0.2.0/24',
      timezone: 'America/Toronto',
    })).toEqual(['sessionTimeout', 'requireMFA', 'enforceStrongPasswords', 'ipWhitelist']);
    expect(notEnforcedKeysIn({ timezone: 'America/Toronto' })).toEqual([]);
    expect(NOT_ENFORCED_SETTING_KEYS).toContain('allowedDomains');
  });

  it('reports unenforced settings on a fresh GET as well as the save response', () => {
    const route = source('app/api/settings/organization/route.ts');
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('/* ── PUT'));
    const put = route.slice(route.indexOf('export const PUT'));
    expect(get).toContain('notEnforced: notEnforcedKeysIn(settings)');
    expect(put).toContain('notEnforcedKeysIn(checkedSettings)');
    expect(put).toContain('await persistAtomicAudit(tx,');
  });

  it('keeps the warning visible after reload and refuses to claim a failed save succeeded', () => {
    const screen = source('app/[locale]/dashboard/settings/_components/org-settings-content.tsx');
    expect(screen).toContain('setNotEnforced(Array.isArray(json.data.notEnforced)');
    expect(screen).toContain('Stored preferences, not enforced controls');
    expect(screen).toContain('Préférences enregistrées, non appliquées');
    expect(screen).toContain('role="status"');
    expect(screen).toContain("if (!res.ok || !json.success || json.data?.updated !== true)");
    expect(screen).toContain('setSaveError(true)');
    expect(screen).toContain('Settings were not saved. Your changes are preserved');
    expect(screen).toContain('setHasChanges(false)');
  });
});
