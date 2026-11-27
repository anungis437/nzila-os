/**
 * ORG_REQUIRED_SERVER_ACTIONS_001 — "Server actions must use resolveOrgContext"
 *
 * Enforces that every server action file across all apps uses the
 * org-scoped auth helper (resolveOrgContext) instead of bare auth()
 * from Clerk.
 *
 * Scope:
 *   apps/nacp-exams/lib/actions/*.ts
 *   apps/zonga/lib/actions/*.ts
 *   apps/cfo/lib/actions/*.ts
 *   apps/partners/lib/actions/*.ts
 *   apps/union-eyes/actions/*.ts
 *
 * Rules:
 *   - FAIL if a server action file ('use server') does not import resolveOrgContext
 *   - FAIL if a server action file uses bare auth() without resolveOrgContext
 *   - FAIL if any exception in governance/exceptions/org-required-server-actions.json is expired
 *   - PASS otherwise
 *
 * @invariant ORG_REQUIRED_SERVER_ACTIONS_001
 * @invariant NO_BARE_AUTH_IN_ACTIONS_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import ts from 'typescript'
import {
  ROOT,
  relPath,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

const ACTION_ROOTS = [
  join(ROOT, 'apps', 'nacp-exams', 'lib', 'actions'),
  join(ROOT, 'apps', 'zonga', 'lib', 'actions'),
  join(ROOT, 'apps', 'cfo', 'lib', 'actions'),
  join(ROOT, 'apps', 'partners', 'lib', 'actions'),
  join(ROOT, 'apps', 'union-eyes', 'actions'),
]

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function listActionFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('-actions.ts'))
    .map((f) => join(dir, f))
}

/** Parse actual module directives and runtime bindings. Comments, string
 * mentions and quote style cannot constitute an authority-helper migration. */
function actionSource(file: string, content: string) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true)
  // Bind only this source file: an inner parameter/local with the same name
  // must not be mistaken for the imported helper. No dependency graph or I/O.
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    noResolve: true,
    noLib: true,
  }
  const host = ts.createCompilerHost(options)
  host.getSourceFile = (name) => (name === file ? source : undefined)
  host.fileExists = (name) => name === file
  host.readFile = (name) => (name === file ? content : undefined)
  const checker = ts.createProgram([file], options, host).getTypeChecker()
  const helperSymbols = new Set<ts.Symbol>(),
    namespaceSymbols = new Set<ts.Symbol>(),
    authNamespaceSymbols = new Set<ts.Symbol>()
  let server = false
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    if (statement.expression.text === 'use server') server = true
  }
  const app = relPath(file).split('/')[1]
  const canonical = resolve(ROOT, 'apps', app, 'lib', 'resolve-org')
  const helpers = new Set<string>(),
    namespaces = new Set<string>(),
    authNames = new Set<string>(),
    authNamespaces = new Set<string>()
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause?.isTypeOnly
    )
      continue
    const module = statement.moduleSpecifier.text,
      bindings = statement.importClause?.namedBindings
    const realHelper =
      module === '@/lib/resolve-org' ||
      (module.startsWith('.') &&
        resolve(dirname(file), module).replace(/\.[cm]?[jt]sx?$/, '') === canonical)
    const authModule = module === '@nzila/platform-auth/entra/server'
    if (bindings && ts.isNamedImports(bindings))
      for (const binding of bindings.elements) {
        if (binding.isTypeOnly) continue
        const name = (binding.propertyName ?? binding.name).text
        if (realHelper && name === 'resolveOrgContext') {
          helpers.add(binding.name.text)
          const symbol = checker.getSymbolAtLocation(binding.name)
          if (symbol) helperSymbols.add(symbol)
        }
        if (authModule && name === 'auth') authNames.add(binding.name.text)
      }
    if (bindings && ts.isNamespaceImport(bindings)) {
      if (realHelper) {
        namespaces.add(bindings.name.text)
        const symbol = checker.getSymbolAtLocation(bindings.name)
        if (symbol) namespaceSymbols.add(symbol)
      }
      if (authModule) {
        authNamespaces.add(bindings.name.text)
        const symbol = checker.getSymbolAtLocation(bindings.name)
        if (symbol) authNamespaceSymbols.add(symbol)
      }
    }
  }
  let called = false,
    bare = authNames.size > 0
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const call = node.expression
      if (ts.isIdentifier(call) && helpers.has(call.text)) {
        const symbol = checker.getSymbolAtLocation(call)
        if (symbol && helperSymbols.has(symbol)) called = true
      }
      if (ts.isPropertyAccessExpression(call) && ts.isIdentifier(call.expression)) {
        const objectSymbol = checker.getSymbolAtLocation(call.expression)
        if (
          namespaces.has(call.expression.text) &&
          objectSymbol &&
          namespaceSymbols.has(objectSymbol) &&
          call.name.text === 'resolveOrgContext'
        )
          called = true
        if (
          authNamespaces.has(call.expression.text) &&
          objectSymbol &&
          authNamespaceSymbols.has(objectSymbol) &&
          call.name.text === 'auth'
        )
          bare = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { server, imported: helpers.size + namespaces.size > 0, called, bare }
}

// ── ORG_REQUIRED_SERVER_ACTIONS_001 ─────────────────────────────────────────

describe('ORG_REQUIRED_SERVER_ACTIONS_001 — Server actions must use resolveOrgContext', () => {
  it('every "use server" action file imports resolveOrgContext', () => {
    const violations: Violation[] = []
    const exceptionFile = loadExceptions('governance/exceptions/org-required-server-actions.json')

    for (const root of ACTION_ROOTS) {
      for (const file of listActionFiles(root)) {
        const rel = relPath(file)
        if (isExcepted(rel, exceptionFile.entries)) continue

        const content = readSafe(file)
        const facts = actionSource(file, content)
        if (!facts.server) continue

        if (!facts.imported || !facts.called) {
          violations.push({
            ruleId: 'ORG_REQUIRED_SERVER_ACTIONS_001',
            filePath: rel,
            offendingValue: 'Missing actual canonical resolveOrgContext import/call',
            remediation:
              "Import and call resolveOrgContext() from '@/lib/resolve-org' instead of using bare auth()",
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('no expired exceptions for ORG_REQUIRED_SERVER_ACTIONS_001', () => {
    const exceptionFile = loadExceptions('governance/exceptions/org-required-server-actions.json')
    expect(
      exceptionFile.expiredEntries,
      `${exceptionFile.expiredEntries.length} expired exception(s)`,
    ).toHaveLength(0)
  })
})

// ── NO_BARE_AUTH_IN_ACTIONS_001 ─────────────────────────────────────────────

describe('NO_BARE_AUTH_IN_ACTIONS_001 — No bare auth() in migrated action files', () => {
  it('files with resolveOrgContext must not also import bare auth() from @nzila/platform-auth', () => {
    const violations: Violation[] = []

    for (const root of ACTION_ROOTS) {
      for (const file of listActionFiles(root)) {
        const rel = relPath(file)
        const content = readSafe(file)

        const facts = actionSource(file, content)
        // This is the same no-bare-auth policy on actually migrated bindings.
        if (!facts.imported) continue
        if (facts.bare) {
          violations.push({
            ruleId: 'NO_BARE_AUTH_IN_ACTIONS_001',
            filePath: rel,
            offendingValue:
              "Imports auth() from '@nzila/platform-auth/entra/server' alongside resolveOrgContext",
            remediation:
              'Remove bare auth() import; resolveOrgContext already wraps auth() internally',
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})

describe('existing server-action policy source parsing', () => {
  const file = join(ROOT, 'apps', 'cfo', 'lib', 'actions', 'parser-actions.ts')
  it('recognizes both module quote styles and real aliased canonical calls', () => {
    for (const quote of ["'", '"'])
      expect(
        actionSource(
          file,
          `${quote}use server${quote};import {resolveOrgContext as scope} from '@/lib/resolve-org';export async function read(){return scope('personal',{permission:'clients:view'},async()=>null)}`,
        ),
      ).toMatchObject({ server: true, imported: true, called: true, bare: false })
  })
  it('rejects comment/string mentions, unused imports, and noncanonical lookalike helpers', () => {
    for (const source of [
      "'use server';// resolveOrgContext\nexport async function read(){return 'resolveOrgContext()'}",
      "'use server';import {resolveOrgContext} from '@/lib/resolve-org';export async function read(){return null}",
      "'use server';import {resolveOrgContext} from '@/lib/unverified';export async function read(){return resolveOrgContext()}",
      "'use server';import {resolveOrgContext} from '@/lib/resolve-org';export async function read(resolveOrgContext:()=>null){return resolveOrgContext()}",
    ]) {
      const facts = actionSource(file, source)
      expect(facts.server).toBe(true)
      expect(facts.imported && facts.called).toBe(false)
    }
    expect(actionSource(file, "// 'use server'\nexport const value='use server'").server).toBe(
      false,
    )
  })
  it('resolves the actual relative canonical module and detects bare auth aliases', () => {
    expect(
      actionSource(
        file,
        "'use server';import {resolveOrgContext} from '../resolve-org';import {auth as identity} from '@nzila/platform-auth/entra/server';export async function read(){await identity();return resolveOrgContext('personal',{permission:'clients:view'},async()=>null)}",
      ),
    ).toMatchObject({ server: true, imported: true, called: true, bare: true })
  })
})
