/**
 * Which `/api/...` URLs the frontend asks for (UE-CONV-H-018).
 *
 * The code-to-database census proves that the application's SQL is valid. It says nothing about the other seam: a page, a component or a hook that fetches a
 * route nobody wrote, a method the route does not export, or a route that answers 501 because its capability was never built. Each is a screen that looks
 * finished and fails when used. This reads every string the frontend builds that starts with `/api/` (a literal, a template, a concatenation), turns each
 * dynamic part into a wildcard, and says which route files could serve it (route-match.ts).
 *
 * No type checker: only the syntax of one file at a time, so a URL that is assembled somewhere else (a base-URL variable, a helper that returns a path) is
 * counted as unresolved, never guessed.
 */
import ts from 'typescript'

/** Stands for a part of a URL the source computes. */
export const DYNAMIC = '\u0001'

export interface ClientCall {
  file: string
  line: number
  /** The URL with every computed part replaced by DYNAMIC, query string and hash removed. */
  pattern: string
  /** True when the source writes it with a trailing slash, as a prefix (`/api/scim/v2/`): any route beneath it serves it. */
  prefix: boolean
  /** The HTTP method when the call says it (fetch options, an axios-style verb), else null. */
  method: string | null
  /** How the URL is used: `fetch`, `verb`, `swr`, `href`, `form`, `window`, `property` or `value`. */
  via: string
}

const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete'])
const SWR_HOOKS = new Set(['useSWR', 'useSWRImmutable', 'useQuery', 'useSuspenseQuery'])

type Part = { text: string } | { dynamic: true }

/** The static shape of an expression that builds a string, or null when it does not start as one. */
function partsOf(node: ts.Expression): Part[] | null {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return partsOf(node.expression)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ text: node.text }]
  if (ts.isTemplateExpression(node)) {
    const parts: Part[] = [{ text: node.head.text }]
    for (const span of node.templateSpans) {
      parts.push({ dynamic: true }, { text: span.literal.text })
    }
    return parts
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = partsOf(node.left)
    if (!left) return null
    const right = partsOf(node.right) ?? [{ dynamic: true as const }]
    return [...left, ...right]
  }
  return null
}

/** The URL pattern of the parts, or null when they do not begin with `/api/`. Everything after the first `?` or `#` is dropped. */
export function patternOf(parts: Part[]): string | null {
  let out = ''
  for (const part of parts) out += 'text' in part ? part.text : DYNAMIC
  if (!(out === '/api' || out.startsWith('/api/') || out.startsWith('/api?'))) return null
  const cut = out.search(/[?#]/)
  if (cut >= 0) out = out.slice(0, cut)
  // A computed part right after a segment's last character is the query string a helper appended (`/api/x${qs}`), not a path segment.
  out = out.replace(new RegExp(`([^/${DYNAMIC}])${DYNAMIC}+$`), '$1')
  return out.length > 1 ? out.replace(/\/+$/, '') || '/' : out
}

const methodFromOptions = (options: ts.Expression | undefined): string | null => {
  if (!options) return 'GET'
  if (!ts.isObjectLiteralExpression(options)) return null
  const property = options.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'method')
  if (!property) return options.properties.some((p) => ts.isSpreadAssignment(p)) ? null : 'GET'
  return ts.isStringLiteralLike(property.initializer) ? property.initializer.text.toUpperCase() : null
}

const calleeName = (call: ts.CallExpression): { name: string; verb: boolean } | null => {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return { name: callee.text, verb: false }
  if (ts.isPropertyAccessExpression(callee)) return { name: callee.name.text, verb: VERBS.has(callee.name.text) }
  return null
}

function classify(node: ts.Expression): { method: string | null; via: string } {
  let child: ts.Node = node
  let parent = node.parent
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent))) {
    child = parent
    parent = parent.parent
  }
  if (parent && ts.isCallExpression(parent) && parent.arguments[0] === child) {
    const callee = calleeName(parent)
    if (callee) {
      if (callee.verb) return { method: callee.name.toUpperCase(), via: 'verb' }
      if (SWR_HOOKS.has(callee.name)) return { method: 'GET', via: 'swr' }
      if (/fetch/i.test(callee.name) || callee.name === 'request' || callee.name === 'apiRequest') return { method: methodFromOptions(parent.arguments[1]), via: 'fetch' }
      if (callee.name === 'open') return { method: 'GET', via: 'window' }
      if (callee.name === 'sendBeacon') return { method: 'POST', via: 'window' }
    }
    return { method: null, via: 'value' }
  }
  if (parent && ts.isNewExpression(parent) && parent.arguments?.[0] === child && ts.isIdentifier(parent.expression) && parent.expression.text === 'EventSource') {
    return { method: 'GET', via: 'window' }
  }
  if (parent && ts.isJsxAttribute(parent)) {
    const name = parent.name.getText()
    if (name === 'action') {
      const opening = parent.parent.parent as ts.JsxOpeningLikeElement
      const method = opening.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === 'method')
      const value = method?.initializer && ts.isStringLiteral(method.initializer) ? method.initializer.text.toUpperCase() : 'GET'
      return { method: value, via: 'form' }
    }
    if (name === 'href' || name === 'src') return { method: 'GET', via: 'href' }
  }
  if (parent && ts.isPropertyAssignment(parent) && parent.initializer === child && ts.isObjectLiteralExpression(parent.parent)) {
    const method = parent.parent.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'method')
    return { method: method && ts.isStringLiteralLike(method.initializer) ? method.initializer.text.toUpperCase() : null, via: 'property' }
  }
  return { method: null, via: 'value' }
}

const STRING_TESTS = new Set(['startsWith', 'endsWith', 'includes', 'indexOf', 'match', 'test', 'replace', 'replaceAll', 'split', 'localeCompare'])
const COMPARISONS = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken])

/** A URL held only to be compared with another (`path.startsWith('/api/x')`, `path === '/api/x'`, `case '/api/x':`) is a matcher, not a request. */
function isMatcher(node: ts.Node): boolean {
  const parent = node.parent
  if (ts.isCaseClause(parent)) return true
  if (ts.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) return true
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && STRING_TESTS.has(parent.expression.name.text)) return true
  return false
}

/** Every `/api/...` URL the source builds, with the method when it can be told. */
export function extractApiCalls(file: string, text: string): ClientCall[] {
  const kind = /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return extractFromSource(file, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)).map(({ node: _node, ...call }) => call)
}

/** The same, from a parsed file, with the node each URL was read from (so a caller that has a type checker can ask what runs it). */
export function extractFromSource(file: string, source: ts.SourceFile): Array<ClientCall & { node: ts.Node }> {
  const calls: Array<ClientCall & { node: ts.Node }> = []

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node) || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      const parts = partsOf(node as ts.Expression)
      const pattern = parts ? patternOf(parts) : null
      // A bare `/api`, or a glob such as `/api/*`, names the prefix (a robots rule, a deprecation matcher), not a request.
      if (pattern && pattern !== '/api' && !pattern.includes('*')) {
        // An import specifier or a type position is not a request.
        if (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isLiteralTypeNode(node.parent) || isMatcher(node)) return
        const { method, via } = classify(node as ts.Expression)
        const last = parts?.[parts.length - 1]
        const prefix = !!last && 'text' in last && /\/(?:[?#].*)?$/.test(last.text) && !last.text.startsWith('?')
        calls.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, pattern, prefix, method, via, node })
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return calls
}
