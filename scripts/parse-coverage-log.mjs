/**
 * Parse turbo test:coverage log and extract per-project coverage summaries.
 * Usage: node scripts/parse-coverage-log.mjs coverage-run-full.log
 */
import { readFileSync, writeFileSync } from 'node:fs'

const logFile = process.argv[2] || 'coverage-run-full.log'
const content = readFileSync(logFile, 'utf-8')
const lines = content.split('\n')

const results = []

// Each project's coverage is prefixed with @nzila/NAME:test:coverage:
// The "All files" line contains the aggregate for that project
// Format: @nzila/NAME:test:coverage: All files   |   XX.XX |   XX.XX |  XX.XX |  XX.XX |

for (const line of lines) {
  const match = line.match(/^(@nzila\/[\w-]+):test:coverage:\s+All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/)
  if (match) {
    results.push({
      package: match[1],
      statements: parseFloat(match[2]),
      branches: parseFloat(match[3]),
      functions: parseFloat(match[4]),
      lines: parseFloat(match[5]),
    })
  }
}

// Also find projects with "No test files found" or 0/0/0/0
const noTestPackages = []
for (const line of lines) {
  const match = line.match(/^(@nzila\/[\w-]+):test:coverage:\s+No test files found/)
  if (match) noTestPackages.push(match[1])
}

// Sort by statements descending
results.sort((a, b) => b.statements - a.statements)

// Calculate overall weighted average (we'll just do simple average since we don't have line counts)
const avg = (arr, key) => arr.length ? (arr.reduce((s, r) => s + r[key], 0) / arr.length).toFixed(2) : 0

console.log(`\n${'Package'.padEnd(50)} | Stmts | Branch | Funcs | Lines`)
console.log('-'.repeat(50) + ' | ----- | ------ | ----- | -----')
for (const r of results) {
  console.log(`${r.package.padEnd(50)} | ${String(r.statements).padStart(5)} | ${String(r.branches).padStart(6)} | ${String(r.functions).padStart(5)} | ${String(r.lines).padStart(5)}`)
}

console.log('-'.repeat(50) + ' | ----- | ------ | ----- | -----')
console.log(`${'AVERAGE (across projects with code)'.padEnd(50)} | ${avg(results, 'statements').padStart(5)} | ${avg(results, 'branches').padStart(6)} | ${avg(results, 'functions').padStart(5)} | ${avg(results, 'lines').padStart(5)}`)

if (noTestPackages.length) {
  console.log(`\nProjects with NO test files (${noTestPackages.length}):`)
  for (const p of noTestPackages) console.log(`  - ${p}`)
}

// Tier breakdown
const tiers = {
  '100%': results.filter(r => r.statements === 100 && r.branches === 100),
  '90-99%': results.filter(r => r.statements >= 90 && !(r.statements === 100 && r.branches === 100)),
  '70-89%': results.filter(r => r.statements >= 70 && r.statements < 90),
  '50-69%': results.filter(r => r.statements >= 50 && r.statements < 70),
  '25-49%': results.filter(r => r.statements >= 25 && r.statements < 50),
  '1-24%': results.filter(r => r.statements > 0 && r.statements < 25),
  '0%': results.filter(r => r.statements === 0),
}

console.log('\n=== TIER BREAKDOWN ===')
for (const [tier, pkgs] of Object.entries(tiers)) {
  console.log(`\n${tier} (${pkgs.length} projects):`)
  for (const p of pkgs) console.log(`  ${p.package} — ${p.statements}/${p.branches}/${p.functions}/${p.lines}`)
}

console.log(`\nTotal projects with coverage data: ${results.length}`)
console.log(`Total projects with no tests: ${noTestPackages.length}`)
console.log(`Grand total: ${results.length + noTestPackages.length}`)

// Write JSON report
const report = { generated: new Date().toISOString(), results, noTestPackages, tiers: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, v.map(r => r.package)])) }
writeFileSync('coverage-report.json', JSON.stringify(report, null, 2))
console.log('\nJSON report written to coverage-report.json')
