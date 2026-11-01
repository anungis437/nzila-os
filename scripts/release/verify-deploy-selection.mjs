#!/usr/bin/env node
/** #1038: fail closed if production omits or substitutes an approved signed target. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const deny = message => { throw new Error('DEPLOY_SELECTION_DENIED: ' + message) }
const NAME = /^[a-z](?!.*--)[a-z0-9-]{0,30}[a-z0-9]$/
const IMAGE = /^nzilacanadaacr\.azurecr\.io\/nzila\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?@sha256:[0-9a-f]{64}$/
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

function indexedTargets(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      !Array.isArray(manifest.deployTargets) || !manifest.deployTargets.length ||
      manifest.deployTargets.length > 32) deny('invalid signed or selected target set')
  const indexed = new Map()
  for (const target of manifest.deployTargets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) deny('malformed target')
    const ids = ['containerAppName', 'app', 'name']
      .filter(key => target[key] !== null && target[key] !== undefined)
      .map(key => target[key])
    const images = ['image', 'imageRef', 'digest']
      .filter(key => target[key] !== null && target[key] !== undefined)
      .map(key => target[key])
    if (!ids.length || ids.some(id => typeof id !== 'string' || !NAME.test(id)) ||
        new Set(ids).size !== 1 || !images.length ||
        images.some(image => typeof image !== 'string' || !IMAGE.test(image)) ||
        new Set(images).size !== 1 || indexed.has(ids[0])) deny('ambiguous signed target')
    indexed.set(ids[0], target)
  }
  return indexed
}

export function verifyDeploySelection(signedManifest, filteredManifest, approvedCsv) {
  if (typeof approvedCsv !== 'string') deny('approved target input missing')
  const approved = approvedCsv.split(',')
  if (!approved.length || approved.length > 32 ||
      approved.some(name => !NAME.test(name)) ||
      new Set(approved).size !== approved.length) deny('approved target identities invalid or duplicated')
  const signed = indexedTargets(signedManifest)
  const selected = indexedTargets(filteredManifest)
  if (selected.size !== approved.length) deny('approved target count does not match selection')
  for (const name of approved) {
    if (!signed.has(name) || !selected.has(name) ||
        !equal(signed.get(name), selected.get(name))) {
      deny('approved target absent or modified relative to signed staging manifest: ' + name)
    }
  }
  return Object.freeze({ approvedCount: approved.length, names: Object.freeze([...approved]) })
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [signedPath, selectedPath, approvedCsv] = process.argv.slice(2)
    if (!signedPath || !selectedPath || !approvedCsv) deny('signed, selected and approved inputs required')
    const signed = JSON.parse(readFileSync(signedPath, 'utf8'))
    const selected = JSON.parse(readFileSync(selectedPath, 'utf8'))
    const result = verifyDeploySelection(signed, selected, approvedCsv)
    console.log('Exact signed-to-approved production selection verified for ' + result.approvedCount + ' target(s)')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'production selection verification failed')
    process.exitCode = 1
  }
}
