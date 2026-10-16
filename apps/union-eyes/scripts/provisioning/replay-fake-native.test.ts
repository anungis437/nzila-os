import { describe, expect, it } from 'vitest'
import { fakeNativeBuiltin, fakeNativeEquality, fakeNativeOverloads } from './replay-fake-native'
describe('closed independent fake native catalog;not runtime PostgreSQL attestation', () => {
  it('binds native text/UUID input-output identities and signatures', () => {
    expect(fakeNativeBuiltin('uuid_in(cstring)', true)).toMatchObject({
      oid: '2952',
      schema: 'pg_catalog',
      body: 'uuid_in',
      argument_oids: '2275',
      result: 'uuid',
      visible: true,
    })
    expect(fakeNativeBuiltin('uuid_out(uuid)', true)).toMatchObject({
      oid: '2953',
      schema: 'pg_catalog',
      body: 'uuid_out',
      argument_oids: '2950',
      result: 'cstring',
    })
    expect(fakeNativeBuiltin('textin(cstring)', true)).toMatchObject({
      oid: '46',
      body: 'textin',
      result: 'text',
    })
  })
  it('preserves native visibility denial rather than assigning all names to pg_catalog', () => {
    expect(fakeNativeBuiltin('current_setting(text,boolean)', false)).toMatchObject({
      visible: false,
      argument_oids: '25 16',
      body: 'show_config_by_name_missing_ok',
    })
    expect(fakeNativeBuiltin('unknown_function(text)', true)).toBeNull()
    expect(fakeNativeOverloads('unknown_function')).toEqual([])
    expect(fakeNativeEquality('unknown_type', true)).toBeNull()
  })
  it('does not guess unlisted native overloads or argument casts', () => {
    expect(fakeNativeBuiltin('current_setting(uuid,boolean)', true)).toBeNull()
    expect(fakeNativeBuiltin('uuid_in(text)', true)).toBeNull()
    expect(fakeNativeOverloads('current_setting')).toEqual([
      {
        oid: '3294',
        schema: 'pg_catalog',
        name: 'current_setting',
        argument_oids: '25 16',
        variadic: '0',
      },
    ])
  })
  it('returns independent rows without allowing a caller to corrupt shared native definitions', () => {
    const row = fakeNativeBuiltin('uuid_in(cstring)', true)!
    row.body = 'corrupted'
    expect(fakeNativeBuiltin('uuid_in(cstring)', true)?.body).toBe('uuid_in')
    const equality = fakeNativeEquality('2950', true)!
    equality.function_oid = 'corrupted'
    expect(fakeNativeEquality('2950', true)?.function_oid).toBe('2956')
  })
})
