import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, readFileSync, realpathSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const within = (parent, child) => {
  const path = relative(parent, child)
  return path !== '' && !isAbsolute(path) && path !== '..' && !path.startsWith('../')
}

/** Preserve Node's installed, hoisted/nested package paths, including dynamic assets. */
export function copyDocumentRuntimeDependencies({ root, standaloneDirectory }) {
  root = realpathSync(root)
  standaloneDirectory = realpathSync(standaloneDirectory)
  assert(within(root, standaloneDirectory), 'Standalone output must belong to this checkout')
  const installed = [join(root, 'node_modules'), join(root, 'apps/union-eyes/node_modules')]
  const visited = new Map()

  function locate(from, name, optional = false) {
    assert(/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name), 'Invalid package name')
    const lookup = createRequire(join(from, 'package.json')).resolve.paths(name) ?? []
    for (const base of lookup) {
      const candidate = join(base, name, 'package.json')
      if (!existsSync(candidate)) continue
      const directory = realpathSync(dirname(candidate))
      assert(installed.some(boundary => within(boundary, directory)), 'Runtime dependency escaped installed packages')
      const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      assert(metadata.name === name && !name.startsWith('@nzila/'), 'Workspace or mismatched runtime dependency')
      return { directory, metadata }
    }
    assert(optional, 'Missing installed runtime dependency: ' + name)
    return null
  }

  function visit(pkg) {
    if (!pkg || visited.has(pkg.directory)) return
    const path = relative(root, pkg.directory)
    const target = join(standaloneDirectory, path)
    assert(within(standaloneDirectory, target), 'Runtime dependency output escaped standalone')
    const files = []
    function inspect(directory) {
      for (const name of readdirSync(directory).sort()) {
        if (name === 'node_modules') continue
        const file = join(directory, name), stat = lstatSync(file)
        assert(!stat.isSymbolicLink(), 'Unexpected symlink in runtime package: ' + path)
        if (stat.isDirectory()) inspect(file)
        else if (stat.isFile()) files.push([relative(pkg.directory, file), createHash('sha256').update(readFileSync(file)).digest('hex')])
      }
    }
    inspect(pkg.directory)
    const row = { name: pkg.metadata.name, version: pkg.metadata.version, path, files }
    visited.set(pkg.directory, row)
    cpSync(pkg.directory, target, { recursive: true, filter: source => relative(pkg.directory, source).split('/')[0] !== 'node_modules' })
    for (const name of Object.keys(pkg.metadata.dependencies ?? {}).sort()) {
      visit(locate(pkg.directory, name, Object.hasOwn(pkg.metadata.optionalDependencies ?? {}, name)))
    }
    for (const name of Object.keys(pkg.metadata.optionalDependencies ?? {}).sort()) visit(locate(pkg.directory, name, true))
  }

  for (const name of ['pdf-parse', 'tesseract.js', 'pdfkit']) visit(locate(join(root, 'apps/union-eyes'), name))
  const report = { schema: 'ue-document-runtime-dependencies/v1', packages: [...visited.values()].sort((a, b) => a.path.localeCompare(b.path)) }
  writeFileSync(join(standaloneDirectory, 'ue-document-runtime-dependencies.json'), JSON.stringify(report, null, 2) + '\n')
  return report
}

export function verifyDocumentRuntimeDependencies(standaloneDirectory, report) {
  const appRequire = createRequire(join(standaloneDirectory, 'apps/union-eyes/server.js'))
  const pdf = report.packages.find(pkg => pkg.name === 'pdf-parse')
  assert(pdf && typeof appRequire('pdf-parse').PDFParse === 'function', 'PDF runtime cannot load')
  const pdfRequire = createRequire(join(standaloneDirectory, pdf.path, 'package.json'))
  assert(typeof pdfRequire('@napi-rs/canvas').DOMMatrix === 'function', 'Native PDF canvas cannot load')
  assert(typeof appRequire('tesseract.js').createWorker === 'function', 'OCR runtime cannot load')
  assert(typeof appRequire('pdfkit') === 'function', 'PDF export runtime cannot load')
  const pdfkit = report.packages.find(pkg => pkg.name === 'pdfkit')
  for (const font of ['Helvetica', 'Helvetica-Bold', 'Courier']) {
    assert(pdfkit && existsSync(join(standaloneDirectory, pdfkit.path, 'js/data/' + font + '.afm')), 'PDF export font asset missing')
  }
  const worker = report.packages.find(pkg => pkg.name === 'tesseract.js')
  const core = report.packages.find(pkg => pkg.name === 'tesseract.js-core')
  assert(worker && existsSync(join(standaloneDirectory, worker.path, 'src/worker-script/node/index.js')), 'OCR worker script missing')
  for (const variant of ['', '-lstm', '-simd', '-simd-lstm', '-relaxedsimd', '-relaxedsimd-lstm']) {
    for (const suffix of ['.wasm', '.wasm.js']) {
      assert(core && existsSync(join(standaloneDirectory, core.path, 'tesseract-core' + variant + suffix)), 'OCR WASM core missing')
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd(), standaloneDirectory = join(root, 'apps/union-eyes/.next/standalone')
  const report = copyDocumentRuntimeDependencies({ root, standaloneDirectory })
  verifyDocumentRuntimeDependencies(standaloneDirectory, report)
  console.log(JSON.stringify({ status: 'DOCUMENT_RUNTIME_DEPENDENCIES_COPIED_AND_LOAD_VERIFIED', packages: report.packages.length }))
}
