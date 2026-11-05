/**
 * What a screen reads of a value that nothing checks (UE-CONV-H-028).
 *
 * The compiler checks a key a screen reads of a value whose type it knows, and the response-shape census (response-shape-census.ts) checks that type against what the route answers with.
 * Two ways of reading escape both:
 *   - ANY_READ: a member of a value the checker can only call `any` (`const data = await res.json(); data.items.map((row) => row.name)`): a key that is not there is `undefined` at run time and
 *     the screen shows nothing, or a placeholder, or fails;
 *   - READER_KEY_NOT_RETURNED: a key a strict reader takes off a record typed `Record<string, unknown>` (`requiredString(row, 'courseCode')`, `row.courseCode`, `row['courseCode']`): the type is
 *     only "a record", so a key the route never sends is an error at run time and no tool says so. It is judged against the keys of the answers of the routes the screens that use the reader
 *     request (response-shape census, same reading of the routes): a key none of them sends is not returned.
 * Neither says what the value is; both say a read nothing checks, and what the screen does with it is for a person.
 */
import ts from 'typescript'
import { unwrap } from './request-body'
import type { Shape } from './route-response'

export interface UntypedRead {
  line: number
  /** The member as written: `data.items`, `row['id']`, `requiredString(row, 'id')`. */
  text: string
  /** The key; `*` for a member whose name is computed. */
  key: string
}

const oneLine = (node: ts.Node): string => node.getText().replace(/\s+/g, ' ').slice(0, 120)

/** `x.y = …`, `x.y += …`, `delete x.y`, `x.y++`: a write, not a read of what the value holds. */
function isWriteTarget(node: ts.Node): boolean {
  const parent = node.parent
  if (ts.isBinaryExpression(parent) && parent.left === node) return parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  if (ts.isDeleteExpression(parent)) return true
  if ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) && (parent.operator === ts.SyntaxKind.PlusPlusToken || parent.operator === ts.SyntaxKind.MinusMinusToken)) return true
  return false
}

const keyOf = (node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string => {
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  return ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : '*'
}

/** `any` that is the checker's own "I could not resolve this" (a module it cannot find) is not a screen's `any`. */
const isUnresolved = (type: ts.Type): boolean => (type as { intrinsicName?: string }).intrinsicName === 'error'

/** Members of a value the checker can only call `any`. */
export function anyReadsOf(source: ts.SourceFile, checker: ts.TypeChecker): UntypedRead[] {
  const out: UntypedRead[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && !isWriteTarget(node)) {
      const type = checker.getTypeAtLocation(node.expression)
      if (type.flags & ts.TypeFlags.Any && !isUnresolved(type)) out.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text: oneLine(node), key: keyOf(node) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

/** A record the type says nothing of but that it is one (`Record<string, unknown>`): what a strict reader takes a row as. */
function isLooseRecord(checker: ts.TypeChecker, node: ts.Node): boolean {
  const type = checker.getNonNullableType(checker.getTypeAtLocation(node))
  if (!(type.flags & ts.TypeFlags.Object) || checker.isArrayType(type)) return false
  if (checker.getPropertiesOfType(type).length > 0) return false
  const index = checker.getIndexInfoOfType(type, ts.IndexKind.String)
  return index !== undefined && (index.type.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) !== 0
}

/**
 * A reader's own row: a parameter of a function, or what `asRecord` makes of one (`const row = asRecord(value, 'course')`). A record taken out of another (`const stats = isRecord(row.stats) ? row.stats : {}`,
 * a member of a JSON column) is a part of the row whose keys are the screen's contract with what was stored, not with the route, and are not judged.
 */
function isRowOrigin(checker: ts.TypeChecker, node: ts.Node): boolean {
  const target = ts.isExpression(node) ? unwrap(node) : node
  if (ts.isCallExpression(target)) return target.arguments.length > 0 && isRowOrigin(checker, target.arguments[0])
  if (!ts.isIdentifier(target)) return false
  const declaration = checker.getSymbolAtLocation(target)?.valueDeclaration
  if (!declaration) return false
  if (ts.isParameter(declaration)) return true
  return ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined && isRowOrigin(checker, declaration.initializer)
}

/** Keys taken off a row typed `Record<string, unknown>`: handed to a reader as a name (`requiredString(row, 'id')`) or read as a member (`row.id`, `row['id']`). */
export function readerKeysOf(source: ts.SourceFile, checker: ts.TypeChecker): UntypedRead[] {
  const out: UntypedRead[] = []
  const add = (node: ts.Node, key: string): void => {
    out.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text: oneLine(node), key })
  }
  const isRow = (node: ts.Node): boolean => isLooseRecord(checker, node) && isRowOrigin(checker, node)
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.arguments.length >= 2 && ts.isStringLiteralLike(node.arguments[1]) && isRow(node.arguments[0])) add(node, node.arguments[1].text)
    else if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && !isWriteTarget(node) && isRow(node.expression)) {
      const key = keyOf(node)
      if (key !== '*') add(node, key)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

/** Every key of every object an answer holds, at any depth, through lists: the names a reader of that answer may take. */
export function keysOfShape(shape: Shape, into: Set<string> = new Set()): Set<string> {
  if (!shape) return into
  if (shape.kind === 'array') return keysOfShape(shape.element, into)
  for (const [key, value] of shape.keys) {
    into.add(key)
    keysOfShape(value, into)
  }
  return into
}
