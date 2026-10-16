import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import {
  runNextHttpSmoke,
  seedNextHttpSmoke,
  type HttpObservation,
} from '../bootstrap-v2/next-http-smoke'

/**
 * Limited staging proof (not the engineering campaign): seeds synthetic actors through the operator
 * connection, then runs the 33-step representative HTTP smoke against the deployed staging app.
 */
async function main() {
  const out = process.argv[2]
  const base = process.argv[3]
  const secrets = path.join(process.env.TEMP!, 'ue-v2-staging-secrets')
  const read = (name: string) => readFileSync(path.join(secrets, name), 'utf8').trim()
  process.env.UE_V2_SMOKE_CRON_SECRET = read('cron.txt')
  const seed = new pg.Client({
    host: 'nzila-ue-v2-staging-db.postgres.database.azure.com',
    user: 'uev2admin',
    password: read('pgadmin.txt'),
    database: 'ue_v2_staging',
    ssl: { rejectUnauthorized: false },
  })
  await seed.connect()
  const observations: HttpObservation[] = []
  try {
    const fixture = await seedNextHttpSmoke(seed, read('mfakey.txt'))
    writeFileSync(
      path.join(out, 'staging-fixture-ids.json'),
      JSON.stringify(
        {
          organizations: fixture.organizations,
          actor: fixture.actor,
          administrator: fixture.administrator,
        },
        null,
        2,
      ),
    )
    const result = await runNextHttpSmoke(base, seed, fixture, observations)
    writeFileSync(
      path.join(out, 'staging-http-observations.json'),
      JSON.stringify({ result, observations }, null, 2),
    )
    process.stdout.write(
      JSON.stringify({ result: result.status, observations: observations.length }) + '\n',
    )
  } catch (error) {
    writeFileSync(
      path.join(out, 'staging-http-observations.json'),
      JSON.stringify({ error: String(error), observations }, null, 2),
    )
    throw error
  } finally {
    await seed.end()
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 1500))
  process.exitCode = 1
})
