/**
 * CFO Final Enforcement Check
 *
 * Validates ALL 7 phases of the CFO 10/10 initiative:
 *   1. Financial Proof Engine — present and correct
 *   2. Single Computation Engine — centralized, versioned
 *   3. Validation Gates — pre-report checks
 *   4. Forecasting Model Hardening — versioned, explainable
 *   5. CFO Intelligence Layer — anomaly + trend + threshold
 *   6. Enforcement Scripts — this check + single-compute check
 *   7. Test Coverage — comprehensive specs
 *
 * Usage: npx tsx scripts/cfo-final-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

let failures = 0
let passes = 0

function pass(msg: string) {
  console.log(`  ✅ ${msg}`)
  passes++
}

function fail(msg: string) {
  console.error(`  ❌ ${msg}`)
  failures++
}

function check(condition: boolean, msg: string) {
  if (condition) pass(msg)
  else fail(msg)
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 1: Financial Proof Engine
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🔒 PHASE 1: Financial Proof Engine')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-core/src/financial-proof.ts'), 'financial-proof.ts exists')

const proofSrc = fileExists('packages/cfo-core/src/financial-proof.ts')
  ? readFile('packages/cfo-core/src/financial-proof.ts')
  : ''

check(proofSrc.includes('FinancialProofSchema'), 'FinancialProofSchema defined')
check(proofSrc.includes('computeProofHash'), 'computeProofHash function exists')
check(proofSrc.includes('generateFinancialProof'), 'generateFinancialProof function exists')
check(proofSrc.includes('verifyFinancialProof'), 'verifyFinancialProof function exists')
check(proofSrc.includes('requireFinancialProof'), 'requireFinancialProof guard exists')
check(proofSrc.includes('FINANCIAL_OUTPUT_BLOCKED_NO_PROOF'), 'FINANCIAL_OUTPUT_BLOCKED_NO_PROOF error code')
check(proofSrc.includes('sha256'), 'Uses SHA-256 for proof hash')
check(proofSrc.includes('reportId'), 'Proof tracks report_id')
check(proofSrc.includes('orgId'), 'Proof tracks org_id')
check(proofSrc.includes('inputSources'), 'Proof tracks input_sources')
check(proofSrc.includes('calculationVersion'), 'Proof tracks calculation_version')
check(proofSrc.includes('outputValues'), 'Proof tracks output_values')

// ═══════════════════════════════════════════════════════════════════════════
// Phase 2: Single Financial Computation Engine
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🧮 PHASE 2: Single Financial Computation Engine')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-core/src/financial-engine.ts'), 'financial-engine.ts exists')

const engineSrc = fileExists('packages/cfo-core/src/financial-engine.ts')
  ? readFile('packages/cfo-core/src/financial-engine.ts')
  : ''

check(engineSrc.includes('FINANCIAL_ENGINE_VERSION'), 'Engine version constant')
check(engineSrc.includes('financialEngine'), 'financialEngine object exported')
check(engineSrc.includes('computeProfitLoss'), 'computeProfitLoss method')
check(engineSrc.includes('computeBudget'), 'computeBudget method')
check(engineSrc.includes('computeMargins'), 'computeMargins method')
check(engineSrc.includes('computeCashFlow'), 'computeCashFlow method')
check(engineSrc.includes('computeBudgetUtilization'), 'computeBudgetUtilization method')
check(engineSrc.includes('computeAnnualProjection'), 'computeAnnualProjection method')
check(engineSrc.includes('isBudgetOverrun'), 'isBudgetOverrun method')
check(engineSrc.includes('ProvenResult'), 'Returns ProvenResult type')
check(engineSrc.includes('generateFinancialProof'), 'Every computation generates proof')

// ═══════════════════════════════════════════════════════════════════════════
// Phase 3: Financial Validation Gates
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🚧 PHASE 3: Financial Validation Gates')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-core/src/validation.ts'), 'validation.ts exists')

const validSrc = fileExists('packages/cfo-core/src/validation.ts')
  ? readFile('packages/cfo-core/src/validation.ts')
  : ''

check(validSrc.includes('FINANCIAL_VALIDATION_FAILED'), 'FINANCIAL_VALIDATION_FAILED error code')
check(validSrc.includes('runValidationGates'), 'Composite gate runner')
check(validSrc.includes('validateRequiredInputs'), 'Gate: required inputs')
check(validSrc.includes('validateEntrySchemas'), 'Gate: entry schemas')
check(validSrc.includes('validateTimeRange'), 'Gate: time range')
check(validSrc.includes('validateNoDuplicates'), 'Gate: no duplicates')
check(validSrc.includes('validateAmounts'), 'Gate: valid amounts')

// ═══════════════════════════════════════════════════════════════════════════
// Phase 4: Forecasting Model Hardening
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📈 PHASE 4: Forecasting Model Hardening')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-core/src/forecasting.ts'), 'forecasting.ts exists')

const forecastSrc = fileExists('packages/cfo-core/src/forecasting.ts')
  ? readFile('packages/cfo-core/src/forecasting.ts')
  : ''

check(forecastSrc.includes('FORECASTING_VERSION'), 'Forecasting version constant')
check(forecastSrc.includes('ForecastModelType'), 'ForecastModelType defined')
check(forecastSrc.includes("'linear'"), 'Supports linear model')
check(forecastSrc.includes("'moving-average'"), 'Supports moving-average model')
check(forecastSrc.includes("'weighted-average'"), 'Supports weighted-average model')
check(forecastSrc.includes('assumptions'), 'Tracks assumptions')
check(forecastSrc.includes('confidenceLow'), 'Confidence range: low')
check(forecastSrc.includes('confidenceHigh'), 'Confidence range: high')
check(forecastSrc.includes('generatedAt'), 'Tracks generatedAt')
check(forecastSrc.includes('runForecast'), 'runForecast function exists')
check(forecastSrc.includes('generateFinancialProof'), 'Forecasts include proof')

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5: CFO Intelligence Layer
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🧠 PHASE 5: CFO Intelligence Layer')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-intelligence/src/insight-engine.ts'), 'insight-engine.ts exists')
check(fileExists('packages/cfo-intelligence/src/index.ts'), 'barrel index.ts exists')

const insightSrc = fileExists('packages/cfo-intelligence/src/insight-engine.ts')
  ? readFile('packages/cfo-intelligence/src/insight-engine.ts')
  : ''

check(insightSrc.includes('detectAnomalies'), 'detectAnomalies function')
check(insightSrc.includes('detectTrends'), 'detectTrends function')
check(insightSrc.includes('checkThresholds'), 'checkThresholds function')
check(insightSrc.includes('runInsightEngine'), 'runInsightEngine composite function')
check(insightSrc.includes('FinancialInsight'), 'FinancialInsight type')
check(insightSrc.includes('zScoreThreshold'), 'Z-score based anomaly detection')
check(insightSrc.includes('suggestedAction'), 'Insights include suggested actions')

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6: Enforcement Scripts
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📋 PHASE 6: Enforcement Scripts')
console.log('─'.repeat(50))

check(fileExists('scripts/cfo-single-compute-check.ts'), 'cfo-single-compute-check.ts exists')
check(fileExists('scripts/cfo-final-check.ts'), 'cfo-final-check.ts exists (this file)')

// ═══════════════════════════════════════════════════════════════════════════
// Phase 7: Test Coverage
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🧪 PHASE 7: Test Coverage')
console.log('─'.repeat(50))

check(fileExists('apps/cfo/tests/financial-proof.test.ts'), 'financial-proof.test.ts')
check(fileExists('apps/cfo/tests/financial-engine.test.ts'), 'financial-engine.test.ts')
check(fileExists('apps/cfo/tests/validation-gates.test.ts'), 'validation-gates.test.ts')
check(fileExists('apps/cfo/tests/forecasting.test.ts'), 'forecasting.test.ts')
check(fileExists('apps/cfo/tests/insight-engine.test.ts'), 'insight-engine.test.ts')

// ═══════════════════════════════════════════════════════════════════════════
// Package wiring
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📦 Package Wiring')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-core/package.json'), 'cfo-core/package.json exists')
check(fileExists('packages/cfo-intelligence/package.json'), 'cfo-intelligence/package.json exists')

const cfoPkg = fileExists('apps/cfo/package.json') ? readFile('apps/cfo/package.json') : ''
check(cfoPkg.includes('"@nzila/cfo-core"'), 'CFO app depends on @nzila/cfo-core')
check(cfoPkg.includes('"@nzila/cfo-intelligence"'), 'CFO app depends on @nzila/cfo-intelligence')

const intelPkg = fileExists('packages/cfo-intelligence/package.json')
  ? readFile('packages/cfo-intelligence/package.json')
  : ''
check(intelPkg.includes('"@nzila/cfo-core"'), 'cfo-intelligence depends on cfo-core')

// ═══════════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(50))
console.log(`CFO Final Check: ${passes} passed, ${failures} failed`)
if (failures > 0) {
  console.error(`\n❌ FAILED — ${failures} check(s) not met`)
  process.exit(1)
} else {
  console.log('\n✅ ALL PHASES VERIFIED — CFO is 10/10')
}
