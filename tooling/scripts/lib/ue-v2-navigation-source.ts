/** Compile the declared application's pure navigation modules from its Git tree.
 * Current checkout files and workspace package aliases are never source fallbacks. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

export function navigationSource(root: string, sourceSha: string) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/, 'NAVIGATION_SOURCE_SHA_REQUIRED')
  assert.equal(execFileSync('git', ['cat-file', '-t', sourceSha], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim(), 'commit', 'NAVIGATION_COMMIT_REQUIRED')
  const bytes = new Map<string, string>()
  const modules = new Map<string, { exports: Record<string, unknown> }>()
  function read(file: string): string {
    assert(file.startsWith('apps/union-eyes/'), 'NAVIGATION_SOURCE_OUTSIDE_APPLICATION')
    assert(!file.split('/').includes('..') && !file.includes('\0'), 'NAVIGATION_SOURCE_PATH_INVALID')
    if (!bytes.has(file)) {
      bytes.set(file, execFileSync('git', ['show', `${sourceSha}:${file}`], {
        cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }))
    }
    return bytes.get(file)!
  }
  function load(file: string): Record<string, unknown> {
    assert(file.startsWith('apps/union-eyes/lib/') && file.endsWith('.ts'), 'NAVIGATION_PURE_MODULE_REQUIRED')
    const cached = modules.get(file)
    if (cached) return cached.exports
    const module = { exports: {} as Record<string, unknown> }
    modules.set(file, module)
    const output = ts.transpileModule(read(file), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: file,
    }).outputText
    const requireSource = (specifier: string) => {
      assert(specifier.startsWith('.'), 'NAVIGATION_NONRELATIVE_IMPORT_REFUSED')
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      return load(resolved.endsWith('.ts') ? resolved : resolved + '.ts')
    }
    new vm.Script(output, { filename: `${sourceSha}:${file}` }).runInNewContext({
      module, exports: module.exports, require: requireSource,
    }, { timeout: 1000 })
    return module.exports
  }
  function digests(files: string[]) {
    return Object.fromEntries([...new Set([...files, ...bytes.keys()])].map(file => [
      file, createHash('sha256').update(read(file)).digest('hex'),
    ]))
  }
  return { read, load, digests }
}
