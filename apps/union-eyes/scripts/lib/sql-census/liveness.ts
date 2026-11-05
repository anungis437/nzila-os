/**
 * Which top-level declarations anything runs (UE-CONV-H-013).
 *
 * A statement in a function nothing calls fails nothing today; in a function a route calls it fails every request, often silently when the caller catches. The
 * file-level import graph cannot tell the two apart (one live function in a module makes every dead sibling look reachable), so this builds the graph at the
 * level the question is asked: the type checker resolves every identifier to the top-level declaration it names, an edge runs from the declaration that
 * mentions it, and liveness is what the entry points can reach. Entry points are what the platform itself invokes: route handlers, pages, layouts, middleware,
 * server actions, cron routes and scripts.
 *
 * Over-approximate by design: a reference through a member of an object or class counts as a reference to the whole declaration, and a top-level call runs when
 * its module loads. A declaration this calls dead has no reference from anything that runs; one it calls live may still be unused.
 */
import ts from 'typescript'

export interface Liveness {
  /** `relative/file.ts#name` of every declaration an entry point reaches. */
  live: Set<string>
  declarations: number
  edges: number
  /** Declarations an entry point reaches through the application (routes, pages, middleware, actions), not only through a script. */
  app: Set<string>
}

const MODULE = '<module>'
const NEXT_ENTRY = /^(?:.*\/)?(?:route|page|layout|loading|error|global-error|not-found|template|default|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(?:ts|tsx)$/
const ROOT_ENTRY = /^(?:middleware|instrumentation|instrumentation-client|proxy)\.(?:ts|tsx)$/

const keyOf = (file: string, name: string): string => `${file}#${name}`

/** The name a top-level statement declares, one per declarator, or the module slot for a statement that declares nothing. */
function declaredNames(statement: ts.Statement): string[] {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) {
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    return [statement.name?.text ?? (exported ? 'default' : MODULE)]
  }
  if (ts.isVariableStatement(statement)) {
    const names: string[] = []
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
      else for (const element of declaration.name.elements) if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) names.push(element.name.text)
    }
    return names.length ? names : [MODULE]
  }
  if (ts.isExportAssignment(statement)) return ['default']
  return [MODULE]
}

export function computeLiveness(program: ts.Program, appRoot: string): Liveness {
  const checker = program.getTypeChecker()
  const root = appRoot.replace(/\\/g, '/')
  const relativeOf = (file: ts.SourceFile): string | null => {
    const name = file.fileName.replace(/\\/g, '/')
    if (file.isDeclarationFile || name.includes('/node_modules/') || !name.startsWith(`${root}/`) || !/\.(m?tsx?)$/.test(name)) return null
    return name.slice(root.length + 1)
  }

  const edges = new Map<string, Set<string>>()
  const declarations = new Set<string>()
  const entries = new Set<string>()
  const appEntries = new Set<string>()
  const addEdge = (from: string, to: string): void => {
    if (from === to) return
    const set = edges.get(from) ?? new Set<string>()
    set.add(to)
    edges.set(from, set)
  }

  /** The declarations a symbol stands for, resolved through imports and re-exports to where they are written. */
  const targetsOf = (symbol: ts.Symbol | undefined): string[] => {
    if (!symbol) return []
    let resolved = symbol
    if (resolved.flags & ts.SymbolFlags.Alias) resolved = checker.getAliasedSymbol(resolved)
    const keys: string[] = []
    for (const declaration of resolved.declarations ?? []) {
      const relative = relativeOf(declaration.getSourceFile())
      if (!relative) continue
      // `import * as ns` resolves to the module itself: every export of it may be used.
      if (ts.isSourceFile(declaration)) {
        keys.push(keyOf(relative, '*'))
        continue
      }
      let node: ts.Node = declaration
      let named: string | null = null
      // Climb to the top-level statement, remembering the binding that was named.
      while (node.parent && !ts.isSourceFile(node.parent)) {
        if ((ts.isVariableDeclaration(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && !named) named = node.name.text
        node = node.parent
      }
      if (!node.parent || !ts.isSourceFile(node.parent)) continue
      if (ts.isVariableStatement(node)) keys.push(...(named ? [keyOf(relative, named)] : declaredNames(node).map((name) => keyOf(relative, name))))
      else keys.push(...declaredNames(node as ts.Statement).map((name) => keyOf(relative, name)))
    }
    return keys
  }

  for (const source of program.getSourceFiles()) {
    const relative = relativeOf(source)
    if (!relative) continue
    const isTest = /(\/__tests__\/|\.test\.|\.spec\.|\/__mocks__\/|^e2e\/)/.test(relative)
    const moduleKey = keyOf(relative, MODULE)
    const useServer = source.statements.some((statement) => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use server')
    const nextEntry = NEXT_ENTRY.test(relative) || ROOT_ENTRY.test(relative)
    const scriptEntry = /^scripts\//.test(relative) && !/^scripts\/lib\//.test(relative) && !isTest
    const toolingEntry = /^(workers|jobs|actions)\//.test(relative) || /^lib\/workers\//.test(relative)
    declarations.add(moduleKey)
    if (!isTest) {
      if (nextEntry || useServer) appEntries.add(moduleKey)
      if (nextEntry || useServer || scriptEntry || toolingEntry) entries.add(moduleKey)
    }

    for (const statement of source.statements) {
      const names = declaredNames(statement)
      const ownKeys = names.map((name) => keyOf(relative, name))
      for (const key of ownKeys) declarations.add(key)
      const exported = ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword)
      if (!isTest && (nextEntry || useServer) && (exported || ts.isExportAssignment(statement))) for (const key of ownKeys) { entries.add(key); appEntries.add(key) }
      else if (!isTest && (scriptEntry || toolingEntry) && (exported || ts.isExportAssignment(statement))) for (const key of ownKeys) entries.add(key)
      // A declaration that is live ran its module.
      for (const key of ownKeys) addEdge(key, moduleKey)

      // Importing a module runs it.
      if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier) {
        const target = checker.getSymbolAtLocation(statement.moduleSpecifier)
        const declaration = target?.valueDeclaration ?? target?.declarations?.[0]
        const targetRelative = declaration ? relativeOf(declaration.getSourceFile()) : null
        if (targetRelative) addEdge(moduleKey, keyOf(targetRelative, MODULE))
        continue
      }
      if (ts.isExportDeclaration(statement)) continue

      // A top-level declaration whose initializer calls something runs that call when the module loads.
      const sourceKeys = ownKeys.length ? ownKeys : [moduleKey]
      const runsAtLoad = ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => declaration.initializer && /^(Call|New|Await)/.test(ts.SyntaxKind[unwrapKind(declaration.initializer)]))
      if (runsAtLoad) for (const key of sourceKeys) addEdge(moduleKey, key)
      if (ts.isExpressionStatement(statement) || ts.isIfStatement(statement) || ts.isForStatement(statement) || ts.isTryStatement(statement)) for (const key of sourceKeys) addEdge(moduleKey, key)

      const visit = (node: ts.Node, ownerKeys: string[]): void => {
        let owners = ownerKeys
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ts.isVariableDeclarationList(node.parent) && ts.isVariableStatement(node.parent.parent) && node.parent.parent === statement) owners = [keyOf(relative, node.name.text)]
        if (ts.isIdentifier(node)) {
          const isDeclarationName = (ts.isVariableDeclaration(node.parent) || ts.isFunctionDeclaration(node.parent) || ts.isClassDeclaration(node.parent) || ts.isParameter(node.parent)) && (node.parent as ts.NamedDeclaration).name === node
          if (!isDeclarationName) {
            const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node)
            for (const target of targetsOf(symbol)) for (const owner of owners) addEdge(owner, target)
          }
        }
        // A dynamic import names a module, not which of its exports are used: all of them are.
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
          const resolved = ts.resolveModuleName(node.arguments[0].text, source.fileName, program.getCompilerOptions(), ts.sys).resolvedModule
          const targetRelative = resolved ? relativeOf(program.getSourceFile(resolved.resolvedFileName) ?? source) : null
          if (resolved && targetRelative && targetRelative !== relative) for (const owner of owners) addEdge(owner, keyOf(targetRelative, '*'))
        }
        ts.forEachChild(node, (child) => visit(child, owners))
      }
      visit(statement, sourceKeys)
    }
  }

  // `file#*` stands for every declaration of the file.
  const byFile = new Map<string, string[]>()
  for (const key of declarations) {
    const file = key.slice(0, key.indexOf('#'))
    const list = byFile.get(file) ?? []
    list.push(key)
    byFile.set(file, list)
  }
  const walk = (starts: Iterable<string>): Set<string> => {
    const seen = new Set<string>()
    const queue = [...starts]
    while (queue.length) {
      const key = queue.pop()!
      if (seen.has(key)) continue
      seen.add(key)
      if (key.endsWith('#*')) for (const member of byFile.get(key.slice(0, -2)) ?? []) queue.push(member)
      for (const next of edges.get(key) ?? []) if (!seen.has(next)) queue.push(next)
    }
    return seen
  }
  return { live: walk(entries), app: walk(appEntries), declarations: declarations.size, edges: [...edges.values()].reduce((sum, set) => sum + set.size, 0) }
}

function unwrapKind(expression: ts.Expression): ts.SyntaxKind {
  let current = expression
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current)) current = current.expression
  return current.kind
}

/** The key of the top-level declaration a node sits in: what `Liveness.live` is keyed by. */
export function declarationKeyOf(node: ts.Node, relative: string): string {
  let current: ts.Node = node
  let named: string | null = null
  while (current.parent && !ts.isSourceFile(current.parent)) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name) && !named && ts.isVariableDeclarationList(current.parent) && ts.isVariableStatement(current.parent.parent)) named = current.name.text
    current = current.parent
  }
  if (!current.parent || !ts.isSourceFile(current.parent)) return keyOf(relative, MODULE)
  if (ts.isVariableStatement(current) && named) return keyOf(relative, named)
  return keyOf(relative, declaredNames(current as ts.Statement)[0] ?? MODULE)
}
