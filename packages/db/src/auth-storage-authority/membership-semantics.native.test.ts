import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import {
  canonicalPostgresMajor,
  compileCanonicalMembershipGrant,
  membershipCatalogProjectionSql,
} from './membership-semantics'
import { compileRolePrerequisiteAssertions } from './role-prerequisites'

/** Real restricted LOGINs on separately owned loopback-only native clusters. */
describe.skipIf(process.env.UE_V2_NATIVE_MANIFEST !== '1')(
  'native canonical membership equivalence',
  () => {
    it.each([15, 16] as const)(
      'preserves inheritance, SET, ADMIN denial and ownership transfer on PostgreSQL %s',
      async (major) => {
        const ownership = randomUUID(),
          name = `ue-membership-${ownership}`,
          password = randomUUID()
        const image =
          major === 15
            ? 'postgres:15'
            : 'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
        // The retained PG15 fixture is ARM64; the qualified PG16 image is AMD64.
        // Explicit selection avoids DOCKER_DEFAULT_PLATFORM hiding a cached image.
        const platform = major === 15 ? 'linux/arm64' : 'linux/amd64'
        const docker = (args: string[]) =>
          execFileSync('docker', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          }).trim()
        const imageFacts = JSON.parse(
          docker([
            'image',
            'inspect',
            '--platform',
            platform,
            image,
          ]),
        )[0]
        assert.equal(imageFacts.Os, 'linux')
        assert.equal(`linux/${imageFacts.Architecture}`, platform)
        const container = execFileSync(
          'docker',
          [
            'run',
            '-d',
            '--pull',
            'never',
            '--platform',
            platform,
            '--name',
            name,
            '--label',
            'nzila.mission=UE_MEMBERSHIP_NATIVE',
            '--label',
            `nzila.qualification-owner=${ownership}`,
            '--memory',
            '512m',
            '--cpus',
            '1',
            '--tmpfs',
            '/var/lib/postgresql/data:rw,size=256m',
            '-p',
            '127.0.0.1::5432',
            '-e',
            'POSTGRES_PASSWORD',
            image,
          ],
          {
            encoding: 'utf8',
            env: { ...process.env, POSTGRES_PASSWORD: password },
          },
        ).trim()
        const clients: pg.Client[] = [],
          failures: string[] = []
        try {
          for (let attempt = 0; ; attempt++) {
            try {
              docker(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])
              break
            } catch (error) {
              if (attempt >= 80) throw error
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }
          const port = Number(docker(['port', container, '5432/tcp']).split(':').at(-1))
          const connect = async (user: string) => {
            const client = new pg.Client({
              host: '127.0.0.1',
              port,
              user,
              password,
              database: 'postgres',
            })
            client.on('error', (error) =>
              failures.push(error.message.replaceAll(password, '[REDACTED]')),
            )
            clients.push(client)
            await client.connect()
            return client
          }
          const admin = await connect('postgres')
          const version = (
            await admin.query("SELECT current_setting('server_version_num') AS version")
          ).rows[0].version
          expect(canonicalPostgresMajor(version)).toBe(major)
          console.info(
            JSON.stringify({
              proof: 'NATIVE_MEMBERSHIP_ROLE_SEMANTICS',
              major,
              serverVersionNum: version,
              platform,
              imageId: imageFacts.Id,
              repoDigests: imageFacts.RepoDigests,
            }),
          )
          await admin.query(`CREATE ROLE proof_owner NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        CREATE ROLE proof_gateway NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        CREATE ROLE proof_phase NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        CREATE ROLE proof_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        CREATE ROLE proof_app NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        CREATE ROLE proof_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        CREATE ROLE proof_install LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';
        CREATE SCHEMA proof AUTHORIZATION proof_owner;
        REVOKE ALL ON SCHEMA proof FROM PUBLIC;
        CREATE TABLE proof.rows(id integer PRIMARY KEY); INSERT INTO proof.rows VALUES(1);
        GRANT USAGE ON SCHEMA proof TO proof_phase,proof_reader;
        GRANT SELECT ON proof.rows TO proof_phase,proof_reader;`)
          const grant = (member: string, targets: string[], inherit = false) =>
            compileCanonicalMembershipGrant(
              member,
              targets,
              { inherit, set: true, memberRoleInherit: inherit },
              major,
            )
          await admin.query(
            grant('proof_gateway', ['proof_phase']) +
              grant('proof_owner', ['proof_reader'], true) +
              grant('proof_login', ['proof_gateway']) +
              grant('proof_install', ['proof_owner']),
          )
          const prerequisites = compileRolePrerequisiteAssertions(
            ['proof_gateway', 'proof_phase', 'proof_reader'],
            { proof_gateway: ['proof_phase'] },
            { postgresMajor: major },
          )
          await admin.query(prerequisites)
          if (major === 16)
            await expect(
              admin.query(
                compileRolePrerequisiteAssertions(
                  ['proof_gateway', 'proof_phase', 'proof_reader'],
                  { proof_gateway: ['proof_phase'] },
                  { postgresMajor: 15 },
                ),
              ),
            ).rejects.toThrow('SEMANTICS_VERSION_MISMATCH')
          const projection = membershipCatalogProjectionSql(major)
          const membershipQuery = `SELECT member.rolname AS member,target.rolname AS target,${projection.adminOption} AS admin,${projection.inheritOption} AS inherit,${projection.setOption} AS set
        FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles target ON target.oid=m.roleid ORDER BY member.rolname,target.rolname`
          const edges = (await admin.query(membershipQuery)).rows
          expect(edges.filter((row) => row.member.startsWith('proof_'))).toEqual([
            {
              member: 'proof_gateway',
              target: 'proof_phase',
              admin: false,
              inherit: false,
              set: true,
            },
            {
              member: 'proof_install',
              target: 'proof_owner',
              admin: false,
              inherit: false,
              set: true,
            },
            {
              member: 'proof_login',
              target: 'proof_gateway',
              admin: false,
              inherit: false,
              set: true,
            },
            {
              member: 'proof_owner',
              target: 'proof_reader',
              admin: false,
              inherit: true,
              set: true,
            },
          ])
          const actor = await connect('proof_login')
          await expect(actor.query('SELECT * FROM proof.rows')).rejects.toMatchObject({
            code: '42501',
          })
          await actor.query('SET ROLE proof_gateway')
          await expect(actor.query('SELECT * FROM proof.rows')).rejects.toMatchObject({
            code: '42501',
          })
          await actor.query('SET ROLE proof_phase')
          expect((await actor.query('SELECT * FROM proof.rows')).rows).toEqual([{ id: 1 }])
          await expect(actor.query('GRANT proof_phase TO proof_app')).rejects.toMatchObject({
            code: '42501',
          })
          await expect(actor.query('SET ROLE proof_owner')).rejects.toMatchObject({ code: '42501' })
          await actor.query('RESET ROLE')
          await expect(actor.query('SELECT * FROM proof.rows')).rejects.toMatchObject({
            code: '42501',
          })
          await admin.query('GRANT proof_phase TO proof_gateway WITH ADMIN OPTION')
          await expect(admin.query(prerequisites)).rejects.toThrow('MEMBERSHIP_DRIFT')
          await admin.query(grant('proof_gateway', ['proof_phase']))
          await admin.query(prerequisites)
          await admin.query(grant('proof_gateway', ['proof_reader']))
          await expect(admin.query(prerequisites)).rejects.toThrow('MEMBERSHIP_DRIFT')
          await admin.query('REVOKE proof_reader FROM proof_gateway')
          await admin.query('ALTER ROLE proof_gateway INHERIT')
          await expect(admin.query(prerequisites)).rejects.toThrow('ROLE_UNSAFE')
          await admin.query('ALTER ROLE proof_gateway NOINHERIT')
          await admin.query(prerequisites)
          const installer = await connect('proof_install')
          await installer.query('BEGIN; SET LOCAL ROLE proof_owner')
          expect((await installer.query('SELECT * FROM proof.rows')).rows).toEqual([{ id: 1 }])
          await installer.query(`GRANT CREATE ON SCHEMA proof TO proof_reader;
        CREATE FUNCTION proof.owned() RETURNS integer LANGUAGE sql AS 'SELECT 1';
        ALTER FUNCTION proof.owned() OWNER TO proof_reader;
        REVOKE CREATE ON SCHEMA proof FROM proof_reader; COMMIT;`)
          expect(
            (
              await admin.query(
                "SELECT has_schema_privilege('proof_reader','proof','CREATE') AS allowed",
              )
            ).rows[0].allowed,
          ).toBe(false)
          await expect(installer.query('SELECT * FROM proof.rows')).rejects.toMatchObject({
            code: '42501',
          })
          expect(failures).toEqual([])
        } finally {
          await Promise.allSettled(clients.map((client) => client.end()))
          const record = JSON.parse(docker(['inspect', container]))[0]
          assert.equal(record.Id, container)
          assert.equal(record.Name, `/${name}`)
          assert.equal(record.Config.Labels['nzila.mission'], 'UE_MEMBERSHIP_NATIVE')
          assert.equal(record.Config.Labels['nzila.qualification-owner'], ownership)
          docker(['rm', '-f', container])
          assert.equal(
            record.State.OOMKilled,
            false,
            'Native role fixture exceeded its resource limit',
          )
        }
      },
      60000,
    )
  },
)
