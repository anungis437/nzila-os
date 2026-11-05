/**
 * The environment variables a program reads (UE-CONV-H-024): the reads of every file, with the helpers that read on a caller's behalf resolved.
 *
 * Two passes. The first reads each file for the variables it names and for the functions that read `process.env[<parameter>]`. The second finds the calls
 * to those functions, and the variable each call names is a read at the call: `readEnv('X')` reads X where it is written, not where `readEnv` is. A helper
 * that hands its parameter on to another helper makes that one a helper too, so the passes repeat until no new helper turns up. A call counts only when it can
 * be the helper: in the file that declares it, or in a file that imports it (through at most two layers of re-exports).
 */
import path from 'node:path'
import { extractEnvFacts, extractHelperCalls, type FileFacts, type HelperDef, type ScanOptions, type UnresolvedSite, type WholeUse } from './reads'

export interface ReadSite {
  file: string
  line: number
  via: string
}

export interface Collected {
  files: number
  /** variable name -> where it is read. */
  reads: Map<string, ReadSite[]>
  /** variable name -> where the code assigns or deletes it. */
  writes: Map<string, ReadSite[]>
  unresolved: Array<UnresolvedSite & { file: string }>
  helpers: HelperDef[]
  whole: Array<WholeUse & { file: string }>
}

export interface SourceText {
  file: string
  text: string
}

/** `@/lib/config/env-validation` and the relative forms of it: the module whose `env` export is the validated environment. */
export const ENV_OBJECT_MODULE = /(^|\/)config\/env-validation$/

const EXTENSIONS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js']

export function resolveSpecifier(from: string, specifier: string, files: ReadonlySet<string>): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = specifier.slice(2)
  else if (specifier.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  else return null
  for (const extension of EXTENSIONS) if (files.has(`${base}${extension}`)) return `${base}${extension}`
  return null
}

const SOURCE_NAME = /^[A-Za-z_$][\w$]*$/

export function collectReads(sources: readonly SourceText[], options: ScanOptions = { envObjectModule: (specifier) => ENV_OBJECT_MODULE.test(specifier) }): Collected {
  const files = new Set(sources.map((source) => source.file))
  const facts = new Map<string, FileFacts>()
  const reads = new Map<string, ReadSite[]>()
  const writes = new Map<string, ReadSite[]>()
  const seen = new Set<string>()
  const unresolved: Collected['unresolved'] = []
  const whole: Collected['whole'] = []
  const helpers: HelperDef[] = []

  const add = (into: Map<string, ReadSite[]>, name: string, site: ReadSite): void => {
    const key = `${name}\u0000${site.file}\u0000${site.line}\u0000${site.via}`
    if (seen.has(key)) return
    seen.add(key)
    into.set(name, [...(into.get(name) ?? []), site])
  }
  const addUnresolved = (file: string, site: UnresolvedSite): void => {
    if (!unresolved.some((existing) => existing.file === file && existing.line === site.line && existing.text === site.text)) unresolved.push({ file, ...site })
  }
  const addHelper = (helper: HelperDef): boolean => {
    if (helpers.some((existing) => existing.file === helper.file && existing.name === helper.name && existing.index === helper.index)) return false
    helpers.push(helper)
    return true
  }

  // Pass one: what every file names directly, and the functions that read on behalf of their callers.
  for (const source of sources) {
    const found = extractEnvFacts(source.file, source.text, options)
    facts.set(source.file, found)
    for (const site of found.reads) add(reads, site.name, { file: source.file, line: site.line, via: site.via })
    for (const site of found.writes) add(writes, site.name, { file: source.file, line: site.line, via: site.via })
    for (const site of found.unresolved) addUnresolved(source.file, site)
    for (const site of found.whole) whole.push({ file: source.file, ...site })
    for (const helper of found.helpers) addHelper(helper)
  }

  /** True when `module`, imported by `from`, is the file that declares `helper`, or re-exports from it. */
  const reaches = (from: string, module: string, helper: HelperDef, depth = 0): boolean => {
    const target = resolveSpecifier(from, module, files)
    if (!target) return false
    if (target === helper.file) return true
    if (depth >= 2) return false
    return (facts.get(target)?.reexports ?? []).some((reexport) => reaches(target, reexport, helper, depth + 1))
  }

  // Pass two: the calls to the helpers, repeated while a helper turns out to forward its parameter to another.
  let pending = helpers.filter((helper) => SOURCE_NAME.test(helper.name))
  for (let round = 0; round < 4 && pending.length > 0; round += 1) {
    const names = [...new Set(pending.map((helper) => helper.name))]
    const discovered: HelperDef[] = []
    for (const source of sources) {
      if (!names.some((name) => source.text.includes(name))) continue
      const found = extractHelperCalls(source.file, source.text, pending, (module, helper) => reaches(source.file, module, helper), options)
      for (const site of found.reads) add(reads, site.name, { file: source.file, line: site.line, via: site.via })
      for (const site of found.unresolved) addUnresolved(source.file, site)
      for (const helper of found.helpers) if (addHelper(helper)) discovered.push(helper)
    }
    pending = discovered.filter((helper) => SOURCE_NAME.test(helper.name))
  }

  return { files: sources.length, reads, writes, unresolved, helpers, whole }
}
