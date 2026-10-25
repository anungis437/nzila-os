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

export function scanUnscopedMutations(): Record<string, number> {
  const classes = registryClasses()
  const variables = tableVariables()
  const found: Record<string, number> = {}
  const roots = ['app', 'lib', 'services'].map((r) => path.join(APP, r)).filter((r) => { try { return statSync(r).isDirectory() } catch { return false } })
  for (const file of roots.flatMap((r) => walk(r))) {
    const text = readFileSync(file, 'utf8')
    const rel = path.relative(APP, file).split(path.sep).join('/')
    for (const m of text.matchAll(/\.(update|delete)\(\s*(\w+)\s*\)/g)) {
      const table = variables[m[2]]
      if (!table || !LIVE.has(classes[table])) continue
      const rest = text.slice(m.index!, m.index! + 900)
      const w = rest.indexOf('.where(')
      let scoped = false
      if (w >= 0 && w <= 600) {
        let i = m.index! + w + 7
        let depth = 1
        const start = i
        while (i < text.length && depth > 0) {
          if (text[i] === '(') depth++
          else if (text[i] === ')') depth--
          i++
        }
        scoped = /organizationId|organization_id|orgId|org_id|inOrganization|deadlineInOrganization|sourceOrganizationId/.test(text.slice(start, i - 1))
      }
      if (!scoped) {
        const key = `${rel}|${table}`
        found[key] = (found[key] ?? 0) + 1
      }
    }
  }
  return found
}

