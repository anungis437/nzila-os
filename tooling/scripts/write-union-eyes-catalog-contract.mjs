#!/usr/bin/env node
/**
 * Regenerates the packaged catalog contract from the reviewed storage-authority
 * source. The Next.js app imports the JSON. It does not read this script.
 * The payload comes from the same function the bootstrap verifier uses to check
 * that the packaged contract is current, so the two cannot drift apart.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contractFromManifest, loadAuthorityManifest } from './lib/union-eyes-catalog-authority.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const destination = path.join(repoRoot, 'apps/union-eyes/lib/operations/catalog-authority-contract.json')
const contract = contractFromManifest(loadAuthorityManifest(repoRoot))
fs.writeFileSync(destination, `${JSON.stringify(contract)}\n`)
process.stdout.write(`${destination} ${contract.payload.entries.length} entries ${contract.digest}\n`)