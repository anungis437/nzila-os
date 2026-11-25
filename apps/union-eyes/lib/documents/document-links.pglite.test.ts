import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { allDocumentLinksWellFormed, readDocumentLinks, UNLINKED_DOCUMENT } from './document-links';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const DOC = '33333333-3333-4333-8333-333333333333';
const CASE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CASE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CASE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let pg: PGlite;
let tx: RLSTx;

const addLink = (organizationId: string, documentId: string, type: string, id: string) =>
  pg.query(
    'INSERT INTO document_links(organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES($1,$2,$3,$4,$5)',
    [organizationId, documentId, type, id, 'u1'],
  );

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE TABLE document_links(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_id uuid NOT NULL,
    linked_entity_type text NOT NULL, linked_entity_id uuid NOT NULL, linked_by text NOT NULL,
    linked_at timestamptz NOT NULL DEFAULT now(), metadata jsonb DEFAULT '{}')`);
  tx = drizzle(pg) as unknown as RLSTx;
});
afterAll(async () => { await pg?.close(); });

describe('every link of a document is read, in one fixed order', () => {
  it('returns all links of a multi-case document in the same order whichever was attached first', async () => {
    await addLink(ORG, DOC, 'grievance', CASE_B);
    await addLink(ORG, DOC, 'case', CASE_C);
    await addLink(ORG, DOC, 'case', CASE_A);
    const first = await readDocumentLinks(tx, ORG, DOC);
    expect(first).toEqual([
      { linkedEntityType: 'case', linkedEntityId: CASE_A },
      { linkedEntityType: 'case', linkedEntityId: CASE_C },
      { linkedEntityType: 'grievance', linkedEntityId: CASE_B },
    ]);
    await pg.exec(`UPDATE document_links SET metadata = metadata || '{"touched": true}'::jsonb`);
    expect(await readDocumentLinks(tx, ORG, DOC)).toEqual(first);
  });

  it('never reads another organization’s links and treats a document with none as unlinked', async () => {
    const lonely = '44444444-4444-4444-8444-444444444444';
    await addLink(OTHER_ORG, lonely, 'case', CASE_A);
    expect(await readDocumentLinks(tx, ORG, lonely)).toBe(UNLINKED_DOCUMENT);
  });

  it('refuses the whole document when any one link is malformed', () => {
    expect(allDocumentLinksWellFormed(UNLINKED_DOCUMENT)).toBe(true);
    expect(allDocumentLinksWellFormed([{ linkedEntityType: 'case', linkedEntityId: CASE_A }, { linkedEntityType: 'case', linkedEntityId: ' ' }])).toBe(false);
    expect(allDocumentLinksWellFormed([{ linkedEntityType: 'case', linkedEntityId: CASE_A }, { linkedEntityType: 'mystery', linkedEntityId: CASE_B }])).toBe(false);
  });
});
