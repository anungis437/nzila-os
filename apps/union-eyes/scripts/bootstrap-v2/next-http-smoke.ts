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
import {
  runAuthenticatedCaseworkLoad,
  seedAuthenticatedCaseworkFixtures,
} from './authenticated-casework-load'
import { PLATFORM_ORGANIZATION_ID } from '../../lib/authority/platform-organization'

export interface HttpObservation {
  name: string
  method: string
  path: string
  status: number
}

export async function seedNextHttpSmoke(
  seed: pg.Client,
  mfaEncryptionKey: string,
  authenticatedCaseworkLoad = false,
) {
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
  // The platform organization the owner creates once; the administrator starts as an unappointed platform officer.
  await seed.query(
    `INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
     VALUES ($1,'Synthetic platform organization','ue-http-platform-'||$2,'platform',ARRAY[]::text[],0,
       ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`,
    [PLATFORM_ORGANIZATION_ID, randomUUID()],
  )
  await seed.query(
    `INSERT INTO user_management.organization_users (user_id,organization_id,role,is_primary,is_active,joined_at)
     VALUES ($1,$2,'officer',false,true,now())`,
    [administrator, PLATFORM_ORGANIZATION_ID],
  )
  const loadFixture = authenticatedCaseworkLoad
    ? await seedAuthenticatedCaseworkFixtures(seed, {
        organizationId: organizations[0],
        foreignOrganizationId: organizations[2],
        passwordHash,
        encryptedMfaSecret,
      })
    : null
  return { organizations, actor, administrator, password, mfaSecret, loadFixture }
}

export async function runNextHttpSmoke(
  base: string,
  seed: pg.Client,
  fixture: Awaited<ReturnType<typeof seedNextHttpSmoke>>,
  observations: HttpObservation[],
  options: {
    duesInitiationStatuses?: number[]
    /** The running server's CRON_SECRET; there is no default, so a mismatched credential cannot pass unnoticed. */
    cronSecret?: string
    documentRepositoryStatuses?: number[]
    authenticatedCaseworkLoad?: { runtimeUrl: string; authUrl: string }
  } = {},
) {
  const { actor, administrator, password, organizations, mfaSecret } = fixture
  const cronSecret = options.cronSecret
  assert.ok(cronSecret && cronSecret.length >= 64, 'The server cron credential is required for the authorized cron journey')
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
  // Client-supplied organization and user identifiers are never an authority: the route's strict schema now REFUSES them
  // outright (it previously ignored them). Nothing may be written for a refused request.
  await request(
    'hostile-identity-fields-in-preference-write-refused',
    '/api/notifications/preferences',
    [400],
    {
      method: 'PUT',
      cookie,
      body: {
        email: `${actor}@example.invalid`,
        emailEnabled: false,
        organizationId: organizations[2],
        userId: administrator,
      },
    },
  )
  assert.equal(
    (
      await seed.query('SELECT 1 FROM public.user_notification_preferences WHERE user_id=ANY($1)', [
        [actor, administrator],
      ])
    ).rowCount,
    0,
    'A refused preference write persisted a row',
  )
  await request('ordinary-preference-write', '/api/notifications/preferences', [200], {
    method: 'PUT',
    cookie,
    body: { email: `${actor}@example.invalid`, emailEnabled: false },
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
  // Key Vault where it is required: equity self-identification is encrypted through the owned vault and decrypted on reload.
  // The reviewed notice is SYNTHETIC reference data for this disposable run, not a reviewed institutional notice.
  await seed.query(
    `INSERT INTO public.equity_consent_notice_versions (purpose,version,notice,status,reviewed_by,reviewed_at,effective_from,retention_days)
     VALUES ('equity_self_identification',1,'{"synthetic":"disposable qualification notice"}','reviewed','synthetic-qualification',now(),now()-interval '1 minute',30)`,
  )
  const equityNotice = await request('equity-consent-notice', '/api/equity/consent', [200], { cookie })
  const noticeBody = equityNotice.body as { data?: { notice?: { id?: string } }; notice?: { id?: string } }
  const noticeVersionId = noticeBody.data?.notice?.id ?? noticeBody.notice?.id
  assert.ok(noticeVersionId, 'the reviewed equity notice was not returned')
  await request('equity-consent-granted', '/api/equity/consent', [200, 201], {
    method: 'POST',
    cookie,
    body: { noticeVersionId, granted: true },
  })
  await request('equity-self-identification-encrypted-write', '/api/equity/self-identify', [200, 201], {
    method: 'POST',
    cookie,
    body: { genderIdentity: 'prefer_not_to_say', racialized: true },
  })
  const stored = await seed.query(
    `SELECT encrypted_payload::text AS payload,key_version FROM public.equity_self_identification_records
      WHERE organization_id=$1 AND subject_user_id=$2 AND purpose='equity_self_identification' AND deleted_at IS NULL`,
    [organizations[1], actor],
  )
  assert.equal(stored.rowCount, 1, 'the encrypted self-identification did not persist exactly once')
  assert.ok(!stored.rows[0].payload.includes('prefer_not_to_say'), 'self-identification was stored in plaintext')
  const decrypted = await request('equity-self-identification-decrypted-reload', '/api/equity/self-identify', [200], { cookie })
  assert.ok(JSON.stringify(decrypted.body).includes('prefer_not_to_say'), 'the encrypted self-identification did not decrypt on reload')
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
  // Platform-wide writes (lib/platform/platform-staff.ts): only the appointed platform executive (or a mandated officer) may
  // create an organization; every exercise and every refusal is audited, and a refusal writes nothing.
  const createPayload = () => {
    const slug = `ue-http-created-${randomUUID()}`
    return { slug, body: { name: 'Synthetic HTTP child', slug, type: 'local', parentId: organizations[0] } }
  }
  const organizationCount = async () => Number((await seed.query('SELECT count(*)::int AS n FROM public.organizations')).rows[0].n)
  const platformAudit = (organizationId: string, userId: string, action: string, key: string, value: string) =>
    seed.query(
      `SELECT 1 FROM public.audit_logs WHERE organization_id=$1::uuid AND user_id=$2 AND action=$3
         AND resource_type='platform_authority' AND details->>$4=$5`,
      [organizationId, userId, action, key, value],
    )
  const refusedWrite = async (
    name: string,
    requestCookie: string,
    audited: { organizationId: string; userId: string; reason: string } | null,
  ) => {
    const before = await organizationCount()
    const { slug, body } = createPayload()
    await request(name, '/api/organizations', [403], { method: 'POST', cookie: requestCookie, body })
    const persisted = await seed.query('SELECT 1 FROM public.organizations WHERE slug=$1', [slug])
    assert.equal(persisted.rowCount, 0, `${name}: a refused organization write persisted`)
    assert.equal(await organizationCount(), before, `${name}: a refused organization write changed the organization count`)
    if (audited) {
      const denial = await platformAudit(audited.organizationId, audited.userId, 'platform.organization.manage.denied', 'reason', audited.reason)
      assert.ok((denial.rowCount ?? 0) >= 1, `${name}: the refusal was not audited with reason ${audited.reason}`)
    }
  }
  await refusedWrite('ordinary-system-write-denied', cookie, {
    organizationId: organizations[1],
    userId: actor,
    reason: 'not_platform_staff_eligible',
  })
  let adminCookie = await login(administrator)
  await refusedWrite('system-actor-without-selected-membership-denied', adminCookie, null)
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
  // Eligible but not appointed, acting from a customer organization: refused.
  await refusedWrite('unappointed-platform-administrator-in-customer-organization-refused', adminCookie, {
    organizationId: organizations[0],
    userId: administrator,
    reason: 'not_acting_from_platform_organization',
  })
  const platformSelection = await request('platform-organization-switch', '/api/organizations/switch', [200], {
    method: 'POST',
    cookie: adminCookie,
    body: { organizationId: PLATFORM_ORGANIZATION_ID },
  })
  const platformCookie = cookies(platformSelection.response)
  // A platform officer without a mandate: refused.
  await refusedWrite('unappointed-platform-officer-refused', platformCookie, {
    organizationId: PLATFORM_ORGANIZATION_ID,
    userId: administrator,
    reason: 'no_live_scoped_platform_staff_mandate',
  })
  // The owner's one-time appointment: an executive membership in the platform organization.
  await seed.query(
    "UPDATE user_management.organization_users SET role='executive' WHERE user_id=$1 AND organization_id=$2",
    [administrator, PLATFORM_ORGANIZATION_ID],
  )
  const authorized = createPayload()
  const created = await request('platform-executive-organization-write', '/api/organizations', [201], {
    method: 'POST',
    cookie: platformCookie,
    body: authorized.body,
  })
  const persisted = await seed.query(
    'SELECT id::text,parent_id::text,hierarchy_level,organization_type FROM public.organizations WHERE slug=$1',
    [authorized.slug],
  )
  assert.equal(persisted.rowCount, 1, 'the authorized organization write did not persist exactly once')
  assert.equal(persisted.rows[0].id, created.body.data.id)
  assert.equal(persisted.rows[0].parent_id, organizations[0])
  assert.equal(persisted.rows[0].hierarchy_level, 1)
  assert.equal(persisted.rows[0].organization_type, 'local')
  const createdAudit = await seed.query(
    `SELECT 1 FROM public.audit_logs WHERE organization_id=$1::uuid AND user_id=$2 AND action='organization.create' AND resource_id=$3`,
    [persisted.rows[0].id, administrator, persisted.rows[0].id],
  )
  assert.equal(createdAudit.rowCount, 1, 'the authorized organization write was not audited exactly once')
  const exercise = await platformAudit(PLATFORM_ORGANIZATION_ID, administrator, 'platform.organization.manage.authorized', 'basis', 'platform_executive')
  assert.ok((exercise.rowCount ?? 0) >= 1, 'the platform executive exercise was not audited')
  // Removing the appointment ends the authority at once.
  await seed.query(
    "UPDATE user_management.organization_users SET role='officer' WHERE user_id=$1 AND organization_id=$2",
    [administrator, PLATFORM_ORGANIZATION_ID],
  )
  await refusedWrite('removed-platform-executive-refused', platformCookie, {
    organizationId: PLATFORM_ORGANIZATION_ID,
    userId: administrator,
    reason: 'no_live_scoped_platform_staff_mandate',
  })
  // Switching rotates the session: the administrator returns to their customer organization on the live platform session.
  const customerReselection = await request('platform-administrator-switch-back-to-customer-organization', '/api/organizations/switch', [200], {
    method: 'POST',
    cookie: platformCookie,
    body: { organizationId: organizations[0] },
  })
  adminCookie = cookies(customerReselection.response)
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
    'SELECT id::text,organization_id::text,member_id FROM public.claims WHERE claim_number=$1 AND organization_id=$2',
    [claimNumber, organizations[1]],
  )
  assert.equal(claimRows.rowCount, 1, 'claim did not persist exactly once')
  assert.equal(claimRows.rows[0].organization_id, organizations[1])
  assert.equal(claimRows.rows[0].member_id, actor)
  // Real-login authority checks (R-42 class): the role is read from the caller's own ACTIVE membership in the SELECTED
  // organization, so neither another organization's role, a client-supplied tenant header, a forged cookie, a cross-tenant
  // administrator nor a suspended identity can widen what the session may do.
  const claimId = claimRows.rows[0].id as string
  const otherOrg = await request(
    'multi-org-switch-to-member-organization',
    '/api/organizations/switch',
    [200],
    {
      method: 'POST',
      cookie,
      body: { organizationId: organizations[0] },
    },
  )
  const memberHere = cookies(otherOrg.response)
  await request('steward-elsewhere-is-only-member-here', '/api/claims', [403], {
    method: 'POST',
    cookie: memberHere,
    body: journeyClaim,
  })
  const backToStewardOrg = await request(
    'multi-org-switch-back',
    '/api/organizations/switch',
    [200],
    {
      method: 'POST',
      cookie: memberHere,
      body: { organizationId: organizations[1] },
    },
  )
  cookie = cookies(backToStewardOrg.response)
  const hostileHeader = await request(
    'client-tenant-header-does-not-select-organization',
    '/api/notifications/preferences',
    [200, 404],
    {
      cookie,
      headers: { 'x-org-id': organizations[2], 'x-organization-id': organizations[2] },
    },
  )
  assert.ok(
    !JSON.stringify(hostileHeader.body).includes(organizations[2]),
    'a client tenant header selected an organization',
  )
  const forged = cookie.replace(/=([^;]+)/, (_match, value: string) => `=${value.slice(0, -4)}AAAA`)
  assert.notEqual(forged, cookie)
  await request('forged-session-cookie-denied', '/api/notifications/preferences', [401], {
    cookie: forged,
  })
  const bystander = await request(
    'cross-tenant-administrator-claim-read-denied',
    `/api/claims/${claimId}`,
    [403, 404],
    {
      cookie: adminCookie,
    },
  )
  assert.ok(
    !JSON.stringify(bystander.body).includes(claimNumber),
    'a cross-tenant administrator read another organization claim',
  )
  await seed.query(
    "UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1",
    [actor],
  )
  await request('suspended-identity-session-denied', '/api/claims', [401, 403], { cookie })
  await request('suspended-identity-login-denied', '/api/auth/login', [401, 403], {
    method: 'POST',
    body: { email: `${actor}@example.invalid`, password },
  })
  await seed.query(
    "UPDATE user_management.users SET lifecycle_state='active', is_active=true WHERE user_id=$1",
    [actor],
  )
  await request('reinstated-identity-session-allowed', '/api/notifications/preferences', [200], {
    cookie,
  })
  await seed.query(
    "UPDATE user_management.organization_users SET role='member' WHERE user_id=$1 AND organization_id=$2",
    [actor, organizations[1]],
  )
  await request('role-revoked-claim-create-denied', '/api/claims', [403], {
    method: 'POST',
    cookie,
    body: journeyClaim,
  })
  // Member dues payment is not offered in the base release (BaseFinancialCapabilityUnavailable): with the owned Redis the
  // rate limiter admits the request and the route answers 501, and a member assertion of payment never credits the ledger.
  await request(
    'dues-initiation-not-implemented',
    '/api/portal/dues/pay',
    options.duesInitiationStatuses ?? [501],
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
  await request('cron-without-credential-denied', '/api/cron/deadline-reminders', [401], {
    method: 'POST',
  })
  await request('cron-with-credential', '/api/cron/deadline-reminders', [200], {
    method: 'POST',
    headers: { 'x-cron-secret': cronSecret },
  })
  await request('session-logout', '/api/auth/logout', [200], { method: 'POST', cookie })
  await request('revoked-session-denied', '/api/notifications/preferences', [401], { cookie })
  await request('health', '/api/health', [200])
  const authenticatedCaseworkLoad = options.authenticatedCaseworkLoad
    ? await runAuthenticatedCaseworkLoad({
        origin: base,
        seed,
        fixture: assertLoadFixture(fixture.loadFixture),
        password,
        mfaSecret,
        ...options.authenticatedCaseworkLoad,
      })
    : { status: 'UNEXECUTED', reason: 'UE_V2_AUTHENTICATED_CASEWORK_LOAD=1 was not enabled.' }
  return {
    status: authenticatedCaseworkLoad.status === 'FAIL' ? 'FAIL' : 'PASS',
    authenticatedCaseworkLoad,
    ordinaryWrite: 'PERSISTED_RELOADED_CANONICAL_ACTOR_AND_ORGANIZATION',
    systemWrite: 'AUTHORIZED_AND_PERSISTED_ORDINARY_CALLER_DENIED',
    vault: 'OWNED_VAULT_ENCRYPTED_WRITE_DECRYPTED_RELOAD',
    platformStaff: {
      mechanism: 'PLATFORM_EXECUTIVE_APPOINTMENT',
      refusals: ['UNAUTHORIZED', 'FOREIGN_TENANT', 'UNAPPOINTED', 'REMOVED_EXECUTIVE'],
    },
    limitations: ['Representative HTTP smoke is not complete caller or financial qualification.'],
  }
}

function assertLoadFixture<T>(fixture: T | null): T {
  assert.ok(fixture, 'Enabled authenticated load requires its producer-owned synthetic fixtures')
  return fixture
}
