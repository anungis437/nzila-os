import { readFileSync } from 'node:fs'
import ts from 'typescript'

/**
 * Which named operations of a module actually reach a given call, and whether a route invokes any of them.
 *
 * The route scan used to call a route two-phase (INTENT_OUTCOME) when ANY module it can reach contained `performAuditedOperation(`, so a
 * route that only created a chat session was labelled like a route that calls an AI provider, because the service that holds both also
 * holds the provider call. This reads the modules as syntax: every named scope (function, const initializer, class method or property) is
 * recorded with the names it calls, a scope that calls the target directly is marked, a scope that calls a marked scope is marked, and a
 * route is two-phase only if it mentions the name of a marked scope. A route's own direct call still counts as before.
 *
 * Matching is by name, so a common name shared with an unrelated scope can only widen the result (a route stays two-phase), never hide a
 * real call. A reachable module whose call to the target sits outside any named scope cannot be attributed, so the scan falls back to the old
 * file-level answer for it rather than guess.
 */
export interface Scope {
  name: string
  /** Every name called anywhere inside the scope, nested functions included. */
  calls: Set<string>
  /** The scope calls the target itself. */
  direct: boolean
}

export interface ModuleScopes {
  scopes: Scope[]
  /** The target is called outside every named scope (module level), so it cannot be attributed to a name. */
  unattributed: boolean
}

function calleeName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  if (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression)) return calleeName(expression.expression)
  return null
}

function collect(node: ts.Node, target: string): { calls: Set<string>; direct: boolean } {
  const calls = new Set<string>()
  let direct = false
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child)) {
      const name = calleeName(child.expression)
      if (name) {
        calls.add(name)
        if (name === target) direct = true
      }
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return { calls, direct }
}

const nameOf = (name: ts.PropertyName | ts.BindingName | undefined): string | null =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) ? name.text : null

export function scopesOf(text: string, target: string, fileName = 'module.ts'): ModuleScopes {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const scopes: Scope[] = []
  let unattributed = false
  const add = (name: string | null, node: ts.Node) => {
    const found = collect(node, target)
    if (name) scopes.push({ name, ...found })
    else if (found.direct) unattributed = true
  }

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)) add(nameOf(statement.name), statement)
    else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) add(nameOf(declaration.name), declaration)
    } else if (ts.isClassDeclaration(statement)) {
      for (const member of statement.members) {
        if (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member) || ts.isPropertyDeclaration(member)) add(nameOf(member.name), member)
        else if (ts.isConstructorDeclaration(member)) add('constructor', member)
      }
    } else {
      // An export default, an expression statement or any other module-level statement has no name to attribute a call to.
      add(null, statement)
    }
  }
  return { scopes, unattributed }
}

/** The names whose scopes reach the target, directly or through other scopes of the given modules. */
export function reachingNames(modules: ModuleScopes[]): Set<string> {
  const reaching = new Set<string>()
  for (const module of modules) for (const scope of module.scopes) if (scope.direct) reaching.add(scope.name)
  let grew = true
  while (grew) {
    grew = false
    for (const module of modules) {
      for (const scope of module.scopes) {
        if (reaching.has(scope.name)) continue
        for (const call of scope.calls) {
          if (reaching.has(call)) {
            reaching.add(scope.name)
            grew = true
            break
          }
        }
      }
    }
  }
  return reaching
}

/** Every identifier a route's source mentions outside its import declarations: what it can invoke, call or hand on as a value. */
export function mentionedNames(routeSource: string): Set<string> {
  const source = ts.createSourceFile('route.ts', routeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const names = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) return
    if (ts.isIdentifier(node)) names.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

export const TWO_PHASE_TARGET = 'performAuditedOperation'

/**
 * Whether a route invokes an operation that reaches the target. `reached` are the first-party modules the route can reach (already
 * resolved by the scan) and `skip` the file that defines the target itself.
 */
export function invokesTarget(
  routeSource: string,
  reached: string[],
  target: string = TWO_PHASE_TARGET,
  read: (file: string) => string = (file) => readFileSync(file, 'utf8'),
): boolean {
  const containing = reached.filter((file) => read(file).includes(`${target}(`))
  if (containing.length === 0) return false
  const modules = containing.map((file) => scopesOf(read(file), target, file))
  // A call the scan cannot attribute to any name is treated as reachable, as before.
  if (modules.some((module) => module.unattributed)) return true
  // Scopes of every reachable module take part in the closure, so an intermediary in a module without the target still links the route to it.
  const all = reached.filter((file) => !containing.includes(file)).map((file) => scopesOf(read(file), target, file))
  const reaching = reachingNames([...modules, ...all])
  const mentioned = mentionedNames(routeSource)
  for (const name of reaching) if (mentioned.has(name)) return true
  return false
}
