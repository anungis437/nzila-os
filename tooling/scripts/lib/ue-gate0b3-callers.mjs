/**
 * Deterministic caller discovery for Gate 0B.3. A caller is a line in tracked product source outside the API tree,
 * tests, documentation and capability registries that names the route path as a string. The search is route-level:
 * it does not say which HTTP method the caller uses. The builder records each hit as a file and a quoted line, and
 * the validator checks that every recorded line is present in its file.
 */
import { execFileSync } from 'node:child_process'

const EXCLUDED = [
  ':(exclude)apps/union-eyes/app/api',
  ':(exclude)*.test.*',
  ':(exclude)*.spec.*',
  ':(exclude)apps/union-eyes/__tests__',
  ':(exclude)apps/union-eyes/e2e',
  ':(exclude)apps/union-eyes/docs',
  ':(exclude)*.json',
  ':(exclude)*.md',
  ':(exclude)apps/union-eyes/lib/executive/capability-matrix.ts',
  ':(exclude)apps/union-eyes/lib/reality',
  ':(exclude)apps/union-eyes/scripts',
]

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function loadApiReferences(root) {
  const out = execFileSync('git', ['grep', '-n', '-I', '-F', '/api/', '--', 'apps/union-eyes', ...EXCLUDED], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return out.split('\n').filter(Boolean).map((line) => {
    const match = line.match(/^([^:]+):(\d+):(.*)$/)
    return match ? { file: match[1], line: Number(match[2]), text: match[3] } : null
  }).filter(Boolean)
}

export function pathPattern(route) {
  const path = `/api/${route.replace(/\/route\.ts$/, '')}`
  const pattern = escape(path).replace(/\\\[[^\]]+\\\]/g, '(?:\\$\\{[^}]+\\}|\\[[a-zA-Z]+\\])')
  return new RegExp(`${pattern}(?=['"\`?]|$)`)
}

export function callersOf(route, references) {
  const pattern = pathPattern(route)
  return references
    .filter((reference) => pattern.test(reference.text))
    .map((reference) => ({ ref: reference.file, quote: reference.text.trim().slice(0, 200) }))
    .filter((item, index, all) => all.findIndex((other) => other.ref === item.ref && other.quote === item.quote) === index)
    .sort((a, b) => (a.ref + a.quote < b.ref + b.quote ? -1 : a.ref + a.quote > b.ref + b.quote ? 1 : 0))
}

export function callerFindingOf(callers) {
  return callers.length === 0
    ? 'No caller outside the API tree, tests, documentation and capability registries names this route path in tracked product source.'
    : `${callers.length} call site(s) in product source name this route path; the search is route-level and does not determine the HTTP method each site uses.`
}
