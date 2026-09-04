/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 37: social_accounts OAuth credential authority — full
 * reachability census.
 *
 * Every real production reference to socialAccounts/SocialAccounts/
 * SocialAccountsViewSet/social_accounts/social-accounts/oauth_state/
 * oauth_organization_id/oauth_user_id/the OAuth callback path, scanned via
 * git grep across every tracked *.ts/*.tsx/*.py file (not a hand-maintained
 * directory allow-list) so a real caller under any production directory is
 * not invisible to it — same methodology as round 34/35/36's reachability
 * locks (required test #9: reachability census fails if a new production
 * importer/caller appears outside the reviewed set).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '..', '..', '..');

function realImporterFiles(pattern: string, extensions: string[], definingFileRelativePath?: string): string[] {
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-l', '-E', pattern, '--', ...extensions], {
      cwd: APP_ROOT,
      encoding: 'utf8',
    });
  } catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string };
    if (execErr.status === 1) return [];
    out = execErr.stdout ?? '';
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__') && !file.includes('.test.') && !file.includes('.spec.') && !file.includes('/tests.py'))
    // Exclude round-numbered Django containment test modules themselves —
    // their docstrings/imports necessarily cite the exact symbols under
    // review (e.g. tests_round36_reward_containment.py, this round's own
    // tests_round37_social_accounts_containment.py), which would otherwise
    // self-cite as a false "importer" the same way a test file would.
    .filter((file) => !/(^|\/)tests_round\d+_[^/]*\.py$/.test(file))
    .filter((file) => !file.startsWith('db/rls-storage-authority/'))
    .filter((file) => file !== definingFileRelativePath);
}

describe('round 37: full reachability census for social_accounts', () => {
  it('socialAccounts (TS) importers are exactly the reviewed set', () => {
    const importers = realImporterFiles('socialAccounts', ['*.ts', '*.tsx']).sort();
    expect(importers).toEqual(
      [
        'app/api/social-media/accounts/callback/route.ts',
        'app/api/social-media/accounts/route.ts',
        'app/api/social-media/analytics/route.ts',
        'app/api/social-media/posts/route.ts',
        'db/schema/domains/infrastructure/social-media.ts',
        'db/schema/social-media-schema.ts',
        'lib/social-media/social-media-service.ts',
      ].sort()
    );
  });

  it('SocialAccounts (Django model) importers are exactly the reviewed set', () => {
    const importers = realImporterFiles('SocialAccounts', ['*.py']).sort();
    expect(importers).toEqual(
      [
        'backend/content/admin.py',
        'backend/content/migrations/0001_initial.py',
        'backend/content/models.py',
        'backend/content/serializers.py',
        'backend/content/urls.py',
        'backend/content/views.py',
      ].sort()
    );
  });

  it('SocialAccountsViewSet importers are exactly urls.py + views.py', () => {
    const importers = realImporterFiles('SocialAccountsViewSet', ['*.py']).sort();
    expect(importers).toEqual(['backend/content/urls.py', 'backend/content/views.py'].sort());
  });

  it('no TS/TSX file calls the Django social-accounts REST endpoint', () => {
    const matches = realImporterFiles('content/social-accounts|api/content/social', ['*.ts', '*.tsx']);
    expect(matches).toEqual([]);
  });

  it('oauth_state is set and consumed only by the connect route and its own callback', () => {
    const matches = realImporterFiles('oauth_state', ['*.ts', '*.tsx']).sort();
    expect(matches).toEqual(
      ['app/api/social-media/accounts/callback/route.ts', 'app/api/social-media/accounts/route.ts'].sort()
    );
  });

  it('oauth_platform is set and consumed only by the connect route and its own callback', () => {
    const matches = realImporterFiles('oauth_platform', ['*.ts', '*.tsx']).sort();
    expect(matches).toEqual(
      ['app/api/social-media/accounts/callback/route.ts', 'app/api/social-media/accounts/route.ts'].sort()
    );
  });

  it('correction tranche: oauth_organization_id (org-binding cookie) is set and consumed only by the connect route and its own callback', () => {
    const matches = realImporterFiles('oauth_organization_id', ['*.ts', '*.tsx']).sort();
    expect(matches).toEqual(
      ['app/api/social-media/accounts/callback/route.ts', 'app/api/social-media/accounts/route.ts'].sort()
    );
  });

  it('correction tranche: oauth_user_id (session-binding cookie) is set and consumed only by the connect route and its own callback', () => {
    const matches = realImporterFiles('oauth_user_id', ['*.ts', '*.tsx']).sort();
    expect(matches).toEqual(
      ['app/api/social-media/accounts/callback/route.ts', 'app/api/social-media/accounts/route.ts'].sort()
    );
  });

  it('the callback redirect URI is only referenced by the connect route and its own callback', () => {
    const matches = realImporterFiles('accounts/callback', ['*.ts', '*.tsx']).sort();
    expect(matches).toEqual(
      ['app/api/social-media/accounts/callback/route.ts', 'app/api/social-media/accounts/route.ts'].sort()
    );
  });

  it('the callback route is no longer unrelated campaign CRUD (required test #10)', () => {
    const matches = realImporterFiles('crudRoutes', ['*.ts', '*.tsx']);
    expect(matches).not.toContain('app/api/social-media/accounts/callback/route.ts');
  });
});
