/**
 * Raw Date parameters over drizzle's postgres.js driver (UE-CONV-H-011): the helper, and that every production client uses it.
 *
 * What it guards is in db/driver-dates.ts. The native proof against a real server is db/__tests__/driver-raw-dates.postgres.test.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { serializeRawDates } from '../driver-dates'

const APP = join(__dirname, '..', '..')

/** What drizzle's postgres-js driver leaves in place for the temporal types: an identity function (its column mappers have already encoded the value). */
const drizzleLikeClient = () => {
  const identity = (value: unknown) => value
  const serializers: Record<string, (value: unknown) => unknown> = { '1184': identity, '1114': identity, '1082': identity, '16': (value) => (value ? 't' : 'f') }
  return { options: { serializers }, identity }
}

describe('serializeRawDates', () => {
  it('sends a Date as its ISO instant for timestamptz, timestamp and date, as drizzle\'s own column mappers do', () => {
    const client = serializeRawDates(drizzleLikeClient() as never) as unknown as ReturnType<typeof drizzleLikeClient>
    const instant = new Date('2026-11-02T18:44:12.531Z')
    for (const oid of ['1184', '1114', '1082']) expect(client.options.serializers[oid](instant), oid).toBe('2026-11-02T18:44:12.531Z')
  })

  it('leaves what drizzle already encoded, nulls and other types as they were', () => {
    const client = serializeRawDates(drizzleLikeClient() as never) as unknown as ReturnType<typeof drizzleLikeClient>
    for (const oid of ['1184', '1114', '1082']) {
      expect(client.options.serializers[oid]('2026-11-02T18:44:12.531Z'), oid).toBe('2026-11-02T18:44:12.531Z')
      expect(client.options.serializers[oid](null), oid).toBeNull()
    }
    expect(client.options.serializers['16'](true)).toBe('t')
    expect(Object.keys(client.options.serializers).sort()).toEqual(['1082', '1114', '1184', '16'])
  })

  it('keeps the serializer it replaces for everything that is not a Date, and is safe to call twice', () => {
    const original = (value: unknown) => `original:${String(value)}`
    const client = { options: { serializers: { '1184': original, '1114': original, '1082': original } as Record<string, (value: unknown) => unknown> } }
    serializeRawDates(client as never)
    const once = client.options.serializers['1184']
    serializeRawDates(client as never)
    expect(client.options.serializers['1184']).toBe(once)
    expect(once('x')).toBe('original:x')
    expect(once(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z')
  })

  it('works on a client whose type has no serializer yet', () => {
    const client = { options: { serializers: {} as Record<string, (value: unknown) => unknown> } }
    serializeRawDates(client as never)
    expect(client.options.serializers['1184'](new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z')
    expect(client.options.serializers['1184']('already text')).toBe('already text')
  })
})

describe('every production drizzle client over postgres.js', () => {
  // drizzle installs its serializers when it is constructed, so the helper must come after it. A factory that forgets it leaves every raw Date parameter of that
  // client to crash the driver.
  const factories: Array<[file: string, construction: RegExp]> = [
    ['db/db.ts', /drizzle\(getClient\(\)/],
    ['db/system-db.ts', /drizzle\(getSystemClient\(\)/],
    ['lib/database/multi-db-client.ts', /drizzlePg\(client/],
    ['db/test-db.ts', /drizzle\(testClient/],
  ]
  for (const [file, construction] of factories) {
    it(`${file} applies serializeRawDates after constructing drizzle`, () => {
      const source = readFileSync(join(APP, file), 'utf8')
      const built = source.search(construction)
      const applied = source.indexOf('serializeRawDates(', built)
      expect(built, `${file} no longer constructs drizzle the way this test expects`).toBeGreaterThanOrEqual(0)
      expect(applied, `${file} must call serializeRawDates(client) after drizzle()`).toBeGreaterThan(built)
    })
  }

  it('is the whole set: no other application module constructs a drizzle postgres.js client', () => {
    const roots = ['db', 'lib', 'app', 'actions', 'components', 'services']
    const known = new Set(factories.map(([file]) => file))
    const found: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '__tests__' || entry === '.next') continue
        const path = join(dir, entry)
        const stat = statSync(path)
        if (stat.isDirectory()) {
          // the financial service is a separate package with its own client and schema
          if (relative(APP, path).replace(/\\/g, '/') === 'services/financial-service') continue
          walk(path)
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
          const source = readFileSync(path, 'utf8')
          if (source.includes("drizzle-orm/postgres-js") && /\bdrizzle(Pg)?\(/.test(source)) found.push(relative(APP, path).replace(/\\/g, '/'))
        }
      }
    }
    for (const root of roots) walk(join(APP, root))
    expect(found.filter((file) => !known.has(file)), 'a new drizzle postgres.js client must call serializeRawDates(client) after drizzle(), and be added to the list above').toEqual([])
  })
})
