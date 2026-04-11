/**
 * Contract Test — UnionEyes: RLS Context Sets Both User AND Org
 *
 * BLOCKER: withRLSContext() must set app.current_org_id alongside
 * app.current_user_id. If org context is missing, RLS policies
 * cannot enforce org isolation → cross-org data breach.
 *
 * This contract test statically verifies the RLS wrapper code.
 *
 * @invariant INV-32: RLS context includes org_id
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const RLS_CONTEXT_PATH = join(ROOT, 'apps', 'union-eyes', 'lib', 'db', 'with-rls-context.ts');

describe('INV-32 — RLS Context Includes Org ID', () => {
  it('with-rls-context.ts exists', () => {
    expect(existsSync(RLS_CONTEXT_PATH)).toBe(true);
  });

  it('withRLSContext sets app.current_org_id', () => {
    const content = readFileSync(RLS_CONTEXT_PATH, 'utf-8');

    expect(content).toContain("set_config('app.current_org_id'");
    expect(content).toContain("set_config('app.current_user_id'");
  });

  it('withRLSContext requires orgId from Clerk auth', () => {
    const content = readFileSync(RLS_CONTEXT_PATH, 'utf-8');

    // Must destructure orgId from auth()
    expect(content).toMatch(/const\s*\{[^}]*orgId[^}]*\}\s*=\s*await\s+auth\(\)/);
  });

  it('withRLSContext rejects missing orgId', () => {
    const content = readFileSync(RLS_CONTEXT_PATH, 'utf-8');

    // Must check for !orgId and throw
    expect(content).toContain('Organization context required');
  });

  it('withSystemContext clears org context', () => {
    const content = readFileSync(RLS_CONTEXT_PATH, 'utf-8');

    // withSystemContext must clear both user and org context
    const systemContextBlock = content.slice(content.indexOf('withSystemContext'));
    expect(systemContextBlock).toContain("set_config('app.current_org_id', ''");
  });

  it('validateRLSContext checks org context', () => {
    const content = readFileSync(RLS_CONTEXT_PATH, 'utf-8');

    // validateRLSContext must validate org_id
    expect(content).toContain('app.current_org_id is not set');
  });
});
