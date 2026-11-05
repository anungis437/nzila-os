/**
 * Native proof of notification delivery races.
 *
 * Cursor does not set UE_DELIVERY_NATIVE_PROOF and does not start Docker.
 * A skipped run is not evidence. Status stays READY_FOR_VS_EXECUTION.
 *
 * The suite creates its own PostgreSQL 16 container, applies the minimal ledger
 * and queue tables, then applies platform 0032. It does not point at a shared
 * database and it does not mark the migration qualified.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const native = process.env.UE_DELIVERY_NATIVE_PROOF === '1' ? describe : describe.skip
const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const QUEUE = '33333333-3333-4333-8333-333333333333'

native('notification delivery native races', () => {
  const image = 'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
  const name = `ue-delivery-native-${process.pid}-${Date.now()}`
  let created = false
  let config: pg.ClientConfig
  let client: pg.Client

  function connect(): pg.Client {
    return new pg.Client(config)
  }

  beforeAll(async () => {
    execFileSync('docker', ['run', '--detach', '--name', name, '-e', 'POSTGRES_PASSWORD=synthetic-only',
      '-p', '127.0.0.1::5432', image], { stdio: 'pipe' })
    created = true
    const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name], { encoding: 'utf8' }))
    const port = Number(ports['5432/tcp'][0].HostPort)
    for (let attempt = 0; ; attempt += 1) {
      try {
        execFileSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres'], { stdio: 'pipe' })
        break
      } catch (error) {
        if (attempt >= 60) throw error
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    config = { host: '127.0.0.1', port, database: 'postgres', user: 'postgres', password: 'synthetic-only' }
    client = connect()
    await client.connect()
    await client.query(`
      CREATE TABLE notification_delivery_log (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        notification_id uuid NOT NULL,
        event text NOT NULL,
        event_timestamp timestamptz NOT NULL,
        provider_id text,
        external_event_id text,
        details jsonb,
        status_code text,
        error_message text,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE notification_queue (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        status text NOT NULL
      );
    `)
    const sql = readFileSync(path.resolve(__dirname, '../migrations-platform/0032_notification_callback_identity.sql'), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      const text = statement.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim()
      if (text) await client.query(text)
    }
  }, 120_000)

  afterAll(async () => {
    await client?.end().catch(() => undefined)
    if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' })
  })

  async function claim(db: pg.Client, id: string, organizationId: string): Promise<number> {
    const result = await db.query(
      `UPDATE notification_queue
          SET status = 'processing'
        WHERE id = $1
          AND organization_id = $2
          AND status IN ('pending', 'failed', 'retrying')
        RETURNING id`,
      [id, organizationId],
    )
    return result.rowCount ?? 0
  }

  it('lets the first retry claim win and leaves a crashed processing row unclaimed', async () => {
    await client.query(
      `INSERT INTO notification_queue (id, organization_id, status) VALUES ($1, $2, 'failed')`,
      [QUEUE, ORG_A],
    )
    const other = connect()
    await other.connect()
    try {
      await client.query('BEGIN')
      await other.query('BEGIN')
      const first = await claim(client, QUEUE, ORG_A)
      const second = claim(other, QUEUE, ORG_A)
      await client.query('COMMIT')
      expect(await second).toBe(0)
      await other.query('COMMIT')
      expect(first).toBe(1)
    } finally {
      await other.end()
    }
    await client.query(`UPDATE notification_queue SET status = 'processing' WHERE id = $1`, [QUEUE])
    expect(await claim(client, QUEUE, ORG_A)).toBe(0)
  })

  it('records one simultaneous callback and refuses the duplicate, a second tenant, and a later claim', async () => {
    const message = 'provider-message-1'
    const insert = (db: pg.Client, organizationId: string, event: string) => db.query(
      `INSERT INTO notification_delivery_log
         (id, organization_id, notification_id, event, event_timestamp, external_event_id)
       VALUES (gen_random_uuid(), $1, $2, $3, now(), $4)`,
      [organizationId, QUEUE, event, message],
    )
    await insert(client, ORG_A, 'accepted')
    const peer = connect()
    await peer.connect()
    try {
      const results = await Promise.allSettled([
        insert(client, ORG_A, 'delivered'),
        insert(peer, ORG_A, 'delivered'),
      ])
      const rejected = results.filter((result) => result.status === 'rejected')
      expect(rejected).toHaveLength(1)
      expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/unique|duplicate/i)
    } finally {
      await peer.end()
    }
    await expect(insert(client, ORG_B, 'bounced')).rejects.toThrow(/another organization/)
    await insert(client, ORG_A, 'uncertain')
    const events = await client.query(
      `SELECT event FROM notification_delivery_log WHERE external_event_id = $1 ORDER BY event`,
      [message],
    )
    expect(events.rows.map((row) => row.event)).toEqual(['accepted', 'delivered', 'uncertain'])
    expect(await claim(client, QUEUE, ORG_A)).toBe(0)
  })
})
