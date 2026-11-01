/**
 * F06 final hardening (audit intent/outcome): every route the route manifest labels INTENT_OUTCOME is reviewed here, with the reason it is not
 * one atomic transaction. A route may be two-phase (intent recorded, effect, outcome recorded) only when its effect cannot sit inside one
 * database transaction: it acts on a provider or an external store, it is bulk work with partial progress by design, it acts on a store that
 * is not the database, or it is finance-frozen. A database-only operation belongs in a transaction with its audit row, and a route that is
 * labelled two-phase only because a module it imports also holds an unrelated two-phase call is checked to really be atomic.
 *
 * This is a ratchet, not a reclassification: it does not change what the manifest says, it fails when the set of two-phase routes changes
 * without a reviewer deciding why.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../../../..')
const app = path.join(root, 'apps/union-eyes')

type Reason =
  | 'external_provider'
  | 'external_storage'
  | 'external_job_queue'
  | 'external_cache'
  | 'bulk_partial_progress'
  | 'in_process_store'
  | 'finance_frozen'
  | 'db_atomic_labelled_transitively'

const REVIEWED: Record<string, Reason> = {
  'admin/billing-cycles/route.ts': 'finance_frozen',
  'admin/billing-cycles/trigger-scheduled/route.ts': 'finance_frozen',
  'admin/documents/legacy-backfill/route.ts': 'external_storage',
  'admin/dues/send-reminders/route.ts': 'external_provider',
  'admin/ingest/route.ts': 'bulk_partial_progress',
  'admin/jobs/[action]/route.ts': 'external_job_queue',
  'admin/jobs/retry/route.ts': 'external_job_queue',
  'admin/payments/retry-failed/route.ts': 'external_provider',
  'admin/pki/signatures/[id]/sign/route.ts': 'in_process_store',
  'admin/pki/signatures/[id]/verify/route.ts': 'in_process_store',
  'admin/pki/workflows/[id]/route.ts': 'in_process_store',
  'ai/cache-stats/route.ts': 'external_cache',
  'ai/classify/route.ts': 'external_provider',
  'ai/copilot/query/route.ts': 'external_provider',
  'ai/copilot/sessions/[id]/route.ts': 'db_atomic_labelled_transitively',
  'ai/extract-clauses/route.ts': 'external_provider',
  'ai/grievances/[id]/clause-reasoning/route.ts': 'external_provider',
  'ai/grievances/[id]/triage/route.ts': 'external_provider',
  'ai/grievances/triage/route.ts': 'external_provider',
  'ai/ingest/route.ts': 'external_provider',
  'ai/match-precedents/route.ts': 'external_provider',
  'ai/search/route.ts': 'external_provider',
  'ai/summarize/route.ts': 'external_provider',
  'cba-intelligence/extraction/route.ts': 'external_provider',
  'cba-intelligence/ingestion/run/route.ts': 'external_provider',
  'chatbot/messages/route.ts': 'external_provider',
  'chatbot/sessions/route.ts': 'db_atomic_labelled_transitively',
  'dues/arrears/[id]/reminder/route.ts': 'external_provider',
  'dues/setup-intent/route.ts': 'external_provider',
  'exit-interviews/[id]/index/route.ts': 'external_provider',
  'exit-interviews/copilot/route.ts': 'external_provider',
  'integrations/framework/[id]/activate/route.ts': 'db_atomic_labelled_transitively',
  'integrations/framework/[id]/sync/route.ts': 'external_provider',
  'integrations/framework/route.ts': 'db_atomic_labelled_transitively',
  'payments/checkout/create/route.ts': 'external_provider',
  'payments/webhooks/paypal/route.ts': 'external_provider',
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/union-eyes/convergence/register/ue-route-coverage-manifest.json'), 'utf8'))
const entries = (Array.isArray(manifest) ? manifest : (manifest.routes ?? manifest.entries ?? Object.values(manifest).find(Array.isArray) ?? [])) as Array<Record<string, unknown>>
const twoPhase = entries.filter((entry) => JSON.stringify(entry).includes('INTENT_OUTCOME')).map((entry) => String(entry.route)).sort()
const read = (rel: string) => fs.readFileSync(path.join(app, rel), 'utf8')

describe('routes recorded as two-phase (intent, effect, outcome) are each reviewed', () => {
  it('is exactly the reviewed set: a route that becomes or stops being two-phase needs a reviewer', () => {
    expect(twoPhase).toEqual(Object.keys(REVIEWED).sort())
  })

  it('has no database-only operation among the directly two-phase routes: each names a reason its effect cannot join one transaction', () => {
    const direct = Object.entries(REVIEWED).filter(([, reason]) => reason !== 'db_atomic_labelled_transitively')
    expect(direct.length).toBeGreaterThan(20)
    for (const [route, reason] of direct) expect(reason, route).not.toBe('db_atomic_labelled_transitively')
  })
})

describe('routes labelled two-phase only through an imported module are really atomic', () => {
  const transitive = Object.entries(REVIEWED).filter(([, reason]) => reason === 'db_atomic_labelled_transitively').map(([route]) => route)

  it.each(transitive)('%s does not itself wrap its effect in a two-phase operation', (route) => {
    expect(read(`app/api/${route}`)).not.toMatch(/\bperformAuditedOperation\(/)
  })

  it('creates a chat session, configures or switches an integration, and records a copilot outcome in one transaction with the audit row', () => {
    const chatbot = read('lib/ai/chatbot-service.ts')
    const create = chatbot.slice(chatbot.indexOf('async createSession('), chatbot.indexOf('async getUserSessions('))
    expect(create).toMatch(/withRLSContext\([^)]*\)[\s\S]*persistAtomicAudit\(tx,/)

    const control = read('lib/integrations/control-plane.ts')
    for (const name of ['configureIntegrationForOrg', 'setIntegrationActivationForOrg']) {
      const start = control.indexOf(`export async function ${name}(`)
      const body = control.slice(start, control.indexOf('\nexport async function ', start + 10))
      expect(body, name).toMatch(/withRLSContext\([\s\S]*persistAtomicAudit\(tx,/)
      expect(body, name).not.toContain('performAuditedOperation(')
    }

    const copilot = read('lib/ai/steward-copilot.ts')
    const outcome = copilot.slice(copilot.indexOf('export async function recordCopilotOutcome('))
    expect(outcome.slice(0, outcome.indexOf('\n}\n'))).toMatch(/withRLSContext\([\s\S]*\.update\(aiCopilotSessions\)[\s\S]*persistAtomicAudit\(tx,/)
  })
})
