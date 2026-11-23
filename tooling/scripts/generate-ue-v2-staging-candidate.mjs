/** One reviewed candidate for the portable release gate and typed approval engine. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(root, 'tooling/scripts/lib/ue-v2-staging-candidate.json')
const target = path.join(root, 'packages/platform-change-management/src/ue-v2-staging-candidate.ts')
const binding = JSON.parse(fs.readFileSync(source, 'utf8'))
assert.deepEqual(Object.keys(binding).sort(), ['applicationSourceSha', 'changeId', 'environment', 'schemaVersion'])
assert.equal(binding.schemaVersion, 1)
assert.equal(binding.changeId, 'CHG-2026-0114')
assert.equal(binding.environment, 'STAGING')
assert.match(binding.applicationSourceSha, /^[a-f0-9]{40}$/)
const expected = [
  '/** Generated from tooling/scripts/lib/ue-v2-staging-candidate.json.',
  ' * Regenerate with node tooling/scripts/generate-ue-v2-staging-candidate.mjs --write.',
  ' * A candidate binding grants no production or technical-gate exception. */',
  `export const UE_V2_REVIEWED_APPLICATION_SOURCE_SHA = ${JSON.stringify(binding.applicationSourceSha)}`,
  '',
].join('\n')
const args = process.argv.slice(2)
assert(args.length === 1 && ['--check', '--write'].includes(args[0]), 'Use --check or --write')
if (args[0] === '--write') fs.writeFileSync(target, expected)
else assert.equal(fs.readFileSync(target, 'utf8'), expected, 'Reviewed staging candidate projection is stale')
