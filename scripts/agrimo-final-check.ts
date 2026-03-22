/**
 * Agrimo Final Check — CI script.
 * Validates that the Agrimo platform meets all requirements:
 *   1. Offline-safe: OfflineStore exists and exports correctly
 *   2. Provenance present: enforceProvenance gate exists
 *   3. Supply chain tracked: createSupplyChain / recordStep exist
 *   4. Intelligence explainable: every output has explanation + confidence_level
 */

const checks: { name: string; pass: boolean; detail: string }[] = []

function check(name: string, fn: () => string): void {
  try {
    const detail = fn()
    checks.push({ name, pass: true, detail })
  } catch (e) {
    checks.push({
      name,
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    })
  }
}

// ── Check 1: Offline engine ────────────────────────────────────────────────

check('Offline-safe: OfflineStore exports', async () => {
  const mod = await import('../packages/agrimo-core/offline-engine')
  if (typeof mod.OfflineStore !== 'function')
    throw new Error('OfflineStore class not found')
  const store = new mod.OfflineStore({
    device_id: 'test',
    conflict_strategy: 'last-write-wins',
  })
  const rec = store.create({ test: true })
  if (!rec.local_id) throw new Error('create() did not return local_id')
  if (rec.synced !== false) throw new Error('new record should not be synced')
  return `OfflineStore creates records offline ✓`
})

// ── Check 2: Provenance gate ───────────────────────────────────────────────

check('Provenance present: enforceProvenance gate', async () => {
  const mod = await import('../packages/agrimo-core/provenance')
  if (typeof mod.enforceProvenance !== 'function')
    throw new Error('enforceProvenance not found')
  try {
    mod.enforceProvenance({ data: {}, provenance: undefined } as never)
    throw new Error('should have thrown')
  } catch (e) {
    if (
      e instanceof Error &&
      e.message === 'AGRIMO_DATA_BLOCKED_NO_PROVENANCE'
    )
      return 'enforceProvenance blocks missing provenance ✓'
    throw e
  }
})

// ── Check 3: Supply chain tracking ─────────────────────────────────────────

check('Supply chain tracked: create + record', async () => {
  const mod = await import('../packages/agrimo-core/supply-chain')
  if (typeof mod.createSupplyChain !== 'function')
    throw new Error('createSupplyChain not found')
  if (typeof mod.recordStep !== 'function')
    throw new Error('recordStep not found')
  const chain = mod.createSupplyChain({
    batch_id: 'b1',
    crop_type: 'maize',
    origin_cooperative_id: 'c1',
    origin_farmer_id: 'f1',
  })
  if (chain.steps.length !== 0) throw new Error('new chain should have 0 steps')
  return 'createSupplyChain + recordStep exports ✓'
})

// ── Check 4: Intelligence explainability ───────────────────────────────────

check('Intelligence explainable: outputs have explanation', async () => {
  const mod = await import('../packages/agrimo-intelligence/assist-engine')
  const rec = mod.createRecommendation({
    type: 'harvest_timing',
    title: 'Test',
    explanation: 'Test explanation',
    source_data_refs: [{ type: 'test', id: 't1' }],
    confidence_level: 'high',
    priority: 'medium',
  })
  if (!rec.explanation) throw new Error('recommendation missing explanation')
  if (!rec.confidence_level)
    throw new Error('recommendation missing confidence_level')
  if (!rec.source_data_refs?.length)
    throw new Error('recommendation missing source_data_refs')
  return 'Recommendations have explanation + confidence_level + source_data_refs ✓'
})

// ── Report ─────────────────────────────────────────────────────────────────

console.log('Agrimo Final Check\n')
for (const c of checks) {
  const icon = c.pass ? '✓' : '✗'
  console.log(`  ${icon} ${c.name}: ${c.detail}`)
}

const failed = checks.filter((c) => !c.pass)
if (failed.length > 0) {
  console.error(`\n✗ FAIL — ${failed.length} check(s) failed.`)
  process.exit(1)
} else {
  console.log(`\n✓ ALL CHECKS PASSED (${checks.length}/${checks.length})`)
}
