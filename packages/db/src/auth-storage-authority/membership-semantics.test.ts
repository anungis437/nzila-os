import { describe, expect, it } from 'vitest'
import {
  canonicalPostgresMajor,
  compileCanonicalMembershipGrant,
  membershipCatalogProjectionSql,
} from './membership-semantics'

describe('canonical native membership semantics', () => {
  it.each([150020, '150020', 160016, '160016'])(
    'reads the actual supported server version %s',
    (version) => {
      expect(canonicalPostgresMajor(version)).toBe(Number(String(version).slice(0, 2)))
    },
  )
  it.each([undefined, null, '', '16', '160016x', 16.5, 140020, 170001, Infinity])(
    'rejects absent or unsupported server version %s',
    (version) => {
      expect(() => canonicalPostgresMajor(version)).toThrow()
    },
  )
  it('keeps PG16 native edge facts and derives PG15 facts from its actual role semantics', () => {
    expect(membershipCatalogProjectionSql()).toEqual({
      adminOption: 'm.admin_option',
      inheritOption: 'm.inherit_option',
      setOption: 'm.set_option',
    })
    expect(membershipCatalogProjectionSql(15)).toEqual({
      adminOption: 'm.admin_option',
      inheritOption: 'member.rolinherit',
      setOption:
        "CASE WHEN current_setting('server_version_num')::integer BETWEEN 150000 AND 159999 THEN true ELSE NULL END",
    })
    expect(() => membershipCatalogProjectionSql(15, { memberAlias: 'member;drop' })).toThrow()
  })
  it('requires explicit representability and never changes role flags to simulate an edge', () => {
    for (const options of [
      { inherit: false, set: false, memberRoleInherit: false },
      { inherit: false, set: true, memberRoleInherit: true },
      { inherit: true, set: true },
    ])
      expect(() => compileCanonicalMembershipGrant('gateway', ['reader'], options, 15)).toThrow(
        'NOT_REPRESENTABLE',
      )
    const sql = compileCanonicalMembershipGrant(
      'gateway',
      ['reader'],
      { inherit: false, set: true, memberRoleInherit: false },
      15,
    )
    expect(sql).toContain('REVOKE ADMIN OPTION')
    expect(sql).toContain('RESTRICT')
    expect(sql).not.toMatch(/ALTER ROLE|CASCADE|WITH ADMIN OPTION/)
  })
  it('retains explicit independent edge options on PG16 and rejects malformed role inputs', () => {
    expect(
      compileCanonicalMembershipGrant('gateway', ['reader'], {
        inherit: false,
        set: true,
        memberRoleInherit: true,
      }),
    ).toBe('GRANT "reader" TO "gateway" WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;')
    expect(() =>
      compileCanonicalMembershipGrant(
        'gateway',
        ['reader', 'reader'],
        { inherit: false, set: true },
        16,
      ),
    ).toThrow()
    expect(() =>
      compileCanonicalMembershipGrant(
        'gateway',
        ['reader;grant'],
        { inherit: false, set: true },
        16,
      ),
    ).toThrow()
  })
})
