import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { resolveDocumentCaseId } from './document-link-authority';

const OWN = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const OWN_CASE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FOREIGN_CASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NON_CASE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let pg: PGlite;
let database: ReturnType<typeof drizzle>;
const resolve = (linkedEntityType: string | null, linkedEntityId: string | null, organizationId = OWN) =>
  resolveDocumentCaseId(database as unknown as Pick<RLSTx, 'select'>, { organizationId, linkedEntityType, linkedEntityId });

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec('CREATE TABLE grievances(id uuid PRIMARY KEY, organization_id uuid NOT NULL)');
  await pg.query('INSERT INTO grievances VALUES($1,$2),($3,$4)', [OWN_CASE, OWN, FOREIGN_CASE, FOREIGN]);
  database = drizzle(pg);
});
beforeEach(() => vi.restoreAllMocks());
afterAll(async () => { await pg?.close(); });

describe('document link authority on actual tenant-filtered SQL', () => {
  it.each(['case', 'grievance'])('resolves explicit %s without another SQL lookup', async type => {
    const select = vi.spyOn(database, 'select');
    expect(await resolve(type, OWN_CASE)).toBe(OWN_CASE);
    expect(select).not.toHaveBeenCalled();
  });

  it.each(['member', 'policy_library', 'template_library', 'collective_agreement', 'other'])('recognizes a legacy %s label that names this tenant case', async type => {
    const select = vi.spyOn(database, 'select');
    expect(await resolve(type, OWN_CASE)).toBe(OWN_CASE);
    expect(select).toHaveBeenCalledOnce();
  });

  it('does not turn a different tenant case or ordinary entity into a case of this tenant', async () => {
    expect(await resolve('policy_library', FOREIGN_CASE)).toBeNull();
    expect(await resolve('policy_library', OWN_CASE, FOREIGN)).toBeNull();
    expect(await resolve('policy_library', NON_CASE)).toBeNull();
  });

  it('keeps an unlinked document unlinked without SQL', async () => {
    const select = vi.spyOn(database, 'select');
    expect(await resolve(null, null)).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it.each([[null, OWN_CASE], ['case', null], ['policy_library', null], ['unknown', OWN_CASE]])('refuses malformed %s/%s instead of returning organization scope', async (type, id) => {
    const select = vi.spyOn(database, 'select');
    await expect(resolve(type, id)).rejects.toThrow('DOCUMENT_LINK_INVALID');
    expect(select).not.toHaveBeenCalled();
  });
});
