/**
 * Round 56+ calendar credential isolation contract.
 *
 * Calendar routes no longer use generic CRUD. The previous test only
 * observed crudRoutes options and thus failed after explicit, safer routes
 * replaced that facade. This verifies the actual route source restrictions
 * and rejects accidental exposure of raw OAuth credentials.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const collection = readFileSync(join(__dirname, '..', 'calendar-sync', 'connections', 'route.ts'), 'utf8');
const item = readFileSync(join(__dirname, '..', 'calendar-sync', 'connections', '[id]', 'route.ts'), 'utf8');

describe('calendar-sync connections — strict actor/tenant and token boundaries', () => {
  it('lists only caller-owned connections under the active organization', () => {
    expect(collection).toMatch(/eq\(externalCalendarConnections\.organizationId,\s*organizationId\)/);
    expect(collection).toMatch(/eq\(externalCalendarConnections\.userId,\s*userId\)/);
    expect(collection).toMatch(/rlsOrgContext:\s*true/);
    expect(collection).toMatch(/auth:\s*\{\s*required:\s*true,\s*minRole:\s*'member'/);
    expect(collection).not.toMatch(/crudRoutes\(/);
  });

  it('creates no calendar credentials directly from an untrusted POST payload', () => {
    expect(collection).toMatch(/provider:\s*z\.enum\(\['google',\s*'microsoft'\]\)/);
    expect(collection).toMatch(/\}\)\.strict\(\)/);
    expect(collection).toMatch(/connectionCreated:\s*false/);
    expect(collection).not.toMatch(/\.insert\(/);
    expect(collection).not.toMatch(/accessToken:\s*body\.|refreshToken:\s*body\./);
  });

  it('guards item GET, PATCH and DELETE with one exact org/user/id predicate', () => {
    expect(item).toMatch(/const ownConnection[\s\S]*?eq\(connections\.organizationId,\s*organizationId\)[\s\S]*?eq\(connections\.userId,\s*userId\)[\s\S]*?eq\(connections\.id,\s*id\)/);
    const calls = item.match(/ownConnection\(organizationId,\s*userId,\s*parsed\.data\)/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(4);
    expect(item).not.toMatch(/crudRoutes\(/);
    expect(item).toMatch(/persistAtomicAudit\(tx/);
  });

  it('returns a strict non-secret projection and does not accept OAuth tokens as editable fields', () => {
    expect(item).toMatch(/const updateSchema = z\.object\(/);
    expect(item).toMatch(/\}\)\.strict\(\)\.refine/);
    for (const secret of ['accessToken', 'refreshToken', 'tokenSecret', 'clientSecret']) {
      expect(item).not.toMatch(new RegExp('\\b' + secret + '\\s*:\\s*connections\\.'));
      expect(item).not.toMatch(new RegExp('\\b' + secret + '\\s*:\\s*z\\.'));
    }
    expect(item).toMatch(/providerRevocationVerified:\s*false/);
  });
});
