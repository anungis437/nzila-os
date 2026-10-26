#!/usr/bin/env node
/**
 * Measures and certifies the Union Eyes migration lineage.
 *
 *   node tooling/scripts/measure-ue-migration-lineage.mjs --emit-baseline [--ref <sha>]
 *       Prints the approved-lineage record measured from a git ref (default: the approved baseline).
 *   node tooling/scripts/measure-ue-migration-lineage.mjs --verify [--ref <ref> | --worktree]
 *       Certifies the lineage at a ref (default HEAD) or the working tree against the approved record.
 *       Exit 0 only when every approved entry is byte-identical and every addition is registered.
 *   node tooling/scripts/measure-ue-migration-lineage.mjs --emit-additions [--ref <ref> | --worktree]
 *       Prints the additions found beyond the approved prefix, in registration format, for REVIEW.
 *       It never edits the approved record; registering an addition is a deliberate, reviewed commit.
 */
import {
  certifyLineage,
  loadApprovedLineage,
  readLineageFromGit,
  readLineageFromWorktree,
  LINEAGES,
} from './lib/ue-migration-lineage-certification.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const BASELINE = '0c994b968aed0657cca5b702954ba87252408245'

if (flag('--emit-baseline')) {
  const ref = value('--ref') ?? BASELINE
  const lineage = readLineageFromGit(ref)
  console.log(JSON.stringify({ version: 1, baselineCommit: ref, measuredFrom: 'git blob bytes (LF)', ...lineage, registeredAdditions: { scoped: [], platform: [] } }, null, 2))
  process.exit(0)
}

const approved = loadApprovedLineage()
const current = flag('--worktree') ? readLineageFromWorktree() : readLineageFromGit(value('--ref') ?? 'HEAD')

if (flag('--emit-additions')) {
  const out = {}
  for (const { key } of LINEAGES) out[key] = current[key].slice(approved[key].length)
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

const result = certifyLineage(approved, current)
console.log(JSON.stringify({ baselineCommit: approved.baselineCommit, ok: result.ok, approvedVerified: result.approvedVerified, additions: result.additions, violations: result.violations }, null, 2))
process.exit(result.ok ? 0 : 1)
