import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../../', import.meta.url)

test('tracked migration requirements never supply credential defaults', () => {
  const content = readFileSync(new URL('packages/automation/generators/infra/.env.migration', root), 'utf8')
  const activeLines = content.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'))
  assert.deepEqual(activeLines, [], 'Migration credentials must come from the operator environment, never this tracked file')
  for (const name of ['ABR_SOURCE_URL', 'ABR_TARGET_URL', 'UE_SOURCE_URL', 'UE_TARGET_URL']) {
    assert.ok(content.includes(name), `Required environment contract lost: ${name}`)
  }
})

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonical(entry)]))
  return value
}

test('historical scan evidence retains every finding without republishing matched credentials', () => {
  const report = JSON.parse(readFileSync(fileURLToPath(new URL('reports/security/gitleaks-report.json', root)), 'utf8'))
  assert.equal(report.length, 26)
  for (const finding of report) {
    assert.equal(finding.Match, '[REDACTED]', 'Raw matched content must not be stored in the public scan report')
    assert.equal(finding.Secret, '[REDACTED]', 'Raw credentials must not be stored in the public scan report')
  }
  const metadata = report.map(({ Match: _match, Secret: _secret, ...finding }) => finding)
  const digest = createHash('sha256').update(JSON.stringify(canonical(metadata))).digest('hex')
  assert.equal(digest, 'd852d862afc2b64fdd5d187fac87b593d960d47413ad4e6d445f7b274c772731', 'Redaction must preserve every original non-secret finding field')
})
