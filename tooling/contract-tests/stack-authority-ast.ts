/**
 * AST-level Drizzle-mutation detector for STACK_AUTHORITY_001.
 *
 * Closes the "KNOWN GAP" in {@link ./stack-authority.test.ts} where pure
 * aliases without a recognised suffix (e.g. `const writer = db;
 * writer.insert(...)`) bypass the regex check. Uses the bare TypeScript
 * compiler API (root dep `typescript@^6`) — no `ts-morph`, no full
 * `ts.Program`. Per-file `ts.createSourceFile` keeps the contract-test
 * suite well under its 30s budget.
 *
 * Scope is intentionally intra-file (matches today's regex). Cross-file
 * alias tracking is a separate, larger problem.
 *
 * @invariant STACK_AUTHORITY_001
 */
import ts from 'typescript'

// ── Shared constants (single source of truth; re-exported into the
//    regex test for lockstep coverage) ────────────────────────────────────

/**
 * Drizzle-style mutation methods. Must stay in sync with the regex
 * check in stack-authority.test.ts.
 */
export const MUTATION_METHODS = [
  'insert',
  'insertMany',
  'insertInto',
  'bulkInsert',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'merge',
] as const

export type MutationMethod = (typeof MUTATION_METHODS)[number]
const MUTATION_METHOD_SET = new Set<string>(MUTATION_METHODS)

/**
 * Names of helper functions whose callback body is considered a safe
 * context for a Drizzle mutation. A mutation is acceptable iff it
 * sits inside the function body passed as an argument to one of these
 * calls (verified structurally via parent walk).
 */
export const SAFE_MUTATION_CONTEXTS = [
  'withRLSContext',
  'withSystemContext',
  'withSystemRLSContext',
  'withPlatformAdminRLSContext',
  'withExplicitUserContext',
  'createAuditedScopedDb',
  'createScopedDb',
] as const

const SAFE_CONTEXT_SET = new Set<string>(SAFE_MUTATION_CONTEXTS)

/**
 * Heuristic suffix pattern for "looks-like-a-DB-handle" identifiers.
 * Preserved verbatim from the regex check so the AST detector is a
 * strict superset (never narrower).
 */
export const DB_HANDLE_NAME_REGEX = new RegExp(
  String.raw`^[A-Za-z_$][\w$]*(?:[dD]b|[dD]atabase|[cC]lient|[cC]onn(?:ection)?|[tT]x|[tT]rx|[tT]ransaction|[dD]rizzle|[sS]ql|[pP]g)$`,
)

/**
 * Canonical DB-handle names that are bare (no prefix) and therefore do
 * not satisfy {@link DB_HANDLE_NAME_REGEX}'s `<prefix><suffix>` shape
 * (e.g. `db` itself, `tx`). Treated as DB handles when they appear as
 * a destructuring source key or a parameter name.
 */
const CANONICAL_DB_NAMES = new Set([
  'db',
  'database',
  'client',
  'conn',
  'connection',
  'tx',
  'trx',
  'transaction',
  'drizzle',
  'sql',
  'pg',
])

function isHandleName(name: string): boolean {
  return CANONICAL_DB_NAMES.has(name) || DB_HANDLE_NAME_REGEX.test(name)
}

/**
 * Module specifiers whose imports we always treat as DB roots, even if
 * the local binding name does not match {@link DB_HANDLE_NAME_REGEX}.
 */
const DB_IMPORT_PREFIXES = [
  '@nzila/db',
  'drizzle-orm',
  'postgres',
  'pg',
  '@neondatabase/serverless',
] as const

function isDbImportSpecifier(spec: string): boolean {
  return DB_IMPORT_PREFIXES.some((p) => spec === p || spec.startsWith(`${p}/`))
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface MutationFinding {
  /** 1-based line number of the offending call */
  line: number
  /** 1-based column of the offending call */
  column: number
  /** Up to 120 chars of source near the call */
  snippet: string
  /** The local identifier the mutation was invoked on (e.g. `writer`) */
  alias: string
  /** The seed root the alias chains back to (e.g. `db`, `platformDb`) */
  root: string
  /** Which mutation method was called (e.g. `insert`) */
  method: MutationMethod
}

/**
 * Find Drizzle-shaped mutations in `content` that are not enclosed by a
 * structurally-verified safe context. Intra-file only.
 *
 * @param filePath used only for parser hints (script kind); not read
 * @param content TypeScript / TSX source
 */
export function findAliasedMutations(
  filePath: string,
  content: string,
): MutationFinding[] {
  const scriptKind = /\.tsx$/i.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  )

  const aliasRoots = collectAliasRoots(sourceFile)
  if (aliasRoots.size === 0) return []

  const findings: MutationFinding[] = []
  visit(sourceFile)
  return findings

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const finding = inspectCall(node, aliasRoots, sourceFile)
      if (finding && !isInsideSafeContext(node)) {
        findings.push(finding)
      }
    }
    ts.forEachChild(node, visit)
  }
}

// ── Alias-root collection ───────────────────────────────────────────────────

/**
 * Walks the file once and builds a map `localName -> rootName` for every
 * identifier that resolves (intra-file) back to a recognised DB root.
 *
 * Roots are seeded from:
 *  - import bindings from {@link DB_IMPORT_PREFIXES}
 *  - any identifier whose name matches {@link DB_HANDLE_NAME_REGEX}
 *    (preserves today's regex behaviour)
 *
 * Aliases are propagated through:
 *  - `const x = root` / `let x = root`
 *  - destructuring with rename: `const { db: x } = ctx`
 *  - function parameters whose default value is a seed
 *  - function parameters whose *name* matches the handle regex (so a
 *    `tx`/`scoped` callback parameter is treated as a root)
 *
 * Iterates to fixpoint within the file.
 */
function collectAliasRoots(sourceFile: ts.SourceFile): Map<string, string> {
  const roots = new Map<string, string>() // localName -> rootName

  // ── seed pass 1: imports from DB packages ────────────────────────────────
  const seedImport = (name: string) => roots.set(name, name)

  function visitImports(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isDbImportSpecifier(node.moduleSpecifier.text)) {
        const clause = node.importClause
        if (!clause) return
        if (clause.name) seedImport(clause.name.text) // default import
        const bindings = clause.namedBindings
        if (bindings) {
          if (ts.isNamespaceImport(bindings)) {
            seedImport(bindings.name.text)
          } else {
            for (const el of bindings.elements) seedImport(el.name.text)
          }
        }
      }
    }
    ts.forEachChild(node, visitImports)
  }
  visitImports(sourceFile)

  // ── seed pass 2: identifiers matching the handle-suffix heuristic ───────
  //    (declarations only — variables, parameters, bindings)
  function visitHandleHeuristic(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (isHandleName(node.name.text)) {
        roots.set(node.name.text, node.name.text)
      }
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      if (isHandleName(node.name.text)) {
        roots.set(node.name.text, node.name.text)
      }
    } else if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
      if (isHandleName(node.name.text)) {
        roots.set(node.name.text, node.name.text)
      }
    }
    ts.forEachChild(node, visitHandleHeuristic)
  }
  visitHandleHeuristic(sourceFile)

  // ── propagation: worklist to fixpoint ───────────────────────────────────
  let changed = true
  let guard = 0
  while (changed && guard++ < 50) {
    changed = false

    function visitProp(node: ts.Node): void {
      // const x = <root>
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const baseRoot = resolveIdentifierRoot(node.initializer, roots)
        if (baseRoot && !roots.has(node.name.text)) {
          roots.set(node.name.text, baseRoot)
          changed = true
        }
      }

      // const { db: x, ... } = <root-ish>
      if (
        ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer
      ) {
        // Either the whole initializer is a known root, or any
        // destructured key whose name matches the handle heuristic.
        const initRoot = resolveIdentifierRoot(node.initializer, roots)
        for (const el of node.name.elements) {
          if (!ts.isIdentifier(el.name)) continue
          const localName = el.name.text
          if (roots.has(localName)) continue

          // Renamed: const { db: writer } = ...
          const sourceKey = el.propertyName && ts.isIdentifier(el.propertyName)
            ? el.propertyName.text
            : localName

          if (initRoot && isHandleName(sourceKey)) {
            roots.set(localName, initRoot)
            changed = true
          }
        }
      }

      // function/arrow parameter with default = <root>
      if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.initializer) {
        const baseRoot = resolveIdentifierRoot(node.initializer, roots)
        if (baseRoot && !roots.has(node.name.text)) {
          roots.set(node.name.text, baseRoot)
          changed = true
        }
      }

      ts.forEachChild(node, visitProp)
    }
    visitProp(sourceFile)
  }

  return roots
}

/**
 * If `expr` is (a chain ending in) an identifier in `roots`, return the
 * root name. Property accesses like `ctx.db` are NOT treated as a root
 * unless `ctx` itself is a root and the final property name matches the
 * handle heuristic — keeps the heuristic intra-identifier-ish.
 */
function resolveIdentifierRoot(
  expr: ts.Expression,
  roots: Map<string, string>,
): string | null {
  if (ts.isIdentifier(expr)) {
    return roots.get(expr.text) ?? null
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const base = resolveIdentifierRoot(expr.expression, roots)
    if (base && isHandleName(expr.name.text)) {
      return base
    }
  }
  return null
}

// ── Call inspection ─────────────────────────────────────────────────────────

function inspectCall(
  call: ts.CallExpression,
  roots: Map<string, string>,
  sourceFile: ts.SourceFile,
): MutationFinding | null {
  const callee = call.expression
  if (!ts.isPropertyAccessExpression(callee)) return null
  const methodName = callee.name.text
  if (!MUTATION_METHOD_SET.has(methodName)) return null

  // Walk the receiver chain to its base identifier.
  let base: ts.Expression = callee.expression
  while (ts.isPropertyAccessExpression(base) || ts.isCallExpression(base)) {
    base = ts.isCallExpression(base) ? base.expression : base.expression
  }
  if (!ts.isIdentifier(base)) return null

  const root = roots.get(base.text)
  if (!root) return null

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(call.getStart(sourceFile))
  const lineText = sourceFile.text.split('\n')[line] ?? ''
  return {
    line: line + 1,
    column: character + 1,
    snippet: lineText.trim().slice(0, 120),
    alias: base.text,
    root,
    method: methodName as MutationMethod,
  }
}

/**
 * Walk parents of `node`; return true iff any ancestor is the function
 * body of a callback passed to a SAFE_MUTATION_CONTEXTS call. We require
 * structural enclosure (not "name appears in window") to eliminate the
 * regex's comment/string false-positive class.
 */
function isInsideSafeContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const fnParent = current.parent
      if (fnParent && ts.isCallExpression(fnParent)) {
        const callee = fnParent.expression
        const calleeName = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : null
        if (calleeName && SAFE_CONTEXT_SET.has(calleeName)) {
          // confirm the function is actually one of the call's arguments
          if (fnParent.arguments.some((a) => a === current)) {
            return true
          }
        }
      }
    }
    current = current.parent
  }
  return false
}
