/**
 * The JSON body a frontend request sends (UE-CONV-H-025): the keys of the object literal a `fetch` (or an axios-style verb call) puts in `JSON.stringify(...)`.
 *
 * Syntax only, one file at a time, like the rest of the frontend census. A body is read when it is an object literal, or an identifier declared in the enclosing
 * scopes with an object literal as its initializer; a spread of something the syntax cannot read makes the body `open` (it may carry more keys than listed);
 * a body held in React state, a parameter, a form data object or anything else is not read, never guessed.
 */
import ts from 'typescript'

export type Presence = 'always' | 'maybe'

export interface RequestBody {
  /** Every key the call sends; `maybe` when a condition decides (`...(flag ? { a } : {})`). */
  keys: Map<string, Presence>
  /** The body may carry keys this list does not have: a spread of a value the syntax cannot read, or a computed key. */
  open: boolean
}

const VERBS = new Set(['post', 'put', 'patch', 'delete'])
const MAX_DEPTH = 6

export function unwrap(node: ts.Expression): ts.Expression {
  let current = node
  for (;;) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current) || ts.isTypeAssertionExpression(current)) current = current.expression
    else return current
  }
}

export const propertyName = (name: ts.PropertyName): string | null => (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) ? name.text : null)

interface Declaration {
  initializer: ts.Expression
  /** The block the name is declared in: later `name.key = ...` assignments in it add keys to the object. */
  scope: ts.Node
  /** `const [form, setForm] = useState({...})`: the initializer is only the first shape, the setter changes it. */
  state: boolean
}

/** The closest `const`/`let` of that name in the scopes around the identifier, or null (a parameter, a destructuring, an import). */
export function declarationOf(identifier: ts.Identifier): Declaration | null {
  for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
    const statements = ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) || ts.isCaseClause(scope) || ts.isDefaultClause(scope) ? scope.statements : undefined
    if (!statements) continue
    for (const statement of statements) {
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!declaration.initializer) continue
        if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier.text) return { initializer: declaration.initializer, scope, state: false }
        if (ts.isArrayBindingPattern(declaration.name)) {
          const first = declaration.name.elements[0]
          const call = unwrap(declaration.initializer)
          const isState = ts.isCallExpression(call) && (ts.isIdentifier(call.expression) ? call.expression.text === 'useState' : ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'useState')
          if (first && ts.isBindingElement(first) && ts.isIdentifier(first.name) && first.name.text === identifier.text && isState && ts.isCallExpression(call) && call.arguments[0]) return { initializer: call.arguments[0], scope, state: true }
        }
      }
    }
  }
  return null
}

const isAssignment = (node: ts.BinaryExpression): boolean => node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment

const isNamed = (expression: ts.Expression, name: string): boolean => {
  const node = unwrap(expression)
  return ts.isIdentifier(node) && node.text === name
}

/** `body.key = ...`, `body['key'] = ...` and `Object.assign(body, ...)` after the literal change what it sends: a keyed one adds a conditional key, anything else leaves the keys unknown. */
function addMutations(scope: ts.Node, name: string, body: RequestBody): void {
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && isAssignment(node)) {
      const target = unwrap(node.left)
      if (ts.isPropertyAccessExpression(target) && isNamed(target.expression, name)) {
        if (body.keys.get(target.name.text) !== 'always') body.keys.set(target.name.text, 'maybe')
      } else if (ts.isElementAccessExpression(target) && isNamed(target.expression, name)) {
        const key = unwrap(target.argumentExpression)
        if (ts.isStringLiteralLike(key)) {
          if (body.keys.get(key.text) !== 'always') body.keys.set(key.text, 'maybe')
        } else body.open = true
      }
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'assign' && node.arguments[0] && isNamed(node.arguments[0], name)) {
      body.open = true
    }
    ts.forEachChild(node, visit)
  }
  visit(scope)
}

function addAll(into: RequestBody, from: RequestBody, presence: Presence | null): void {
  for (const [key, value] of from.keys) {
    const merged: Presence = presence === 'maybe' || value === 'maybe' ? 'maybe' : 'always'
    if (into.keys.get(key) !== 'always') into.keys.set(key, merged)
  }
  if (from.open) into.open = true
}

/** The keys of an expression that evaluates to an object, or null when the syntax does not say. */
export function objectKeysOf(expression: ts.Expression, depth = 0): RequestBody | null {
  if (depth > MAX_DEPTH) return null
  const node = unwrap(expression)
  if (ts.isIdentifier(node)) {
    const declaration = declarationOf(node)
    if (!declaration) return null
    const body = objectKeysOf(declaration.initializer, depth + 1)
    if (!body) return null
    if (declaration.state) body.open = true
    else addMutations(declaration.scope, node.text, body)
    return body
  }
  if (!ts.isObjectLiteralExpression(node)) return null
  const body: RequestBody = { keys: new Map(), open: false }
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name = propertyName(property.name)
      if (name === null) body.open = true
      else body.keys.set(name, 'always')
    } else if (ts.isShorthandPropertyAssignment(property)) {
      body.keys.set(property.name.text, 'always')
    } else if (ts.isSpreadAssignment(property)) {
      const spread = unwrap(property.expression)
      const branches: ts.Expression[] = []
      let conditional = false
      if (ts.isConditionalExpression(spread)) {
        branches.push(spread.whenTrue, spread.whenFalse)
        conditional = true
      } else if (ts.isBinaryExpression(spread) && (spread.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || spread.operatorToken.kind === ts.SyntaxKind.BarBarToken || spread.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
        branches.push(spread.right)
        conditional = true
      } else branches.push(spread)
      for (const branch of branches) {
        const inner = unwrap(branch)
        // `false`, `null`, `undefined` and `{}` add nothing.
        if (inner.kind === ts.SyntaxKind.FalseKeyword || inner.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(inner) && inner.text === 'undefined')) continue
        const keys = objectKeysOf(inner, depth + 1)
        if (keys) addAll(body, keys, conditional ? 'maybe' : null)
        else body.open = true
      }
    }
  }
  return body
}

const calleeName = (call: ts.CallExpression): string | null => (ts.isIdentifier(call.expression) ? call.expression.text : ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : null)

/**
 * The body of the request the URL expression belongs to: `undefined` when the call sends none (a GET), `null` when it sends one the syntax cannot read, else its keys.
 * `url` is the node the URL string was read from.
 */
export function requestBodyOf(url: ts.Node): RequestBody | null | undefined {
  let child: ts.Node = url
  let parent = url.parent
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent))) {
    child = parent
    parent = parent.parent
  }
  if (!parent || !ts.isCallExpression(parent) || parent.arguments[0] !== child) return undefined
  const name = calleeName(parent)
  if (name === null) return undefined
  if (ts.isPropertyAccessExpression(parent.expression) && VERBS.has(name)) {
    const argument = parent.arguments[1]
    return argument ? objectKeysOf(argument) : undefined
  }
  if (!(/fetch/i.test(name) || name === 'request' || name === 'apiRequest')) return undefined
  const options = parent.arguments[1]
  if (!options) return undefined
  const literal = unwrap(options)
  if (!ts.isObjectLiteralExpression(literal)) return null
  const property = literal.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propertyName(p.name) === 'body')
  if (!property) return literal.properties.some((p) => ts.isSpreadAssignment(p)) ? null : undefined
  const value = unwrap(property.initializer)
  if (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression) && value.expression.expression.getText() === 'JSON' && value.expression.name.text === 'stringify' && value.arguments[0]) {
    return objectKeysOf(value.arguments[0])
  }
  // A helper that wraps fetch (`apiFetch(url, { method: 'POST', body: { a, b } })`) takes the object and serializes it; native fetch takes a string.
  if (name !== 'fetch') return objectKeysOf(value)
  return null
}
