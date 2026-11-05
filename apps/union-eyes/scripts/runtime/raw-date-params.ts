/**
 * Raw Date parameters in drizzle `sql` templates (UE-CONV-H-011).
 *
 * The application's clients are drizzle over postgres.js. drizzle installs identity serializers for the timestamp and date types (it encodes through column mappers), so a
 * `Date` interpolated into a raw `sql` template reaches the driver as an object and the driver throws ERR_INVALID_ARG_TYPE. A column operator (`eq`, `gte`) encodes through its
 * column and is not affected; only a bare interpolation in `sql\`...\`` is. This finds those, by type, not by name: every substitution of a `sql` tagged template whose type
 * is (or includes) Date.
 *
 *   npx tsx scripts/runtime/raw-date-params.ts            # report
 *   import { scanRawDateParams } from './raw-date-params'  # for a test
 */
import path from 'node:path'
import ts from 'typescript'

export interface RawDateParam {
  file: string
  line: number
  expression: string
  type: string
}

const isDateType = (type: ts.Type): boolean => {
  if (type.isUnion()) return type.types.some(isDateType)
  if (type.isIntersection()) return type.types.some(isDateType)
  return type.symbol?.name === 'Date'
}

export function scanRawDateParams(appRoot: string, options: { includeTests?: boolean } = {}): { findings: RawDateParam[]; scannedFiles: number; templates: number } {
  const configPath = ts.findConfigFile(appRoot, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) throw new Error(`no tsconfig.json under ${appRoot}`)
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true })
  const checker = program.getTypeChecker()
  const findings: RawDateParam[] = []
  let scannedFiles = 0
  let templates = 0
  for (const source of program.getSourceFiles()) {
    const name = source.fileName.replace(/\\/g, '/')
    if (source.isDeclarationFile || name.includes('/node_modules/') || !name.startsWith(appRoot.replace(/\\/g, '/'))) continue
    if (!options.includeTests && /(\/__tests__\/|\.test\.|\.spec\.|\/test-|\/e2e\/)/.test(name)) continue
    scannedFiles += 1
    const visit = (node: ts.Node): void => {
      if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'sql' && ts.isTemplateExpression(node.template)) {
        templates += 1
        for (const span of node.template.templateSpans) {
          const type = checker.getTypeAtLocation(span.expression)
          if (isDateType(type)) {
            findings.push({
              file: path.relative(appRoot, source.fileName).replace(/\\/g, '/'),
              line: source.getLineAndCharacterOfPosition(span.expression.getStart()).line + 1,
              expression: span.expression.getText().replace(/\s+/g, ' ').slice(0, 100),
              type: checker.typeToString(type),
            })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { findings, scannedFiles, templates }
}

if (process.argv[1] && /raw-date-params\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) {
  const appRoot = path.resolve(__dirname, '..', '..')
  const started = Date.now()
  const { findings, scannedFiles, templates } = scanRawDateParams(appRoot, { includeTests: process.argv.includes('--tests') })
  console.log(`scanned ${scannedFiles} files, ${templates} sql templates, in ${Math.round((Date.now() - started) / 1000)}s`)
  console.log(`${findings.length} raw Date parameter(s):`)
  for (const f of findings) console.log(`  ${f.file}:${f.line}  ${f.expression}  [${f.type}]`)
}
