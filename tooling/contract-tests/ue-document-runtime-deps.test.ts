import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { ROOT } from './governance-helpers'

const temporary: string[] = []
const helper = pathToFileURL(join(ROOT, 'tooling/scripts/lib/ue-document-runtime-deps.mjs')).href
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }) })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ue-document-packaging-'))
  temporary.push(root)
  const standaloneDirectory = join(root, 'apps/union-eyes/.next/standalone')
  mkdirSync(standaloneDirectory, { recursive: true })
  writeFileSync(join(root, 'apps/union-eyes/package.json'), '{}')
  function pkg(path: string, name: string, metadata: Record<string, unknown> = {}) {
    const directory = join(root, path)
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.cjs', ...metadata }))
    writeFileSync(join(directory, 'index.cjs'), 'module.exports = {}')
    return directory
  }
  const pdf = pkg('node_modules/pdf-parse', 'pdf-parse', { dependencies: { '@napi-rs/canvas': '1.0.0' } })
  const canvas = pkg('node_modules/@napi-rs/canvas', '@napi-rs/canvas', { optionalDependencies: { 'uninstalled-other-platform': '1.0.0' } })
  const worker = pkg('node_modules/tesseract.js', 'tesseract.js', { dependencies: { 'tesseract.js-core': '1.0.0' } })
  const core = pkg('node_modules/tesseract.js-core', 'tesseract.js-core')
  const pdfkit = pkg('node_modules/pdfkit', 'pdfkit')
  return { root, standaloneDirectory, pkg, pdf, canvas, worker, core, pdfkit }
}

function copy(input: { root: string; standaloneDirectory: string }) {
  const code = `import {copyDocumentRuntimeDependencies} from ${JSON.stringify(helper)}; console.log(JSON.stringify(copyDocumentRuntimeDependencies(JSON.parse(process.argv[1]))))`
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(input)], { encoding: 'utf8', stdio: 'pipe' })) as {
    packages: { name: string; version: string; path: string; files: [string, string][] }[]
  }
}

describe('Union Eyes document runtime packaging', () => {
  it('copies dynamically loaded worker, WASM and native assets with their actual dependency graph', () => {
    const f = fixture()
    for (const [directory, file] of [[f.worker, 'src/worker-script/node/index.js'], [f.core, 'tesseract-core-simd-lstm.wasm'], [f.canvas, 'native-binding.node'], [f.pdfkit, 'js/data/Helvetica.afm']]) {
      const path = join(directory, file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, 'synthetic installed runtime asset')
    }
    f.pkg('node_modules/unrelated-service', 'unrelated-service')
    const report = copy(f)
    expect(report.packages.map(pkg => pkg.name).sort()).toEqual(['@napi-rs/canvas', 'pdf-parse', 'pdfkit', 'tesseract.js', 'tesseract.js-core'])
    expect(readFileSync(join(f.standaloneDirectory, 'node_modules/tesseract.js/src/worker-script/node/index.js'), 'utf8')).toBe('synthetic installed runtime asset')
    expect(existsSync(join(f.standaloneDirectory, 'node_modules/@napi-rs/canvas/native-binding.node'))).toBe(true)
    expect(existsSync(join(f.standaloneDirectory, 'node_modules/pdfkit/js/data/Helvetica.afm'))).toBe(true)
    expect(existsSync(join(f.standaloneDirectory, 'node_modules/unrelated-service'))).toBe(false)
    expect(report.packages.every(pkg => pkg.files.every(([, digest]) => /^[a-f0-9]{64}$/.test(digest)))).toBe(true)
  })

  it('fails when an installed required dependency is absent', () => {
    const f = fixture()
    rmSync(f.canvas, { recursive: true })
    expect(() => copy(f)).toThrow(/Missing installed runtime dependency/)
  })

  it('allows an absent optional package for another platform without inventing it', () => {
    const f = fixture()
    expect(copy(f).packages.some(pkg => pkg.name === 'uninstalled-other-platform')).toBe(false)
  })

  it('rejects dependencies outside the installed package boundary', () => {
    const f = fixture()
    const outside = join(f.root, 'outside-canvas')
    rmSync(f.canvas, { recursive: true })
    mkdirSync(outside)
    writeFileSync(join(outside, 'package.json'), JSON.stringify({ name: '@napi-rs/canvas', version: '1.0.0' }))
    symlinkSync(outside, f.canvas, 'dir')
    expect(() => copy(f)).toThrow(/escaped installed packages/)
  })

  it('rejects unexpected asset symlinks instead of copying external files', () => {
    const f = fixture()
    symlinkSync(join(f.root, 'apps/union-eyes/package.json'), join(f.canvas, 'outside.json'))
    expect(() => copy(f)).toThrow(/Unexpected symlink/)
  })

  it('preserves nested dependency versions and their Node resolution paths', () => {
    const f = fixture()
    writeFileSync(join(f.worker, 'package.json'), JSON.stringify({ name: 'tesseract.js', version: '1.0.0', dependencies: { 'tesseract.js-core': '2.0.0' } }))
    f.pkg('node_modules/tesseract.js/node_modules/tesseract.js-core', 'tesseract.js-core', { version: '2.0.0' })
    const report = copy(f)
    expect(report.packages.find(pkg => pkg.name === 'tesseract.js-core')?.path).toBe('node_modules/tesseract.js/node_modules/tesseract.js-core')
    const metadata = JSON.parse(readFileSync(join(f.standaloneDirectory, 'node_modules/tesseract.js/node_modules/tesseract.js-core/package.json'), 'utf8'))
    expect(metadata.version).toBe('2.0.0')
  })
})
