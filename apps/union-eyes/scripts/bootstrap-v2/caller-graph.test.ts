import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { deriveTypeScriptCallerGraph } from './caller-graph'

function graph(code: string, sourcePath = ['app', 'api', 'example', 'route.ts']) {
  const root = path.resolve('caller-graph-fixture')
  const route = path.join(root, 'apps', 'union-eyes', ...sourcePath)
  const provider = path.join(root, 'node_modules', 'drizzle-orm', 'index.d.ts')
  const files = new Map(
    [
      [
        route,
        `declare function register(callback: () => void): () => void;
      declare function pgTable(name: string): object;
      import { db } from '${provider.replaceAll('\\', '/')}';
      const accounts = pgTable('accounts');
      ${code}`,
      ],
      [
        provider,
        'export declare const db: { insert(table: object): void; delete(table: object): void };',
      ],
    ].map(([file, content]) => [file.replaceAll('\\', '/'), content]),
  )
  const host = ts.createCompilerHost({ noLib: true })
  host.directoryExists = (directory) =>
    [...files.keys()].some((file) => file.startsWith(`${directory.replaceAll('\\', '/')}/`))
  host.fileExists = (file) => files.has(file.replaceAll('\\', '/'))
  host.readFile = (file) => files.get(file.replaceAll('\\', '/'))
  host.getSourceFile = (file, languageVersion) => {
    const content = files.get(file.replaceAll('\\', '/'))
    return content === undefined
      ? undefined
      : ts.createSourceFile(file, content, languageVersion, true)
  }
  const program = ts.createProgram(
    [route, provider],
    { noLib: true, moduleResolution: ts.ModuleResolutionKind.Node10 },
    host,
  )
  return deriveTypeScriptCallerGraph(program, root)
}

describe('source-derived mutating caller graph', () => {
  it('follows a GET wrapper and helper into a real Drizzle sink', () => {
    const result = graph(`
      function write() { db.insert(accounts); }
      export const GET = register(async () => { write(); });
    `)
    expect(result.roots.map((root) => root.export)).toEqual(['GET'])
    expect(result.callers.find((node) => node.symbol === 'write')?.mutations).toEqual([
      expect.objectContaining({ operation: 'INSERT', table: 'accounts' }),
    ])
    expect(result.callers.every((node) => node.roots.length === 1)).toBe(true)
  })

  it('does not promote uncalled exported arrow writers or Map-like deletes', () => {
    const result = graph(`
      export const deadWriter = () => db.insert(accounts);
      export function POST() {
        const cache = { delete(key: string) {} };
        cache.delete('not-a-table');
      }
    `)
    expect(result.callers).toEqual([])
    expect(result.unreachableDirectWriters).toHaveLength(1)
  })

  it('follows named callback registrations rather than requiring inline handlers', () => {
    const result = graph(`
      function write() { db.delete(accounts); }
      export function POST() { register(write); }
    `)
    expect(result.callers.find((node) => node.symbol === 'write')?.roots).toHaveLength(1)
  })

  it('does not treat an imported helper as mutating unless a rooted path actually calls it', () => {
    const root = path.resolve('caller-graph-fixture')
    const route = path.join(root, 'apps', 'union-eyes', 'app', 'api', 'example', 'route.ts')
    const helper = path.join(root, 'apps', 'union-eyes', 'lib', 'writer.ts')
    const provider = path.join(root, 'node_modules', 'drizzle-orm', 'index.d.ts')
    const files = new Map(
      [
        [
          route,
          `import { write } from '../../../lib/writer';
           export function GET() { return 'ok'; }`,
        ],
        [
          helper,
          `import { db } from '${provider.replaceAll('\\', '/')}'; export function write() { db.insert({}); }`,
        ],
        [
          provider,
          'export declare const db: { insert(table: object): void; delete(table: object): void };',
        ],
      ].map(([file, content]) => [file.replaceAll('\\', '/'), content]),
    )
    const host = ts.createCompilerHost({ noLib: true })
    host.directoryExists = (directory) =>
      [...files.keys()].some((file) => file.startsWith(`${directory.replaceAll('\\', '/')}/`))
    host.fileExists = (file) => files.has(file.replaceAll('\\', '/'))
    host.readFile = (file) => files.get(file.replaceAll('\\', '/'))
    host.getSourceFile = (file, languageVersion) => {
      const content = files.get(file.replaceAll('\\', '/'))
      return content === undefined
        ? undefined
        : ts.createSourceFile(file, content, languageVersion, true)
    }
    const program = ts.createProgram(
      [route, helper, provider],
      { noLib: true, moduleResolution: ts.ModuleResolutionKind.Node10 },
      host,
    )
    const result = deriveTypeScriptCallerGraph(program, root)
    expect(result.callers).toEqual([])
    expect(result.unreachableDirectWriters).toHaveLength(1)
  })

  it('keeps dynamic SQL unresolved instead of inventing a table or runtime PASS', () => {
    const result = graph(`
      declare const connection: { execute(sql: string): void };
      export function POST() { connection.execute('UPDATE ' + 'unknown'); }
    `)
    expect(result.limitations).toContain(
      'Static signature reachability is not runtime qualification.',
    )
    expect(result.callers.find((node) => node.symbol === 'POST')?.mutations).toEqual([
      expect.objectContaining({ operation: 'UNKNOWN', table: 'UNRESOLVED_DYNAMIC_SQL' }),
    ])
  })

  it('keeps same-line callbacks distinct and propagates roots through cycles', () => {
    const result = graph(`
      function a() { b(); } function b() { a(); db.insert(accounts); }
      export function POST() { register(() => a()); register(() => db.delete(accounts)); }
      export function PATCH() { a(); }
    `)
    const callbacks = result.callers.filter((node) => node.symbol.startsWith('callback@'))
    expect(callbacks).toHaveLength(2)
    expect(new Set(callbacks.map((node) => node.id)).size).toBe(2)
    expect(result.callers.find((node) => node.symbol === 'a')?.roots).toHaveLength(2)
    expect(result.callers.find((node) => node.symbol === 'b')?.roots).toHaveLength(2)
  })

  it('finds inline server actions in pages without promoting ordinary page callbacks', () => {
    const result = graph(
      `
      export function Page() {
        async function submit() { 'use server'; db.insert(accounts); }
        const unused = () => db.delete(accounts);
        return submit;
      }
    `,
      ['app', 'example', 'page.tsx'],
    )
    expect(result.roots).toEqual([
      expect.objectContaining({ kind: 'SERVER_ACTION', export: 'submit' }),
    ])
    expect(result.callers.find((node) => node.symbol === 'submit')?.mutations).toHaveLength(1)
    expect(result.unreachableDirectWriters.find((node) => node.symbol === 'unused')).toBeDefined()
  })

  it('treats instrumentation registration as an actual startup entrypoint', () => {
    const result = graph(
      `
      function initialize() { db.insert(accounts); }
      export function register() { initialize(); }
      export function unrelated() { db.delete(accounts); }
    `,
      ['instrumentation.ts'],
    )
    expect(result.roots).toEqual([
      expect.objectContaining({ kind: 'NEXT_INSTRUMENTATION', export: 'register' }),
    ])
    expect(result.callers.find((node) => node.symbol === 'initialize')?.roots).toHaveLength(1)
    expect(
      result.unreachableDirectWriters.find((node) => node.symbol === 'unrelated'),
    ).toBeDefined()
  })

  it('retains top-level side-effect imports as part of rooted module evaluation', () => {
    const root = path.resolve('caller-graph-fixture')
    const route = path.join(root, 'apps', 'union-eyes', 'app', 'api', 'example', 'route.ts')
    const bootstrap = path.join(root, 'apps', 'union-eyes', 'lib', 'bootstrap.ts')
    const provider = path.join(root, 'node_modules', 'drizzle-orm', 'index.d.ts')
    const files = new Map(
      [
        [route, `import '../../../lib/bootstrap'; export function POST() { return 'ok'; }`],
        [
          bootstrap,
          `import { db } from '${provider.replaceAll('\\', '/')}';
           const accounts = {};
           db.insert(accounts);`,
        ],
        [
          provider,
          'export declare const db: { insert(table: object): void; delete(table: object): void };',
        ],
      ].map(([file, content]) => [file.replaceAll('\\', '/'), content]),
    )
    const host = ts.createCompilerHost({ noLib: true })
    host.directoryExists = (directory) =>
      [...files.keys()].some((file) => file.startsWith(`${directory.replaceAll('\\', '/')}/`))
    host.fileExists = (file) => files.has(file.replaceAll('\\', '/'))
    host.readFile = (file) => files.get(file.replaceAll('\\', '/'))
    host.getSourceFile = (file, languageVersion) => {
      const content = files.get(file.replaceAll('\\', '/'))
      return content === undefined
        ? undefined
        : ts.createSourceFile(file, content, languageVersion, true)
    }
    const program = ts.createProgram(
      [route, bootstrap, provider],
      { noLib: true, moduleResolution: ts.ModuleResolutionKind.Node10 },
      host,
    )
    const result = deriveTypeScriptCallerGraph(program, root)
    expect(
      result.callers.find((node) => node.sourcePath.endsWith('bootstrap.ts'))?.mutations,
    ).toEqual([expect.objectContaining({ operation: 'INSERT' })])
  })
})
