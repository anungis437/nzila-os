/** Regenerate the existing canonical overlay; the historical base stays intact. */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hash, type V2Plan } from '../../apps/union-eyes/scripts/bootstrap-v2/source'
import { currentSecurityProjection, loadCurrentSecurityPlan } from './lib/union-eyes-current-security-programs'
import historicalContract from '../../apps/union-eyes/lib/operations/catalog-authority-contract.json'
import { catalogContractDigest } from '../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'

export async function buildCurrentCatalogOverlay(plan: V2Plan) {
  const projection = await currentSecurityProjection(plan)
  const entries = projection.security.rules.filter(rule => !rule.table.includes('.')).map(rule => ({
    table: rule.table, classification: rule.classification,
    runtime: rule.runtimePrivileges, system: rule.systemPrivileges,
    decision: rule.source,
  })).sort((a, b) => a.table.localeCompare(b.table))
  if (catalogContractDigest(historicalContract.payload) !== historicalContract.digest)
    throw new Error('Historical catalog source contract digest differs')
  const currentNames = new Set(entries.map(entry => entry.table))
  for (const entry of historicalContract.payload.entries) {
    if (currentNames.has(entry.table)) continue
    entries.push({ table: entry.table, classification: 'CONTAINED_NO_AUTHORITY', runtime: [], system: [], decision: 'Known historical storage object has no current source authority; preserve rows and deny application grants.' })
  }
  entries.push({ table: 'ue_v2_bootstrap_receipt', classification: 'CONTAINED_NO_AUTHORITY', runtime: [], system: [], decision: 'Installer receipt has no business authority.' })
  entries.sort((a,b) => a.table.localeCompare(b.table))
  return {
    note: 'Current canonical privilege and persistence decisions compiled from the source-bound V2 plan and actual auth/framework/case compilers. The historical storage-authority manifest and base catalog contract are unchanged. This artifact records source authority, not runtime or customer acceptance.',
    entries,
    currentSecurity: {
      contractVersion: '1', sourcePlanDigest: hash(JSON.stringify(plan)),
      currentFunctions: projection.functions,
      approvedColumnGrants: projection.columnGrants,
      dedicatedRolePrivileges: projection.tableGrants.filter(grant => /^(nzila_auth_|ue_framework_)/.test(grant.role)),
      requiredSessionPolicy: projection.requiredSessionPolicy,
      requiredContainedParentPolicies: projection.requiredContainedParentPolicies,
      requiredPhysicalTriggers: projection.requiredPhysicalTriggers,
      nonPublic: [
        ...plan.tables.filter(table => table.name.startsWith('user_management.')).map(table => ({ schema: 'user_management', table: table.name.split('.')[1], runtime: [], system: [] })),
        { schema: 'audit_security', table: 'audit_logs', runtime: [], system: [] },
      ],
      runtimeSchemaUsage: ['public', 'user_management'], systemSchemaUsage: ['public'],
    },
  }
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const output = path.join(root, 'apps/union-eyes/lib/operations/catalog-v2-decisions.json')
  const compiled = JSON.stringify(await buildCurrentCatalogOverlay(loadCurrentSecurityPlan(root)), null, 2) + '\n'
  if (process.argv.includes('--write')) writeFileSync(output, compiled)
  else if (readFileSync(output, 'utf8') !== compiled) throw new Error('Current canonical catalog overlay differs from its source compilers')
  process.stdout.write('Current canonical catalog overlay matches its source compilers\n')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch(error => { console.error(error); process.exitCode = 1 })
