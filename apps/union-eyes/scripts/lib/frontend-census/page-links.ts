/**
 * Which page a link goes to (UE-CONV-H-020). Pure: the links come from the source text, the pages from the file names under app/.
 *
 * The frontend-to-API census proves that what a screen fetches is served; this proves the other thing a screen offers, a way to somewhere else. A `<Link>`,
 * a `router.push`, a `redirect` or a navigation entry whose path no page serves is a button that ends in a 404, and no unit test notices: the link is a
 * string, and the page it should reach is a different file.
 *
 * A link is a string that starts with `/` in a place that navigates: a JSX `href`/`to`, a `href:` (or `actionUrl:`, `redirectTo:` ...) property, a
 * `redirect()` or `router.push()` argument, an assignment to `location.href`. Template substitutions are unknown values (DYNAMIC), except one named for the
 * locale (LOCALE): `/${locale}/dashboard/${id}` is the dashboard page of a record. The path is judged the way Next.js serves it: route groups `(x)` do
 * not appear in a URL, `[x]` matches one segment, `[...x]` one or more, `[[...x]]` none or more, a path without a locale is served by a root page or
 * redirected to the default locale, and a catch-all with nothing literal before it (here, one that only redirects) is not counted as a page.
 */
import ts from 'typescript'
import { DYNAMIC } from './client-calls'

/** A template substitution that is the locale (`${locale}`, `${params.locale}`, `${currentLocale}`). */
export const LOCALE = '\u0002'

export interface PageLink {
  path: string
  line: number
  via: string
}

const JSX_ATTRIBUTES = new Set(['href', 'to'])
const PROPERTIES = new Set(['href', 'actionUrl', 'redirectTo', 'redirectUrl', 'callbackUrl', 'returnTo', 'link', 'url'])
const REDIRECTS = new Set(['redirect', 'permanentRedirect'])
const ROUTER_METHODS = new Set(['push', 'replace', 'prefetch'])
const ROUTER_NAME = /router|navigat|\bnav\b/i
/** Helpers that put the locale in front of the path they are given. */
const LOCALIZING_HELPERS = new Set(['withLocale', 'localizedHref'])
/** Helpers that return the path they are given, with a query added. */
const PASSING_HELPERS = new Set(['withInstitutionalContext'])

/** The paths an expression can evaluate to, with unknown parts marked; empty when it is not a string the census can read. */
export function pathsOf(node: ts.Expression): string[] {
  if (ts.isStringLiteralLike(node)) return [node.text]
  if (ts.isTemplateExpression(node)) {
    let paths = [node.head.text]
    for (const span of node.templateSpans) {
      const marker = /locale/i.test(span.expression.getText()) ? LOCALE : DYNAMIC
      paths = paths.map((path) => `${path}${marker}${span.literal.text}`)
    }
    return paths
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return pathsOf(node.expression)
  if (ts.isConditionalExpression(node)) return [...pathsOf(node.whenTrue), ...pathsOf(node.whenFalse)]
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = pathsOf(node.left)
      const right = pathsOf(node.right)
      return (left.length ? left : [DYNAMIC]).flatMap((a) => (right.length ? right : [DYNAMIC]).map((b) => `${a}${b}`))
    }
    if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return [...pathsOf(node.left), ...pathsOf(node.right)]
    return []
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments[0]) {
    const inner = pathsOf(node.arguments[0])
    if (LOCALIZING_HELPERS.has(node.expression.text)) return inner.map((path) => `/${LOCALE}${path}`)
    if (PASSING_HELPERS.has(node.expression.text)) return inner
  }
  return []
}

const isInternalPath = (path: string): boolean => path.startsWith('/') && !path.startsWith('//') && !/\s/.test(path)

export function extractPageLinksFromSource(source: ts.SourceFile): PageLink[] {
  const links: PageLink[] = []
  const add = (node: ts.Node, expression: ts.Expression | undefined, via: string): void => {
    if (!expression) return
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    for (const path of pathsOf(expression)) if (isInternalPath(path)) links.push({ path, line: line + 1, via })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && JSX_ATTRIBUTES.has(node.name.text) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) add(node, node.initializer, 'jsx')
      else if (ts.isJsxExpression(node.initializer)) add(node, node.initializer.expression, 'jsx')
    } else if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && PROPERTIES.has(node.name.text)) {
      add(node, node.initializer, node.name.text)
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isIdentifier(callee) && REDIRECTS.has(callee.text)) add(node, node.arguments[0], callee.text)
      else if (ts.isPropertyAccessExpression(callee) && ROUTER_METHODS.has(callee.name.text) && ts.isIdentifier(callee.expression) && ROUTER_NAME.test(callee.expression.text)) add(node, node.arguments[0], `router.${callee.name.text}`)
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'href' && /location$/.test(node.left.expression.getText())) {
      add(node, node.right, 'location.href')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return links
}

export function extractPageLinks(file: string, text: string): PageLink[] {
  return extractPageLinksFromSource(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[mc]?[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS))
}

type Segment = { kind: 'literal'; value: string } | { kind: 'param' } | { kind: 'catchall'; optional: boolean }

export interface PageRoute {
  /** The route file relative to the app directory: `[locale]/dashboard/members/page.tsx`. */
  file: string
  segments: Segment[]
  /** Under `[locale]`: served with a locale in the URL. A root page is served without one. */
  localized: boolean
}

/** The route a `page.*` (or a `route.*` outside app/api, which answers a link's GET) stands for; null for what is not reachable by URL (parallel slots, private folders, intercepting routes). */
export function pageRouteOf(file: string): PageRoute | null {
  const parts = file.split('/')
  const name = parts.pop() ?? ''
  if (!/^(page|route)\.(tsx|ts|jsx|js|mdx)$/.test(name)) return null
  if (name.startsWith('route.') && parts[0] === 'api') return null
  const segments: Segment[] = []
  let localized = false
  for (const [index, part] of parts.entries()) {
    if (part.startsWith('@') || part.startsWith('_') || /^\(\.{1,3}\)/.test(part)) return null
    if (/^\(.*\)$/.test(part)) continue
    if (index === 0 && part === '[locale]') {
      localized = true
      continue
    }
    if (/^\[\[\.\.\..+\]\]$/.test(part)) segments.push({ kind: 'catchall', optional: true })
    else if (/^\[\.\.\..+\]$/.test(part)) segments.push({ kind: 'catchall', optional: false })
    else if (/^\[.+\]$/.test(part)) segments.push({ kind: 'param' })
    else segments.push({ kind: 'literal', value: part })
  }
  return { file, segments, localized }
}

export function pageRoutesOf(files: readonly string[]): PageRoute[] {
  // A catch-all with nothing literal before it matches every path; here the one that exists only redirects to the default locale, and counting it would let every dead link through.
  return files.map(pageRouteOf).filter((route): route is PageRoute => route !== null && route.segments[0]?.kind !== 'catchall')
}

/** Whether a segment of a link (which may hold unknown parts) can be the literal segment of a route. */
function literalMatches(client: string, value: string): boolean {
  if (!/[\u0001\u0002]/.test(client)) return client === value
  const pattern = client
    .split(/[\u0001\u0002]/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${pattern}$`).test(value)
}

function matches(client: readonly string[], route: readonly Segment[], i = 0, j = 0): boolean {
  if (j === route.length) return i === client.length
  const segment = route[j]
  if (segment.kind === 'catchall') return segment.optional || i < client.length
  if (i === client.length) return false
  if (segment.kind === 'param') return matches(client, route, i + 1, j + 1)
  return literalMatches(client[i], segment.value) && matches(client, route, i + 1, j + 1)
}

export type LinkVerdict = 'OK' | 'PAGE_MISSING' | 'UNANALYZED'

export function judgeLink(link: string, pages: readonly PageRoute[], locales: readonly string[]): LinkVerdict {
  const path = link.split(/[?#]/)[0]
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path
  // Not a page: an endpoint, a build asset, a file.
  if (trimmed === '/api' || trimmed.startsWith('/api/') || trimmed.startsWith('/_next/') || /\.[a-z0-9]{2,5}$/i.test(trimmed)) return 'OK'
  const segments = trimmed.split('/').filter(Boolean)
  // With nothing literal in it (a path made only of unknown parts) there is nothing to judge.
  if (segments.length > 0 && segments.every((segment) => segment.replace(/[\u0001\u0002]/g, '') === '')) return 'UNANALYZED'

  const [first, ...rest] = segments
  const candidates: Array<{ localized: boolean; client: string[] }> = []
  if (first === undefined) candidates.push({ localized: false, client: [] })
  else if (locales.includes(first)) candidates.push({ localized: true, client: rest })
  else if (first.startsWith(LOCALE)) {
    const remainder = first.slice(1)
    candidates.push({ localized: true, client: remainder === '' ? rest : [remainder, ...rest] })
  } else {
    candidates.push({ localized: false, client: segments })
    // A wholly unknown first segment may be the locale.
    if (first === DYNAMIC) candidates.push({ localized: true, client: rest })
  }
  // A path with no locale is served by a root page, or redirected to the default locale and served there.
  return candidates.some((candidate) => pages.some((page) => (candidate.localized ? page.localized : true) && matches(candidate.client, page.segments))) ? 'OK' : 'PAGE_MISSING'
}
