/**
 * The tenant-context and privilege census (UE-CONV-H-019, UE-CONV-H-023): which database handle each statement runs on, and whether the role it runs as may do what it does.
 *
 * Two judgments over one reading of the program (see lib/tenant-context/analysis.ts for what each means and why no unit test sees either).
 *
 * 1. Context. A statement on the ambient database handle with no tenant or system transaction around it. A finding is a route, page or server action that can reach it
 *    with no context on the way. `TENANT` names a tenant table, which the runtime role shows as empty outside a tenant transaction; `SYSTEM` a system-only table, which it
 *    may not read at all; `UNCLASSIFIED` a statement whose tables could not be resolved (a handle passed on, a raw statement, a table the manifest does not know). Fix a
 *    finding by running the code in a context: `withApi({ rlsOrgContext: true })` for a route whose handler is all tenant work, or `withRLSContext({ organizationId }, ...)`
 *    / `withSystemContext(...)` around the statement.
 *
 * 2. Privilege. Every statement some entry point runs, as the role that runs it (the runtime role in a tenant transaction or on the ambient handle, the system role in the
 *    system context), against `requiredRuntimePrivileges` / `requiredSystemPrivileges` of the storage-authority manifest, which are what the GRANTs are generated from. A
 *    finding is a statement the database answers "permission denied": an UPDATE on a table the role may only read, a tenant transaction reading a system-only table. Fix it in
 *    the code (run it as the role that has the privilege, or stop doing what no role may), or in the manifest when the privilege is needed and was never declared.
 *
 * Read-only: it reads source files and the committed manifest, and needs no database.
 *
 * `--strict` fails on a finding that lib/tenant-context/exemptions.ts does not account for (each exemption names the statement and why it is right) and on an exemption that
 * accounts for no finding. `--mode=legacy` is the gate: a route is handed a tenant transaction only when it asks for one, which is the topology every deployment can be in;
 * the canonical (V2) state hands one to more routes, so zero here is zero there.
 *
 * Usage (from apps/union-eyes; `pnpm run census:tenant-context` does this with the heap it needs):
 *   NODE_OPTIONS=--max-old-space-size=9216 npx tsx scripts/runtime/tenant-context-census.ts [--mode=legacy|v2|both] [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { createAppProgram } from '../lib/sql-census/sites'
import { analyzeAmbientHandle, type AmbientFinding, type AmbientReport, type Mode, type Needs, type PrivilegeFinding, type TableAuthority, type TablePrivileges } from '../lib/tenant-context/analysis'
import { applyExemptions, applyPrivilegeExemptions } from '../lib/tenant-context/exemptions'

export const APP_ROOT = path.resolve(__dirname, '..', '..')

export function manifestAuthority(): (table: string) => TableAuthority | undefined {
  const byTable = new Map<string, TableAuthority>()
  for (const entry of storageAuthorityManifest) byTable.set(entry.table, { classification: entry.classification, principal: entry.dbExecutionPrincipal })
  return (table) => byTable.get(table)
}

/** What each role is granted on each table. An entry whose privileges are still `TBD` is a decision not yet made: nothing can be judged against it. */
export function manifestPrivileges(): (table: string) => TablePrivileges | undefined {
  const byTable = new Map<string, TablePrivileges>()
  for (const entry of storageAuthorityManifest) {
    if (entry.requiredRuntimePrivileges === 'TBD' || entry.requiredSystemPrivileges === 'TBD') continue
    byTable.set(entry.table, { runtime: new Set<string>(entry.requiredRuntimePrivileges), system: new Set<string>(entry.requiredSystemPrivileges) })
  }
  return (table) => byTable.get(table)
}

export function runCensus(modes: Mode[] = ['v2']): Record<Mode, AmbientReport | undefined> {
  const program = createAppProgram(APP_ROOT)
  const authority = manifestAuthority()
  const privileges = manifestPrivileges()
  return {
    v2: modes.includes('v2') ? analyzeAmbientHandle(program, APP_ROOT, authority, 'v2', privileges) : undefined,
    legacy: modes.includes('legacy') ? analyzeAmbientHandle(program, APP_ROOT, authority, 'legacy', privileges) : undefined,
  }
}

export function summarize(findings: AmbientFinding[]): { byNeeds: Record<Needs, number>; files: number; entries: number } {
  const byNeeds: Record<Needs, number> = { TENANT: 0, SYSTEM: 0, OPEN: 0, UNCLASSIFIED: 0 }
  for (const finding of findings) byNeeds[finding.needs] += 1
  return { byNeeds, files: new Set(findings.map((finding) => finding.file)).size, entries: new Set(findings.map((finding) => finding.witness[0])).size }
}

function markdown(report: AmbientReport, privilegeFindings: PrivilegeFinding[]): string {
  const { byNeeds, files, entries } = summarize(report.findings)
  const lines = [
    '# Tenant-context and privilege census',
    '',
    `## Context: ${report.findings.length} statements on the ambient handle with no context, in ${files} files, reached from ${entries} entry points.`,
    '',
    `TENANT ${byNeeds.TENANT} · SYSTEM ${byNeeds.SYSTEM} · UNCLASSIFIED ${byNeeds.UNCLASSIFIED}`,
    '',
    '| File | Line | Method | Tables | Needs | Entry |',
    '| --- | ---: | --- | --- | --- | --- |',
    ...report.findings.map((finding) => `| ${finding.file} | ${finding.line} | ${finding.method} | ${finding.tables.join(', ') || '-'} | ${finding.needs} | ${finding.witness[0]} |`),
    '',
    `## Privilege: ${privilegeFindings.length} statements run as a role that has not been granted what they do (${report.statements} statements judged, ${report.unjudged} could not be fully judged).`,
    '',
    '| File | Line | Role | Table | Operation | Why | Via | Entry |',
    '| --- | ---: | --- | --- | --- | --- | --- | --- |',
    ...privilegeFindings.map((finding) => `| ${finding.file} | ${finding.line} | ${finding.principal} | ${finding.table} | ${finding.operation} | ${finding.reason} | ${finding.via} | ${finding.witness[0]} |`),
  ]
  return lines.join('\n') + '\n'
}

function main(): void {
  const args = process.argv.slice(2)
  const arg = (name: string): string | undefined => args.find((candidate) => candidate.startsWith(`--${name}=`))?.slice(name.length + 3)
  const requested = arg('mode') ?? 'both'
  const reports = runCensus(requested === 'both' ? ['v2', 'legacy'] : [requested as Mode])
  const gate = reports.legacy ?? reports.v2!
  const { open, exempt, stale } = applyExemptions(gate.findings)
  const privilege = applyPrivilegeExemptions(gate.privilegeFindings)
  if (arg('write')) writeFileSync(arg('write')!, JSON.stringify(gate, null, 1))
  if (arg('markdown')) writeFileSync(arg('markdown')!, markdown({ ...gate, findings: open }, privilege.open))
  if (!args.includes('--quiet')) {
    for (const [mode, report] of Object.entries(reports)) {
      if (!report) continue
      const { byNeeds, files, entries } = summarize(report.findings)
      console.log(`[${mode}] ${report.declarations} declarations, ${report.edges} edges, ${report.entries} entry points, ${report.sites} statements on the ambient handle`)
      console.log(`[${mode}] ${report.findings.length} reachable with no context, in ${files} files, from ${entries} entry points: TENANT ${byNeeds.TENANT}, SYSTEM ${byNeeds.SYSTEM}, UNCLASSIFIED ${byNeeds.UNCLASSIFIED}`)
      const byRole = { RUNTIME: report.privilegeFindings.filter((finding) => finding.principal === 'RUNTIME').length, SYSTEM: report.privilegeFindings.filter((finding) => finding.principal === 'SYSTEM').length }
      console.log(`[${mode}] ${report.statements} statements run by an entry point, ${report.unjudged} not fully judged; ${report.privilegeFindings.length} denied: runtime ${byRole.RUNTIME}, system ${byRole.SYSTEM}`)
    }
    console.log(`[gate:${reports.legacy ? 'legacy' : 'v2'}] context: ${open.length} open, ${exempt.length} exempt, ${stale.length} stale exemptions; privilege: ${privilege.open.length} open, ${privilege.exempt.length} exempt, ${privilege.stale.length} stale exemptions`)
    for (const finding of open.slice(0, 40)) console.log(`  CONTEXT   ${finding.needs.padEnd(12)} ${finding.file}:${finding.line} ${finding.method} ${finding.tables.join(',') || '-'}  <- ${finding.witness[0]}`)
    for (const finding of privilege.open.slice(0, 60)) console.log(`  PRIVILEGE ${finding.principal.padEnd(7)} ${finding.file}:${finding.line} ${finding.operation} ${finding.table} (${finding.reason}; ${finding.via})  <- ${finding.witness[0]}`)
    for (const entry of stale) console.log(`  STALE EXEMPTION ${entry.declaration} ${entry.method}`)
    for (const entry of privilege.stale) console.log(`  STALE PRIVILEGE EXEMPTION ${entry.declaration} ${entry.principal} ${entry.operation} ${entry.table}`)
  }
  if (args.includes('--strict') && (open.length > 0 || stale.length > 0 || privilege.open.length > 0 || privilege.stale.length > 0)) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main()
