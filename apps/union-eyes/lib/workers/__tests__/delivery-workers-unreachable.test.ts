/**
 * The BullMQ email, SMS, and notification workers had no production importer.
 * Importing one started a worker that could send without the delivery ledger.
 * Those entrypoints are retired. Delivery evidence lives on notification_delivery_log.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const APP = path.resolve(__dirname, '../../..')
const RETIRED = [
  'lib/workers/email-worker.ts',
  'lib/workers/sms-worker.ts',
  'lib/workers/notification-worker.ts',
] as const

function productionSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === 'dist' || name === '.next') continue
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      productionSources(full, out)
      continue
    }
    if (!/\.(ts|tsx|mjs|js|cjs)$/.test(name)) continue
    if (/\.(test|spec)\./.test(name)) continue
    out.push(full)
  }
  return out
}

describe('retired delivery workers', () => {
  it('removes the BullMQ senders and leaves no production import', () => {
    for (const relative of RETIRED) {
      expect(existsSync(path.join(APP, relative)), relative).toBe(false)
    }
    const needle = /(?:from|import)\s*(?:\(|['"])[^'"\n]*workers\/(?:email-worker|sms-worker|notification-worker)/
    const hits = productionSources(APP).filter((file) => needle.test(readFileSync(file, 'utf8')))
    expect(hits.map((file) => path.relative(APP, file))).toEqual([])
  })
})
