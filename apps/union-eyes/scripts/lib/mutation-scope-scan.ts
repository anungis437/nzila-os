/**
 * Scanner behind the mutation-scope ratchet (UE-CONV-K-006): UPDATE/DELETE statements on tenant-scoped, parent-owned,
 * user-scoped and multi-party relations whose WHERE clause names no organization. Shared by the ratchet test and the
 * report script (scripts/mutation-scope-report.ts).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const APP = path.resolve(__dirname, '../..')
export const BASELINE = path.resolve(APP, '../../docs/union-eyes/convergence/register/ue-mutation-scope-baseline.json')
const LIVE = new Set(['TENANT_RLS_REQUIRED', 'PARENT_OWNED_RLS_REQUIRED', 'USER_RLS_REQUIRED', 'MULTI_PARTY_RLS_REQUIRED', 'MIXED_GLOBAL_TENANT_RLS_REQUIRED'])
const SKIP = new Set(['node_modules', '.next', '__tests__', 'backend', '.git', 'migrations'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

function registryClasses(): Record<string, string> {
  const out: Record<string, string> = {}
  const dir = path.join(APP, 'db/rls-storage-authority')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const text = readFileSync(path.join(dir, file), 'utf8')
    for (const m of text.matchAll(/table:\s*"([\w.]+)",\s*\r?\n\s*classification:\s*"(\w+)"/g)) out[m[1]] = m[2]
  }
  return out
}

function tableVariables(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const file of walk(path.join(APP, 'db/schema'))) {
    for (const m of readFileSync(file, 'utf8').matchAll(/export const (\w+)\s*=\s*pgTable\(\s*["'`](\w+)["'`]/g)) out[m[1]] = m[2]
  }
  return out
}

/** 1 where the source character is inside a comment. Strings are left intact so a comment marker in a literal is not a comment. */
export function commentMask(text: string): Uint8Array {
  const mask = new Uint8Array(text.length)
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      i++
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue }
        if (text[i] === quote) { i++; break }
        i++
      }
      continue
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') { mask[i] = 1; i++ }
      continue
    }
    if (c === '/' && n === '*') {
      mask[i] = 1
      mask[i + 1] = 1
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { mask[i] = 1; i++ }
      if (i < text.length) { mask[i] = 1; mask[i + 1] = 1; i += 2 }
      continue
    }
    i++
  }
  return mask
}

function nonCommentOffset(mask: Uint8Array, from: number, to: number): number {
  let count = 0
  for (let i = from; i < to; i++) if (!mask[i]) count++
  return count
}

function whereBody(text: string, openParen: number, mask: Uint8Array): string {
  let i = openParen + 1
  let depth = 1
  let out = ''
  while (i < text.length && depth > 0) {
    if (mask[i]) out += ' '
    else {
      if (text[i] === '(') depth++
      else if (text[i] === ')') depth--
      if (depth > 0) out += text[i]
    }
    i++
  }
  return out
}

/**
 * A statement is scoped only when its own WHERE predicate names the tenant or the owning user.
 * Comments do not count toward the distance between `.update`/`.delete` and `.where`, and a
 * comment cannot supply the scope token. Whitespace still counts, so a later statement's
 * predicate cannot be pulled into this one by a blank gap.
 */
export function updateIsScoped(text: string, updateIndex: number, classification: string, mask = commentMask(text)): boolean {
  const limit = Math.min(text.length, updateIndex + 900)
  let whereAt = -1
  for (let i = updateIndex; i + 7 <= limit; i++) {
    if (mask[i]) continue
    if (text.startsWith('.where(', i)) { whereAt = i; break }
  }
  if (whereAt < 0 || nonCommentOffset(mask, updateIndex, whereAt) > 600) return false
  const scope = classification === 'USER_RLS_REQUIRED'
    ? /organization_?id|org_?id|inOrganization|user_?id|member_?id/i
    : /organization_?id|org_?id|inOrganization/i
  return scope.test(whereBody(text, whereAt + 6, mask))
}

export function unscopedMutationsInSource(rel: string, text: string, variables: Record<string, string>, classes: Record<string, string>): Record<string, number> {
  const found: Record<string, number> = {}
  const mask = commentMask(text)
  for (const m of text.matchAll(/\.(update|delete)\(\s*(\w+)\s*\)/g)) {
    if (mask[m.index!]) continue
    const table = variables[m[2]]
    if (!table || !LIVE.has(classes[table] ?? '')) continue
    if (updateIsScoped(text, m.index!, classes[table], mask)) continue
    const key = `${rel}|${table}`
    found[key] = (found[key] ?? 0) + 1
  }
  return found
}

export function scanUnscopedMutations(): Record<string, number> {
  const classes = registryClasses()
  const variables = tableVariables()
  const found: Record<string, number> = {}
  const roots = ['app', 'lib', 'services'].map((r) => path.join(APP, r)).filter((r) => { try { return statSync(r).isDirectory() } catch { return false } })
  for (const file of roots.flatMap((r) => walk(r))) {
    const text = readFileSync(file, 'utf8')
    const rel = path.relative(APP, file).split(path.sep).join('/')
    const hits = unscopedMutationsInSource(rel, text, variables, classes)
    for (const [key, count] of Object.entries(hits)) found[key] = (found[key] ?? 0) + count
  }
  return found
}

