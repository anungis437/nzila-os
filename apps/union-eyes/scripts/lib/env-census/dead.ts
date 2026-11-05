/**
 * Code that reads environment variables and that nothing runs (UE-CONV-H-024): not part of the configuration the application has.
 *
 * A module nobody calls reads a variable for nobody. Counting it would make `.env.example` and the registry tell an operator that Square payments, Twilio SMS, a
 * chaos monkey or a CLC partner API can be configured, when no route, page or job can reach the code that would use them. The right fix is to delete the module,
 * and most of the modules that were found dead were deleted with this census. These are the ones that could not be deleted by the change that introduced the
 * census, because a file outside it (the storage-authority registry under db/, the capability registry, the convergence manifests, an acceptance ledger) names them
 * by path and is owned by someone else; each says what blocks it. The census does not read them, and holds three things:
 *
 *   1. each file still exists (a deleted module leaves this register, so the register can only shrink: the end state is empty);
 *   2. nothing new imports it: the importers recorded here are the only non-test ones, so wiring a dead module back in fails the census until the
 *      dead-code proof is redone (`pnpm census:env --reach` computes, for every declaration of the application, whether a route, a page, a layout, middleware,
 *      instrumentation, a server action or a script can reach it, and fails when a registered module has a declaration that can be reached);
 *   3. under `--reach`, every environment read that nothing can reach is either in a registered module or a finding.
 */
import ts from 'typescript'
import { resolveSpecifier } from './collect'

export interface DeadModule {
  /** A file, or a directory when it ends in `/`, relative to apps/union-eyes. */
  path: string
  /** The non-test files that import it today (all of them dead, or importing without using it). */
  importers: readonly string[]
  /** What stops this change from deleting it. */
  blockedBy: string
}

const STORAGE_AUTHORITY = 'named by path in db/rls-storage-authority/** (owned by the RLS storage-authority work)'
const CAPABILITY_REGISTRY = 'named in lib/reality/capability-registry.ts (owned by the capability ledger)'
const CONVERGENCE_GATE = 'named by path in tooling/scripts/lib/ue-gate0*-facts.mjs, the convergence manifests or db/rls-storage-authority/**'

export const DEAD_MODULES: readonly DeadModule[] = [
  { path: 'lib/stripe-elements.ts', importers: ['components/public/donation-page.tsx', 'components/public/event-registration-page.tsx'], blockedBy: `imported by two public pages that do not use it to take a payment; ${CAPABILITY_REGISTRY}` },
  { path: 'lib/address/address-service.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/ai/services/rate-limiter.ts', importers: ['lib/ai/services/cost-tracking-wrapper.ts'], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/api/certification-management-service-api.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/api/lmbp-immigration-service-api.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/api/schema-api.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/api/signature-service-api.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/api/tax-slip-service-api.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/api/workflows.test-api.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/chaos-engineering/', importers: [], blockedBy: 'a directory of experiments no route, page or script starts; delete with its tests once the chaos register agrees' },
  { path: 'lib/database/multi-db-client.ts', importers: ['db/db.ts'], blockedBy: 'imported by db/db.ts without being used there; db/ is the storage-authority surface' },
  { path: 'lib/document-management-system.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/ml-client.ts', importers: ['lib/useUEMlSignals.ts'], blockedBy: 'imported by a hook no component uses' },
  { path: 'lib/payment-processor/', importers: [], blockedBy: `the payment-processor factory (Stripe, PayPal, Square, manual adapters) is built by nothing; ${STORAGE_AUTHORITY}` },
  { path: 'lib/services/break-glass-service.ts', importers: ['lib/services/index.ts'], blockedBy: 'exported from the services barrel, which nothing imports for it' },
  { path: 'lib/services/external-data/clc-partnership-service.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'lib/services/external-data/lrb-unified-service.ts', importers: [], blockedBy: CONVERGENCE_GATE },
  { path: 'lib/services/rewards/webhook-service.ts', importers: ['app/api/integrations/shopify/webhooks/route.ts', 'app/api/payments/webhooks/paypal/route.ts', 'lib/services/rewards/index.ts'], blockedBy: `imported by two routes that use other exports of it; ${STORAGE_AUTHORITY}` },
  { path: 'lib/services/signature-providers.ts', importers: ['lib/document-management-system.ts', 'lib/services/signature-workflow-service.ts'], blockedBy: 'imported by the dead document-management-system and a workflow service no route uses' },
  { path: 'lib/services/transfer-pricing-service.ts', importers: ['app/api/billing/validate/route.ts'], blockedBy: `the route uses other exports of it; ${STORAGE_AUTHORITY}` },
  { path: 'lib/tracing/opentelemetry.ts', importers: ['lib/tracing/index.ts'], blockedBy: 'a second OpenTelemetry bootstrap beside @nzila/os-core/telemetry; its barrel is imported by nothing live' },
  { path: 'lib/tracing/utils.ts', importers: ['lib/tracing/index.ts'], blockedBy: 'see lib/tracing/opentelemetry.ts' },
  { path: 'lib/webhook-security.ts', importers: [], blockedBy: 'listed as evidence in scripts/acceptance/acceptance-ledger.ts' },
  { path: 'lib/workers/cleanup-worker.ts', importers: [], blockedBy: `orphaned by the move of background jobs to Django Celery (see lib/job-queue.ts); ${STORAGE_AUTHORITY}` },
  { path: 'lib/workers/report-worker.ts', importers: [], blockedBy: `orphaned by the move of background jobs to Django Celery (see lib/job-queue.ts); ${STORAGE_AUTHORITY}` },
  { path: 'services/break-glass-service.ts', importers: ['services/force-majeure-integration.ts'], blockedBy: CONVERGENCE_GATE },
  { path: 'services/clc/clc-api-integration.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'services/clc/remittance-notifications.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'services/currency-enforcement-service.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'services/fcm-service.ts', importers: [], blockedBy: CONVERGENCE_GATE },
  { path: 'services/tax-slip-service.ts', importers: [], blockedBy: STORAGE_AUTHORITY },
  { path: 'services/twilio-sms-service.ts', importers: ['services/clc/remittance-notifications.ts'], blockedBy: `imported by the dead CLC remittance notifications; ${CONVERGENCE_GATE}` },
]

export const isDeadModule = (file: string): boolean => DEAD_MODULES.some((entry) => (entry.path.endsWith('/') ? file.startsWith(entry.path) : file === entry.path))

export interface DeadFinding {
  kind: 'DEAD_MODULE_GONE' | 'DEAD_MODULE_IMPORTED'
  name: string
  detail: string
}

const TEST_FILE = /(__tests__|\.test\.|\.spec\.|\/tests?\/)/

/** The register against the files that exist: a registered module that is gone leaves the register, and one that gained an importer is no longer known to be dead. */
export function checkDeadModules(sources: ReadonlyArray<{ file: string; text: string }>, register: readonly DeadModule[] = DEAD_MODULES): DeadFinding[] {
  const files = new Set(sources.map((source) => source.file))
  const findings: DeadFinding[] = []
  const matches = (entry: DeadModule, file: string): boolean => (entry.path.endsWith('/') ? file.startsWith(entry.path) : file === entry.path)
  for (const entry of register) if (![...files].some((file) => matches(entry, file))) findings.push({ kind: 'DEAD_MODULE_GONE', name: entry.path, detail: 'no longer exists: remove it from DEAD_MODULES' })

  const importedBy = new Map<string, Set<string>>()
  for (const source of sources) {
    if (TEST_FILE.test(source.file)) continue
    for (const imported of ts.preProcessFile(source.text, true, true).importedFiles) {
      const target = resolveSpecifier(source.file, imported.fileName, files)
      if (!target) continue
      const set = importedBy.get(target) ?? new Set<string>()
      set.add(source.file)
      importedBy.set(target, set)
    }
  }
  for (const entry of register) {
    const allowed = new Set(entry.importers)
    for (const [target, importers] of importedBy) {
      if (!matches(entry, target)) continue
      for (const importer of importers) {
        // Files of the same dead directory, and of other registered modules, import each other freely.
        if (matches(entry, importer) || allowed.has(importer) || register.some((other) => matches(other, importer))) continue
        findings.push({ kind: 'DEAD_MODULE_IMPORTED', name: entry.path, detail: `${importer} imports ${target}: a module in DEAD_MODULES gained an importer, so it is no longer known to be dead (run \`pnpm census:env --reach\`)` })
      }
    }
  }
  return findings
}
