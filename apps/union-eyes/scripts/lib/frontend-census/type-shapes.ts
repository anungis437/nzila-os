/**
 * What the TypeScript checker knows of the JSON a value becomes (UE-CONV-H-027).
 *
 * The route reader (route-response.ts) reads the syntax of a handler, and says nothing of the keys of what a service hands it (`return listAgreements(...)`, `return { agreement, clauses }`).
 * A screen that declares what it expects of the answer (`useQuery<AgreementListResponse>`, `(await res.json()) as Row[]`) says nothing in syntax about the route either. The checker knows both.
 *
 * A type is read as the JSON it serialises to: an object has the keys of its properties, a list its element, and everything else (a string, a number, a Date, anything with `toJSON`, a function)
 * is a leaf the census does not look into. What the type cannot say (`any`, `unknown`, a type parameter, a type that contains itself) is not known, never guessed: a shape is only used to say a
 * key is NOT there when the object it belongs to is closed.
 */
import path from 'node:path'
import ts from 'typescript'
import { objectOf, union, type Shape, type TypeOracle } from './route-response'

/** How deep a type is read: a row of a service result is a few levels deep; what goes beyond is cut, not guessed. */
const MAX_TYPE_DEPTH = 7
/** Classes whose JSON is not their members: a Map or a Set is `{}`, a Promise is not JSON, a Date or a Buffer is a string. */
const LEAF_CLASSES = new Set(['Date', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'RegExp', 'Error', 'URL', 'URLSearchParams', 'Buffer', 'ArrayBuffer', 'Uint8Array', 'Blob', 'File', 'Response', 'Request', 'Headers', 'ReadableStream', 'FormData', 'NextResponse', 'NextRequest'])
const NOT_KNOWN = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.TypeParameter | ts.TypeFlags.Index | ts.TypeFlags.IndexedAccess | ts.TypeFlags.Conditional | ts.TypeFlags.Substitution
const LEAF = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.ESSymbolLike | ts.TypeFlags.EnumLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.NonPrimitive

const normalize = (file: string): string => file.replace(/\\/g, '/')

export class TypeShapes implements TypeOracle {
  private checker: ts.TypeChecker | null = null
  private readonly files = new Map<string, ts.SourceFile>()
  private readonly cache = new Map<ts.Type, Shape>()

  /** The program is made when the first shape is asked for: building it is the expense, and a census that never needs a type does not pay it. */
  constructor(private readonly createProgram: () => ts.Program, private readonly root: string) {}

  /** The application as its own tsconfig describes it: the same files, paths and options as `tsc`. */
  static forProject(root: string, tsconfig = 'tsconfig.json'): TypeShapes {
    return new TypeShapes(() => {
      const configPath = path.join(root, tsconfig)
      const read = ts.readConfigFile(configPath, ts.sys.readFile)
      const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, root)
      return ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true, skipLibCheck: true, incremental: false, composite: false, tsBuildInfoFile: undefined } })
    }, root)
  }

  /** A program over in-memory files (named relative to `root`) and the real standard library: for tests. */
  static forFiles(root: string, sources: Record<string, string>): TypeShapes {
    return new TypeShapes(() => {
      const options: ts.CompilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true, skipLibCheck: true, jsx: ts.JsxEmit.Preserve, types: [] }
      const virtual = new Map(Object.entries(sources).map(([file, text]) => [normalize(path.join(root, file)), text]))
      const directories = new Set<string>()
      for (const file of virtual.keys()) for (let dir = path.posix.dirname(file); dir.length > 1 && !directories.has(dir); dir = path.posix.dirname(dir)) directories.add(dir)
      const host = ts.createCompilerHost(options, true)
      const { fileExists, readFile, getSourceFile, directoryExists } = host
      host.fileExists = (file) => virtual.has(normalize(file)) || fileExists.call(host, file)
      host.readFile = (file) => virtual.get(normalize(file)) ?? readFile.call(host, file)
      host.directoryExists = (dir) => directories.has(normalize(dir)) || (directoryExists?.call(host, dir) ?? false)
      host.getSourceFile = (file, languageVersion, onError, shouldCreate) => {
        const text = virtual.get(normalize(file))
        return text === undefined ? getSourceFile.call(host, file, languageVersion, onError, shouldCreate) : ts.createSourceFile(file, text, languageVersion, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      }
      return ts.createProgram({ rootNames: [...virtual.keys()], options, host })
    }, root)
  }

  private ensure(): ts.TypeChecker {
    if (this.checker) return this.checker
    const program = this.createProgram()
    this.checker = program.getTypeChecker()
    for (const file of program.getSourceFiles()) {
      const relative = normalize(path.relative(this.root, file.fileName))
      if (!relative.startsWith('..') && !relative.includes('node_modules/')) this.files.set(relative, file)
    }
    return this.checker
  }

  /** The node of the program that is the same text at the same place as a node of a source the census parsed itself, or null when the program does not have the file. */
  private locate(node: ts.Node): ts.Node | null {
    this.ensure()
    const file = this.files.get(normalize(node.getSourceFile().fileName))
    if (!file) return null
    const start = node.getStart()
    const end = node.getEnd()
    let current: ts.Node = file
    for (;;) {
      if (current !== file && current.kind === node.kind && current.getStart(file) === start && current.end === end) return current
      let next: ts.Node | undefined
      ts.forEachChild(current, (child) => {
        if (!next && child.pos <= start && child.end >= end) next = child
      })
      if (!next) return null
      current = next
    }
  }

  shapeOfNode(node: ts.Node): Shape {
    const located = this.locate(node)
    if (!located) return null
    const checker = this.ensure()
    const type = checker.getTypeAtLocation(located)
    return this.toShape(checker.getAwaitedType(type) ?? type, 0, new Set())
  }

  private remember(type: ts.Type, shape: Shape): Shape {
    this.cache.set(type, shape)
    return shape
  }

  private toShape(input: ts.Type, depth: number, inside: Set<ts.Type>): Shape {
    const checker = this.ensure()
    // Checked before the nullable part is taken away: the non-nullable form of a type that is not resolved (`Awaited<T>`) is `Awaited<T> & {}`, which would read as an empty object.
    if (input.flags & NOT_KNOWN) return null
    const type = checker.getNonNullableType(input)
    if (type.flags & NOT_KNOWN) return null
    if (depth > MAX_TYPE_DEPTH || inside.has(type)) return null
    if (this.cache.has(type)) return this.cache.get(type) ?? null

    if (type.isUnion()) {
      // A value that is an object in one case and a string in another is not an object the census can look into.
      let result: Shape = null
      for (const [index, member] of type.types.entries()) {
        const shape = this.toShape(member, depth, inside)
        result = index === 0 ? shape : union(result, shape)
        if (!result) return this.remember(type, null)
      }
      return this.remember(type, result)
    }
    if (type.isIntersection()) {
      if (type.types.some((member) => member.flags & (LEAF | NOT_KNOWN))) return this.remember(type, null)
      // An array with something added to it (a database result is a list with `count` and `columns`) is a list in JSON.
      const list = type.types.find((member) => checker.isArrayType(member))
      if (list) return this.remember(type, this.toShape(list, depth, inside))
    } else if (type.flags & LEAF || !(type.flags & ts.TypeFlags.Object)) return this.remember(type, null)

    if (checker.isArrayType(type)) {
      inside.add(type)
      const element = checker.getTypeArguments(type as ts.TypeReference)[0]
      const shape: Shape = { kind: 'array', element: element ? this.toShape(element, depth + 1, inside) : null }
      inside.delete(type)
      return this.remember(type, shape)
    }
    if (checker.isTupleType(type)) return this.remember(type, { kind: 'array', element: null })
    if (type.symbol && LEAF_CLASSES.has(type.symbol.name)) return this.remember(type, null)
    // A type that serialises itself (`toJSON`) is what it returns, not its members; a function is dropped by JSON.
    if (type.getProperty('toJSON') || type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) return this.remember(type, null)

    const shape = objectOf({}, false)
    inside.add(type)
    for (const property of checker.getPropertiesOfType(type)) {
      if (property.name.startsWith('__@')) continue
      const propertyType = checker.getTypeOfSymbol(property)
      if (propertyType.getCallSignatures().length > 0 && propertyType.getProperties().length === 0) continue
      shape.keys.set(property.name, this.toShape(propertyType, depth + 1, inside))
    }
    inside.delete(type)
    if (checker.getIndexInfosOfType(type).length > 0) shape.open = true
    // A type with no members (`{}`, `object`) says nothing of the keys: it is what a value is typed as when nothing better is known.
    if (shape.keys.size === 0 && !shape.open) return this.remember(type, null)
    return this.remember(type, shape)
  }
}
