import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import type pg from 'pg'
import { hashPassword } from '../../../../packages/platform-auth/src/password/password'
import { encryptSecret } from '../../../../packages/platform-auth/src/mfa/encryption'
import {
  computeTotp,
  generateTotpSecret,
  verifyTotp,
} from '../../../../packages/platform-auth/src/mfa/totp'

export interface HttpObservation {
  name: string
  method: string
  path: string
  status: number
}

export async function seedNextHttpSmoke(seed: pg.Client, mfaEncryptionKey: string) {
  const organizations = [randomUUID(), randomUUID(), randomUUID()]
  const actor = `ue-v2-http-${randomUUID()}`
  const administrator = `ue-v2-http-admin-${randomUUID()}`
  const password = randomBytes(32).toString('base64url')
  const passwordHash = await hashPassword(password)
  const mfaSecret = generateTotpSecret()
  const previousMfaKey = process.env.AUTH_MFA_ENCRYPTION_KEY
  let encryptedMfaSecret: string
  try {
    process.env.AUTH_MFA_ENCRYPTION_KEY = mfaEncryptionKey
    encryptedMfaSecret = encryptSecret(mfaSecret)
  } finally {
    if (previousMfaKey === undefined) delete process.env.AUTH_MFA_ENCRYPTION_KEY
    else process.env.AUTH_MFA_ENCRYPTION_KEY = previousMfaKey
  }
  await seed.query(
    `INSERT INTO user_management.mfa_totp (user_id,secret_encrypted,enabled_at)
     SELECT user_id,$2,now() FROM unnest($1::text[]) AS fixture(user_id)`,
    [[actor, administrator], encryptedMfaSecret],
  )
  await seed.query(
    `INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
      SELECT id,'Synthetic HTTP organization','ue-http-'||id::text,'local',ARRAY[]::text[],0,
        ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now()
      FROM unnest($1::uuid[]) AS fixture(id)`,
    [organizations],
  )
  for (const [id, isAdmin] of [
    [actor, false],
    [administrator, true],
  ] as const)
    await seed.query(
      `INSERT INTO user_management.users
       (user_id,email,password_hash,is_active,lifecycle_state,is_system_admin)
       VALUES ($1,$2,$3,true,'active',$4)`,
      [id, `${id}@example.invalid`, passwordHash, isAdmin],
    )
  await seed.query(
    `INSERT INTO user_management.organization_users
     (user_id,organization_id,role,is_primary,is_active,joined_at)
     VALUES ($1,$2,'member',true,true,now()),($1,$3,'member',false,true,now()),
       ($4,$2,'admin',true,true,now())`,
    [actor, organizations[0], organizations[1], administrator],
  )
  return { organizations, actor, administrator, password, mfaSecret }
}

export async function runNextHttpSmoke(
  base: string,
  seed: pg.Client,
  fixture: Awaited<ReturnType<typeof seedNextHttpSmoke>>,
  observations: HttpObservation[],
  options: { duesInitiationStatuses?: number[]; documentRepositoryStatuses?: number[] } = {},
) {
  const { actor, administrator, password, organizations, mfaSecret } = fixture
  const cronSecret = process.env.UE_V2_SMOKE_CRON_SECRET ?? 'ue-v2-cron-secret'
  const request = async (
    name: string,
    route: string,
    expected: number[],
    options: {
      method?: string
      body?: unknown
      cookie?: string
      headers?: Record<string, string>
    } = {},
  ) => {
    const response = await fetch(`${base}${route}`, {
      method: options.method ?? 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(120000),
      headers: {
        origin: base,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...(options.headers ?? {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })
    observations.push({
      name,
      path: route,
      method: options.method ?? 'GET',
      status: response.status,
    })
    const text = await response.text()
    assert.ok(
      expected.includes(response.status),
      `${name}: HTTP ${response.status}: ${text.slice(0, 600)}`,
    )
    return { response, body: text ? JSON.parse(text) : null }
  }
  const cookies = (response: Response) => {
    const values = response.headers.getSetCookie().map((value) => value.split(';')[0])
    assert.ok(values.length > 0, 'Real password authentication did not issue a cookie')
    return values.join('; ')
  }
  const login = async (userId: string) => {
    const result = await request('password-login', '/api/auth/login', [200], {
      method: 'POST',
      body: { email: `${userId}@example.invalid`, password },
    })
    assert.equal(result.body.user.id, userId)
    assert.equal(result.body.requiresMfa, true)
    assert.equal(typeof result.body.mfaChallengeToken, 'string')
    assert.equal(result.response.headers.has('set-cookie'), false)
    let invalidCode = '000000'
    while (verifyTotp(mfaSecret, invalidCode))
      invalidCode = String(Number(invalidCode) + 1).padStart(6, '0')
    const challengeToken: string = result.body.mfaChallengeToken
    await request('invalid-mfa-code-denied', '/api/auth/mfa/challenge', [401], {
      method: 'POST',
      body: { challengeToken, code: invalidCode },
    })
    const completed = await request('real-totp-challenge', '/api/auth/mfa/challenge', [200], {
      method: 'POST',
      body: { challengeToken, code: computeTotp(mfaSecret) },
    })
    assert.equal(completed.body.userId, userId)
    await request('consumed-mfa-challenge-denied', '/api/auth/mfa/challenge', [401], {
      method: 'POST',
      body: { challengeToken, code: computeTotp(mfaSecret) },
    })
    return cookies(completed.response)
  }
  await request('public-version', '/api/version', [200])
  await request('anonymous-preferences-denied', '/api/notifications/preferences', [401])
  await request('wrong-password-denied', '/api/auth/login', [401], {
    method: 'POST',
    body: { email: `${actor}@example.invalid`, password: 'Incorrect-synthetic-password-1!' },
  })
  let cookie = await login(actor)
  const listed = await request('canonical-memberships', '/api/users/me/organizations', [200], {
    cookie,
  })
  assert.ok(JSON.stringify(listed.body).includes(organizations[0]))
  assert.ok(JSON.stringify(listed.body).includes(organizations[1]))
  assert.ok(!JSON.stringify(listed.body).includes(organizations[2]))
  await request('foreign-organization-selection-denied', '/api/organizations/switch', [403, 404], {
    method: 'POST',
    cookie,
    body: { organizationId: organizations[2] },
  })
  const switched = await request(
    'canonical-organization-switch',
    '/api/organizations/switch',
    [200],
    {
      method: 'POST',
      cookie,
      body: { organizationId: organizations[1] },
    },
  )
  cookie = cookies(switched.response)
  await request('ordinary-preference-write', '/api/notifications/preferences', [200], {
    method: 'PUT',
    cookie,
    body: {
      email: `${actor}@example.invalid`,
      emailEnabled: false,
      organizationId: organizations[2],
      userId: administrator,
    },
  })
  const rows = await seed.query(
    `SELECT organization_id::text,user_id,email_enabled
     FROM public.user_notification_preferences WHERE user_id=$1`,
    [actor],
  )
  assert.equal(rows.rowCount, 1, 'HTTP write did not persist exactly one preference')
  assert.equal(rows.rows[0].organization_id, organizations[1])
  assert.equal(rows.rows[0].user_id, actor)
  assert.equal(rows.rows[0].email_enabled, false)
  const reloaded = await request(
    'ordinary-preference-reload',
    '/api/notifications/preferences',
    [200],
    { cookie },
  )
  assert.ok(JSON.stringify(reloaded.body).includes(organizations[1]))
  assert.ok(JSON.stringify(reloaded.body).includes(actor))
  await seed.query(
    'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2',
    [actor, organizations[1]],
  )
  await request('inactive-membership-denied', '/api/notifications/preferences', [401, 403], {
    cookie,
  })
  await seed.query(
    'UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1 AND organization_id=$2',
    [actor, organizations[1]],
  )
  const slug = `ue-http-created-${randomUUID()}`
  const payload = { name: 'Synthetic HTTP child', slug, type: 'local', parentId: organizations[0] }
  await request('ordinary-system-write-denied', '/api/organizations', [403], {
    method: 'POST',
    cookie,
    body: payload,
  })
  let adminCookie = await login(administrator)
  await request('system-actor-without-selected-membership-denied', '/api/organizations', [403], {
    method: 'POST',
    cookie: adminCookie,
    body: payload,
  })
  const adminSelection = await request(
    'system-actor-canonical-organization-switch',
    '/api/organizations/switch',
    [200],
    {
      method: 'POST',
      cookie: adminCookie,
      body: { organizationId: organizations[0] },
    },
  )
  adminCookie = cookies(adminSelection.response)
  const created = await request(
    'authorized-system-organization-write',
    '/api/organizations',
    [201],
    {
      method: 'POST',
      cookie: adminCookie,
      body: payload,
    },
  )
  const persisted = await seed.query(
    'SELECT id::text,parent_id::text,hierarchy_level FROM public.organizations WHERE slug=$1',
    [slug],
  )
  assert.equal(persisted.rowCount, 1)
  assert.equal(persisted.rows[0].id, created.body.data.id)
  assert.equal(persisted.rows[0].parent_id, organizations[0])
  assert.equal(persisted.rows[0].hierarchy_level, 1)
  // G5 critical journeys: role change and claim, dues payment, scheduled SYSTEM flow, revocation.
  const journeyClaim = {
    claimType: 'other',
    description: 'Synthetic journey claim for acceptance',
    priority: 'low',
  }
  await request('member-claim-create-denied', '/api/claims', [403], {
    method: 'POST',
    cookie,
    body: journeyClaim,
  })
  await seed.query(
    "UPDATE user_management.organization_users SET role='steward' WHERE user_id=$1 AND organization_id=$2",
    [actor, organizations[1]],
  )
  const claimCreated = await request('steward-claim-create', '/api/claims', [200, 201], {
    method: 'POST',
    cookie,
    body: journeyClaim,
  })
  const claimNumber = JSON.stringify(claimCreated.body).match(/CLM-\d{8}-\d{4}/)?.[0]
  assert.ok(claimNumber, 'claim number was not returned')
  const claimRows = await seed.query(
    'SELECT organization_id::text,member_id FROM public.claims WHERE claim_number=$1 AND organization_id=$2',
    [claimNumber, organizations[1]],
  )
  assert.equal(claimRows.rowCount, 1, 'claim did not persist exactly once')
  assert.equal(claimRows.rows[0].organization_id, organizations[1])
  assert.equal(claimRows.rows[0].member_id, actor)
  await seed.query(
    "UPDATE user_management.organization_users SET role='member' WHERE user_id=$1 AND organization_id=$2",
    [actor, organizations[1]],
  )
  await request('role-revoked-claim-create-denied', '/api/claims', [403], {
    method: 'POST',
    cookie,
    body: journeyClaim,
  })
  // Dues are settled only by a verified Stripe webhook (proven natively and in staging). The
  // hermetic smoke has no rate-limit store or provider, so initiation fails closed and a member
  // assertion of payment can never credit the ledger.
  await request(
    'dues-initiation-fails-closed-without-rate-limit-store',
    '/api/portal/dues/pay',
    options.duesInitiationStatuses ?? [429],
    {
      method: 'POST',
      cookie,
      body: { organizationId: organizations[1], amount: 25, paymentMethod: 'cash' },
    },
  )
  const dues = await seed.query('SELECT 1 FROM public.member_dues_ledger WHERE user_id=$1', [actor])
  assert.equal(dues.rowCount, 0, 'a member-asserted dues payment credited the ledger')
  // Document journey: the legacy endpoint is explicitly disabled and the repository endpoint is
  // entitlement-gated; the stored-blob positive path needs external object storage (external gate).
  const documentPayload = {
    title: 'Synthetic journey document',
    filename: 'synthetic-journey.pdf',
    fileUrl: 'https://documents.example.invalid/synthetic-journey.pdf',
    documentType: 'pdf',
    mimeType: 'application/pdf',
    privacyLabel: 'team_confidential',
  }
  await request('legacy-documents-endpoint-not-implemented', '/api/documents', [501], {
    method: 'POST',
    cookie,
    body: {
      ...documentPayload,
      name: documentPayload.title,
      fileType: 'pdf',
      organizationId: organizations[1],
    },
  })
  await request(
    'document-repository-entitlement-denied',
    '/api/documents/repository',
    options.documentRepositoryStatuses ?? [403],
    {
      method: 'POST',
      cookie,
      body: documentPayload,
    },
  )
  const documentRows = await seed.query('SELECT 1 FROM public.documents WHERE title=$1', [
    documentPayload.title,
  ])
  assert.equal(documentRows.rowCount, 0, 'denied document request persisted a row')
  await request('cron-without-credential-denied', '/api/cron/deadline-reminders', [401])
  await request('cron-with-credential', '/api/cron/deadline-reminders', [200], {
    headers: { 'x-cron-secret': cronSecret },
  })
  await request('session-logout', '/api/auth/logout', [200], { method: 'POST', cookie })
  await request('revoked-session-denied', '/api/notifications/preferences', [401], { cookie })
  await request('health', '/api/health', [200])
  return {
    status: 'PASS',
    ordinaryWrite: 'PERSISTED_RELOADED_CANONICAL_ACTOR_AND_ORGANIZATION',
    systemWrite: 'AUTHORIZED_AND_PERSISTED_ORDINARY_CALLER_DENIED',
    limitations: ['Representative HTTP smoke is not complete caller or financial qualification.'],
  }
}
