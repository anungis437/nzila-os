/**
 * A route file that only re-exports the handlers of another route file has no authorization text of its own: the access decision is the target's.
 * The contract tests that look for an authorization token in a route's own text accept such an alias only through this recogniser, which requires
 * that
 *   1. the file is nothing but re-exports of other route modules (and route segment configuration), so it cannot add behaviour of its own, and
 *   2. every target, followed through further aliases, is itself accepted by the calling contract's own predicate.
 * An alias of a route that fails the contract fails it too, an alias of a route that does not exist fails, and so does a cycle. A re-export of
 * anything that is not a route module (a library, another package) is not an alias. ue-route-aliases.test.ts proves the exemption is narrow, so it
 * cannot be reached by a route that does anything.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
const LINE_COMMENT = /(^|[^:])\/\/.*$/gm
const REEXPORT = /export\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]\s*;?/g
const SEGMENT_CONFIG = /export\s+const\s+(?:dynamic|runtime|maxDuration|revalidate|preferredRegion|fetchCache|dynamicParams)\s*=\s*[^;\n]+;?/g
const MAX_ALIAS_DEPTH = 5

/** The module specifiers a file re-exports, or null when the file is anything other than re-exports and route segment configuration. */
export function reexportedSpecifiers(content: string): string[] | null {
  const code = content.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1')
  const specifiers = [...code.matchAll(REEXPORT)].map((match) => match[1])
  if (specifiers.length === 0) return null
  const rest = code.replace(REEXPORT, '').replace(SEGMENT_CONFIG, '').trim()
  return rest === '' ? specifiers : null
}

function resolveRouteModule(fromFile: string, specifier: string): string | null {
  if (!/^\.{1,2}\//.test(specifier)) return null
  const base = resolve(dirname(fromFile), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'route.ts'), resolve(base, 'route.tsx')]) {
    if (/[\\/]route\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate
  }
  return null
}

export function isReexportAliasOfAcceptedRoute(
  routeFile: string,
  content: string,
  accepts: (targetFile: string, targetContent: string) => boolean,
  seen: readonly string[] = [],
): boolean {
  const specifiers = reexportedSpecifiers(content)
  if (!specifiers || seen.includes(routeFile) || seen.length >= MAX_ALIAS_DEPTH) return false
  const trail = [...seen, routeFile]
  return specifiers.every((specifier) => {
    const target = resolveRouteModule(routeFile, specifier)
    if (!target) return false
    const targetContent = readFileSync(target, 'utf-8')
    return accepts(target, targetContent) || isReexportAliasOfAcceptedRoute(target, targetContent, accepts, trail)
  })
}
