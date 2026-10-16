import { createHash } from 'node:crypto'
import path from 'node:path'
import ts from 'typescript'

export type MutationOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN'
export interface CallerMutation {
  operation: MutationOperation
  table: string
  evidence: string
  line: number
}
export interface CallerNode {
  id: string
  sourcePath: string
  sourceSha256: string
  symbol: string
  line: number
  mutations: CallerMutation[]
  calls: string[]
  roots: string[]
  unresolvedCalls: { expression: string; line: number }[]
}
export interface CallerRoot {
  id: string
  kind: 'NEXT_HTTP' | 'SERVER_ACTION' | 'NEXT_INSTRUMENTATION' | 'DECLARED_PROCESS'
  path: string
  export: string
}

const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const relative = (root: string, file: string) => path.relative(root, file).replaceAll('\\', '/')
const isTest = (file: string) =>
  /(?:^|[/\\])(?:__tests__|tests|e2e)[/\\]|[.](?:test|spec|stories)[.]/.test(file)

function resolveRelativeImport(
  source: ts.SourceFile,
  specifier: string,
  sourceSet: Set<ts.SourceFile>,
) {
  if (!specifier.startsWith('.')) return undefined
  const base = path.resolve(path.dirname(source.fileName), specifier)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    const resolved = [...sourceSet].find(
      (file) => path.resolve(file.fileName) === path.resolve(candidate),
    )
    if (resolved) return resolved
  }
  return undefined
}

function literalText(node: ts.Node): string | undefined {
  return ts.isStringLiteralLike(node) ? node.text : undefined
}

function bodyScope(node: ts.Node): boolean {
  return (
    (ts.isFunctionLike(node) && 'body' in node && Boolean(node.body)) ||
    (ts.isVariableDeclaration(node) &&
      Boolean(node.initializer) &&
      (ts.isArrowFunction(node.initializer!) ||
        ts.isFunctionExpression(node.initializer!) ||
        ts.isCallExpression(node.initializer!)))
  )
}

function scopeName(node: ts.Node): string {
  if ('name' in node && node.name && typeof node.name === 'object' && 'getText' in node.name)
    return (node.name as ts.Node).getText()
  if (ts.isVariableDeclaration(node.parent)) return node.parent.name.getText()
  if (ts.isPropertyAssignment(node.parent)) return node.parent.name.getText()
  return `callback@${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`
}

/** Source graph only. Reachability and test bindings never imply runtime qualification. */
export function deriveTypeScriptCallerGraph(
  program: ts.Program,
  repositoryRoot: string,
  declaredProcesses: readonly string[] = [],
) {
  const checker = program.getTypeChecker()
  const sources = program.getSourceFiles().filter((file) => {
    const name = relative(repositoryRoot, file.fileName)
    return (
      !file.isDeclarationFile &&
      !name.startsWith('../') &&
      !name.includes('node_modules/') &&
      !isTest(name) &&
      !name.startsWith('apps/union-eyes/scripts/') &&
      !name.includes('/migrations/')
    )
  })
  const sourceSet = new Set(sources)
  const scopes = new Map<ts.Node, CallerNode>()
  const nodes = new Map<string, CallerNode>()
  const roots: CallerRoot[] = []
  const sourceDigests: Record<string, string> = {}
  const nodeFor = (scope: ts.Node) => {
    const file = scope.getSourceFile()
    const sourcePath = relative(repositoryRoot, file.fileName)
    const position = file.getLineAndCharacterOfPosition(scope.getStart())
    const line = position.line + 1
    const symbol = ts.isSourceFile(scope) ? '@module' : scopeName(scope)
    const id = `${sourcePath}#${symbol}:${line}:${position.character + 1}`
    const result: CallerNode = {
      id,
      sourcePath,
      sourceSha256: digest(file.text),
      symbol,
      line,
      mutations: [],
      calls: [],
      roots: [],
      unresolvedCalls: [],
    }
    scopes.set(scope, result)
    nodes.set(id, result)
    return result
  }
  for (const source of sources) {
    sourceDigests[relative(repositoryRoot, source.fileName)] = digest(source.text)
    nodeFor(source)
    const visit = (node: ts.Node) => {
      if (bodyScope(node)) nodeFor(node)
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(source, visit)
  }
  const ownerOf = (node: ts.Node): CallerNode | undefined => {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
      const found = scopes.get(current)
      if (found) return found
    }
    return undefined
  }
  const resolveSymbol = (node: ts.Node) => {
    let symbol = checker.getSymbolAtLocation(node)
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
    return symbol
  }
  const tableName = (node: ts.Node | undefined): string => {
    if (!node) return 'UNRESOLVED_TABLE'
    const symbol = resolveSymbol(node)
    for (const declaration of symbol?.declarations ?? []) {
      if (
        !ts.isVariableDeclaration(declaration) ||
        !declaration.initializer ||
        !ts.isCallExpression(declaration.initializer)
      )
        continue
      const initializer = declaration.initializer
      const callName = initializer.expression.getText()
      if (/(?:pgTable|[.]table)$/.test(callName)) {
        const name = initializer.arguments[0] && literalText(initializer.arguments[0])
        if (name) return name
      }
    }
    return `UNRESOLVED_TABLE:${node.getText().slice(0, 120)}`
  }
  const edge = (from: CallerNode, to: CallerNode | undefined) => {
    if (to && from.id !== to.id && !from.calls.includes(to.id)) from.calls.push(to.id)
  }
  for (const source of sources) {
    const visit = (node: ts.Node) => {
      const owner = ownerOf(node)
      if (!owner) return
      if (
        ts.isFunctionLike(node) &&
        'body' in node &&
        node.body &&
        ts.isBlock(node.body) &&
        node.body.statements.some(
          (statement) =>
            ts.isExpressionStatement(statement) &&
            ts.isStringLiteral(statement.expression) &&
            statement.expression.text === 'use server',
        )
      ) {
        const root: CallerRoot = {
          id: `${owner.id}#server-action`,
          kind: 'SERVER_ACTION',
          path: owner.sourcePath,
          export: owner.symbol,
        }
        roots.push(root)
        owner.roots.push(root.id)
        edge(owner, scopes.get(source))
      }
      if (bodyScope(node)) {
        // Initializers and callbacks execute through their enclosing call, not as independent roots.
        if (
          (ts.isVariableDeclaration(node) &&
            node.initializer &&
            ts.isCallExpression(node.initializer)) ||
          ts.isArrowFunction(node) ||
          ts.isFunctionExpression(node)
        )
          edge(ownerOf(node.parent)!, scopes.get(node))
      }
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
        const signature = checker.getResolvedSignature(node)
        const declaration = signature?.declaration
        if (
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments?.[0] &&
          ts.isStringLiteralLike(node.arguments[0])
        ) {
          const imported = checker
            .getSymbolAtLocation(node.arguments[0])
            ?.declarations?.find(ts.isSourceFile)
          if (imported && sourceSet.has(imported)) edge(owner, scopes.get(imported))
          else owner.unresolvedCalls.push({ expression: node.getText(), line })
        }
        if (declaration && sourceSet.has(declaration.getSourceFile())) {
          const target = ownerOf(declaration)
          if (target && target.symbol !== '@module') edge(owner, target)
          else owner.unresolvedCalls.push({ expression: node.expression.getText(), line })
        }
        for (const argument of node.arguments ?? []) {
          if (!ts.isIdentifier(argument) && !ts.isPropertyAccessExpression(argument)) continue
          const symbol = resolveSymbol(argument)
          for (const callback of symbol?.declarations ?? [])
            if (sourceSet.has(callback.getSourceFile()) && bodyScope(callback))
              edge(owner, scopes.get(callback))
        }
        const member = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ''
        const provider = declaration?.getSourceFile().fileName.replaceAll('\\', '/') ?? ''
        if (['insert', 'update', 'delete'].includes(member) && /drizzle-orm/.test(provider)) {
          owner.mutations.push({
            operation: member.toUpperCase() as MutationOperation,
            table: tableName(node.arguments?.[0]),
            evidence: node.expression.getText(),
            line,
          })
        }
        if (['query', 'execute', '$executeRaw', '$executeRawUnsafe', 'unsafe'].includes(member)) {
          for (const argument of node.arguments ?? []) {
            const text = ts.isStringLiteralLike(argument)
              ? argument.text
              : ts.isTaggedTemplateExpression(argument)
                ? argument.template.getText()
                : undefined
            if (!text) {
              owner.mutations.push({
                operation: 'UNKNOWN',
                table: 'UNRESOLVED_DYNAMIC_SQL',
                evidence: 'NON_LITERAL_QUERY_REQUIRES_RECONCILIATION',
                line,
              })
              continue
            }
            for (const match of text.matchAll(
              /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+((?:"?[a-z_]\w*"?\.)?"?[a-z_]\w*"?)/gi,
            ))
              owner.mutations.push({
                operation: match[1].toUpperCase().split(/\s/)[0] as MutationOperation,
                table: match[2].replaceAll('"', ''),
                evidence: 'SQL_LITERAL',
                line,
              })
            if (
              /\b(?:INSERT|UPDATE|DELETE)\b/i.test(text) &&
              !owner.mutations.some((item) => item.line === line)
            )
              owner.mutations.push({
                operation: /\bDELETE\b/i.test(text)
                  ? 'DELETE'
                  : /\bINSERT\b/i.test(text)
                    ? 'INSERT'
                    : 'UPDATE',
                table: 'UNRESOLVED_DYNAMIC_SQL',
                evidence: 'SQL_TEMPLATE_REQUIRES_RECONCILIATION',
                line,
              })
          }
        }
      }
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
        const symbol = checker.getSymbolAtLocation(node.moduleSpecifier)
        const imported =
          symbol?.declarations?.find(ts.isSourceFile) ??
          (ts.isStringLiteralLike(node.moduleSpecifier)
            ? resolveRelativeImport(source, node.moduleSpecifier.text, sourceSet)
            : undefined)
        if (imported && sourceSet.has(imported)) edge(scopes.get(source)!, scopes.get(imported))
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(source, visit)
    const file = relative(repositoryRoot, source.fileName)
    const moduleSymbol = checker.getSymbolAtLocation(source)
    const exports = moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []
    const serverAction = source.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === 'use server',
    )
    for (const exported of exports) {
      const name = exported.name
      const nextRoute =
        /apps\/union-eyes\/app\/.*\/route[.]tsx?$/.test(file) &&
        /^(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)$/.test(name)
      const instrumentation =
        /apps\/union-eyes\/(?:src\/)?instrumentation[.]tsx?$/.test(file) && name === 'register'
      if (!nextRoute && !serverAction && !instrumentation) continue
      const symbol =
        exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
      const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0]
      const target = declaration && ownerOf(declaration)
      if (!target || target.symbol === '@module') continue
      const root: CallerRoot = {
        id: `${file}#${name}`,
        kind: nextRoute ? 'NEXT_HTTP' : instrumentation ? 'NEXT_INSTRUMENTATION' : 'SERVER_ACTION',
        path: file,
        export: name,
      }
      roots.push(root)
      target.roots.push(root.id)
      scopes.get(source)?.roots.push(root.id)
    }
    if (declaredProcesses.includes(file)) {
      const root: CallerRoot = {
        id: `${file}#process`,
        kind: 'DECLARED_PROCESS',
        path: file,
        export: '@module',
      }
      roots.push(root)
      scopes.get(source)!.roots.push(root.id)
    }
  }
  const origins = new Map<string, Set<string>>()
  const queue = [...nodes.values()].filter((node) => node.roots.length).map((node) => node.id)
  const pending = new Set(queue)
  for (const id of queue) origins.set(id, new Set(nodes.get(id)!.roots))
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = nodes.get(queue[cursor])!
    pending.delete(node.id)
    for (const called of node.calls) {
      const set = origins.get(called) ?? new Set<string>()
      const before = set.size
      for (const root of origins.get(node.id)!) set.add(root)
      origins.set(called, set)
      if (set.size !== before && !pending.has(called)) {
        pending.add(called)
        queue.push(called)
      }
    }
  }
  const mutating = new Set(
    [...nodes.values()]
      .filter((node) => origins.has(node.id) && node.mutations.length)
      .map((node) => node.id),
  )
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes.values())
      if (
        origins.has(node.id) &&
        !mutating.has(node.id) &&
        node.calls.some((called) => mutating.has(called))
      ) {
        mutating.add(node.id)
        changed = true
      }
  }
  const callers = [...mutating].sort().map((id) => {
    const node = nodes.get(id)!
    return { ...node, calls: node.calls.sort(), roots: [...origins.get(id)!].sort() }
  })
  return {
    roots: roots.sort((a, b) => a.id.localeCompare(b.id)),
    callers,
    sourceDigests,
    unreachableDirectWriters: [...nodes.values()].filter(
      (node) => !origins.has(node.id) && node.mutations.length,
    ),
    unresolvedReachableCalls: [...nodes.values()]
      .filter((node) => origins.has(node.id) && node.unresolvedCalls.length)
      .map((node) => ({ id: node.id, calls: node.unresolvedCalls })),
    limitations: [
      'Static signature reachability is not runtime qualification.',
      'Dependency injection, dynamic SQL, runtime dispatch and external library mutations require explicit reconciliation.',
      'A source-level callback edge is conservative; a root path does not prove every branch executes.',
    ],
  }
}
