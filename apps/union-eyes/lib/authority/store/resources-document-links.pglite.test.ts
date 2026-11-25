// Real SQL fact loading; case authorization remains the canonical kernel's separate responsibility.
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadDocument } from './resources'
import type { SqlExecutor } from './executor'

const org = randomUUID(), otherOrg = randomUUID(), documentId = randomUUID(), caseId = randomUUID()
let pg: PGlite
let exec: SqlExecutor
beforeAll(async () => {
  pg = new PGlite()
  exec = { query: (text: string, params: unknown[] = []) => pg.query(text, params) } as SqlExecutor
  await pg.exec(`CREATE TABLE documents(id uuid, organization_id uuid, uploaded_by text, privacy_label text,
    contains_legal_privilege boolean, contains_medical_sensitive boolean, medical_sensitive boolean,
    disciplinary_sensitive boolean, member_pii boolean);
    CREATE TABLE document_links(document_id uuid, organization_id uuid, linked_entity_type text, linked_entity_id uuid);`)
})
afterAll(async () => { await pg.close() })
beforeEach(async () => {
  await pg.exec('DELETE FROM document_links; DELETE FROM documents;')
  await pg.query(`INSERT INTO documents(id,organization_id,uploaded_by,privacy_label) VALUES($1,$2,'member','team_confidential')`, [documentId, org])
})

describe('canonical document case-link facts', () => {
  it.each(['case', 'grievance'])('loads the %s alias with exact tenant and unchanged classification', async linkType => {
    await pg.query('INSERT INTO document_links VALUES($1,$2,$3,$4)', [documentId, org, linkType, caseId])
    expect(await loadDocument(exec, org, documentId)).toMatchObject({ organizationId: org, caseIds: [caseId], label: 'team_confidential', privileged: false })
    expect(await loadDocument(exec, otherOrg, documentId)).toBeNull()
  })

  it('deduplicates both spellings for one case and never arbitrarily selects one of two distinct cases', async () => {
    for (const type of ['case', 'grievance']) await pg.query('INSERT INTO document_links VALUES($1,$2,$3,$4)', [documentId, org, type, caseId])
    expect((await loadDocument(exec, org, documentId))?.caseIds).toEqual([caseId])
    const anotherCase = randomUUID()
    await pg.query("INSERT INTO document_links VALUES($1,$2,'case',$3)", [documentId, org, anotherCase])
    expect((await loadDocument(exec, org, documentId))?.caseIds.sort()).toEqual([caseId, anotherCase].sort())
  })

  it('cannot derive a case from a cross-tenant, unknown or non-case link', async () => {
    await pg.query("INSERT INTO document_links VALUES($1,$2,'case',$3),($1,$4,'unknown',$3),($1,$4,'member',$3)", [documentId, otherOrg, caseId, org])
    expect((await loadDocument(exec, org, documentId))?.caseIds).toEqual([])
  })
})
