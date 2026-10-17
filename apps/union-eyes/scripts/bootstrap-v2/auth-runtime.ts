import assert from 'node:assert/strict'
import type pg from 'pg'
import {
  AUTH_EXECUTION_ROLES,
  AUTH_BOUNDARY_GAPS,
  authContextSettings,
  authExecutionRole,
  type AuthExecutionContext,
} from './auth-sql'
import { inspectAuthPrivilegeExpectations } from './auth-privileges'
import { proveAuthOrgBindingBoundary } from './auth-org-runtime'

export interface AuthProofClients {
  owner: pg.Client
  ordinary: pg.Client
  legacySystem: pg.Client
  auth: pg.Client
  authSystem: pg.Client
}

export const AUTH_REQUIRED_NATIVE_PATHS = [
  'ordinary and legacy system cannot read auth or SET ROLE, even with forged GUCs',
  'gateway has no unscoped table grants or system role',
  'preidentity email lookup is one-row and cannot change password or issue session',
  'validated identity sees/mutates own user/session, not cross-user or privilege fields',
  'session bearer resolves only matching hash and cannot revoke a session',
  'reset, magic-link, invite and MFA token lookup is hash-scoped, not identity',
  'explicit system action targets one user/org and cannot mutate identities or roles',
  'transaction-local context is cleared on connection reuse',
  'independent effective table/column/function ACL contract',
  'issuance cannot mint an existing identity, and signup is transaction-bound',
  'reset bearer owns password update and session revocation, never session issuance',
  'magic bearer resolves one identity and revokes its own authority after consumption',
  'invite bearer cannot forge organization or platform role',
  'tenant administrator is active, actor-bound and organization-bound',
  'MFA bearer sees enrollment only for its own live challenge',
  'lifecycle requires canonical system administrator and is irreversible',
  'cleanup deletes only inactive sessions expired beyond retention',
  'Entra immutable subject mapping rejects unknown, revoked and cross-tenant subjects',
  'administrator MFA mutation requires canonical administrator and cannot change passwords',
  'preidentity acceptance audit can append channel-bound receipts, never read or claim identity',
  'actor/session/membership business RLS rejects forged contexts and stale authority',
] as const

const q = (name: string) => `"${name.replaceAll('"', '""')}"`

async function scoped<T>(
  client: pg.Client,
  context: AuthExecutionContext,
  work: (client: pg.Client) => Promise<T>,
): Promise<T> {
  await client.query('BEGIN')
  try {
    const role = authExecutionRole(context)
    await client.query(`SET LOCAL ROLE ${q(role)}`)
    for (const [key, value] of Object.entries(authContextSettings(context)))
      await client.query('SELECT set_config($1,$2,true)', [key, value])
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function denied(work: () => Promise<unknown>): Promise<void> {
  await assert.rejects(work, (error: unknown) =>
    typeof error === 'object' && error !== null && 'code' in error &&
      (error.code === '42501' || error.code === '44000'))
}

/**
 * Real PG adapter for parent integration. Requires a local, disposable database,
 * installed canonical auth tables and compileAuthBootstrapSql() output. Seeds
 * only synthetic identities; derives qualification from the executed ledger.
 * Clients must be separate authenticated connections, not owner SET ROLE mocks.
 */
export async function proveAuthExecutionBoundary(clients: AuthProofClients) {
  for (const client of Object.values(clients)) {
    const host = (client as unknown as { host: string }).host
    if (!['127.0.0.1', 'localhost', '::1'].includes(host))
      throw new Error('Auth synthetic proof requires a local PostgreSQL endpoint')
  }
  const passed: string[] = []
  const failures: { path: string; error: string }[] = []
  let orgBoundary: Awaited<ReturnType<typeof proveAuthOrgBindingBoundary>> | undefined
  const check = async (name: string, work: () => Promise<void>) => {
    try { await work(); passed.push(name) }
    catch (error) { failures.push({ path: name, error: error instanceof Error ? error.message : String(error) }) }
  }
  const { owner, ordinary, legacySystem, auth, authSystem } = clients
  await owner.query(`
    INSERT INTO user_management.users(user_id,email,password_hash)
      VALUES ('auth-proof-a','auth-proof-a@example.invalid','synthetic-hash'),
             ('auth-proof-b','auth-proof-b@example.invalid','synthetic-hash');
    INSERT INTO user_management.organization_users(user_id,organization_id)
      VALUES ('auth-proof-a','11111111-1111-4111-8111-111111111111'),
             ('auth-proof-b','22222222-2222-4222-8222-222222222222');
    INSERT INTO user_management.user_sessions(user_id,session_token,session_token_hash,expires_at)
      VALUES ('auth-proof-a',repeat('a',64),repeat('a',64),now()+interval '1 day'),
             ('auth-proof-b',repeat('b',64),repeat('b',64),now()+interval '1 day');
    INSERT INTO user_management.password_reset_tokens(user_id,token_hash,expires_at)
      VALUES ('auth-proof-a',repeat('c',64),now()+interval '1 hour'),
             ('auth-proof-b',repeat('d',64),now()+interval '1 hour');
    INSERT INTO user_management.magic_links(email,user_id,token_hash,expires_at)
      VALUES ('auth-proof-a@example.invalid','auth-proof-a',repeat('e',64),now()+interval '1 hour');
    INSERT INTO user_management.invites(email,organization_id,invited_by,token_hash,expires_at)
      VALUES ('auth-proof-a@example.invalid','11111111-1111-4111-8111-111111111111','auth-proof-b',repeat('f',64),now()+interval '1 hour');
    INSERT INTO user_management.mfa_challenges(user_id,token_hash,expires_at)
      VALUES ('auth-proof-a',repeat('1',64),now()+interval '5 minutes');
  `)
  await check('ordinary and legacy system cannot read auth or SET ROLE, even with forged GUCs', async () => {
    for (const client of [ordinary, legacySystem]) {
      await client.query(`SELECT set_config('nzila.auth_user_id','auth-proof-a',false)`)
      await denied(() => client.query('SELECT * FROM user_management.users'))
      for (const role of Object.values(AUTH_EXECUTION_ROLES))
        await denied(() => client.query(`SET ROLE ${q(role)}`))
    }
  })
  await check('gateway has no unscoped table grants or system role', async () => {
    await denied(() => auth.query('SELECT * FROM user_management.users'))
    await denied(() => auth.query(`SET ROLE ${q(AUTH_EXECUTION_ROLES.system)}`))
    await denied(() => authSystem.query(`SET ROLE ${q(AUTH_EXECUTION_ROLES.identity)}`))
  })
  await check('preidentity email lookup is one-row and cannot change password or issue session', async () => {
    const context: AuthExecutionContext = { phase: 'lookup', selector: { kind: 'email', email: 'AUTH-PROOF-A@example.invalid' } }
    await scoped(auth, context, async client => {
      const rows = (await client.query('SELECT user_id FROM user_management.users')).rows
      assert.deepEqual(rows, [{ user_id: 'auth-proof-a' }])
      assert.equal((await client.query(`UPDATE user_management.users SET failed_login_attempts=1 WHERE user_id='auth-proof-b'`)).rowCount, 0)
      assert.equal((await client.query(`UPDATE user_management.users SET failed_login_attempts=1 WHERE user_id='auth-proof-a'`)).rowCount, 1)
    })
    await denied(() => scoped(auth, context, client =>
      client.query(`UPDATE user_management.users SET password_hash='forged'`)))
    await denied(() => scoped(auth, context, client =>
      client.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
        VALUES ('auth-proof-a','forged',now()+interval '1 day')`)))
  })
  await check('validated identity sees/mutates own user/session, not cross-user or privilege fields', async () => {
    const context: AuthExecutionContext = { phase: 'identity', userId: 'auth-proof-a' }
    await scoped(auth, context, async client => {
      assert.equal((await client.query('SELECT * FROM user_management.users')).rowCount, 1)
      assert.equal((await client.query('SELECT * FROM user_management.organization_users')).rowCount, 1)
      assert.equal((await client.query('SELECT * FROM user_management.user_sessions')).rowCount, 1)
      assert.equal((await client.query(`UPDATE user_management.users SET last_login_at=now() WHERE user_id='auth-proof-b'`)).rowCount, 0)
      assert.equal((await client.query(`UPDATE user_management.users SET last_login_at=now() WHERE user_id='auth-proof-a'`)).rowCount, 1)
    })
    await denied(() => scoped(auth, context, client =>
      client.query(`UPDATE user_management.users SET is_system_admin=true`)))
    await denied(() => scoped(auth, context, client =>
      client.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
        VALUES ('auth-proof-b','forged-cross-user',now()+interval '1 day')`)))
    await denied(() => scoped(auth, context, client =>
      client.query(`UPDATE user_management.organization_users SET role='admin'`)))
  })
  await check('session bearer resolves only matching hash and cannot revoke a session', async () => {
    const context: AuthExecutionContext = { phase: 'lookup', selector: { kind: 'session', tokenHash: 'a'.repeat(64) } }
    await scoped(auth, context, async client => {
      assert.deepEqual((await client.query('SELECT user_id FROM user_management.user_sessions')).rows, [{ user_id: 'auth-proof-a' }])
      assert.equal((await client.query('SELECT * FROM user_management.users')).rowCount, 0)
      assert.equal((await client.query('UPDATE user_management.user_sessions SET last_used_at=now()')).rowCount, 1)
    })
    await denied(() => scoped(auth, context, client =>
      client.query('UPDATE user_management.user_sessions SET is_active=false')))
  })
  await check('reset, magic-link, invite and MFA token lookup is hash-scoped, not identity', async () => {
    for (const [kind, table, hash] of [
      ['reset', 'password_reset_tokens', 'c'], ['magic-link', 'magic_links', 'e'],
      ['invite', 'invites', 'f'], ['mfa', 'mfa_challenges', '1'],
    ] as const) {
      await scoped(auth, { phase: 'lookup', selector: { kind, tokenHash: hash.repeat(64) } }, async client => {
        assert.equal((await client.query(`SELECT * FROM user_management.${q(table)}`)).rowCount, 1)
        assert.equal((await client.query('SELECT * FROM user_management.users')).rowCount, 0)
      })
      await scoped(auth, { phase: 'lookup', selector: { kind, tokenHash: '0'.repeat(64) } }, async client => {
        assert.equal((await client.query(`SELECT * FROM user_management.${q(table)}`)).rowCount, 0)
      })
    }
  })
  await check('explicit system action targets one user/org and cannot mutate identities or roles', async () => {
    const context: AuthExecutionContext = {
      phase: 'system', actorUserId: 'synthetic-platform-admin', targetUserId: 'auth-proof-b',
      operation: 'revoke-sessions', reason: 'Synthetic authorized offboarding',
    }
    await scoped(authSystem, context, async client => {
      assert.equal((await client.query('UPDATE user_management.user_sessions SET is_active=false')).rowCount, 1)
    })
    await denied(() => scoped(authSystem, context, client => client.query('SELECT * FROM user_management.users')))
    const membership = { ...context, operation: 'membership-state' as const, organizationId: '22222222-2222-4222-8222-222222222222' }
    await scoped(authSystem, membership, async client => {
      assert.equal((await client.query('UPDATE user_management.organization_users SET is_active=false')).rowCount, 1)
    })
    await denied(() => scoped(authSystem, membership, client =>
      client.query(`UPDATE user_management.organization_users SET role='admin'`)))
  })
  await check('transaction-local context is cleared on connection reuse', async () => {
    for (const client of [auth, authSystem]) {
      assert.equal((await client.query("SELECT nullif(current_setting('nzila.auth_user_id',true),'') AS value")).rows[0].value, null)
      await denied(() => client.query('SELECT * FROM user_management.users'))
    }
  })
  await check('independent effective table/column/function ACL contract', async () => {
    const acl = await inspectAuthPrivilegeExpectations(owner)
    assert.deepEqual(acl.failures, [])
  })
  await check('issuance cannot mint an existing identity, and signup is transaction-bound', async () => {
    await denied(() => scoped(auth, { phase: 'issuance', operation: 'signup', email: 'auth-proof-a@example.invalid' },
      client => client.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
        VALUES ('auth-proof-a','forged-issuance',now()+interval '1 day')`)))
    await scoped(auth, { phase: 'issuance', operation: 'signup', email: 'auth-proof-signup@example.invalid' }, async client => {
      await client.query(`INSERT INTO user_management.users(user_id,email,password_hash)
        VALUES ('auth-proof-signup','auth-proof-signup@example.invalid','synthetic-hash')`)
      await client.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
        VALUES ('auth-proof-signup','synthetic-signup',now()+interval '1 day')`)
    })
    await scoped(auth, { phase: 'issuance', operation: 'magic-issue', email: 'auth-proof-a@example.invalid' }, async client => {
      assert.equal((await client.query(`SELECT user_management.auth_request_count('magic-issue','auth-proof-a@example.invalid') AS count`)).rows[0].count, 1)
      assert.equal((await client.query(`SELECT user_management.auth_request_count('magic-issue','other@example.invalid') AS count`)).rows[0].count, null)
    })
  })
  await check('reset bearer owns password update and session revocation, never session issuance', async () => {
    const context: AuthExecutionContext = { phase: 'redemption', selector: { kind: 'reset', tokenHash: 'c'.repeat(64) } }
    await scoped(auth, context, async client => {
      await client.query('SELECT * FROM user_management.password_reset_tokens FOR UPDATE')
      assert.equal((await client.query(`UPDATE user_management.users SET password_hash='reset-proof' WHERE user_id='auth-proof-b'`)).rowCount, 0)
      assert.equal((await client.query(`UPDATE user_management.users SET password_hash='reset-proof' WHERE user_id='auth-proof-a'`)).rowCount, 1)
      await client.query('UPDATE user_management.user_sessions SET is_active=false')
    })
    await denied(() => scoped(auth, context, client => client.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
      VALUES ('auth-proof-a','reset-must-not-login',now()+interval '1 day')`)))
  })
  await check('magic bearer resolves one identity and revokes its own authority after consumption', async () => {
    const context: AuthExecutionContext = { phase: 'redemption', selector: { kind: 'magic-link', tokenHash: 'e'.repeat(64) } }
    await scoped(auth, context, async client => {
      await client.query('SELECT * FROM user_management.magic_links FOR UPDATE')
      assert.deepEqual((await client.query('SELECT user_id FROM user_management.users')).rows, [{ user_id: 'auth-proof-a' }])
      await client.query(`INSERT INTO user_management.user_sessions(user_id,session_token,expires_at)
        VALUES ('auth-proof-a','magic-proof',now()+interval '1 day')`)
      await client.query('UPDATE user_management.magic_links SET used_at=now()')
      assert.equal((await client.query('SELECT * FROM user_management.users')).rowCount, 0)
    })
  })
  await check('invite bearer cannot forge organization or platform role', async () => {
    const context: AuthExecutionContext = { phase: 'redemption', selector: { kind: 'invite', tokenHash: 'f'.repeat(64) } }
    await denied(() => scoped(auth, context, client => client.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,invited_by)
      VALUES ('auth-proof-a','33333333-3333-4333-8333-333333333333','admin','auth-proof-b')`)))
    await denied(() => scoped(auth, context, client => client.query(`UPDATE user_management.organization_users SET role='coo'`)))
    await scoped(auth, context, async client => {
      assert.equal((await client.query(`UPDATE user_management.organization_users SET role='member',invited_by='auth-proof-b'`)).rowCount, 1)
    })
  })
  await check('tenant administrator is active, actor-bound and organization-bound', async () => {
    await owner.query(`UPDATE user_management.organization_users SET role='admin' WHERE user_id='auth-proof-a'`)
    await scoped(auth, { phase: 'tenant-admin', userId: 'auth-proof-a', organizationId: '11111111-1111-4111-8111-111111111111' }, async client => {
      await client.query(`INSERT INTO user_management.invites(email,organization_id,role,token_hash,invited_by,expires_at)
        VALUES ('tenant-proof@example.invalid','11111111-1111-4111-8111-111111111111','member',repeat('9',64),'auth-proof-a',now()+interval '1 hour')`)
    })
    await denied(() => scoped(auth, { phase: 'tenant-admin', userId: 'auth-proof-b', organizationId: '11111111-1111-4111-8111-111111111111' },
      client => client.query(`INSERT INTO user_management.invites(email,organization_id,role,token_hash,invited_by,expires_at)
        VALUES ('tenant-forged@example.invalid','11111111-1111-4111-8111-111111111111','admin',repeat('8',64),'auth-proof-b',now()+interval '1 hour')`)))
  })
  await check('MFA bearer sees enrollment only for its own live challenge', async () => {
    await owner.query(`INSERT INTO user_management.mfa_totp(user_id,secret_encrypted,recovery_codes_hashed,enabled_at)
      VALUES ('auth-proof-a','synthetic-not-a-real-secret','[]',now())`)
    await scoped(auth, { phase: 'redemption', selector: { kind: 'mfa', tokenHash: '1'.repeat(64) } }, async client => {
      assert.equal((await client.query('SELECT * FROM user_management.mfa_totp FOR UPDATE')).rowCount, 1)
      await client.query('UPDATE user_management.mfa_challenges SET consumed_at=now()')
      assert.equal((await client.query('SELECT * FROM user_management.mfa_totp')).rowCount, 0)
    })
  })
  await check('lifecycle requires canonical system administrator and is irreversible', async () => {
    await scoped(authSystem, { phase: 'lifecycle', operation: 'suspend', actorUserId: 'auth-proof-b', targetUserId: 'auth-proof-a', reason: 'Synthetic unauthorized actor' }, async client => {
      assert.equal((await client.query(`UPDATE user_management.users SET lifecycle_state='suspended',is_active=false,lifecycle_changed_by='auth-proof-b'
        WHERE user_id='auth-proof-a'`)).rowCount, 0)
    })
    await owner.query(`UPDATE user_management.users SET is_system_admin=true WHERE user_id='auth-proof-a'`)
    await scoped(authSystem, { phase: 'lifecycle', operation: 'deprovision', actorUserId: 'auth-proof-a', targetUserId: 'auth-proof-b', reason: 'Synthetic offboarding' }, async client => {
      assert.equal((await client.query(`UPDATE user_management.users SET lifecycle_state='deprovisioned',is_active=false,lifecycle_changed_by='auth-proof-a'
        WHERE user_id='auth-proof-b'`)).rowCount, 1)
    })
    await scoped(authSystem, { phase: 'lifecycle', operation: 'reactivate', actorUserId: 'auth-proof-a', targetUserId: 'auth-proof-b', reason: 'Synthetic forbidden reactivation' }, async client => {
      assert.equal((await client.query(`UPDATE user_management.users SET lifecycle_state='active',is_active=true,lifecycle_changed_by='auth-proof-a'
        WHERE user_id='auth-proof-b'`)).rowCount, 0)
    })
    await owner.query(`UPDATE user_management.users SET lifecycle_state='active',is_active=true WHERE user_id='auth-proof-b'`)
  })
  await check('cleanup deletes only inactive sessions expired beyond retention', async () => {
    await owner.query(`INSERT INTO user_management.user_sessions(user_id,session_token,created_at,expires_at,is_active)
      VALUES ('auth-proof-a','cleanup-old',now()-interval '10 days',now()-interval '8 days',false),
        ('auth-proof-a','cleanup-recent',now()-interval '10 days',now()-interval '1 day',false),
        ('auth-proof-a','cleanup-active',now()-interval '10 days',now()-interval '8 days',true)`)
    await scoped(authSystem, { phase: 'cleanup', actorUserId: 'auth-proof-maintenance', reason: 'Synthetic retention' }, async client => {
      assert.equal((await client.query('DELETE FROM user_management.user_sessions')).rowCount, 1)
    })
  })
  await check('Entra immutable subject mapping rejects unknown, revoked and cross-tenant subjects', async () => {
    await owner.query(`INSERT INTO public.platform_identity_bindings(provider,provider_subject,platform_user_id,verified_at,provisioned_by)
      VALUES ('entra','synthetic-tenant:synthetic-object','auth-proof-a',now(),'synthetic-proof')`)
    const context: AuthExecutionContext = { phase: 'provider', provider: 'entra', providerSubject: 'synthetic-tenant:synthetic-object' }
    await scoped(auth, context, async client => {
      assert.equal((await client.query('SELECT user_id FROM user_management.users')).rows[0].user_id, 'auth-proof-a')
      assert.equal((await client.query('SELECT user_management.auth_provider_binding() AS binding')).rows[0].binding.platformUserId, 'auth-proof-a')
    })
    await scoped(auth, { ...context, providerSubject: 'wrong-tenant:synthetic-object' }, async client => {
      assert.equal((await client.query('SELECT * FROM user_management.users')).rowCount, 0)
    })
    await owner.query(`UPDATE public.platform_identity_bindings SET state='revoked' WHERE provider_subject='synthetic-tenant:synthetic-object'`)
    await scoped(auth, context, async client => {
      assert.equal((await client.query('SELECT * FROM user_management.users')).rowCount, 0)
    })
  })
  await check('administrator MFA mutation requires canonical administrator and cannot change passwords', async () => {
    await scoped(authSystem, { phase: 'mfa-admin', actorUserId: 'auth-proof-b', targetUserId: 'auth-proof-a', reason: 'Synthetic denial' }, async client => {
      assert.equal((await client.query("UPDATE user_management.users SET two_factor_enabled=false WHERE user_id='auth-proof-a'")).rowCount, 0)
    })
    await scoped(authSystem, { phase: 'mfa-admin', actorUserId: 'auth-proof-a', targetUserId: 'auth-proof-a', reason: 'Synthetic authorized disable' }, async client => {
      assert.equal((await client.query("UPDATE user_management.users SET two_factor_enabled=false WHERE user_id='auth-proof-a'")).rowCount, 1)
    })
    await denied(() => scoped(authSystem, { phase: 'mfa-admin', actorUserId: 'auth-proof-a', targetUserId: 'auth-proof-a', reason: 'Synthetic forbidden password change' },
      client => client.query("UPDATE user_management.users SET password_hash='not-authorized'")))
  })
  await check('preidentity acceptance audit can append channel-bound receipts, never read or claim identity', async () => {
    const context: AuthExecutionContext = { phase: 'audit', channel: 'cora-acceptance' }
    await scoped(auth, context, async client => {
      assert.equal((await client.query(`INSERT INTO user_management.auth_audit_log(event_type,metadata)
        VALUES ('acceptance_auth.deny','{"provider":"cora-acceptance","applicationId":"cora","decision":"DENY"}')`)).rowCount, 1)
    })
    await denied(() => scoped(auth, context, client => client.query('SELECT * FROM user_management.auth_audit_log')))
    await denied(() => scoped(auth, context, client => client.query(`INSERT INTO user_management.auth_audit_log(user_id,event_type,metadata)
      VALUES ('auth-proof-a','acceptance_auth.allow','{"provider":"cora-acceptance","applicationId":"cora","decision":"ALLOW"}')`)))
    await denied(() => scoped(auth, context, client => client.query('SELECT * FROM user_management.users')))
  })
  await check('actor/session/membership business RLS rejects forged contexts and stale authority', async () => {
    const report = orgBoundary = await proveAuthOrgBindingBoundary({ owner, ordinary, legacySystem })
    assert.deepEqual(report.failures, [])
    assert.deepEqual(report.gaps, [])
    assert.equal(report.result, 'PASS')
  })
  await owner.query(`DELETE FROM user_management.mfa_totp WHERE user_id='auth-proof-a';
    UPDATE user_management.users SET is_system_admin=false WHERE user_id='auth-proof-a';
    UPDATE user_management.organization_users SET role='member' WHERE user_id='auth-proof-a';
    UPDATE user_management.user_sessions SET is_active=true WHERE user_id='auth-proof-a';`)
  const executed = new Set([...passed, ...failures.map(failure => failure.path)])
  const gaps = [...AUTH_BOUNDARY_GAPS, ...AUTH_REQUIRED_NATIVE_PATHS.filter(path => !executed.has(path)).map(path => `UNPROBED: ${path}`)]
  return {
    contractVersion: '2.0',
    scope: 'LOCAL_SYNTHETIC_AUTH_BOUNDARY',
    result: failures.length ? 'FAIL' : gaps.length ? 'PARTIAL' : 'PASS',
    requiredPaths: AUTH_REQUIRED_NATIVE_PATHS,
    orgBoundary,
    passed,
    failures,
    gaps,
    stagingProof: false,
  } as const
}
