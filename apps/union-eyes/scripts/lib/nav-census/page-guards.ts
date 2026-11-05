/**
 * The role a dashboard page or layout turns a caller away for.
 *
 * Only a guard whose result decides a redirect counts: `if (!(await hasMinRole('steward'))) redirect('/dashboard')`, or the same through a variable
 * (`const hasAccess = await hasMinRole('steward'); if (!hasAccess) redirect(...)`). A role check that only decides what a page shows
 * (`const canSign = await hasMinRole('officer')` passed to a component) does not refuse anybody, so it is not read as a guard.
 * Guards written another way are not found: the census built on this can miss a refusal, never invent one.
 */
import ts from 'typescript'

const GUARD_CALLS = new Set(['hasMinRole', 'requireMinRole'])
const LEAVING_CALLS = new Set(['redirect', 'permanentRedirect', 'notFound'])

function unwrap(node: ts.Expression): ts.Expression {
  let current = node
  while (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) current = current.expression
  return current
}

/** The role a call to a guard function names, when it names one as a string. */
function roleOfCall(node: ts.Expression): string | null {
  const call = unwrap(node)
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || !GUARD_CALLS.has(call.expression.text)) return null
  const [argument] = call.arguments
  return argument && ts.isStringLiteralLike(argument) ? argument.text : null
}

function leaves(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && LEAVING_CALLS.has(child.expression.text)) {
      found = true
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

/** The roles whose absence makes `condition` true: `!guard`, and any of them joined with `||`. */
function denialRoles(condition: ts.Expression, bound: ReadonlyMap<string, string>): string[] {
  const expression = unwrap(condition)
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = unwrap(expression.operand)
    const role = roleOfCall(operand) ?? (ts.isIdentifier(operand) ? bound.get(operand.text) ?? null : null)
    return role ? [role] : []
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    return [...denialRoles(expression.left, bound), ...denialRoles(expression.right, bound)]
  }
  return []
}

/** The roles a source file refuses a caller below, each at least once: every guard whose denial redirects. */
export function redirectingGuards(source: string, fileName = 'page.tsx'): string[] {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const bound = new Map<string, string>()
  const roles: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const role = roleOfCall(node.initializer)
      if (role) bound.set(node.name.text, role)
    }
    if (ts.isIfStatement(node) && leaves(node.thenStatement)) roles.push(...denialRoles(node.expression, bound))
    if (ts.isExpressionStatement(node)) {
      const role = roleOfCall(node.expression)
      if (role) roles.push(role)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return [...new Set(roles)]
}
