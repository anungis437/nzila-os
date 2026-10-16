import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { catalogDigest, inspectCatalog, type CatalogObject } from '../bootstrap-v2/installer'

/** Compares the Azure staging catalog with the qualified expected catalog, per object kind. */
async function main() {
  const dir = process.argv[2]
  // Connection comes from PGHOST/PGUSER/PGDATABASE/PGPASSWORD; the staging defaults and the staging
  // password file remain the fallback so the staging procedure is unchanged.
  const password =
    process.env.PGPASSWORD ??
    readFileSync(path.join(process.env.TEMP!, 'ue-v2-staging-secrets', 'pgadmin.txt'), 'utf8')
  const client = new pg.Client({
    host: process.env.PGHOST ?? 'nzila-ue-v2-staging-db.postgres.database.azure.com',
    user: process.env.PGUSER ?? 'uev2admin',
    password,
    database: process.env.PGDATABASE ?? 'ue_v2_staging',
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const actual = await inspectCatalog(client)
  const expected = JSON.parse(
    readFileSync(path.join(dir, 'expected-catalog.json'), 'utf8'),
  ) as CatalogObject[]
  await client.end()
  writeFileSync(path.join(dir, 'actual-catalog.json'), JSON.stringify(actual))
  const key = (o: CatalogObject) => `${o.kind}:${o.id}`
  const em = new Map(expected.map((o) => [key(o), JSON.stringify(o.definition)]))
  const am = new Map(actual.map((o) => [key(o), JSON.stringify(o.definition)]))
  const kinds = new Map<
    string,
    { exp: number; act: number; missing: number; extra: number; diff: number }
  >()
  const bump = (k: string, f: 'exp' | 'act' | 'missing' | 'extra' | 'diff') => {
    const e = kinds.get(k) ?? { exp: 0, act: 0, missing: 0, extra: 0, diff: 0 }
    e[f]++
    kinds.set(k, e)
  }
  const diffs: string[] = []
  for (const [k, v] of em) {
    const kind = k.split(':')[0]
    bump(kind, 'exp')
    if (!am.has(k)) {
      bump(kind, 'missing')
      diffs.push(`MISSING ${k}`)
    } else if (am.get(k) !== v) {
      bump(kind, 'diff')
      diffs.push(`DIFF ${k}\n   exp ${v.slice(0, 260)}\n   act ${am.get(k)!.slice(0, 260)}`)
    }
  }
  for (const k of am.keys()) {
    const kind = k.split(':')[0]
    bump(kind, 'act')
    if (!em.has(k)) {
      bump(kind, 'extra')
      diffs.push(`EXTRA ${k}`)
    }
  }
  process.stdout.write(
    JSON.stringify(
      {
        expectedDigest: catalogDigest(expected),
        actualDigest: catalogDigest(actual),
        exactMatch: catalogDigest(expected) === catalogDigest(actual),
        kinds: Object.fromEntries(kinds),
      },
      null,
      1,
    ) + '\n',
  )
  process.stdout.write(
    diffs.slice(0, Number(process.argv[3] ?? 40)).join('\n') +
      `\n(total differences ${diffs.length})\n`,
  )
  assert(true)
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
