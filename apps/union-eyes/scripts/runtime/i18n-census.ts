/**
 * The i18n census (UE-CONV-H-024): does every message a screen asks for exist, in both languages, and can it be formatted with what the call gives it?
 *
 * A message the catalogs do not carry renders as its key ("rewards.admin.members.title") and logs an error; one that does not parse, or whose French differs
 * from its English in the values it needs, throws when a person opens the screen; a call that leaves out a value the message needs throws the same way. None of
 * it is seen by a unit test, which mocks the translator or loads a different catalog than the application does. Six kinds (see lib/i18n-census):
 *   - MISSING_KEY: code asks for a message the English (en-CA, merged over en) catalog does not have.
 *   - MISSING_IN_FRENCH: it has it in English and not in French (fr-CA merged over fr).
 *   - NOT_A_MESSAGE: the key names a group of messages, not one.
 *   - INVALID_MESSAGE: a message in either language that the runtime cannot parse.
 *   - ARGUMENT_MISMATCH: the English and the French message need different values (an apostrophe before a brace, a renamed argument).
 *   - MISSING_ARGUMENT: a call with literal values leaves out one the message needs (or passes none).
 * Read-only: it reads source files and the catalogs and needs no database. Fix a finding in the catalogs (both languages) or in the call, never by removing the check.
 *
 * Usage (from apps/union-eyes):
 *   npx tsx scripts/runtime/i18n-census.ts [--write=<json>] [--markdown=<md>] [--strict] [--quiet]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { loadCatalogs, parseMessage, FALLBACK_LOCALES, type Catalogs } from '../lib/i18n-census/catalog'
import { findTranslationUses } from '../lib/i18n-census/usage'

export const APP_ROOT = path.resolve(__dirname, '..', '..')

export type I18nKind = 'MISSING_KEY' | 'MISSING_IN_FRENCH' | 'NOT_A_MESSAGE' | 'INVALID_MESSAGE' | 'ARGUMENT_MISMATCH' | 'MISSING_ARGUMENT'

export interface I18nFinding {
  kind: I18nKind
  key: string
  detail: string
  /** The call site, or null for a finding about the catalogs themselves. */
  file: string | null
  line: number | null
}

export interface I18nReport {
  files: number
  uses: number
  /** Translators bound to a computed namespace: read by no census, listed so the blind spot has a size. */
  unresolvedNamespaces: number
  /** Calls whose key is computed. */
  computedKeys: number
  /** Messages the Italian and Portuguese catalogs (which fall back to English) leave to the fallback. */
  fallbackMessages: Record<string, number>
  findings: I18nFinding[]
}

// What is not the application's source. The directories named for the root (`public`, `docs`, `messages`, `reports`...) are skipped only there: `components/public`, `app/[locale]/dashboard/messages`
// and `app/api/reports` are code, and a census that skipped them by name would never read the screens and routes that live there.
const SKIP_ANYWHERE = new Set(['node_modules', '.next', '.turbo', 'coverage', '.storybook', '.git', '__tests__', '__mocks__'])
const SKIP_AT_ROOT = new Set(['dist', 'archive', 'backups', 'mobile', 'backend', 'e2e', 'tests', 'public', 'docs', 'scripts', 'nzila-scripts-book-template', 'messages'])
const SOURCE_FILE = /\.(?:ts|tsx)$/
const NOT_SOURCE = /(?:\.d\.ts|\.test\.tsx?|\.spec\.tsx?|\.stories\.tsx?)$/

export function sourceFilesForI18n(root: string = APP_ROOT): string[] {
  const files: string[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!SKIP_ANYWHERE.has(entry.name) && !(directory === '' && SKIP_AT_ROOT.has(entry.name))) walk(relative)
      } else if (SOURCE_FILE.test(entry.name) && !NOT_SOURCE.test(entry.name)) files.push(relative)
    }
  }
  walk('')
  return files.sort()
}

const spell = (required: readonly string[]): string => required.join(', ')

export async function runCensus(root: string = APP_ROOT, catalogs?: Catalogs): Promise<I18nReport> {
  const loaded = catalogs ?? (await loadCatalogs(root))
  const english = loaded.byLocale['en-CA']
  const french = loaded.byLocale['fr-CA']
  const findings: I18nFinding[] = []
  const signatures = new Map<string, ReturnType<typeof parseMessage>>()
  const signatureOf = (locale: string, key: string): ReturnType<typeof parseMessage> | null => {
    const catalog = loaded.byLocale[locale]
    if (!catalog.has(key)) return null
    const id = `${locale}|${key}`
    let parsed = signatures.get(id)
    if (!parsed) {
      parsed = parseMessage(catalog.get(key))
      signatures.set(id, parsed)
    }
    return parsed
  }
  const isGroup = (catalog: Map<string, unknown>, key: string): boolean => {
    const prefix = `${key}.`
    for (const candidate of catalog.keys()) if (candidate.startsWith(prefix)) return true
    return false
  }

  // The catalogs themselves: a message that does not parse, and an English/French pair that needs different values. A list of messages (an array) is read with `t.raw`
  // and is judged where it is read, not here.
  for (const key of new Set([...english.keys(), ...french.keys()])) {
    const en = typeof english.get(key) === 'string' ? signatureOf('en-CA', key) : null
    const fr = typeof french.get(key) === 'string' ? signatureOf('fr-CA', key) : null
    if (en && !en.ok) findings.push({ kind: 'INVALID_MESSAGE', key, detail: `en-CA: ${en.error}`, file: null, line: null })
    if (fr && !fr.ok) findings.push({ kind: 'INVALID_MESSAGE', key, detail: `fr-CA: ${fr.error}`, file: null, line: null })
    if (en?.ok && fr?.ok && spell(en.signature.required) !== spell(fr.signature.required)) {
      findings.push({ kind: 'ARGUMENT_MISMATCH', key, detail: `en-CA needs {${spell(en.signature.required)}}, fr-CA needs {${spell(fr.signature.required)}}`, file: null, line: null })
    }
  }

  // The screens: every literal key a translator is asked for.
  const files = sourceFilesForI18n(root)
  let uses = 0
  let unresolvedNamespaces = 0
  let computedKeys = 0
  for (const file of files) {
    const found = findTranslationUses(file, readFileSync(path.join(root, file), 'utf8'))
    unresolvedNamespaces += found.unresolved
    for (const use of found.uses) {
      uses += 1
      if (use.key === null) {
        computedKeys += 1
        if (use.prefix) {
          const group = `${use.namespace ? `${use.namespace}.` : ''}${use.prefix}`
          const starts = [...english.keys()].some((candidate) => candidate.startsWith(group))
          if (!starts) findings.push({ kind: 'MISSING_KEY', key: `${group}*`, detail: 'no message in en-CA starts with this computed key', file, line: use.line })
        }
        continue
      }
      if (use.call === 'has') continue
      const key = use.namespace ? `${use.namespace}.${use.key}` : use.key
      if (!english.has(key)) {
        findings.push(isGroup(english, key) ? { kind: 'NOT_A_MESSAGE', key, detail: 'the key names a group of messages', file, line: use.line } : { kind: 'MISSING_KEY', key, detail: 'not in the en-CA catalog (merged over en)', file, line: use.line })
        continue
      }
      if (!french.has(key)) findings.push({ kind: 'MISSING_IN_FRENCH', key, detail: 'in en-CA, not in fr-CA (merged over fr)', file, line: use.line })
      if (use.call === 'raw') continue
      if (typeof english.get(key) !== 'string' || (french.has(key) && typeof french.get(key) !== 'string')) {
        findings.push({ kind: 'INVALID_MESSAGE', key, detail: 'a list of messages is read with t.raw; any other call throws', file, line: use.line })
        continue
      }
      if (use.provides === null) continue
      const provided = new Set(use.provides)
      for (const locale of ['en-CA', 'fr-CA'] as const) {
        const parsed = signatureOf(locale, key)
        if (!parsed?.ok) continue
        const absent = parsed.signature.required.filter((name) => !provided.has(name.startsWith('<') ? name.slice(1, -1) : name))
        if (absent.length) findings.push({ kind: 'MISSING_ARGUMENT', key, detail: `${locale} needs {${absent.join(', ')}}, the call gives {${[...provided].join(', ')}}`, file, line: use.line })
      }
    }
  }

  const fallbackMessages: Record<string, number> = {}
  for (const locale of FALLBACK_LOCALES) fallbackMessages[locale] = [...english.keys()].filter((key) => !loaded.byLocale[locale].has(key)).length
  return { files: files.length, uses, unresolvedNamespaces, computedKeys, fallbackMessages, findings: dedupe(findings) }
}

/** One finding per (kind, key, site): a call that is missing two values in two languages is one line to fix. */
function dedupe(findings: I18nFinding[]): I18nFinding[] {
  const seen = new Set<string>()
  const out: I18nFinding[] = []
  for (const finding of findings) {
    const id = `${finding.kind}|${finding.key}|${finding.file}|${finding.line}|${finding.detail}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push(finding)
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || (a.file ?? '').localeCompare(b.file ?? '') || (a.line ?? 0) - (b.line ?? 0) || a.key.localeCompare(b.key))
}

export function countByKind(findings: I18nFinding[]): Record<I18nKind, number> {
  const counts: Record<I18nKind, number> = { MISSING_KEY: 0, MISSING_IN_FRENCH: 0, NOT_A_MESSAGE: 0, INVALID_MESSAGE: 0, ARGUMENT_MISMATCH: 0, MISSING_ARGUMENT: 0 }
  for (const finding of findings) counts[finding.kind] += 1
  return counts
}

export function toMarkdown(report: I18nReport): string {
  const counts = countByKind(report.findings)
  const lines = ['# i18n census (UE-CONV-H-024)', '', `${report.files} source files, ${report.uses} translator calls (${report.computedKeys} with a computed key, ${report.unresolvedNamespaces} translators bound to a computed namespace); ${report.findings.length} findings.`, '', Object.entries(counts).map(([kind, count]) => `${kind} ${count}`).join(' · '), '']
  for (const kind of Object.keys(counts) as I18nKind[]) {
    const group = report.findings.filter((finding) => finding.kind === kind)
    if (!group.length) continue
    lines.push(`## ${kind}`, '')
    for (const finding of group) lines.push(`- ${finding.file ? `${finding.file}:${finding.line}` : 'catalog'}  \`${finding.key}\`  ${finding.detail}`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const option = (name: string): string | undefined => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const report = await runCensus()
  if (option('write')) writeFileSync(option('write')!, `${JSON.stringify(report, null, 2)}\n`)
  if (option('markdown')) writeFileSync(option('markdown')!, toMarkdown(report))
  if (!args.includes('--quiet')) {
    const counts = countByKind(report.findings)
    console.log(`${report.files} source files, ${report.uses} translator calls (${report.computedKeys} computed keys, ${report.unresolvedNamespaces} computed namespaces); Italian and Portuguese leave ${Object.entries(report.fallbackMessages).map(([locale, count]) => `${count} messages to the English fallback (${locale})`).join(', ')}`)
    console.log(Object.entries(counts).map(([kind, count]) => `  ${kind.padEnd(18)} ${count}`).join('\n'))
    for (const finding of report.findings.slice(0, 200)) console.log(`  ${finding.kind.padEnd(18)} ${finding.file ? `${finding.file}:${finding.line}` : 'catalog'}  ${finding.key}  ${finding.detail}`)
  }
  if (args.includes('--strict') && report.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) void main()
