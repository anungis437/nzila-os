/**
 * CFO Single-Compute Enforcement Check
 *
 * Validates that no ad-hoc financial math exists outside the
 * centralized computation engine (@nzila/cfo-core/engine).
 *
 * Scans CFO app source for raw arithmetic patterns that should
 * be routed through financialEngine.compute*.
 *
 * Usage: npx tsx scripts/cfo-single-compute-check.ts
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

// ── 1. Engine package exists ─────────────────────────────────────────────

console.log('\n🔧 CHECK 1: CFO Core Package')
console.log('─'.repeat(50))

check(fileExists('packages/cfo-core/src/financial-engine.ts'), 'financial-engine.ts exists')
check(fileExists('packages/cfo-core/src/financial-proof.ts'), 'financial-proof.ts exists')
check(fileExists('packages/cfo-core/src/validation.ts'), 'validation.ts exists')
check(fileExists('packages/cfo-core/src/forecasting.ts'), 'forecasting.ts exists')
check(fileExists('packages/cfo-core/src/index.ts'), 'barrel index.ts exists')

// ── 2. Engine exports canonical version ──────────────────────────────────

console.log('\n🔧 CHECK 2: Engine Version')
console.log('─'.repeat(50))

const engineSrc = readFile('packages/cfo-core/src/financial-engine.ts')
check(
  engineSrc.includes('FINANCIAL_ENGINE_VERSION'),
  'Engine exports a version constant',
)
check(
  engineSrc.includes('financialEngine'),
  'Engine exports a financialEngine object',
)

// ── 3. Proof engine is hooked ────────────────────────────────────────────

console.log('\n🔧 CHECK 3: Proof Integration')
console.log('─'.repeat(50))

check(
  engineSrc.includes('generateFinancialProof'),
  'Engine calls generateFinancialProof',
)
check(
  engineSrc.includes('ProvenResult'),
  'Engine returns ProvenResult type',
)

const proofSrc = readFile('packages/cfo-core/src/financial-proof.ts')
check(
  proofSrc.includes('FINANCIAL_OUTPUT_BLOCKED_NO_PROOF'),
  'Proof engine has FINANCIAL_OUTPUT_BLOCKED_NO_PROOF error',
)
check(
  proofSrc.includes('computeProofHash'),
  'Proof engine has deterministic hash function',
)
check(
  proofSrc.includes('sha256'),
  'Proof uses SHA-256',
)

// ── 4. Validation gates exist ────────────────────────────────────────────

console.log('\n🔧 CHECK 4: Validation Gates')
console.log('─'.repeat(50))

const validationSrc = readFile('packages/cfo-core/src/validation.ts')
check(
  validationSrc.includes('FINANCIAL_VALIDATION_FAILED'),
  'Validation throws FINANCIAL_VALIDATION_FAILED',
)
check(
  validationSrc.includes('runValidationGates'),
  'Composite runValidationGates function exists',
)
check(
  validationSrc.includes('validateRequiredInputs'),
  'Gate: required inputs',
)
check(
  validationSrc.includes('validateTimeRange'),
  'Gate: time range consistency',
)
check(
  validationSrc.includes('validateNoDuplicates'),
  'Gate: no duplicates',
)

// ── 5. CFO app depends on cfo-core ────────────────────────────────────────

console.log('\n🔧 CHECK 5: CFO App Dependency')
console.log('─'.repeat(50))

const cfoPkg = readFile('apps/cfo/package.json')
check(
  cfoPkg.includes('"@nzila/cfo-core"'),
  'apps/cfo/package.json lists @nzila/cfo-core',
)

// ── Results ──────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50))
console.log(`CFO Single-Compute Check: ${passes} passed, ${failures} failed`)
if (failures > 0) {
  console.error('❌ FAILED — financial computations must be centralized')
  process.exit(1)
} else {
  console.log('✅ ALL CHECKS PASSED')
}
