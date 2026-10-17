import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type pg from 'pg'
import { quote, type CurrentModel, type V2Plan } from './source'
import {
  FRAMEWORK_ROLES,
  FRAMEWORK_WORKER_TABLES,
  DEDICATED_ADMIN_MODEL_OWNERS,
  PLATFORM_METADATA_MODEL_OWNERS,
} from './framework-contract'
import { inspectFrameworkPrivileges } from './framework-privileges'

export interface FrameworkProofClients {
  owner: pg.Client
  ordinary: pg.Client
  legacySystem: pg.Client
  request: pg.Client
  worker: pg.Client
}
const fixture = {
  member: 'ue-framework-member',
  orgAdmin: 'ue-framework-org-admin',
  platformAdmin: 'ue-framework-platform-admin',
  organization: '55555555-5555-4555-8555-555555555555',
}
const token = (actor: string) => `synthetic-${actor}-bearer-only`
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const username = (actor: string) => `uev2_${hash(actor)}`
const relation = (table: string) => `public.${quote(table)}`

function modelValue(column: CurrentModel['columns'][number], table: string): unknown {
  if (column.defaultKind === 'SCALAR' && column.clientDefault !== null)
    return column.type === 'jsonb' || column.type === 'json'
      ? JSON.stringify(column.clientDefault)
      : column.clientDefault
  if (!column.notNull) return null
  if (column.choices.length) return column.choices[0]
  if (column.name === 'timezone') return 'UTC'
  if (column.type === 'boolean') return false
  if (column.type === 'uuid') {
    const digest = hash(`${table}:${column.name}:framework-metadata`)
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
  }
  if (/^(smallint|integer|bigint|numeric|real|double precision)/.test(column.type)) return 1
  if (column.type.startsWith('timestamp')) return '2026-10-13T00:00:00Z'
  if (column.type === 'date') return '2026-10-13'
  if (column.type === 'jsonb' || column.type === 'json') return '{}'
  if (column.type.endsWith('[]')) return []
  if (column.type.startsWith('varchar') || column.type === 'text')
    return `framework-${hash(`${table}:${column.name}`).slice(0, 12)}`
  throw new Error(`UE_FRAMEWORK_PROOF_VALUE_REQUIRED:${table}:${column.name}:${column.type}`)
}

export async function proveFrameworkBoundary(
  clients: FrameworkProofClients,
  plan: V2Plan,
  invokeApplication?: () => {
    result: 'PASS'
    cases: string[]
    currentSettings: string
    externalDatabaseConnections: number
    sourceDigests: Record<string, string>
  },
) {
  const { owner, ordinary, legacySystem, request, worker } = clients
  const failures: { path: string; error: string }[] = []
  const passed: string[] = []
  const tableReports: { table: string; status: 'PASS' | 'FAIL'; cases: string[] }[] = []
  const check = async (path: string, operation: () => Promise<void>) => {
    try {
      await operation()
      passed.push(path)
    } catch (error: unknown) {
      failures.push({ path, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const scoped = async <T>(
    client: pg.Client,
    role: string,
    actor: string | null,
    operation: () => Promise<T>,
    bearer?: string,
  ) => {
    await client.query('BEGIN')
    let primary: unknown
    let failed = false
    try {
      await client.query(`SET LOCAL ROLE ${quote(role)}`)
      await client.query(
        "SELECT set_config('app.current_user_id',$1,true),set_config('app.current_org_id',$2,true),set_config('app.current_session_token',$3,true),set_config('app.is_platform_admin','true',true)",
        [actor ?? '', actor ? fixture.organization : '', bearer ?? (actor ? token(actor) : '')],
      )
      return await operation()
    } catch (error: unknown) {
      primary = error
      failed = true
      throw error
    } finally {
      try {
        await client.query('ROLLBACK')
      } catch (cleanupError: unknown) {
        if (failed)
          throw new AggregateError(
            [primary, cleanupError],
            'UE_FRAMEWORK_SCOPE_AND_CLEANUP_FAILED',
            { cause: primary },
          )
        throw cleanupError
      }
    }
  }
  const identities = Object.values(fixture).filter((value) => value !== fixture.organization)
  const userIds = new Map<string, number>()
  const workerRows = new Map<string, unknown>()
  const group = 'ue-framework-proof-group'
  let contentTypeId: number | null = null
  let permissionId: number | null = null
  let seeded = false
  let application: ReturnType<NonNullable<typeof invokeApplication>> | null = null
  const counts = async () => {
    const result: Record<string, string> = {}
    for (const table of [
      ...Object.keys(DEDICATED_ADMIN_MODEL_OWNERS),
      ...(invokeApplication ? ['organizations', 'donations', 'audit_logs'] : []),
    ])
      result[table] = (
        await owner.query<{ count: string }>(`SELECT count(*) AS count FROM ${relation(table)}`)
      ).rows[0].count
    return result
  }
  const initialCounts = await counts()
  const applicationOrganizations = [fixture.organization, '66666666-6666-4666-8666-666666666666']
  try {
    await owner.query('BEGIN')
    try {
      if (invokeApplication)
        await owner.query(
          `INSERT INTO public.organizations
            (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
             member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
            SELECT id,'Synthetic framework organization','ue-framework-application-'||id::text,'local',ARRAY[]::text[],0,
                   ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now()
            FROM unnest($1::uuid[]) AS fixture(id)`,
          [applicationOrganizations],
        )
      for (const actor of identities) {
        await owner.query(
          'INSERT INTO user_management.users(user_id,email,is_system_admin) VALUES ($1,$2,$3)',
          [actor, `${actor}@example.invalid`, actor === fixture.platformAdmin],
        )
        await owner.query(
          'INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES ($1,$2,$3,true)',
          [actor, fixture.organization, actor === fixture.orgAdmin ? 'admin' : 'member'],
        )
        await owner.query(
          "INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,is_active,expires_at) VALUES ($1,$2,$3,$3,true,now()+interval '1 hour')",
          [actor, fixture.organization, hash(token(actor))],
        )
        const user = await owner.query<{ id: number }>(
          "INSERT INTO public.auth_user(password,is_superuser,username,first_name,last_name,email,is_staff,is_active,date_joined) VALUES ('!',false,$1,'Synthetic','Actor',$2,false,true,now()) RETURNING id",
          [username(actor), `${actor}@example.invalid`],
        )
        userIds.set(actor, user.rows[0].id)
      }
      await owner.query('INSERT INTO user_management.users(user_id,email) VALUES ($1,$2)', [
        'ue-framework-new-member',
        'ue-framework-new-member@example.invalid',
      ])
      await owner.query(
        "INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,is_active,expires_at) VALUES ($1,$2,$3,$3,true,now()+interval '1 hour')",
        ['ue-framework-new-member', fixture.organization, hash(token('ue-framework-new-member'))],
      )
      if (invokeApplication)
        await owner.query(
          "INSERT INTO public.platform_identity_bindings(provider,provider_subject,platform_user_id,state,verified_at,provisioned_by) VALUES ('entra','ue-framework-tenant:ue-framework-object',$1,'active',now(),'synthetic-framework-application')",
          [fixture.member],
        )
      const groups = await owner.query<{ id: number }>(
        'INSERT INTO public.auth_group(name) VALUES ($1) RETURNING id',
        [group],
      )
      for (const actor of identities)
        await owner.query('INSERT INTO public.auth_user_groups(user_id,group_id) VALUES ($1,$2)', [
          userIds.get(actor),
          groups.rows[0].id,
        ])
      contentTypeId = (
        await owner.query<{ id: number }>(
          "INSERT INTO public.django_content_type(app_label,model) VALUES ('ue_framework_proof','source_model') RETURNING id",
        )
      ).rows[0].id
      permissionId = (
        await owner.query<{ id: number }>(
          "INSERT INTO public.auth_permission(name,content_type_id,codename) VALUES ('Synthetic source view',$1,'view_source_model') RETURNING id",
          [contentTypeId],
        )
      ).rows[0].id
      await owner.query(
        'INSERT INTO public.auth_group_permissions(group_id,permission_id) VALUES ($1,$2)',
        [groups.rows[0].id, permissionId],
      )
      for (const actor of identities) {
        await owner.query(
          'INSERT INTO public.auth_user_user_permissions(user_id,permission_id) VALUES ($1,$2)',
          [userIds.get(actor), permissionId],
        )
        await owner.query(
          "INSERT INTO public.django_admin_log(action_time,user_id,content_type_id,object_id,object_repr,action_flag,change_message) VALUES (now(),$1,$2,'synthetic','Synthetic source model',1,'framework-proof')",
          [userIds.get(actor), contentTypeId],
        )
      }
      await owner.query(
        "INSERT INTO public.django_session(session_key,session_data,expire_date) VALUES ('ue-framework-proof-session','not-canonical-auth-authority',now()+interval '1 hour')",
      )
      for (const table of [
        ...FRAMEWORK_WORKER_TABLES,
        ...Object.keys(PLATFORM_METADATA_MODEL_OWNERS),
      ]) {
        const model = plan.currentModels.models.find((entry) => entry.table === table)
        assert(model, `UE_FRAMEWORK_PROOF_CURRENT_MODEL_REQUIRED:${table}`)
        const columns = model.columns.filter(
          (column) => !(column.primaryKey && /^(integer|bigint)/.test(column.type)),
        )
        const key = model.columns.find((column) => column.primaryKey)
        assert(key, `UE_FRAMEWORK_PROOF_PRIMARY_KEY_REQUIRED:${table}`)
        const row = await owner.query(
          `INSERT INTO ${relation(table)} (${columns.map((column) => quote(column.name)).join(',')})
           VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')}) RETURNING ${quote(key.name)}`,
          columns.map((column) => modelValue(column, table)),
        )
        workerRows.set(table, row.rows[0][key.name])
      }
      await owner.query('COMMIT')
      seeded = true
    } catch (error: unknown) {
      await owner.query('ROLLBACK')
      throw error
    }
    await check('independent-effective-framework-authority', async () => {
      const inspection = await inspectFrameworkPrivileges(owner)
      assert.deepEqual(inspection.failures, [])
    })
    for (const table of Object.keys(DEDICATED_ADMIN_MODEL_OWNERS)) {
      const cases: string[] = []
      const before = failures.length
      for (const [client, role] of [
        [ordinary, 'union_eyes_runtime'],
        [legacySystem, 'union_eyes_system'],
      ] as const)
        await check(`${table}:${role}:direct-read-denied`, async () => {
          await assert.rejects(
            scoped(client, role, fixture.platformAdmin, () =>
              client.query(`SELECT * FROM ${relation(table)}`),
            ),
            { code: '42501' },
          )
          cases.push(`${role}:DIRECT_READ_DENIED_EVEN_FOR_CANONICAL_ADMIN`)
        })
      await check(`${table}:member-admin-role-denied`, async () => {
        const result = await scoped(request, FRAMEWORK_ROLES.admin, fixture.member, () =>
          request.query(`SELECT * FROM ${relation(table)}`),
        )
        assert.equal(result.rowCount, 0)
        cases.push('FORGED_PLATFORM_ADMIN_GUC_DENIED')
      })
      await check(`${table}:org-admin-is-not-platform-admin`, async () => {
        const result = await scoped(request, FRAMEWORK_ROLES.admin, fixture.orgAdmin, () =>
          request.query(`SELECT * FROM ${relation(table)}`),
        )
        assert.equal(result.rowCount, 0)
        cases.push('ORG_ADMIN_GLOBAL_FRAMEWORK_AUTHORITY_DENIED')
      })
      await check(`${table}:canonical-platform-admin`, async () => {
        const result = await scoped(request, FRAMEWORK_ROLES.admin, fixture.platformAdmin, () =>
          request.query(`SELECT * FROM ${relation(table)}`),
        )
        assert(
          result.rowCount && result.rowCount > 0,
          `UE_FRAMEWORK_ADMIN_POSITIVE_READ_REQUIRED:${table}`,
        )
        cases.push('CANONICAL_PLATFORM_ADMIN_READ_ALLOWED')
      })
      await check(`${table}:missing-bearer`, async () => {
        const result = await scoped(
          request,
          FRAMEWORK_ROLES.admin,
          fixture.platformAdmin,
          () => request.query(`SELECT * FROM ${relation(table)}`),
          '',
        )
        assert.equal(result.rowCount, 0)
        cases.push('MISSING_BEARER_DENIED')
      })
      if (PLATFORM_METADATA_MODEL_OWNERS[table])
        await check(`${table}:private-platform-metadata-crud-and-peer-denial`, async () => {
          const model = plan.currentModels.models.find((entry) => entry.table === table)
          assert(model, `UE_PLATFORM_METADATA_CURRENT_MODEL_REQUIRED:${table}`)
          const columns = model.columns
          const key = columns.find((column) => column.primaryKey)
          assert(key, `UE_PLATFORM_METADATA_PRIMARY_KEY_REQUIRED:${table}`)
          const insert = () =>
            request.query(
              `INSERT INTO ${relation(table)} (${columns.map((column) => quote(column.name)).join(',')})
               VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`,
              columns.map((column) => modelValue(column, table)),
            )
          await scoped(request, FRAMEWORK_ROLES.admin, fixture.platformAdmin, async () => {
            assert.equal(
              (
                await request.query(`DELETE FROM ${relation(table)} WHERE ${quote(key.name)}=$1`, [
                  workerRows.get(table),
                ])
              ).rowCount,
              1,
            )
            const inserted = await insert()
            assert.equal(inserted.rowCount, 1)
            const id = inserted.rows[0][key.name]
            assert.equal(
              (
                await request.query(
                  `UPDATE ${relation(table)} SET updated_at=now() WHERE ${quote(key.name)}=$1`,
                  [id],
                )
              ).rowCount,
              1,
            )
            assert.equal(
              (
                await request.query(`DELETE FROM ${relation(table)} WHERE ${quote(key.name)}=$1`, [
                  id,
                ])
              ).rowCount,
              1,
            )
          })
          for (const actor of [fixture.member, fixture.orgAdmin])
            await assert.rejects(scoped(request, FRAMEWORK_ROLES.admin, actor, insert), {
              code: '42501',
            })
          for (const [client, role] of [
            [request, FRAMEWORK_ROLES.identity],
            [worker, FRAMEWORK_ROLES.worker],
          ] as const)
            await assert.rejects(
              scoped(client, role, fixture.platformAdmin, () =>
                client.query(`SELECT * FROM ${relation(table)}`),
              ),
              { code: '42501' },
            )
          cases.push('LIVE_PLATFORM_METADATA_CRUD_AND_MEMBER_ORG_ADMIN_IDENTITY_WORKER_DENIAL')
        })
      if (FRAMEWORK_WORKER_TABLES.includes(table))
        await check(`${table}:worker-real-source-insert-read-update-delete`, async () => {
          const model = plan.currentModels.models.find((entry) => entry.table === table)
          assert(model, `UE_FRAMEWORK_PROOF_CURRENT_MODEL_REQUIRED:${table}`)
          const columns = model.columns.filter(
            (column) => !(column.primaryKey && /^(integer|bigint)/.test(column.type)),
          )
          await scoped(worker, FRAMEWORK_ROLES.worker, null, async () => {
            const key = model.columns.find((column) => column.primaryKey)
            assert(key, `UE_FRAMEWORK_PROOF_PRIMARY_KEY_REQUIRED:${table}`)
            assert.equal(
              (
                await worker.query(`DELETE FROM ${relation(table)} WHERE ${quote(key.name)}=$1`, [
                  workerRows.get(table),
                ])
              ).rowCount,
              1,
            )
            const inserted = await worker.query(
              `INSERT INTO ${relation(table)} (${columns.map((column) => quote(column.name)).join(',')})
               VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`,
              columns.map((column) => modelValue(column, table)),
            )
            assert.equal(inserted.rowCount, 1)
            const row = inserted.rows[0]
            const selected = await worker.query(
              `SELECT * FROM ${relation(table)} WHERE ${quote(key.name)}=$1`,
              [row[key.name]],
            )
            assert.equal(selected.rowCount, 1)
            const writable = columns.find((column) => !column.primaryKey)
            assert(writable, `UE_FRAMEWORK_PROOF_WRITABLE_COLUMN_REQUIRED:${table}`)
            assert.equal(
              (
                await worker.query(
                  `UPDATE ${relation(table)} SET ${quote(writable.name)}=${quote(writable.name)} WHERE ${quote(key.name)}=$1`,
                  [row[key.name]],
                )
              ).rowCount,
              1,
            )
            assert.equal(
              (
                await worker.query(`DELETE FROM ${relation(table)} WHERE ${quote(key.name)}=$1`, [
                  row[key.name],
                ])
              ).rowCount,
              1,
            )
          })
          cases.push('DEDICATED_WORKER_CURRENT_MODEL_CRUD_ALLOWED_AND_ROLLED_BACK')
        })
      else
        await check(`${table}:worker-no-identity-or-admin-authority`, async () => {
          await assert.rejects(
            scoped(worker, FRAMEWORK_ROLES.worker, null, () =>
              worker.query(`SELECT * FROM ${relation(table)}`),
            ),
            { code: '42501' },
          )
          cases.push('WORKER_NON_CELERY_AUTHORITY_DENIED')
        })
      tableReports.push({ table, status: failures.length === before ? 'PASS' : 'FAIL', cases })
    }
    await check('identity-own-stock-user-and-group-memberships', async () => {
      await scoped(request, FRAMEWORK_ROLES.identity, fixture.member, async () => {
        const users = await request.query<{ username: string }>(
          'SELECT username FROM public.auth_user',
        )
        assert.deepEqual(users.rows, [{ username: username(fixture.member) }])
        const groups = await request.query<{ user_id: number }>(
          'SELECT user_id FROM public.auth_user_groups',
        )
        assert.deepEqual(groups.rows, [{ user_id: userIds.get(fixture.member) }])
        const permissions = await request.query<{ user_id: number }>(
          'SELECT user_id FROM public.auth_user_user_permissions',
        )
        assert.deepEqual(permissions.rows, [{ user_id: userIds.get(fixture.member) }])
      })
    })
    await check('identity-current-user-create-own-only', async () => {
      const actor = 'ue-framework-new-member'
      await scoped(request, FRAMEWORK_ROLES.identity, actor, async () => {
        const inserted = await request.query(
          "INSERT INTO public.auth_user(password,is_superuser,username,first_name,last_name,email,is_staff,is_active,date_joined) VALUES ('!',false,$1,'Synthetic','New','new@example.invalid',false,true,now()) RETURNING username",
          [username(actor)],
        )
        assert.deepEqual(inserted.rows, [{ username: username(actor) }])
      })
      await assert.rejects(
        scoped(request, FRAMEWORK_ROLES.identity, actor, () =>
          request.query(
            "INSERT INTO public.auth_user(password,is_superuser,username,first_name,last_name,email,is_staff,is_active,date_joined) VALUES ('!',false,'foreign-unbound-user','Synthetic','New','new@example.invalid',false,true,now())",
          ),
        ),
        { code: '42501' },
      )
    })
    for (const [path, mutation, restoration] of [
      [
        'expired-session',
        "UPDATE user_management.user_sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1",
        "UPDATE user_management.user_sessions SET created_at=now(),expires_at=now()+interval '1 hour' WHERE user_id=$1",
      ],
      [
        'inactive-session',
        'UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1',
        'UPDATE user_management.user_sessions SET is_active=true WHERE user_id=$1',
      ],
      [
        'inactive-user',
        'UPDATE user_management.users SET is_active=false WHERE user_id=$1',
        'UPDATE user_management.users SET is_active=true WHERE user_id=$1',
      ],
      [
        'suspended-user',
        "UPDATE user_management.users SET lifecycle_state='suspended' WHERE user_id=$1",
        "UPDATE user_management.users SET lifecycle_state='active' WHERE user_id=$1",
      ],
      [
        'revoked-platform-admin',
        'UPDATE user_management.users SET is_system_admin=false WHERE user_id=$1',
        'UPDATE user_management.users SET is_system_admin=true WHERE user_id=$1',
      ],
      [
        'foreign-session-organization',
        "UPDATE user_management.user_sessions SET organization_id='66666666-6666-4666-8666-666666666666' WHERE user_id=$1",
        'UPDATE user_management.user_sessions SET organization_id=$2 WHERE user_id=$1',
      ],
    ]) {
      await check(`${path}:live-admin-denied`, async () => {
        try {
          assert.equal((await owner.query(mutation, [fixture.platformAdmin])).rowCount, 1)
          assert.equal(
            (
              await scoped(request, FRAMEWORK_ROLES.admin, fixture.platformAdmin, () =>
                request.query('SELECT * FROM public.auth_user'),
              )
            ).rowCount,
            0,
          )
        } finally {
          assert.equal(
            (
              await owner.query(
                restoration,
                path === 'foreign-session-organization'
                  ? [fixture.platformAdmin, fixture.organization]
                  : [fixture.platformAdmin],
              )
            ).rowCount,
            1,
          )
        }
      })
    }
    await check('identity-profile-update-allowed-protected-columns-denied', async () => {
      assert.equal(
        (
          await scoped(request, FRAMEWORK_ROLES.identity, fixture.member, () =>
            request.query("UPDATE public.auth_user SET first_name='Updated' WHERE username=$1", [
              username(fixture.member),
            ]),
          )
        ).rowCount,
        1,
      )
      for (const column of ['password', 'is_superuser', 'username'])
        await assert.rejects(
          scoped(request, FRAMEWORK_ROLES.identity, fixture.member, () =>
            request.query(`UPDATE public.auth_user SET ${quote(column)}=${quote(column)}`),
          ),
          { code: '42501' },
        )
      await assert.rejects(
        scoped(request, FRAMEWORK_ROLES.identity, fixture.member, () =>
          request.query('UPDATE public.auth_user SET is_staff=true'),
        ),
        { code: '42501' },
      )
    })
    await check('identity-stored-hash-and-forged-actor-denied', async () => {
      for (const [actor, bearer] of [
        [fixture.member, hash(token(fixture.member))],
        [fixture.platformAdmin, token(fixture.member)],
      ])
        assert.equal(
          (
            await scoped(
              request,
              FRAMEWORK_ROLES.identity,
              actor,
              () => request.query('SELECT * FROM public.auth_user'),
              bearer,
            )
          ).rowCount,
          0,
        )
    })
    await check('platform-admin-current-framework-write', async () => {
      assert.equal(
        (
          await scoped(request, FRAMEWORK_ROLES.admin, fixture.platformAdmin, () =>
            request.query(
              "INSERT INTO public.auth_group(name) VALUES ('ue-framework-admin-created')",
            ),
          )
        ).rowCount,
        1,
      )
      await assert.rejects(
        scoped(request, FRAMEWORK_ROLES.admin, fixture.member, () =>
          request.query(
            "INSERT INTO public.auth_group(name) VALUES ('ue-framework-member-forged')",
          ),
        ),
        { code: '42501' },
      )
    })
    await check('ordinary-framework-role-escalation-denied', async () => {
      for (const role of Object.values(FRAMEWORK_ROLES))
        await assert.rejects(ordinary.query(`SET ROLE ${quote(role)}`), { code: '42501' })
    })
    await check('gateway-no-unscoped-framework-grants', async () => {
      await assert.rejects(
        scoped(request, FRAMEWORK_ROLES.gateway, fixture.platformAdmin, () =>
          request.query('SELECT * FROM public.auth_user'),
        ),
        { code: '42501' },
      )
    })
    await check('context-cleared-after-connection-reuse', async () => {
      const context = await request.query<{ actor: string | null; bearer: string | null }>(
        "SELECT nullif(current_setting('app.current_user_id',true),'') AS actor,nullif(current_setting('app.current_session_token',true),'') AS bearer",
      )
      assert.deepEqual(context.rows, [{ actor: null, bearer: null }])
    })
    if (invokeApplication)
      await check('actual-current-django-framework-consumers', async () => {
        for (const table of ['organization_users', 'user_sessions'])
          assert.equal(
            (
              await owner.query(
                `UPDATE user_management.${quote(table)} SET organization_id=$2 WHERE user_id=$1`,
                [fixture.orgAdmin, applicationOrganizations[1]],
              )
            ).rowCount,
            1,
          )
        application = invokeApplication()
        assert.equal(application.result, 'PASS')
        assert.equal(application.externalDatabaseConnections, 0)
      })
  } finally {
    if (seeded) {
      await owner.query('BEGIN')
      try {
        for (const table of [
          ...FRAMEWORK_WORKER_TABLES,
          ...Object.keys(PLATFORM_METADATA_MODEL_OWNERS),
        ].reverse()) {
          const key = plan.currentModels.models
            .find((entry) => entry.table === table)
            ?.columns.find((column) => column.primaryKey)
          assert(key, `UE_FRAMEWORK_PROOF_CLEANUP_KEY_REQUIRED:${table}`)
          await owner.query(`DELETE FROM ${relation(table)} WHERE ${quote(key.name)}=$1`, [
            workerRows.get(table),
          ])
        }
        await owner.query(
          "DELETE FROM public.django_session WHERE session_key='ue-framework-proof-session'",
        )
        await owner.query('DELETE FROM public.django_admin_log WHERE user_id=ANY($1)', [
          [...userIds.values()],
        ])
        await owner.query('DELETE FROM public.auth_user_groups WHERE user_id=ANY($1)', [
          [...userIds.values()],
        ])
        await owner.query('DELETE FROM public.auth_user_user_permissions WHERE user_id=ANY($1)', [
          [...userIds.values()],
        ])
        await owner.query('DELETE FROM public.auth_group_permissions WHERE permission_id=$1', [
          permissionId,
        ])
        await owner.query('DELETE FROM public.auth_permission WHERE id=$1', [permissionId])
        await owner.query('DELETE FROM public.django_content_type WHERE id=$1', [contentTypeId])
        await owner.query('DELETE FROM public.auth_user WHERE username=ANY($1)', [
          identities.map(username),
        ])
        await owner.query('DELETE FROM public.auth_group WHERE name=$1', [group])
        await owner.query('DELETE FROM user_management.user_sessions WHERE user_id=ANY($1)', [
          [...identities, 'ue-framework-new-member'],
        ])
        await owner.query('DELETE FROM user_management.organization_users WHERE user_id=ANY($1)', [
          identities,
        ])
        if (invokeApplication)
          await owner.query(
            "DELETE FROM public.platform_identity_bindings WHERE provider='entra' AND provider_subject='ue-framework-tenant:ue-framework-object' AND provisioned_by='synthetic-framework-application'",
          )
        await owner.query('DELETE FROM user_management.users WHERE user_id=ANY($1)', [
          [...identities, 'ue-framework-new-member'],
        ])
        if (invokeApplication) {
          await owner.query('DELETE FROM public.audit_logs WHERE organization_id=ANY($1::uuid[])', [
            applicationOrganizations,
          ])
          await owner.query('DELETE FROM public.donations WHERE organization_id=ANY($1::uuid[])', [
            applicationOrganizations,
          ])
          await owner.query('DELETE FROM public.organizations WHERE id=ANY($1::uuid[])', [
            applicationOrganizations,
          ])
        }
        await owner.query('COMMIT')
      } catch (error: unknown) {
        await owner.query('ROLLBACK')
        throw error
      }
    }
  }
  return {
    scope: 'LOCAL_SYNTHETIC_CURRENT_FRAMEWORK_BOUNDARY',
    result: failures.length ? ('FAIL' as const) : ('PASS' as const),
    passed,
    failures,
    tableReports,
    applicationInvocation: application ? 'PASS_CURRENT_FRAMEWORK_CONSUMERS' : 'NOT_YET_PROVEN',
    application,
    stagingProof: false,
    fixtureCleanup: await (async () => {
      assert.deepEqual(await counts(), initialCounts, 'UE_FRAMEWORK_PROOF_DATA_RESIDUE')
      return 'PASS' as const
    })(),
  }
}
