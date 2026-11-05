import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { auditGap, kernelPending, scanRoutes, summarize } from './lib/route-coverage-scan'

const root = join(__dirname, '..')
const register = join(root, '..', '..', 'docs', 'union-eyes', 'convergence', 'register')
const entries = scanRoutes(root)

writeFileSync(join(register, 'ue-route-coverage-manifest.json'), `${JSON.stringify({ register: 'UE-CONV-K-008', summary: summarize(entries), routes: entries }, null, 1)}\n`)

// Baselines only ever shrink: a rebase is explicit, and the ordinary run drops entries that no longer apply.
const baselines = join(register, 'ue-route-coverage-baselines.json')
const names = (pick: (e: (typeof entries)[number]) => boolean) => entries.filter(pick).map((e) => e.route)
if (process.argv.includes('--rebase-baselines') || !existsSync(baselines)) {
  writeFileSync(baselines, `${JSON.stringify({ register: 'UE-CONV-K-008', auditGap: names(auditGap), kernelPending: names(kernelPending) }, null, 1)}\n`)
} else {
  const current = JSON.parse(readFileSync(baselines, 'utf8')) as { auditGap: string[]; kernelPending: string[] }
  const still = (list: string[], pick: (e: (typeof entries)[number]) => boolean) => list.filter((route) => entries.some((e) => e.route === route && pick(e)))
  writeFileSync(baselines, `${JSON.stringify({ register: 'UE-CONV-K-008', auditGap: still(current.auditGap, auditGap), kernelPending: still(current.kernelPending, kernelPending) }, null, 1)}\n`)
}
console.log(JSON.stringify(summarize(entries), null, 1))
