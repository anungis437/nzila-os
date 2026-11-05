/**
 * 0032 is the forward uniqueness control for provider callbacks.
 * It is registered UNQUALIFIED and is not applied here.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SQL = readFileSync(
  path.resolve(__dirname, '../migrations-platform/0032_notification_callback_identity.sql'),
  'utf8',
)

describe('0032 notification callback identity', () => {
  it('refuses duplicate evidence and a second organization without deleting a row', () => {
    expect(SQL).toContain('UNQUALIFIED')
    expect(SQL).toContain('notification_delivery_log does not exist')
    expect(SQL).toContain('Do not delete a row to apply this migration')
    expect(SQL).toContain('Do not choose an owner to apply this migration')
    expect(SQL).toContain('notification_delivery_log_provider_event_uidx')
    expect(SQL).toContain('WHERE external_event_id IS NOT NULL')
    expect(SQL).toContain('pg_advisory_xact_lock')
    expect(SQL).toContain('another organization')
    expect(SQL).toContain('ERRCODE = \'23505\'')
    expect(SQL).not.toMatch(/DROP\s+(TABLE|CONSTRAINT|COLUMN|INDEX|TYPE)/i)
    expect(SQL).not.toMatch(/ALTER TABLE\s+public\.notification_queue/i)
    expect(SQL).toContain('does not change notification_queue')
  })
})
