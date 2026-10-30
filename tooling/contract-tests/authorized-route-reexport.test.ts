import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { isAuthorizedRouteReexport } from './authorized-route-reexport';

const root = mkdtempSync(join(tmpdir(), 'ue-delegation-contract-'));
const api = join(root, 'app', 'api');
const target = join(api, 'canonical', 'route.ts');
const alias = join(api, 'alias', 'route.ts');
mkdirSync(dirname(alias), { recursive: true });
mkdirSync(dirname(target), { recursive: true });

const validTarget = `
export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
}, async () => ({}));
export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
}, async () => ({}));
`;
const validAlias = "export const dynamic = 'force-dynamic';\nexport { GET, PATCH } from '../canonical/route';\n";

afterAll(() => { if (existsSync(root)) rmSync(root, { recursive: true, force: true }); });

describe('authorization-preserving API route delegation', () => {
  it('recognizes the real Union Eyes event compatibility alias only when the canonical methods enforce org membership', () => {
    const actual = resolve(__dirname, '../../apps/union-eyes/app/api/events/[id]/route.ts');
    expect(isAuthorizedRouteReexport(actual)).toBe(true);
  });

  it('accepts a pure delegated alias with an actual guarded target', () => {
    writeFileSync(target, validTarget);
    writeFileSync(alias, validAlias);
    expect(isAuthorizedRouteReexport(alias)).toBe(true);
  });

  it('rejects all public, partial, mixed or missing-target aliases', () => {
    writeFileSync(target, validTarget.replace("required: true", "required: false"));
    writeFileSync(alias, validAlias);
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
    writeFileSync(target, validTarget.replace("requireOrg: true", "requireOrg: false"));
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
    writeFileSync(target, validTarget);
    writeFileSync(alias, validAlias.replace('GET, PATCH', 'GET, POST'));
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
    writeFileSync(alias, validAlias + "export const DELETE = async () => new Response('deleted');");
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
    writeFileSync(alias, validAlias.replace('../canonical/route', '../../other/route'));
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
    writeFileSync(alias, validAlias.replace('../canonical/route', '../../../external/route'));
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
    writeFileSync(alias, '// withApi({ auth: { required: true } })\\nexport const GET = async () => new Response();');
    expect(isAuthorizedRouteReexport(alias)).toBe(false);
  });
});
