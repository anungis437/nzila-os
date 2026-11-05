/**
 * The environment variables the Django backend reads (UE-CONV-H-024). The Python backend is a second process of the same deployment (a sidecar of the
 * application container), so the variables it reads are part of the same configuration surface, and a hard-coded fallback in its settings is as much a
 * misconfiguration as one in the Next.js server.
 *
 * Python is not parsed as a language: the backend reads its environment in three spellings (`os.environ.get("X")`, `os.environ["X"]`, `os.getenv("X")`) and the
 * census reads those. A function that reads the environment for the name it is given (`def _env_enabled(name, default=False): os.environ.get(name)`, or
 * `os.environ.get(prefix + "_PGUSER")`) is a helper, and its callers name the variable, as in the TypeScript census. A name built any other way is reported as
 * unresolved.
 */
import type { EnvSite, UnresolvedSite } from './reads'

export interface PythonEnvFacts {
  reads: EnvSite[]
  unresolved: UnresolvedSite[]
}

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length

interface Helper {
  name: string
  param: string
  suffixes: string[]
  start: number
  end: number
}

/** The functions that read `os.environ.get(<their first parameter>[ + "SUFFIX"])`, with the span of their body. */
function helpersOf(text: string): Helper[] {
  const helpers: Helper[] = []
  const definitions = [...text.matchAll(/^([ \t]*)def\s+(\w+)\s*\(\s*(\w+)[^)]*\)[^:\n]*:/gm)]
  for (const [index, definition] of definitions.entries()) {
    const start = (definition.index ?? 0) + definition[0].length
    const indent = definition[1].length
    // The body runs until the next definition at the same or a shallower indent.
    const next = definitions.slice(index + 1).find((other) => other[1].length <= indent)
    const end = next?.index ?? text.length
    const body = text.slice(start, end)
    const suffixes: string[] = []
    const reading = new RegExp(`os\\.(?:environ\\.get|getenv)\\s*\\(\\s*${definition[3]}\\b(?:\\s*\\+\\s*(["'])([A-Za-z0-9_]*)\\1)?`, 'g')
    for (const match of body.matchAll(reading)) suffixes.push(match[2] ?? '')
    if (suffixes.length > 0) helpers.push({ name: definition[2], param: definition[3], suffixes, start, end })
  }
  return helpers
}

export function scanPythonEnv(text: string): PythonEnvFacts {
  const reads: EnvSite[] = []
  const unresolved: UnresolvedSite[] = []
  const helpers = helpersOf(text)
  const insideHelper = (index: number, argument: string): boolean => helpers.some((helper) => index >= helper.start && index < helper.end && new RegExp(`^${helper.param}\\b`).test(argument))

  const calls = /\bos\.(?:environ\.get|getenv)\s*\(\s*(?:(["'])([A-Za-z_][A-Za-z0-9_]*)\1|([^,)]+))/g
  for (const match of text.matchAll(calls)) {
    const index = match.index ?? 0
    if (match[2]) reads.push({ name: match[2], line: lineAt(text, index), via: 'os.environ.get' })
    else if (!insideHelper(index, (match[3] ?? '').trim())) unresolved.push({ line: lineAt(text, index), via: 'os.environ.get', text: (match[3] ?? '').trim() })
  }
  for (const match of text.matchAll(/\bos\.environ\s*\[\s*(["'])([A-Za-z_][A-Za-z0-9_]*)\1\s*\]/g)) reads.push({ name: match[2], line: lineAt(text, match.index ?? 0), via: 'os.environ[]' })

  for (const helper of helpers) {
    for (const call of text.matchAll(new RegExp(`(?<![\\w.])${helper.name}\\s*\\(\\s*(["'])([A-Za-z_][A-Za-z0-9_]*)\\1`, 'g'))) {
      const index = call.index ?? 0
      for (const suffix of helper.suffixes) reads.push({ name: `${call[2]}${suffix}`, line: lineAt(text, index), via: `helper:${helper.name}` })
    }
  }
  return { reads, unresolved }
}

/** True for the backend files that run: migrations, tests and fixtures are not the deployed process. */
export const isDjangoSource = (relative: string): boolean => /\.py$/.test(relative) && !/(^|\/)(tests?|migrations|__pycache__|venv|\.venv|node_modules)\//.test(relative) && !/(^|\/)(test_[^/]*|tests_[^/]*|[^/]*_tests?)\.py$/.test(relative) && !/(^|\/)conftest\.py$/.test(relative)
