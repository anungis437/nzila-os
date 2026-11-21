import { nativePostgres16Image } from './native-postgres-image'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { connectLocalV2, createCurrentState } from './installer'
import { compileMinimumRoleProvisioningSql } from './minimum-installer'
import { qualifyNativePrivileges } from './manifest-security'
import type { V2Plan } from './source'

/** The same restricted fixture login grants are exercised by the SQL-engine regression. */
export function nativeFixtureLoginSql(password: string, auth = false) {
  assert.match(password, /^[a-f0-9]{48}$/, 'Owned fixture password must be random 24-byte hex')
  return [
    ['ue_v2_mutation_runtime', 'union_eyes_runtime'],
    ['ue_v2_mutation_system', 'union_eyes_system'],
    ...(auth
      ? [
          ['ue_v2_mutation_auth', 'nzila_auth_gateway'],
          ['ue_v2_mutation_auth_system', 'nzila_auth_system_gateway'],
        ]
      : []),
  ]
    .map(
      ([user, role]) =>
        `CREATE ROLE ${user} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'; GRANT ${role} TO ${user};`,
    )
    .join('\n')
}

export async function openNativeRuntimeFixture(plan: V2Plan, options: { auth?: boolean } = {}) {
  const password = randomBytes(24).toString('hex')
  const ownership = randomUUID()
  const name = `ue-v2-system-${ownership}`
  const opened: pg.Client[] = []
  let systemSql: ReturnType<typeof postgres> | undefined
  let container: string | undefined
  const dispose = async () => {
    try {
      const results = await Promise.allSettled([
        ...opened.map((client) => client.end()),
        ...(systemSql ? [systemSql.end({ timeout: 5 })] : []),
      ])
      const failure = results.find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    } finally {
      if (container) {
        const inspection = JSON.parse(
          execFileSync('docker', ['inspect', container], { encoding: 'utf8' }),
        ) as { Id: string; Name: string; Config: { Labels: Record<string, string> } }[]
        assert.equal(inspection[0].Id, container)
        assert.equal(inspection[0].Name, `/${name}`)
        assert.equal(inspection[0].Config.Labels['nzila.mission'], 'UE_BOOTSTRAP_V2_RUNTIME')
        assert.equal(inspection[0].Config.Labels['nzila.qualification-owner'], ownership)
        execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' })
        container = undefined
      }
    }
  }
  try {
    container = execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        name,
        '--label',
        'nzila.mission=UE_BOOTSTRAP_V2_RUNTIME',
        '--label',
        `nzila.qualification-owner=${ownership}`,
        '--memory',
        '1g',
        '--cpus',
        '2',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,size=768m',
        '-p',
        '127.0.0.1::5432',
        '-e',
        `POSTGRES_PASSWORD=${password}`,
        nativePostgres16Image(),
      ],
      { encoding: 'utf8' },
    ).trim()
    const port = Number(
      execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' })
        .trim()
        .split(':')
        .at(-1),
    )
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync(
          'docker',
          ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
          { stdio: 'pipe' },
        )
        break
      } catch (error: unknown) {
        if (attempt >= 60) throw error
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    const config = { host: '127.0.0.1', port, password }
    const connect = async (user: string, database: string) => {
      const client = await connectLocalV2({ ...config, user, database })
      opened.push(client)
      return client
    }
    const admin = new pg.Client({ ...config, user: 'postgres', database: 'postgres' })
    opened.push(admin)
    await admin.connect()
    await admin.query(compileMinimumRoleProvisioningSql())
    await admin.query('CREATE DATABASE ue_v2_clean_system_mutations OWNER ue_v2_owner')
    const seed = await connect('postgres', 'ue_v2_clean_system_mutations')
    await seed.query('BEGIN')
    await createCurrentState(seed, plan)
    await seed.query('COMMIT')
    assert.deepEqual((await qualifyNativePrivileges(seed, plan)).mismatches, [])
    await admin.query(nativeFixtureLoginSql(password, options.auth))
    const runtime = await connect('ue_v2_mutation_runtime', 'ue_v2_clean_system_mutations')
    const system = await connect('ue_v2_mutation_system', 'ue_v2_clean_system_mutations')
    systemSql = postgres({
      ...config,
      username: 'ue_v2_mutation_system',
      database: 'ue_v2_clean_system_mutations',
      max: 1,
      connect_timeout: 10,
      idle_timeout: 5,
    })
    const systemWriter = drizzle(systemSql)
    await systemWriter.execute('SELECT 1')
    const url = (username: string) =>
      `postgresql://${username}:${password}@127.0.0.1:${port}/ue_v2_clean_system_mutations`
    return {
      seed,
      runtime,
      system,
      systemWriter,
      dispose,
      runtimeUrl: url('ue_v2_mutation_runtime'),
      systemUrl: url('ue_v2_mutation_system'),
      authUrl: options.auth ? url('ue_v2_mutation_auth') : undefined,
      authSystemUrl: options.auth ? url('ue_v2_mutation_auth_system') : undefined,
    }
  } catch (error: unknown) {
    await dispose()
    throw error
  }
}
