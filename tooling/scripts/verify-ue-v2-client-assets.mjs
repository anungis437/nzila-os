import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { verifyClientScriptManifest } from './lib/ue-v2-client-assets.mjs'

const root = process.argv[2]
assert(root, 'Supply the built .next directory')
const bytes = fs.readFileSync(path.join(root, 'build-manifest.json'))
const manifest = JSON.parse(bytes)
const result = verifyClientScriptManifest(manifest)
for (const file of [...manifest.rootMainFiles, ...(manifest.polyfillFiles ?? []),
  ...Object.values(manifest.rootMainFilesTree ?? {}).flat()]) {
  assert(fs.statSync(path.join(root, file)).isFile(), `Missing script asset: ${file}`)
}
console.log(JSON.stringify({ ...result, purpose: 'BUILT_APP_ROUTER_SCRIPT_ASSETS',
  manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex') }))
