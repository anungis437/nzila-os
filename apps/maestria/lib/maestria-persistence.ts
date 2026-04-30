import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type RecordType = 'quote' | 'comment' | 'task' | 'proposal'

export interface OperationalRecord {
  id: string
  type: RecordType
  title: string
  body: string
  status: string
  priority: string
  createdBy: string
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ConnectorAccount {
  id: string
  system: 'shopify' | 'google-ads' | 'zoho'
  status: 'disconnected' | 'pending' | 'connected' | 'error'
  externalAccountId: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: string | null
  scopes: string[]
  lastSyncAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface NotificationDelivery {
  id: string
  channel: 'email' | 'in_app' | 'webhook'
  recipient: string
  subject: string
  body: string
  status: 'queued' | 'delivered' | 'failed'
  error: string | null
  createdAt: string
  deliveredAt: string | null
  metadata: Record<string, unknown>
}

export interface KpiEvent {
  id: string
  eventName: string
  value: number
  unit: string
  source: string
  occurredAt: string
  dimensions: Record<string, unknown>
}

interface SqliteRow {
  [key: string]: unknown
}

let dbSingleton: DatabaseSync | null = null

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function jsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function resolveDbPath(): string {
  const fromEnv = process.env.MAESTRIA_DB_PATH
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv
  return join(process.cwd(), 'data', 'maestria.db')
}

export function getMaestriaDb(): DatabaseSync {
  if (dbSingleton) return dbSingleton

  const dbPath = resolveDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS operational_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      created_by TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connector_accounts (
      id TEXT PRIMARY KEY,
      system TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      external_account_id TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      scopes_json TEXT NOT NULL,
      last_sync_at TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connector_oauth_states (
      state TEXT PRIMARY KEY,
      system TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      delivered_at TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kpi_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      source TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      dimensions_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screenshot_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      route TEXT NOT NULL,
      locale TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL,
      captured_at TEXT,
      created_at TEXT NOT NULL
    );
  `)

  dbSingleton = db
  return db
}

export function createOperationalRecord(input: {
  type: RecordType
  title: string
  body: string
  status?: string
  priority?: string
  createdBy: string
  payload?: Record<string, unknown>
}): OperationalRecord {
  const db = getMaestriaDb()
  const now = new Date().toISOString()
  const record: OperationalRecord = {
    id: generateId(input.type),
    type: input.type,
    title: input.title,
    body: input.body,
    status: input.status ?? 'open',
    priority: input.priority ?? 'normal',
    createdBy: input.createdBy,
    payload: input.payload ?? {},
    createdAt: now,
    updatedAt: now,
  }

  db.prepare(
    `INSERT INTO operational_records
      (id, type, title, body, status, priority, created_by, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.type,
    record.title,
    record.body,
    record.status,
    record.priority,
    record.createdBy,
    JSON.stringify(record.payload),
    record.createdAt,
    record.updatedAt,
  )

  return record
}

export function listOperationalRecords(type?: RecordType, limit = 50): OperationalRecord[] {
  const db = getMaestriaDb()
  const rows = (type
    ? db.prepare(
      `SELECT * FROM operational_records WHERE type = ? ORDER BY datetime(created_at) DESC LIMIT ?`,
    ).all(type, limit)
    : db.prepare(
      `SELECT * FROM operational_records ORDER BY datetime(created_at) DESC LIMIT ?`,
    ).all(limit)) as SqliteRow[]

  return rows.map((row) => ({
    id: String(row.id),
    type: row.type as RecordType,
    title: String(row.title),
    body: String(row.body),
    status: String(row.status),
    priority: String(row.priority),
    createdBy: String(row.created_by),
    payload: jsonParse<Record<string, unknown>>(row.payload_json, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))
}

export function upsertConnectorAccount(input: {
  system: ConnectorAccount['system']
  status: ConnectorAccount['status']
  externalAccountId?: string | null
  accessToken?: string | null
  refreshToken?: string | null
  tokenExpiresAt?: string | null
  scopes?: string[]
  lastSyncAt?: string | null
  metadata?: Record<string, unknown>
}): ConnectorAccount {
  const db = getMaestriaDb()
  const now = new Date().toISOString()
  const existing = db.prepare('SELECT * FROM connector_accounts WHERE system = ?').get(input.system) as SqliteRow | undefined

  const id = existing ? String(existing.id) : generateId('connector')
  const createdAt = existing ? String(existing.created_at) : now

  db.prepare(
    `INSERT INTO connector_accounts
      (id, system, status, external_account_id, access_token, refresh_token, token_expires_at, scopes_json, last_sync_at, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(system) DO UPDATE SET
        status = excluded.status,
        external_account_id = excluded.external_account_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        scopes_json = excluded.scopes_json,
        last_sync_at = excluded.last_sync_at,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
  ).run(
    id,
    input.system,
    input.status,
    input.externalAccountId ?? null,
    input.accessToken ?? null,
    input.refreshToken ?? null,
    input.tokenExpiresAt ?? null,
    JSON.stringify(input.scopes ?? []),
    input.lastSyncAt ?? null,
    JSON.stringify(input.metadata ?? {}),
    createdAt,
    now,
  )

  const row = db.prepare('SELECT * FROM connector_accounts WHERE system = ?').get(input.system) as SqliteRow
  return {
    id: String(row.id),
    system: row.system as ConnectorAccount['system'],
    status: row.status as ConnectorAccount['status'],
    externalAccountId: row.external_account_id ? String(row.external_account_id) : null,
    accessToken: row.access_token ? String(row.access_token) : null,
    refreshToken: row.refresh_token ? String(row.refresh_token) : null,
    tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : null,
    scopes: jsonParse<string[]>(row.scopes_json, []),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    metadata: jsonParse<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function getConnectorAccount(system: ConnectorAccount['system']): ConnectorAccount | null {
  const db = getMaestriaDb()
  const row = db.prepare('SELECT * FROM connector_accounts WHERE system = ?').get(system) as SqliteRow | undefined
  if (!row) return null
  return {
    id: String(row.id),
    system: row.system as ConnectorAccount['system'],
    status: row.status as ConnectorAccount['status'],
    externalAccountId: row.external_account_id ? String(row.external_account_id) : null,
    accessToken: row.access_token ? String(row.access_token) : null,
    refreshToken: row.refresh_token ? String(row.refresh_token) : null,
    tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : null,
    scopes: jsonParse<string[]>(row.scopes_json, []),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    metadata: jsonParse<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function saveConnectorOAuthState(system: ConnectorAccount['system'], actorId: string): string {
  const db = getMaestriaDb()
  const state = generateId(`oauth_${system}`)
  db.prepare('INSERT INTO connector_oauth_states (state, system, actor_id, created_at) VALUES (?, ?, ?, ?)').run(
    state,
    system,
    actorId,
    new Date().toISOString(),
  )
  return state
}

export function consumeConnectorOAuthState(state: string): { system: ConnectorAccount['system']; actorId: string } | null {
  const db = getMaestriaDb()
  const row = db.prepare('SELECT * FROM connector_oauth_states WHERE state = ?').get(state) as SqliteRow | undefined
  if (!row) return null
  db.prepare('DELETE FROM connector_oauth_states WHERE state = ?').run(state)
  return {
    system: row.system as ConnectorAccount['system'],
    actorId: String(row.actor_id),
  }
}

export function createNotification(input: {
  channel: NotificationDelivery['channel']
  recipient: string
  subject: string
  body: string
  status?: NotificationDelivery['status']
  error?: string | null
  deliveredAt?: string | null
  metadata?: Record<string, unknown>
}): NotificationDelivery {
  const db = getMaestriaDb()
  const now = new Date().toISOString()
  const item: NotificationDelivery = {
    id: generateId('notif'),
    channel: input.channel,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    status: input.status ?? 'queued',
    error: input.error ?? null,
    deliveredAt: input.deliveredAt ?? null,
    createdAt: now,
    metadata: input.metadata ?? {},
  }

  db.prepare(
    `INSERT INTO notification_deliveries
      (id, channel, recipient, subject, body, status, error, delivered_at, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.id,
    item.channel,
    item.recipient,
    item.subject,
    item.body,
    item.status,
    item.error,
    item.deliveredAt,
    JSON.stringify(item.metadata),
    item.createdAt,
  )

  return item
}

export function listNotifications(limit = 50): NotificationDelivery[] {
  const db = getMaestriaDb()
  const rows = db.prepare('SELECT * FROM notification_deliveries ORDER BY datetime(created_at) DESC LIMIT ?').all(limit) as SqliteRow[]
  return rows.map((row) => ({
    id: String(row.id),
    channel: row.channel as NotificationDelivery['channel'],
    recipient: String(row.recipient),
    subject: String(row.subject),
    body: String(row.body),
    status: row.status as NotificationDelivery['status'],
    error: row.error ? String(row.error) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    createdAt: String(row.created_at),
    metadata: jsonParse<Record<string, unknown>>(row.metadata_json, {}),
  }))
}

export function createKpiEvent(input: {
  eventName: string
  value: number
  unit: string
  source: string
  occurredAt?: string
  dimensions?: Record<string, unknown>
}): KpiEvent {
  const db = getMaestriaDb()
  const item: KpiEvent = {
    id: generateId('kpi'),
    eventName: input.eventName,
    value: input.value,
    unit: input.unit,
    source: input.source,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    dimensions: input.dimensions ?? {},
  }

  db.prepare(
    `INSERT INTO kpi_events (id, event_name, value, unit, source, occurred_at, dimensions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.id,
    item.eventName,
    item.value,
    item.unit,
    item.source,
    item.occurredAt,
    JSON.stringify(item.dimensions),
  )

  return item
}

export function listKpiEvents(limit = 200): KpiEvent[] {
  const db = getMaestriaDb()
  const rows = db.prepare('SELECT * FROM kpi_events ORDER BY datetime(occurred_at) DESC LIMIT ?').all(limit) as SqliteRow[]
  return rows.map((row) => ({
    id: String(row.id),
    eventName: String(row.event_name),
    value: Number(row.value),
    unit: String(row.unit),
    source: String(row.source),
    occurredAt: String(row.occurred_at),
    dimensions: jsonParse<Record<string, unknown>>(row.dimensions_json, {}),
  }))
}

export function createScreenshotAsset(input: {
  name: string
  route: string
  locale: string
  filePath: string
  status: 'queued' | 'captured' | 'failed'
  capturedAt?: string | null
}): { id: string } {
  const db = getMaestriaDb()
  const id = generateId('asset')
  db.prepare(
    `INSERT INTO screenshot_assets (id, name, route, locale, file_path, status, captured_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.route,
    input.locale,
    input.filePath,
    input.status,
    input.capturedAt ?? null,
    new Date().toISOString(),
  )
  return { id }
}
