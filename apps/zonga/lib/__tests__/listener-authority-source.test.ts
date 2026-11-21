/** SQL-engine component proof: real action/resolver/service SQL and source
 * declarations under a restricted effective role. Identity and provider I/O
 * are ports; this is not a canonical bootstrap, RLS or native qualification. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { stream } from '@/lib/services/listener-playback'
import { createZongaSourceDatabase } from './fixtures/listener-source-database'
import type { ListenerActionContext } from '@/lib/resolve-org'

const ports = vi.hoisted(() => ({
  actor: 'canonical:listener:opaque',
  hint: null as string | null,
  appRole: undefined as string | undefined,
  providerRole: undefined as string | undefined,
  email: 'listener@fixture.invalid',
  profileActor: null as string | null,
  database: undefined as unknown,
  sign: vi.fn((container: string, key: string) => `https://fixture.invalid/${container}/${key}`),
  aws: vi.fn(async (_config: unknown, value: { storageKey: string }) => ({
    url: `https://fixture.invalid/aws/${value.storageKey}`,
  })),
  outcome: vi.fn(),
  event: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => ({
    userId: ports.actor,
    orgId: ports.hint,
    orgRole: ports.providerRole,
    sessionClaims: { publicMetadata: { zongaRole: ports.appRole } },
  }),
  currentUser: async () => ({
    id: ports.profileActor ?? ports.actor,
    emailAddresses: [{ emailAddress: ports.email }],
  }),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: new Proxy(
    {},
    {
      get(_target, key) {
        if (!ports.database) throw new Error('Fixture database is not initialized')
        const value = Reflect.get(ports.database as object, key)
        // The production postgres-js execute port returns rows directly. Keep
        // real PGlite SQL, adapting only its different transport envelope.
        if (key === 'execute')
          return async (...args: unknown[]) => {
            const result = await value.apply(ports.database, args)
            return result.rows
          }
        return typeof value === 'function' ? value.bind(ports.database) : value
      },
    },
  ),
}))
vi.mock('@nzila/blob', () => ({
  generateSasUrl: ports.sign,
  uploadBuffer: vi.fn(),
  computeSha256: vi.fn(),
}))
vi.mock('@nzila/zonga-streaming-aws/cloudfront-delivery', () => ({
  createSignedPlaybackUrl: ports.aws,
}))
vi.mock('@nzila/zonga-streaming-aws', () => ({ resolveCloudFrontConfig: () => ({}) }))
vi.mock('@/lib/control/control-plane-bridge', () => ({
  afterCommandSuccess: ports.outcome,
  emitCommandEvent: ports.event,
}))
vi.mock('next/cache', () => ({ revalidatePath: ports.revalidate }))
vi.mock('@/lib/pilot-metrics', () => ({
  recordZongaStreamStart: vi.fn(async () => {}),
  recordZongaReplayView: vi.fn(async () => {}),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { resolveOrgContext, resolveListenerContext, resolveListenerUUID } from '@/lib/resolve-org'
import * as listener from '@/lib/actions/listener-actions'
import * as social from '@/lib/actions/social-actions'
import * as browse from '@/lib/actions/browse-actions'
import * as search from '@/lib/actions/search-actions'
import * as notifications from '@/lib/actions/notification-actions'
import { requestStream, getMaxQuality } from '@/lib/actions/streaming-actions'
import { requestDownload, canDownload } from '@/lib/actions/download-actions'
import { getPlaybackUrl } from '@/features/media/playback-service'
import { getStreamUrl } from '@/lib/actions/upload-actions'
import { resolveModerationCase } from '@/lib/actions/moderation-actions'
import { registerPreExecutionGuard } from '@/lib/control/command-bus'
import { resolveModerationCaseHandler } from '@/lib/control/handlers/resolve-moderation-case.handler'
import { GET as streamApi } from '@/app/api/stream/[assetId]/route'

let source: Awaited<ReturnType<typeof createZongaSourceDatabase>>
const ids = {
  org: randomUUID(),
  foreignOrg: randomUUID(),
  creator: randomUUID(),
  asset: randomUUID(),
  draft: randomUUID(),
  withdrawn: randomUUID(),
  listener: randomUUID(),
  foreignListener: randomUUID(),
  playlist: randomUUID(),
  privatePlaylist: randomUUID(),
  ownedPlaylist: randomUUID(),
  case: randomUUID(),
  assignee: randomUUID(),
  track: randomUUID(),
}
const canonicalActor = 'canonical:listener:opaque',
  creatorActor = 'canonical:creator:opaque'
let blockCommand = false
const query = async <T = Record<string, unknown>>(text: string, values: unknown[] = []) =>
  (await source.operator(text, values)).rows as T[]
const count = async (table: string) =>
  Number((await query<{ total: number }>(`SELECT count(*) AS total FROM ${table}`))[0].total)
async function manager() {
  ports.hint = ids.org
  ports.appRole = 'manager'
  await query(`INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_secretary')`, [
    ids.org,
    ports.actor,
  ])
}
async function premium(status: string | null = 'active') {
  await query(`UPDATE zonga_listeners SET plan='premium',subscription_status=$1 WHERE id=$2`, [
    status,
    ids.listener,
  ])
}
async function blobVariant(tier: 'standard' | 'high' | 'hifi' | 'preview', key?: string) {
  const format = tier === 'hifi' ? 'flac' : 'aac'
  const storage = key ?? `processed/${ids.creator}/${ids.track}/${tier}.${format}`
  await query(
    `INSERT INTO zonga_processed_variants(track_asset_id,quality_tier,format,bitrate,codec,storage_key,file_size_bytes) VALUES($1,$2,$3,$4,$5,$6,100)`,
    [
      ids.track,
      tier,
      format,
      tier === 'hifi' ? 1411 : tier === 'high' ? 320 : 128,
      format,
      storage,
    ],
  )
}
async function awsVariant(tier: 'free' | 'standard' | 'high' | 'premium', key?: string) {
  await query(
    `INSERT INTO zonga_media_variants(content_asset_id,quality_tier,storage_key,status,bitrate,codec) VALUES($1,$2,$3,'ready',192,'aac')`,
    [ids.asset, tier, key ?? `processed/${ids.org}/${ids.asset}/${tier}.m4a`],
  )
}
async function failWrites(table: string, condition = 'true') {
  await query(
    `CREATE OR REPLACE FUNCTION fixture_write_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'fixture primary persistence outage'; END IF; RETURN NEW; END $$`,
  )
  await query(
    `CREATE TRIGGER fixture_outage BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fixture_write_failure()`,
  )
}
beforeAll(async () => {
  source = await createZongaSourceDatabase()
  ports.database = source.database
  registerPreExecutionGuard(async () => ({ allowed: !blockCommand, reason: 'Fixture preguard' }))
})
afterAll(async () => {
  await source?.close()
})
beforeEach(async () => {
  for (const table of [
    'audit_events',
    'zonga_notifications',
    'zonga_listener_activity',
    'zonga_listeners',
  ])
    await query(`DROP TRIGGER IF EXISTS fixture_outage ON ${table}`)
  const tables = await query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
  )
  await query(`TRUNCATE ${tables.map((row) => `public."${row.tablename}"`).join(',')} CASCADE`)
  ports.actor = canonicalActor
  ports.hint = null
  ports.appRole = undefined
  ports.providerRole = undefined
  ports.email = 'listener@fixture.invalid'
  ports.profileActor = null
  blockCommand = false
  vi.clearAllMocks()
  await query(
    `INSERT INTO orgs(id,legal_name,jurisdiction) VALUES($1,'Source org','CA-ON'),($2,'Foreign org','CA-ON')`,
    [ids.org, ids.foreignOrg],
  )
  await query(
    `INSERT INTO zonga_creators(id,org_id,user_id,display_name,status,legal_name,stripe_customer_id) VALUES($1,$2,$3,'Published Artist','active','PRIVATE LEGAL NAME','PRIVATE PROVIDER')`,
    [ids.creator, ids.org, creatorActor],
  )
  await query(
    `INSERT INTO zonga_content_assets(id,org_id,creator_id,title,type,status,storage_url,duration_seconds,metadata) VALUES
    ($1,$4,$5,'Source public track','track','published',$6,123,'{"privateAssessment":"PRIVATE ASSESSMENT"}'),
    ($2,$4,$5,'Source private draft','track','draft',NULL,12,'{}'),($3,$4,$5,'Source taken down track','track','taken_down',NULL,12,'{}')`,
    [
      ids.asset,
      ids.draft,
      ids.withdrawn,
      ids.org,
      ids.creator,
      `blob://${ids.creator}/${ids.asset}/master.wav`,
    ],
  )
  await query(
    `INSERT INTO zonga_listeners(id,user_id,display_name,email) VALUES($1,$3,'Own Listener','own@fixture.invalid'),($2,'canonical:foreign','Private Listener','PRIVATE EMAIL')`,
    [ids.listener, ids.foreignListener, canonicalActor],
  )
  await query(
    `INSERT INTO zonga_playlists(id,org_id,owner_type,owner_id,title,visibility) VALUES($1,$4,'listener',$5,'Public collection','public'),($2,$4,'listener',$5,'Private collection','private'),($3,$4,'listener',$6,'Own private collection','private')`,
    [
      ids.playlist,
      ids.privatePlaylist,
      ids.ownedPlaylist,
      ids.org,
      ids.foreignListener,
      ids.listener,
    ],
  )
  await query(
    `INSERT INTO zonga_moderation_cases(id,org_id,entity_type,entity_id,case_type,assigned_to) VALUES($1,$2,'asset',$3,'quality',$4)`,
    [ids.case, ids.org, ids.asset, ids.assignee],
  )
  await query(
    `INSERT INTO zonga_track_assets(id,content_asset_id,org_id,creator_id,storage_key,original_filename,mime_type,file_size_bytes,upload_status) VALUES($1,$2,$3,$4,'raw/master.wav','master.wav','audio/wav',100,'completed')`,
    [ids.track, ids.asset, ids.org, ids.creator],
  )
  source.statements.length = 0
})

describe('actual identity and personal ownership', () => {
  it('runs action SQL under a restricted effective role', async () => {
    const result = await source.db.query<{ role: string; superuser: boolean; bypass: boolean }>(
      `SELECT current_user AS role,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user`,
    )
    expect(result.rows[0]).toEqual({
      role: 'zonga_action_fixture',
      superuser: false,
      bypass: false,
    })
  })
  it('does not turn an organization hint into personal jurisdiction', async () => {
    ports.hint = ids.foreignOrg
    await listener.recordActivity({
      activityType: 'play',
      entityType: 'asset',
      targetEntityId: ids.asset,
      metadata: { source: 'forged' },
    })
    expect(
      await query(`SELECT org_id,listener_id,metadata_json FROM zonga_listener_activity`),
    ).toEqual([
      expect.objectContaining({
        org_id: ids.org,
        listener_id: ids.listener,
        metadata_json: expect.objectContaining({ source: 'listener-reported' }),
      }),
    ])
  })
  it('serves only the own private profile', async () => {
    expect(await listener.getListenerProfile()).toMatchObject({
      id: ids.listener,
      email: 'own@fixture.invalid',
    })
    await expect(listener.getListenerProfile(ids.foreignListener)).rejects.toMatchObject({
      status: 403,
    })
    expect(source.statements.join('\n')).not.toContain('PRIVATE EMAIL')
  })
  it('stores opaque principals in a real UUID profile without an invented org', async () => {
    ports.actor = 'canonical:new:opaque'
    const result = await listener.ensureListenerProfile({ displayName: 'New listener' })
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.id).not.toBe(ports.actor)
    expect(
      await query(`SELECT user_id,org_id FROM zonga_listeners WHERE id=$1`, [result.id]),
    ).toEqual([{ user_id: ports.actor, org_id: null }])
    expect(await listener.ensureListenerProfile({ displayName: 'Ignored duplicate' })).toEqual(
      result,
    )
  })
  it('propagates a real profile persistence outage instead of returning an actor as a UUID', async () => {
    ports.actor = 'canonical:new:opaque'
    await failWrites('zonga_listeners')
    await expect(listener.ensureListenerProfile({ displayName: 'Not stored' })).rejects.toThrow()
    expect(await count('zonga_listeners')).toBe(2)
    await query(`DROP TRIGGER fixture_outage ON zonga_listeners`)
  })
  it('rejects profile ownership and paid-plan mutation before UPDATE', async () => {
    await expect(
      listener.updateListenerProfile({ displayName: 'Changed', plan: 'premium' } as Parameters<
        typeof listener.updateListenerProfile
      >[0]),
    ).rejects.toThrow()
    expect(
      await query(`SELECT display_name,plan FROM zonga_listeners WHERE id=$1`, [ids.listener]),
    ).toEqual([{ display_name: 'Own Listener', plan: 'free' }])
  })
  it('expires callback capabilities and rejects copied identity objects', async () => {
    let captured: ListenerActionContext | undefined
    await resolveOrgContext('personal', async (context) => {
      captured = context
      expect(JSON.stringify(context)).not.toContain('db')
    })
    expect(() => captured!.db).toThrow()
    await expect(
      resolveListenerUUID({ actorId: canonicalActor, orgId: null }),
    ).rejects.toMatchObject({ status: 403 })
    const genuine = await resolveListenerContext()
    ports.actor = 'other:actor'
    await expect(resolveListenerUUID(genuine)).rejects.toMatchObject({ status: 403 })
  })
  it('requires active source membership despite provider admin labels', async () => {
    ports.hint = ids.org
    ports.providerRole = 'org:admin'
    ports.appRole = 'admin'
    await expect(resolveOrgContext()).rejects.toMatchObject({ status: 403 })
    await manager()
    expect(await resolveOrgContext()).toMatchObject({
      orgId: ids.org,
      actorId: canonicalActor,
      role: 'manager',
    })
    await query(`UPDATE org_members SET status='suspended'`)
    await expect(resolveOrgContext()).rejects.toMatchObject({ status: 403 })
  })
})

describe('fixed published projections and actual resource relationships', () => {
  it('publishes exact safe DTOs with matching count and filters draft/withdrawn', async () => {
    const result = await browse.browsePublishedAssets({ search: 'Source' })
    expect(result.total).toBe(1)
    expect(result.assets.map((a) => a.id)).toEqual([ids.asset])
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|storageUrl|fingerprintRef|provider/i)
    expect(result.assets[0]).toMatchObject({
      durationSeconds: 123,
      metadata: { creatorName: 'Published Artist' },
    })
    expect(await browse.getPublishedAsset(ids.draft)).toBeNull()
    expect(JSON.stringify(await browse.getPublishedCreator(ids.creator))).not.toMatch(
      /PRIVATE|userId|stripe|legalName/,
    )
  })
  it('search and playlists never project withdrawn/private resources', async () => {
    const result = await search.globalSearch('Source')
    expect(result.assets.map((a) => a.id)).toEqual([ids.asset])
    expect((await browse.browsePublicPlaylists()).playlists.map((p) => p.id)).toEqual([
      ids.playlist,
    ])
  })
  it('stops published disclosure when creator becomes inactive or mismatched', async () => {
    await query(`UPDATE zonga_creators SET org_id=$1 WHERE id=$2`, [ids.foreignOrg, ids.creator])
    expect((await browse.browsePublishedAssets()).total).toBe(0)
    await expect(social.likeAsset(ids.asset)).rejects.toMatchObject({ status: 403 })
  })
  it('writes saves only for published or truly owned private playlists', async () => {
    await expect(listener.savePlaylist(ids.privatePlaylist)).rejects.toMatchObject({ status: 403 })
    await listener.savePlaylist(ids.playlist)
    await listener.savePlaylist(ids.ownedPlaylist)
    expect((await listener.listSavedPlaylists()).map((row) => row.playlistId).sort()).toEqual(
      [ids.playlist, ids.ownedPlaylist].sort(),
    )
    expect(
      await query(`SELECT DISTINCT org_id,listener_id FROM zonga_listener_playlist_saves`),
    ).toEqual([{ org_id: ids.org, listener_id: ids.listener }])
    await query(`UPDATE zonga_playlists SET visibility='private' WHERE id=$1`, [ids.playlist])
    expect((await listener.listSavedPlaylists()).map((row) => row.playlistId)).toEqual([
      ids.ownedPlaylist,
    ])
  })
  it('owns follow/favorite rows and denies arbitrary follower and history audiences', async () => {
    await social.followCreator(ids.creator)
    await social.likeAsset(ids.asset)
    expect(await query(`SELECT listener_id,org_id FROM zonga_listener_follows`)).toEqual([
      { listener_id: ids.listener, org_id: ids.org },
    ])
    await expect(social.listFollowing(ids.foreignListener)).rejects.toMatchObject({ status: 403 })
    await expect(social.listFollowers(ids.creator)).rejects.toMatchObject({ status: 403 })
    expect(await social.getSocialStats(ids.creator)).toEqual({
      followers: 1,
      following: null,
      likes: 1,
      comments: 0,
    })
    ports.actor = creatorActor
    expect(await social.listFollowers(ids.creator)).toHaveLength(1)
  })
  it('rolls a follow back if its same-transaction activity cannot persist', async () => {
    await failWrites('zonga_listener_activity')
    await expect(social.followCreator(ids.creator)).rejects.toThrow()
    expect(await count('zonga_listener_follows')).toBe(0)
  })
  it('stores actual comment IDs and actor-derived names, rolls back activity failure', async () => {
    await expect(
      social.postComment({ assetId: ids.asset, content: 'Hello', userName: 'Forged author' }),
    ).rejects.toMatchObject({ status: 403 })
    const result = await social.postComment({ assetId: ids.asset, content: 'Hello' })
    expect(result.commentId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await social.listComments(ids.asset)).toEqual([
      expect.objectContaining({
        id: result.commentId,
        userId: canonicalActor,
        userName: 'Own Listener',
        content: 'Hello',
      }),
    ])
    await failWrites('zonga_listener_activity')
    await expect(
      social.postComment({ assetId: ids.asset, content: 'Not committed' }),
    ).rejects.toThrow()
    expect(await count('audit_log')).toBe(1)
  })
  it('contains tipping before any database/provider/evidence effect', async () => {
    const start = source.statements.length
    await expect(
      social.tipCreator({ creatorId: ids.creator, amount: 10, currency: 'USD' }),
    ).rejects.toMatchObject({ status: 501, code: 'VERIFIED_TIP_PAYMENT_SOURCE_UNAVAILABLE' })
    expect(source.statements.slice(start).filter((q) => !/^begin|^rollback/i.test(q))).toEqual([])
    expect(ports.sign).not.toHaveBeenCalled()
    expect(ports.outcome).not.toHaveBeenCalled()
  })
})

describe('actual processed source and subscription ceilings', () => {
  it.each([null, 'canceled', 'past_due'])(
    'does not grant paid features for premium with status %s',
    async (status) => {
      await premium(status)
      expect(await canDownload()).toMatchObject({ allowed: false })
      expect(await getMaxQuality()).toMatchObject({ quality: 'high' })
      expect(await requestDownload(ids.asset)).toMatchObject({ ok: false })
      expect(ports.sign).not.toHaveBeenCalled()
    },
  )
  it('refuses raw masters when no eligible processed variant exists', async () => {
    const result = await requestStream(ids.asset, 'standard')
    expect(result).toMatchObject({ ok: false, bitrate: 0 })
    expect(result.streamUrl).toBeUndefined()
    expect(ports.sign).not.toHaveBeenCalled()
    expect(ports.aws).not.toHaveBeenCalled()
  })
  it('free high entitlement cannot select a hifi master and uses an actual high variant', async () => {
    await blobVariant('high')
    await blobVariant('hifi')
    expect(await requestStream(ids.asset, 'hifi')).toMatchObject({
      ok: true,
      quality: 'high',
      bitrate: 320,
      codec: 'aac',
    })
    expect(ports.sign).toHaveBeenCalledWith(
      'zonga-encoded',
      `processed/${ids.creator}/${ids.track}/high.aac`,
      240,
    )
  })
  it('active premium uses the actual hifi variant and records downloads under the owned UUID', async () => {
    await premium()
    await blobVariant('hifi')
    expect(await requestStream(ids.asset, 'hifi')).toMatchObject({
      ok: true,
      quality: 'hifi',
      bitrate: 1411,
      codec: 'flac',
    })
    expect(await requestDownload(ids.asset)).toMatchObject({ ok: true })
    expect(await query(`SELECT listener_id,org_id FROM zonga_listener_activity`)).toEqual([
      { listener_id: ids.listener, org_id: ids.org },
    ])
  })
  it('does not upgrade standard/free/preview fallback to a higher available tier', async () => {
    await awsVariant('high')
    await blobVariant('hifi')
    await resolveOrgContext('personal', async (context) => {
      for (const ceiling of ['standard', 'free', 'preview'] as const) {
        const result = await getPlaybackUrl(ids.asset, ceiling, ceiling, context.db)
        expect(result.ok).toBe(false)
        expect(result.streamUrl).toBeUndefined()
      }
    })
    expect(ports.aws).not.toHaveBeenCalled()
    expect(ports.sign).not.toHaveBeenCalled()
  })
  it('preserves eligible AWS free and high variants and signs the real org/asset', async () => {
    await awsVariant('free')
    await awsVariant('high')
    await resolveOrgContext('personal', async (context) => {
      expect(await getPlaybackUrl(ids.asset, 'free', 'free', context.db)).toMatchObject({
        ok: true,
        qualityTier: 'free',
        provider: 'aws_cloudfront',
      })
      expect(await getPlaybackUrl(ids.asset, 'high', 'high', context.db)).toMatchObject({
        ok: true,
        qualityTier: 'high',
      })
    })
    expect(ports.aws).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ orgId: ids.org, assetId: ids.asset, qualityTier: 'free' }),
    )
  })
  it('refuses foreign processed pointers and uncompleted tracks without provider calls', async () => {
    await blobVariant('high', `processed/${ids.creator}/${randomUUID()}/high.aac`)
    await awsVariant('high', `processed/${ids.foreignOrg}/${ids.asset}/high.m4a`)
    expect(await requestStream(ids.asset)).toMatchObject({ ok: false })
    expect(ports.aws).not.toHaveBeenCalled()
    expect(ports.sign).not.toHaveBeenCalled()
  })
  it('retains the required signer only for exact stored assets in a verified catalog organization', async () => {
    await manager()
    const path = `${ids.creator}/${ids.asset}/master.wav`
    expect(await getStreamUrl(path)).toBe(`https://fixture.invalid/zonga-audio/${path}`)
    ports.sign.mockClear()
    await expect(getStreamUrl(`${ids.creator}/${randomUUID()}/secret.wav`)).rejects.toMatchObject({
      status: 403,
    })
    expect(ports.sign).not.toHaveBeenCalled()
    await query(`UPDATE org_members SET status='removed'`)
    await expect(getStreamUrl(path)).rejects.toMatchObject({ status: 403 })
  })
})

describe('canonical notification recipients and coupled moderation', () => {
  it('never serves historical UUID-only rows, even to a matching UUID principal', async () => {
    const legacy = randomUUID()
    ports.actor = legacy
    await query(
      `INSERT INTO zonga_notifications(org_id,user_id,type,title) VALUES($1,$2,'old','Retained history')`,
      [ids.org, legacy],
    )
    expect(await notifications.listNotifications()).toEqual([])
    expect(await notifications.getUnreadCount()).toBe(0)
    await notifications.markAllRead()
    expect(await query(`SELECT read FROM zonga_notifications`)).toEqual([{ read: false }])
  })
  it('serves and marks only the exact canonical recipient, independent of provider org hints', async () => {
    const owned = randomUUID(),
      foreign = randomUUID()
    ports.hint = ids.foreignOrg
    await query(
      `INSERT INTO zonga_notifications(id,org_id,recipient_user_id,type,title) VALUES($1,$3,$4,'notice','Own'),($2,$3,'canonical:foreign','notice','Foreign')`,
      [owned, foreign, ids.org, canonicalActor],
    )
    expect((await notifications.listNotifications()).map((n) => n.id)).toEqual([owned])
    expect(await notifications.markAsRead(foreign)).toEqual({ success: false })
    await notifications.markAllRead()
    expect(await query(`SELECT id,read FROM zonga_notifications ORDER BY id`)).toEqual(
      [
        { id: owned, read: true },
        { id: foreign, read: false },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    )
  })
  it('rejects arbitrary notification recipients before insert', async () => {
    await manager()
    await query(`UPDATE zonga_moderation_cases SET status='resolved'`)
    await expect(
      notifications.createNotification({
        orgId: ids.org,
        userId: 'canonical:foreign',
        type: 'moderation_resolved',
        title: 'Content review complete',
        caseId: ids.case,
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(await count('zonga_notifications')).toBe(0)
  })
  it('requires verified live membership and existing moderation role before mutation', async () => {
    ports.hint = ids.org
    ports.appRole = 'manager'
    await expect(
      resolveModerationCase(ids.case, { status: 'resolved', notes: 'Verified review reason' }),
    ).rejects.toMatchObject({ status: 403 })
    await manager()
    await query(`UPDATE org_members SET role='org_viewer' WHERE org_id=$1 AND user_id=$2`, [
      ids.org,
      canonicalActor,
    ])
    ports.appRole = 'viewer'
    await expect(
      resolveModerationCase(ids.case, { status: 'resolved', notes: 'Verified review reason' }),
    ).rejects.toMatchObject({ status: 403 })
    expect((await query(`SELECT status FROM zonga_moderation_cases`))[0].status).toBe('open')
  })
  it('preserves preguards and mandatory reason with no state, audit, notification or outcome', async () => {
    await manager()
    blockCommand = true
    expect(
      await resolveModerationCase(ids.case, {
        status: 'resolved',
        notes: 'Verified review reason',
      }),
    ).toEqual({ success: false })
    blockCommand = false
    expect(await resolveModerationCase(ids.case, { status: 'resolved', notes: '' })).toEqual({
      success: false,
    })
    expect((await query(`SELECT status FROM zonga_moderation_cases`))[0].status).toBe('open')
    expect(await count('audit_events')).toBe(0)
    expect(await count('zonga_notifications')).toBe(0)
    expect(ports.outcome).not.toHaveBeenCalled()
  })
  it('denies forged command context without reading or writing source', async () => {
    const start = source.statements.length
    expect(
      await resolveModerationCaseHandler.execute(
        {
          type: 'resolve_moderation_case',
          case_id: ids.case,
          status: 'resolved',
          notes: 'Verified review reason',
          actor_id: canonicalActor,
        },
        { org_id: ids.org, actor_id: canonicalActor },
      ),
    ).toMatchObject({ success: false, errors: [{ code: 'VERIFIED_MODERATION_CONTEXT_REQUIRED' }] })
    expect(source.statements.length).toBe(start)
  })
  it.each(['primary', 'notification', 'notification-primary'] as const)(
    'rolls back case, trace, notifications and audit on %s persistence failure',
    async (failure) => {
      await manager()
      if (failure === 'notification') await failWrites('zonga_notifications')
      else
        await failWrites(
          'audit_events',
          failure === 'notification-primary' ? "NEW.action='zonga.notification.created'" : 'true',
        )
      expect(
        await resolveModerationCase(ids.case, {
          status: 'resolved',
          notes: 'Verified review reason',
        }),
      ).toEqual({ success: false })
      expect(await query(`SELECT status,assigned_to FROM zonga_moderation_cases`)).toEqual([
        { status: 'open', assigned_to: ids.assignee },
      ])
      expect(await count('audit_log')).toBe(0)
      expect(await count('audit_events')).toBe(0)
      expect(await count('zonga_notifications')).toBe(0)
      expect(ports.outcome).not.toHaveBeenCalled()
      expect(ports.revalidate).not.toHaveBeenCalled()
    },
  )
  it('commits case, actual actor audit and canonical recipient notification before outcome hooks', async () => {
    await manager()
    ports.outcome.mockImplementationOnce(() => {
      expect(source.statements.at(-1)).toMatch(/^commit/i)
    })
    expect(
      await resolveModerationCase(ids.case, {
        status: 'resolved',
        notes: 'Verified review reason',
      }),
    ).toEqual({ success: true })
    expect(ports.outcome).toHaveBeenCalledTimes(1)
    expect(await query(`SELECT status,assigned_to FROM zonga_moderation_cases`)).toEqual([
      { status: 'resolved', assigned_to: ids.assignee },
    ])
    expect(await query(`SELECT DISTINCT actor_user_id FROM audit_events`)).toEqual([
      { actor_user_id: canonicalActor },
    ])
    expect(await query(`SELECT recipient_user_id,user_id,org_id FROM zonga_notifications`)).toEqual(
      [{ recipient_user_id: creatorActor, user_id: null, org_id: ids.org }],
    )
    expect(await count('audit_events')).toBe(2)
    ports.actor = creatorActor
    expect(await notifications.listNotifications()).toHaveLength(1)
  })
})

describe('connected source consumers and retry boundaries', () => {
  it('recommends only currently published coherent assets using real activity columns', async () => {
    await listener.recordActivity({
      activityType: 'play',
      entityType: 'asset',
      targetEntityId: ids.asset,
    })
    const result = await listener.getRecommendationsForUser({ limit: 8 })
    expect(result.items.map((row) => row.itemId)).toEqual([ids.asset])
    expect((await search.getRecentlyPlayed()).map((row) => row.id)).toEqual([ids.asset])
    await query(`UPDATE zonga_creators SET status='suspended' WHERE id=$1`, [ids.creator])
    expect((await listener.getRecommendationsForUser()).items).toEqual([])
    expect(await search.getRecentlyPlayed()).toEqual([])
  })
  it('discovers actual source releases without fictitious exclusivity columns', async () => {
    const published = randomUUID(),
      draft = randomUUID()
    await query(
      `INSERT INTO zonga_releases(id,org_id,creator_id,title,status) VALUES($1,$3,$4,'Published release','published'),($2,$3,$4,'Private release','draft')`,
      [published, draft, ids.org, ids.creator],
    )
    await query(
      `INSERT INTO zonga_release_tracks(release_id,asset_id,track_number) VALUES($1,$2,1),($1,$3,2)`,
      [published, ids.asset, ids.draft],
    )
    expect(await listener.discoverReleases()).toEqual([
      expect.objectContaining({ id: published, trackCount: 1 }),
    ])
  })
  it('keeps incomplete upload variants unavailable', async () => {
    await blobVariant('high')
    await query(`UPDATE zonga_track_assets SET upload_status='pending'`)
    expect(await requestStream(ids.asset)).toMatchObject({ ok: false })
    expect(ports.sign).not.toHaveBeenCalled()
  })
  it('does not sign a foreign raw master even with an active paid subscription', async () => {
    await premium()
    await query(`UPDATE zonga_content_assets SET storage_url=$1 WHERE id=$2`, [
      `blob://${ids.creator}/${randomUUID()}/master.wav`,
      ids.asset,
    ])
    await expect(requestDownload(ids.asset)).rejects.toMatchObject({ status: 403 })
    expect(ports.sign).not.toHaveBeenCalled()
    expect(await count('zonga_listener_activity')).toBe(0)
  })
  it('keeps a notification retry bound to the actual resolved case and exact recipient', async () => {
    await manager()
    await query(`UPDATE zonga_moderation_cases SET status='resolved'`)
    const request = {
      orgId: ids.org,
      userId: creatorActor,
      type: 'moderation_resolved',
      title: 'Content review complete',
      body: 'Your asset has been reviewed and the case has been resolved.',
      link: `/dashboard/catalog/${ids.asset}`,
      caseId: ids.case,
    }
    const first = await notifications.createNotification(request)
    expect(await notifications.createNotification(request)).toEqual(first)
    expect(await count('zonga_notifications')).toBe(1)
    expect(await count('audit_events')).toBe(1)
    await expect(
      notifications.createNotification({ ...request, orgId: ids.foreignOrg }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      notifications.createNotification({ ...request, caseId: randomUUID() }),
    ).rejects.toMatchObject({ status: 403 })
    expect(await count('zonga_notifications')).toBe(1)
  })
  it('does not reinterpret a committed moderation outcome when an external hook is unavailable', async () => {
    await manager()
    ports.outcome.mockImplementationOnce(() => {
      throw new Error('External metric unavailable')
    })
    expect(
      await resolveModerationCase(ids.case, {
        status: 'resolved',
        notes: 'Verified review reason',
      }),
    ).toEqual({ success: true })
    expect(await count('audit_events')).toBe(2)
    expect(await count('zonga_notifications')).toBe(1)
  })
  it.each([null, 'canceled', 'active'] as const)(
    'stream API uses the actual duration and status-aware source ceiling (%s)',
    async (status) => {
      await manager()
      await premium(status)
      await blobVariant('high')
      await blobVariant('hifi')
      const response = await streamApi(
        new Request(`https://fixture.invalid/api/stream/${ids.asset}?quality=hifi`),
        { params: Promise.resolve({ assetId: ids.asset }) },
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.durationMs).toBe(123000)
      expect(body.data.codec).toBe(status === 'active' ? 'flac' : 'aac')
      expect(body.data.streamUrl).toContain(status === 'active' ? '/hifi.flac' : '/high.aac')
    },
  )
  it('stream API refuses invalid source duration before provider calls', async () => {
    await manager()
    await blobVariant('high')
    await query(`UPDATE zonga_content_assets SET duration_seconds=-1 WHERE id=$1`, [ids.asset])
    const response = await streamApi(
      new Request(`https://fixture.invalid/api/stream/${ids.asset}`),
      { params: Promise.resolve({ assetId: ids.asset }) },
    )
    expect(response.status).toBe(503)
    expect(ports.sign).not.toHaveBeenCalled()
  })
})

describe('post-provider fresh entitlement (component interleaving, not native concurrency)', () => {
  it('does not return a paid URL after the actual plan is revoked at the async provider port', async () => {
    await premium()
    await awsVariant('premium')
    await expect(
      resolveOrgContext('personal', async (context) => {
        ports.aws.mockImplementationOnce(async () => {
          await context.db.execute(
            sql`UPDATE public.zonga_listeners SET subscription_status='canceled' WHERE id=${ids.listener}::uuid`,
          )
          return { url: 'https://fixture.invalid/unreleased-paid-url' }
        })
        return stream(context, ids.asset, 'hifi')
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('role facts belong to the selected real organization', () => {
  async function twoOrganizations(secondRole = 'org_viewer') {
    ports.hint = ids.org
    ports.appRole = 'admin'
    ports.providerRole = 'org:admin'
    await query(
      `INSERT INTO org_members(org_id,user_id,role) VALUES($1,$3,'org_admin'),($2,$3,$4)`,
      [ids.org, ids.foreignOrg, canonicalActor, secondRole],
    )
  }
  it('does not carry provider-orgA app admin metadata into selected orgB viewer authority', async () => {
    await twoOrganizations()
    const result = await resolveOrgContext(
      'organization',
      { organizationId: ids.foreignOrg },
      async (context) => ({ role: context.role, permissions: context.permissions }),
    )
    expect(result.role).toBe('viewer')
    expect(result.permissions).not.toContain('zonga:settings:manage')
    expect(result.permissions).not.toContain('zonga:payout:execute')
  })
  it('denies an actual orgB notification write despite orgA admin metadata and two real memberships', async () => {
    await twoOrganizations()
    await query(`UPDATE zonga_creators SET org_id=$1`, [ids.foreignOrg])
    await query(`UPDATE zonga_content_assets SET org_id=$1`, [ids.foreignOrg])
    await query(`UPDATE zonga_moderation_cases SET org_id=$1,status='resolved'`, [ids.foreignOrg])
    await expect(
      notifications.createNotification({
        orgId: ids.foreignOrg,
        userId: creatorActor,
        type: 'moderation_resolved',
        title: 'Content review complete',
        body: 'Your asset has been reviewed and the case has been resolved.',
        link: `/dashboard/catalog/${ids.asset}`,
        caseId: ids.case,
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(await count('zonga_notifications')).toBe(0)
    expect(await count('audit_events')).toBe(0)
  })
  it('also isolates the legacy no-argument helper when the hinted organization is inactive', async () => {
    await twoOrganizations()
    await query(`UPDATE orgs SET status='inactive' WHERE id=$1`, [ids.org])
    expect(await resolveOrgContext()).toMatchObject({ orgId: ids.foreignOrg, role: 'viewer' })
  })
  it('preserves canonical selected-org administrator authority despite unrelated provider metadata', async () => {
    await twoOrganizations('org_admin')
    ports.appRole = 'viewer'
    expect(
      await resolveOrgContext(
        'organization',
        { organizationId: ids.foreignOrg },
        async (context) => context.role,
      ),
    ).toBe('admin')
    ports.hint = null
    await query(`UPDATE orgs SET status='inactive' WHERE id=$1`, [ids.org])
    expect(await resolveOrgContext()).toMatchObject({ orgId: ids.foreignOrg, role: 'admin' })
  })
  it('preserves the existing verified platform super-admin source across organizations', async () => {
    await twoOrganizations()
    ports.email = 'info@nzilaventures.com'
    expect(
      await resolveOrgContext(
        'organization',
        { organizationId: ids.foreignOrg },
        async (context) => context.role,
      ),
    ).toBe('admin')
  })
  it('requires platform-admin profile identity to match the authenticated canonical actor', async () => {
    await twoOrganizations()
    ports.appRole = 'viewer'
    ports.email = 'info@nzilaventures.com'
    ports.profileActor = 'different:canonical:actor'
    await expect(
      resolveOrgContext(
        'organization',
        { organizationId: ids.foreignOrg },
        async (context) => context.role,
      ),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('live selected membership governs administrative power after downgrade', () => {
  it('does not restore a removed admin role from same-org provider/admin metadata', async () => {
    ports.hint = ids.org
    ports.appRole = 'admin'
    ports.providerRole = 'org:admin'
    await query(`INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_admin')`, [
      ids.org,
      canonicalActor,
    ])
    expect(await resolveOrgContext()).toMatchObject({ role: 'admin' })
    await query(`UPDATE org_members SET role='org_viewer' WHERE org_id=$1 AND user_id=$2`, [
      ids.org,
      canonicalActor,
    ])
    expect(await resolveOrgContext()).toMatchObject({ role: 'viewer' })
    expect(
      await resolveOrgContext(
        'organization',
        { organizationId: ids.org },
        async (context) => context.role,
      ),
    ).toBe('viewer')
  })
  it('denies actual moderation mutation after live downgrade despite unchanged same-org admin claims', async () => {
    ports.hint = ids.org
    ports.appRole = 'admin'
    ports.providerRole = 'org:admin'
    await query(`INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_viewer')`, [
      ids.org,
      canonicalActor,
    ])
    await expect(
      resolveModerationCase(ids.case, { status: 'resolved', notes: 'Verified review reason' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(await query(`SELECT status FROM zonga_moderation_cases`)).toEqual([{ status: 'open' }])
    expect(await count('audit_events')).toBe(0)
    expect(await count('zonga_notifications')).toBe(0)
  })
  it('preserves the existing live secretary-to-manager mapping without a provider role', async () => {
    await query(`INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_secretary')`, [
      ids.org,
      canonicalActor,
    ])
    expect(await resolveOrgContext()).toMatchObject({ role: 'manager' })
  })
  it('a live manager cannot regain admin powers through same-org stale admin metadata', async () => {
    ports.hint = ids.org
    ports.appRole = 'admin'
    ports.providerRole = 'org:admin'
    await query(`INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_secretary')`, [
      ids.org,
      canonicalActor,
    ])
    const result = await resolveOrgContext()
    expect(result.role).toBe('manager')
    expect(result.permissions).not.toContain('zonga:payout:execute')
    expect(result.permissions).toContain('zonga:catalog:publish')
  })
})

describe('existing owner flows do not require invented tenant-wide creator grants', () => {
  it('ignores an unbacked creator label while preserving actual creator ownership and published access', async () => {
    ports.actor = creatorActor
    ports.hint = ids.org
    ports.providerRole = 'org:member'
    ports.appRole = 'creator'
    await query(`INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_viewer')`, [
      ids.org,
      creatorActor,
    ])
    const context = await resolveOrgContext()
    expect(context.role).toBe('viewer')
    expect(context.permissions).not.toContain('zonga:catalog:create')
    expect(context.permissions).not.toContain('zonga:payout:preview')
    expect(await browse.getPublishedCreator(ids.creator)).toMatchObject({
      id: ids.creator,
      status: 'active',
    })
    expect(await social.listFollowers(ids.creator)).toEqual([])
    const own = await listener.ensureListenerProfile({ displayName: 'Actual creator listener' })
    expect(await listener.getListenerProfile(own.id)).toMatchObject({
      id: own.id,
      displayName: 'Actual creator listener',
    })
    const playlist = randomUUID()
    await query(
      `INSERT INTO zonga_playlists(id,org_id,owner_type,owner_id,title,visibility) VALUES($1,$2,'creator',$3,'Own creator collection','private')`,
      [playlist, ids.org, ids.creator],
    )
    expect(await listener.savePlaylist(playlist)).toEqual({ success: true })
    expect((await listener.listSavedPlaylists()).map((row) => row.playlistId)).toEqual([playlist])
  })
  it('rejects conflicting active role assignments instead of choosing the strongest stale row', async () => {
    ports.hint = ids.org
    ports.appRole = 'admin'
    await query(
      `INSERT INTO org_members(org_id,user_id,role) VALUES($1,$2,'org_admin'),($1,$2,'org_viewer')`,
      [ids.org, canonicalActor],
    )
    await expect(resolveOrgContext()).rejects.toMatchObject({ status: 403 })
    await expect(
      resolveOrgContext(
        'organization',
        { organizationId: ids.org },
        async (context) => context.role,
      ),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('published aggregate children obey actual published asset visibility', () => {
  it.each(['suspended', 'contradictory-org'] as const)(
    'does not count an ineligible %s child, while retaining valid multi-creator releases',
    async (condition) => {
      const parentRelease = randomUUID(),
        childCreator = randomUUID(),
        childAsset = randomUUID()
      await query(
        `INSERT INTO zonga_creators(id,org_id,user_id,display_name,status) VALUES($1,$2,'canonical:child:creator','Child artist',$3)`,
        [
          childCreator,
          condition === 'suspended' ? ids.org : ids.foreignOrg,
          condition === 'suspended' ? 'suspended' : 'active',
        ],
      )
      await query(
        `INSERT INTO zonga_content_assets(id,org_id,creator_id,title,type,status) VALUES($1,$2,$3,'Hidden child','track','published')`,
        [childAsset, ids.org, childCreator],
      )
      await query(
        `INSERT INTO zonga_releases(id,org_id,creator_id,title,status) VALUES($1,$2,$3,'Compilation','published')`,
        [parentRelease, ids.org, ids.creator],
      )
      await query(
        `INSERT INTO zonga_release_tracks(release_id,asset_id,track_number) VALUES($1,$2,1)`,
        [parentRelease, childAsset],
      )
      expect(await browse.getPublishedAsset(childAsset)).toBeNull()
      expect((await listener.discoverReleases())[0]).toMatchObject({
        id: parentRelease,
        trackCount: 0,
      })
      await query(`UPDATE zonga_creators SET org_id=$1,status='active' WHERE id=$2`, [
        ids.org,
        childCreator,
      ])
      expect(await browse.getPublishedAsset(childAsset)).toMatchObject({
        id: childAsset,
        creatorId: childCreator,
      })
      expect((await listener.discoverReleases())[0]).toMatchObject({
        id: parentRelease,
        trackCount: 1,
      })
      await query(`UPDATE zonga_creators SET org_id=NULL WHERE id=$1`, [childCreator])
      expect((await listener.discoverReleases())[0]).toMatchObject({
        id: parentRelease,
        trackCount: 1,
      })
    },
  )
  it('artist and social aggregates exclude published child rows contradicted by their actual creator scope', async () => {
    await query(`UPDATE zonga_content_assets SET org_id=$1 WHERE id=$2`, [
      ids.foreignOrg,
      ids.asset,
    ])
    await query(
      `INSERT INTO zonga_listener_favorites(org_id,listener_id,entity_type,entity_id) VALUES($1,$2,'asset',$3)`,
      [ids.foreignOrg, ids.listener, ids.asset],
    )
    await query(
      `INSERT INTO audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('social.commented',$1,'comment',$2,$3::jsonb)`,
      [
        canonicalActor,
        ids.foreignOrg,
        JSON.stringify({ assetId: ids.asset, content: 'Retained old comment' }),
      ],
    )
    expect(await browse.getPublishedAsset(ids.asset)).toBeNull()
    const artist = (await listener.discoverArtists()).find((row) => row.id === ids.creator)
    const stats = await social.getSocialStats(ids.creator)
    expect([artist?.assetCount, stats.likes, stats.comments]).toEqual([0, 0, 0])
    await query(`UPDATE zonga_content_assets SET org_id=$1 WHERE id=$2`, [ids.org, ids.asset])
    await query(`UPDATE audit_log SET org_id=$1`, [ids.org])
    expect((await listener.discoverArtists()).find((row) => row.id === ids.creator)).toMatchObject({
      assetCount: 1,
    })
    expect(await social.getSocialStats(ids.creator)).toMatchObject({ likes: 1, comments: 1 })
    await query(`UPDATE zonga_creators SET org_id=NULL WHERE id=$1`, [ids.creator])
    expect((await listener.discoverArtists()).find((row) => row.id === ids.creator)).toMatchObject({
      assetCount: 1,
    })
    expect(await social.getSocialStats(ids.creator)).toMatchObject({ likes: 1, comments: 1 })
  })
})
