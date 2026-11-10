import { describe, expect, it } from 'vitest'
import { canonicalCatalogObject, canonicalDumpExpression } from './catalog-normalization'
import { catalogDigest } from './installer'

const arrayCast = "(ARRAY['member'::character varying, 'admin'::character varying])::text[]"
const elementCasts =
  "ARRAY[('member'::character varying)::text, ('admin'::character varying)::text]"
const relation = (acl: string | null) => ({
  kind: 'relation',
  id: 'public.fixture',
  definition: { kind: 'r', owner: 'ue_v2_owner', rls: true, force: true, acl },
})
const pgAcl = (items: string[]) => `{${items.map((x) => JSON.stringify(x)).join(',')}}`

describe('PostgreSQL dump catalog equivalence without weakening authority', () => {
  it('recognizes the measured lossless array-cast rewrite in predicates', () => {
    expect(canonicalDumpExpression(`role = ANY (${arrayCast})`)).toBe(
      `role = ANY (${elementCasts})`,
    )
    const a = {
      kind: 'policy',
      id: 'public.fixture.tenant',
      definition: { check: `org_id = current_setting('org') AND role = ANY (${arrayCast})` },
    }
    const b = {
      ...a,
      definition: { check: `org_id = current_setting('org') AND role = ANY (${elementCasts})` },
    }
    expect(catalogDigest([a])).toBe(catalogDigest([b]))
    expect(catalogDigest([a])).not.toBe(
      catalogDigest([
        {
          ...b,
          definition: {
            check: b.definition.check.replace("current_setting('org')", "current_setting('other')"),
          },
        },
      ]),
    )
    expect(catalogDigest([a])).not.toBe(
      catalogDigest([
        { ...b, definition: { check: b.definition.check.replace("'admin'", "'super_admin'") } },
      ]),
    )
  })
  it('never rewrites literals, identifiers, comments, dollar strings or function bodies', () => {
    for (const text of [
      `'${arrayCast.replaceAll("'", "''")}'`,
      `"${arrayCast}"`,
      `-- ${arrayCast}\n`,
      `/* ${arrayCast} */`,
      `$body$${arrayCast}$body$`,
    ]) {
      expect(canonicalDumpExpression(text)).toBe(text)
    }
    const fn = (body: string) => ({ kind: 'function', id: 'f()', definition: { definition: body } })
    expect(catalogDigest([fn(arrayCast)])).not.toBe(catalogDigest([fn(elementCasts)]))
    expect(canonicalDumpExpression('(ARRAY[NULL::character varying])::text[]')).toBe(
      '(ARRAY[NULL::character varying])::text[]',
    )
  })
  it('treats only the default owner-only table ACL as equivalent to NULL', () => {
    expect(catalogDigest([relation(null)])).toBe(
      catalogDigest([relation('{ue_v2_owner=arwdDxt/ue_v2_owner}')]),
    )
    for (const acl of [
      '{ue_v2_owner=r/ue_v2_owner}',
      '{ue_v2_owner=arwdDxt/ue_v2_owner,=r/ue_v2_owner}',
      '{ue_v2_owner=arwdDxt/ue_v2_owner,reader=r*/ue_v2_owner}',
    ]) {
      expect(catalogDigest([relation(null)])).not.toBe(catalogDigest([relation(acl)]))
    }
    expect(catalogDigest([relation(null)])).not.toBe(
      catalogDigest([
        { ...relation(null), definition: { ...relation(null).definition, force: false } },
      ]),
    )
  })
  it('sorts ACL entries including quoted names while preserving grantor and grant options', () => {
    const entries = ['"r,one"=U/owner', 'reader=U/owner']
    const object = (acl: string) => ({
      kind: 'schema',
      id: 'user_management',
      definition: { owner: 'owner', acl },
    })
    expect(canonicalCatalogObject(object(pgAcl(entries)))).toEqual(
      canonicalCatalogObject(object(pgAcl([...entries].reverse()))),
    )
    expect(catalogDigest([object(pgAcl(entries))])).not.toBe(
      catalogDigest([object(pgAcl(['"r,one"=U/owner', 'reader=U*/owner']))]),
    )
    expect(catalogDigest([object(pgAcl(entries))])).not.toBe(
      catalogDigest([object(pgAcl(['"r,one"=U/owner', 'reader=U/other']))]),
    )
  })
  it('keeps physical object types and role escalation significant', () => {
    const role = {
      kind: 'role',
      id: 'union_eyes_runtime',
      definition: { superuser: false, bypassrls: false },
    }
    expect(catalogDigest([role])).not.toBe(
      catalogDigest([{ ...role, definition: { ...role.definition, bypassrls: true } }]),
    )
    const column = { kind: 'column', id: 'public.fixture.id', definition: { type: 'uuid' } }
    expect(catalogDigest([column])).not.toBe(
      catalogDigest([{ ...column, definition: { type: 'text' } }]),
    )
  })
})
