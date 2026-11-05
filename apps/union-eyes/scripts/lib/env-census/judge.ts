/**
 * The env census verdicts (UE-CONV-H-024). Pure: it is handed what the code reads, what the registry claims, what the deployment files set and what
 * `.env.example` says, and returns what does not agree.
 *
 *   UNDECLARED            a variable the code reads that the registry does not name.
 *   STALE                 a registry entry no code reads: configuration an operator would set for nothing.
 *   CHECK_ONLY            a variable only a validator or a probe reads, and no other process is named as its consumer: validated, never used. A variable that
 *                         configures the check itself names that file in `configuresCheckIn`, and the census holds that the file reads it.
 *   UNRESOLVED            a key the code builds that the census cannot resolve to names, and no pattern entry accounts for it.
 *   STALE_PATTERN         a pattern entry that no unresolved key matches.
 *   EXAMPLE_DRIFT         `.env.example` is not what the registry generates (a variable missing from it, one it does not know, or any other difference).
 *   VALIDATOR_UNKNOWN     a variable the startup validator (`lib/config/env-validation.ts`) declares that the registry does not.
 *   PROVISIONED_UNKNOWN   a variable the deployment sets for the application that the registry does not name.
 *   UNVERIFIED_PROVISION  a registry entry says the deployment supplies it and the deployment file does not.
 *   UNPROVISIONED         a variable a deployed environment requires that nothing checked into the repository supplies (it is set by hand, or not at all).
 *   PROOF_MISSING         an escape hatch whose registry entry names no test, or a test that does not name the variable.
 *   INVALID_ENTRY         an entry that breaks the rules of the registry (see `checkEntry`).
 *   DEAD_MODULE_GONE      a module registered in DEAD_MODULES that no longer exists (it left the register: the register only shrinks).
 *   DEAD_MODULE_IMPORTED  a module registered in DEAD_MODULES that gained a non-test importer, so it is no longer known to be dead.
 *   DEAD_READ             (--reach) an environment read in a declaration that nothing can reach, in a module that is not registered as dead.
 */
import { ENV_GROUPS, provisionsOf, type EnvEntry, type EnvPattern } from '../../../lib/config/env-registry'
import type { Collected, ReadSite } from './collect'
import { generateExample, parseExample } from './example'
import { PLATFORM_INJECTED, type BicepSurface } from './provision'

export type FindingKind = 'UNDECLARED' | 'STALE' | 'CHECK_ONLY' | 'UNRESOLVED' | 'STALE_PATTERN' | 'EXAMPLE_DRIFT' | 'VALIDATOR_UNKNOWN' | 'PROVISIONED_UNKNOWN' | 'UNVERIFIED_PROVISION' | 'UNPROVISIONED' | 'PROOF_MISSING' | 'INVALID_ENTRY' | 'DEAD_MODULE_GONE' | 'DEAD_MODULE_IMPORTED' | 'DEAD_READ'

export interface EnvFinding {
  kind: FindingKind
  name: string
  detail: string
  sites?: ReadSite[]
}

export interface JudgeInput {
  registry: readonly EnvEntry[]
  patterns: readonly EnvPattern[]
  collected: Collected
  /** Files whose reads only validate, probe or declare: a variable read nowhere else is not consumed. */
  checkFiles: ReadonlySet<string>
  /** Helpers that only probe for presence. */
  checkHelpers: ReadonlySet<string>
  /** The names the Django backend reads. */
  djangoReads: ReadonlySet<string>
  exampleText: string
  validatorKeys: ReadonlySet<string>
  bicep: BicepSurface
  workflow: ReadonlySet<string>
  dockerfile: ReadonlySet<string>
  fileText: (repoRelative: string) => string | null
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const DEPLOYED: ReadonlySet<string> = new Set(['production', 'staging'])

/** The rules every entry keeps, whatever it says about one variable. */
export function checkEntry(entry: EnvEntry): string[] {
  const problems: string[] = []
  if (!NAME.test(entry.name)) problems.push('the name is not an identifier')
  if (!entry.description.trim() || /[\r\n]/.test(entry.description) || entry.description.length > 220) problems.push('the description must be one non-empty line of at most 220 characters')
  if (!(entry.whenMissing === 'fail-closed' || /^degraded:\S.{9,}$/.test(entry.whenMissing) || /^default:\S.{9,}$/.test(entry.whenMissing))) problems.push('whenMissing must be fail-closed, degraded:<exact behaviour> or default:<value and why it is safe> (at least 10 characters of explanation)')
  if (entry.kind === 'secret' && entry.whenMissing.startsWith('default:')) problems.push('a secret has no default: it fails closed or degrades a named capability')
  if (DEPLOYED.has(entry.required) && entry.whenMissing.startsWith('default:')) problems.push(`a variable required in ${entry.required} cannot have a default: it is either required or it has one`)
  if (entry.kind === 'secret' && entry.example) problems.push('a secret carries no example value')
  if (entry.minLength !== undefined && entry.kind !== 'secret') problems.push('minLength is for secrets')
  if (entry.integration && entry.required !== 'optional') problems.push('an integration member is optional')
  const provisions = provisionsOf(entry)
  if (provisions.length === 0) problems.push('provisionedBy is empty')
  const notNeeded = provisions.filter((provision) => provision.via === 'not-needed')
  if (DEPLOYED.has(entry.required) && notNeeded.length > 0) problems.push(`a variable required in ${entry.required} cannot be "not-needed" by the deployment`)
  if ((entry.required === 'dev-only' || entry.required === 'test-only') && provisions.some((provision) => provision.via !== 'not-needed')) problems.push(`a ${entry.required} variable is not supplied by any deployment`)
  for (const provision of provisions) {
    if (provision.via === 'not-needed' && provision.because.trim().length < 10) problems.push('"not-needed" needs a reason')
    if (provision.via === 'operator' && provision.note.trim().length < 10) problems.push('"operator" needs a note saying where it is set')
    if (provision.via === 'platform' && provision.by.trim().length < 3) problems.push('"platform" needs to say what injects it')
  }
  if (!(entry.group in ENV_GROUPS)) problems.push(`unknown group ${entry.group}`)
  return problems
}

const normalizeKey = (text: string): string => text.replace(/\s+/g, ' ').trim()

export function judge(input: JudgeInput): EnvFinding[] {
  const findings: EnvFinding[] = []
  const add = (kind: FindingKind, name: string, detail: string, sites?: ReadSite[]): void => void findings.push({ kind, name, detail, ...(sites ? { sites } : {}) })
  const byName = new Map<string, EnvEntry>()
  for (const entry of input.registry) {
    if (byName.has(entry.name)) add('INVALID_ENTRY', entry.name, 'declared twice')
    byName.set(entry.name, entry)
    for (const problem of checkEntry(entry)) add('INVALID_ENTRY', entry.name, problem)
  }

  const reads = input.collected.reads
  const consumedBy = (name: string): ReadSite[] => (reads.get(name) ?? []).filter((site) => !input.checkFiles.has(site.file) && !(site.via.startsWith('helper:') && input.checkHelpers.has(site.via.slice(7))))

  for (const [name, sites] of reads) if (!byName.has(name)) add('UNDECLARED', name, `read in ${sites.length} place(s), not in the registry`, sites)
  for (const entry of input.registry) {
    if ((entry.runtime ?? 'next') === 'django') {
      if (!input.djangoReads.has(entry.name) && !entry.externalConsumer) add('STALE', entry.name, 'declared for the Django backend and the backend reads it nowhere')
      continue
    }
    const sites = reads.get(entry.name) ?? []
    if (entry.configuresCheckIn) {
      if (!input.checkFiles.has(entry.configuresCheckIn)) add('INVALID_ENTRY', entry.name, `configuresCheckIn names ${entry.configuresCheckIn}, which is not a validate-only file: it is only for the variable of a check the census does not count as use`)
      else if (!sites.some((site) => site.file === entry.configuresCheckIn)) add('INVALID_ENTRY', entry.name, `configuresCheckIn names ${entry.configuresCheckIn}, which does not read it`)
    }
    const configuresCheck = entry.configuresCheckIn !== undefined && sites.some((site) => site.file === entry.configuresCheckIn)
    if (sites.length === 0) {
      if (!input.djangoReads.has(entry.name) && !entry.externalConsumer) add('STALE', entry.name, 'declared and read nowhere')
    } else if (consumedBy(entry.name).length === 0 && !entry.externalConsumer && !configuresCheck && !input.djangoReads.has(entry.name)) {
      add('CHECK_ONLY', entry.name, 'only a validator or a probe reads it: validated, never used', sites)
    }
  }

  const patternSeen = new Set<EnvPattern>()
  for (const site of input.collected.unresolved) {
    const match = input.patterns.find((pattern) => pattern.file === site.file && normalizeKey(pattern.key) === normalizeKey(site.text))
    if (match) patternSeen.add(match)
    else add('UNRESOLVED', `${site.file}:${site.line}`, `a key the census cannot resolve (${normalizeKey(site.text).slice(0, 100)}) and no pattern entry accounts for it`)
  }
  for (const pattern of input.patterns) if (!patternSeen.has(pattern)) add('STALE_PATTERN', pattern.produces, `no unresolved read of ${normalizeKey(pattern.key)} in ${pattern.file}`)

  const expected = generateExample(input.registry)
  if (input.exampleText.replace(/\r\n/g, '\n') !== expected) {
    const declared = new Map(parseExample(input.exampleText).map((variable) => [variable.name, variable]))
    const generated = new Map(parseExample(expected).map((variable) => [variable.name, variable]))
    for (const name of generated.keys()) if (!declared.has(name)) add('EXAMPLE_DRIFT', name, '.env.example omits it')
    for (const name of declared.keys()) if (!generated.has(name)) add('EXAMPLE_DRIFT', name, '.env.example names it and the registry does not (or it is test-only)')
    if (findings.every((finding) => finding.kind !== 'EXAMPLE_DRIFT')) add('EXAMPLE_DRIFT', '.env.example', 'the text differs from what the registry generates: run `pnpm census:env --write-example`')
  }

  for (const key of input.validatorKeys) if (!byName.has(key)) add('VALIDATOR_UNKNOWN', key, 'declared by lib/config/env-validation.ts and not in the registry')

  for (const name of input.bicep.env.keys()) if (!byName.has(name)) add('PROVISIONED_UNKNOWN', name, 'set by infrastructure/bicep/ue-v2/modules/apps.bicep and not in the registry')
  for (const name of input.workflow) if (!byName.has(name)) add('PROVISIONED_UNKNOWN', name, 'set by .github/workflows/deploy-union-eyes.yml and not in the registry')

  for (const entry of input.registry) {
    let verified = false
    for (const provision of provisionsOf(entry)) {
      if (provision.via === 'bicep') {
        const found = input.bicep.env.get(entry.name)
        if (!found) add('UNVERIFIED_PROVISION', entry.name, 'registry says apps.bicep sets it and apps.bicep does not')
        else if (provision.secret && (found.secret !== provision.secret || !input.bicep.secrets.has(provision.secret))) add('UNVERIFIED_PROVISION', entry.name, `registry says Key Vault secret "${provision.secret}"; apps.bicep reads it from "${found.secret ?? 'a plain value'}"`)
        else verified = true
      } else if (provision.via === 'workflow') {
        if (input.workflow.has(entry.name)) verified = true
        else add('UNVERIFIED_PROVISION', entry.name, 'registry says deploy-union-eyes.yml sets it and the workflow does not')
      } else if (provision.via === 'dockerfile') {
        if (input.dockerfile.has(entry.name)) verified = true
        else add('UNVERIFIED_PROVISION', entry.name, 'registry says the Dockerfile sets it and the Dockerfile does not')
      } else if (provision.via === 'platform') {
        if (PLATFORM_INJECTED.has(entry.name)) verified = true
        else add('UNVERIFIED_PROVISION', entry.name, 'registry says the platform injects it and it is not a known platform variable')
      }
    }
    if (DEPLOYED.has(entry.required) && !verified) add('UNPROVISIONED', entry.name, `required in ${entry.required}; no file in infrastructure/ or the deploy workflow supplies it`)
    if (entry.productionProof) {
      const proof = input.fileText(entry.productionProof)
      if (proof === null) add('PROOF_MISSING', entry.name, `${entry.productionProof} does not exist`)
      else if (!proof.includes(entry.name)) add('PROOF_MISSING', entry.name, `${entry.productionProof} does not name it`)
    } else if (entry.required === 'dev-only' || entry.required === 'staging') add('PROOF_MISSING', entry.name, `a ${entry.required} variable names the test that proves production refuses it (productionProof)`)
  }
  return findings
}

export function countBy(findings: readonly EnvFinding[]): Record<FindingKind, number> {
  const counts = { UNDECLARED: 0, STALE: 0, CHECK_ONLY: 0, UNRESOLVED: 0, STALE_PATTERN: 0, EXAMPLE_DRIFT: 0, VALIDATOR_UNKNOWN: 0, PROVISIONED_UNKNOWN: 0, UNVERIFIED_PROVISION: 0, UNPROVISIONED: 0, PROOF_MISSING: 0, INVALID_ENTRY: 0, DEAD_MODULE_GONE: 0, DEAD_MODULE_IMPORTED: 0, DEAD_READ: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}
