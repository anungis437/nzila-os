/** Local source/model policy regression; not a signed-in staging acceptance claim. */
import { PGlite } from '@electric-sql/pglite'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { loadCase } from './resources'
import { decide } from '../kernel'
import { facts, request, ref, NOW, ORG, ORG_B } from '../__tests__/fixtures'
import type { SqlExecutor } from './executor'

describe('the stored represented member survives conversion authorship', () => {
  it('grants the originating member only member visibility while retaining the converter and denying foreign/unrelated access', async () => {
    const pg = new PGlite(),
      id = randomUUID(),
      member = randomUUID(),
      converter = randomUUID()
    try {
      await pg.exec(`CREATE TABLE grievances(id uuid,organization_id uuid,created_by text,grievant_id uuid,created_at timestamptz,is_confidential boolean,has_legal_implications boolean);
        CREATE TABLE claims(claim_id uuid,organization_id uuid,member_id text,created_at timestamptz);
        CREATE TABLE ue_authority_workaid_matters(organization_id uuid,case_id uuid,counsel_accepted_at timestamptz,withdrawn_at timestamptz);`)
      await pg.query('INSERT INTO grievances VALUES($1,$2,$3,$4,$5,false,false)', [
        id,
        ORG,
        converter,
        member,
        new Date(NOW.getTime() - 1000),
      ])
      const exec = {
        query: async (text: string, params: unknown[]) => ({
          rows: (await pg.query(text, params)).rows,
        }),
      } as SqlExecutor
      const req = request(member, 'case:read', ref('case', id))
      const loaded = await loadCase(exec, req, NOW)
      expect(loaded?.relationships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relation: 'creator', principalUserId: converter }),
          expect.objectContaining({ relation: 'represented_member', principalUserId: member }),
        ]),
      )
      const context = facts(member, ['member'], { relationships: loaded!.relationships })
      expect(decide(req, context, loaded!.resource, NOW)).toMatchObject({
        effect: 'allow',
        scope: { visibility: 'member_visible' },
      })
      expect(
        decide({ ...req, action: 'case:read_internal' }, context, loaded!.resource, NOW).effect,
      ).toBe('deny')
      expect(
        decide({ ...req, action: 'case:assign' }, context, loaded!.resource, NOW).effect,
      ).toBe('deny')
      const outsider = randomUUID()
      expect(
        decide(
          request(outsider, 'case:read', ref('case', id)),
          facts(outsider, ['member'], { relationships: loaded!.relationships }),
          loaded!.resource,
          NOW,
        ).effect,
      ).toBe('deny')
      expect(
        await loadCase(
          exec,
          request(member, 'case:read', ref('case', id, ORG_B), { organizationId: ORG_B }),
          NOW,
        ),
      ).toBeNull()
    } finally {
      await pg.close()
    }
  })
})
