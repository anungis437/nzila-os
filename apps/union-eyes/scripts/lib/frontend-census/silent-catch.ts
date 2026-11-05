/**
 * Errors a screen swallows (UE-CONV-H-026). Pure: the findings come from one file's source text.
 *
 * `catch { }`, `catch { // handle error }`, `.catch(() => {})`: the request failed, the person is told nothing, and the screen goes on showing what it had (stale numbers, an
 * empty list that reads as "no results", a form that looks saved). No unit test sees it: the component is tested with a request that succeeds. The anti-theatre scanner (R-6) counts
 * silent catches across the repository as warnings; this holds the UI to none. Two kinds, read from the syntax tree of a UI file:
 *   - EMPTY_CATCH: a catch clause with no statement and no comment that says why, or only a placeholder ("handle error", "ignore", "fail silently", "TODO").
 *   - EMPTY_PROMISE_CATCH: `.catch(() => {})`, `.catch(() => undefined)` or `.catch(noop)` on anything but a body parse (`.json()`, `.text()`, `.blob()`), where a failed read of a
 *     response body that was not JSON is a fallback and not a hidden failure.
 * An empty catch that carries a real explanation (the failure is expected and harmless: storage not available, a cancelled request, a parse of optional input) is not a finding.
 * A catch that has to stay as written is accepted by name, with the reason, in ACCEPTED of scripts/runtime/silent-catch-census.ts.
 */
import ts from 'typescript'

export type SilentCatchKind = 'EMPTY_CATCH' | 'EMPTY_PROMISE_CATCH'

export interface SilentCatch {
  kind: SilentCatchKind
  line: number
  text: string
}

const PLACEHOLDER = /^(?:handle (?:the )?errors?|todo|fixme|ignore[d]?|ignore errors?|noop|no-?op|errors?|silent(?:ly)?(?: ignore[d]?)?|fail silently|swallow(?:ed)?|nothing|empty|skip)[.!]?$/i
const BODY_PARSE = /^(?:json|text|blob|arrayBuffer|formData)$/

export function isUiModule(file: string): boolean {
  return /\.tsx$/.test(file) && !/(?:^|\/)components\/ui\//.test(file) && !/\.(?:test|spec|stories)\./.test(file)
}

/** The comment text written inside an otherwise empty block, without the comment markers. */
function commentInside(block: ts.Block, text: string): string {
  const inner = text.slice(block.getStart() + 1, block.getEnd() - 1)
  return inner.replace(/\/\*+|\*+\//g, ' ').replace(/^\s*\/\/+/gm, ' ').replace(/\s+/g, ' ').trim()
}

const isUndefined = (node: ts.Node): boolean => (ts.isIdentifier(node) && node.text === 'undefined') || (ts.isVoidExpression(node) && ts.isNumericLiteral(node.expression))

export function findSilentCatches(file: string, text: string): SilentCatch[] {
  if (!isUiModule(file) || !/catch/.test(text)) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: SilentCatch[] = []
  const add = (node: ts.Node, kind: SilentCatchKind, shown: string): void => {
    found.push({ kind, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: shown.replace(/\s+/g, ' ').trim().slice(0, 110) })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      const comment = commentInside(node.block, text)
      // A comment that says why the failure is harmless counts; a placeholder or nothing does not.
      if (!comment || PLACEHOLDER.test(comment)) add(node, 'EMPTY_CATCH', node.getText())
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'catch' && node.arguments.length === 1) {
      const handler = node.arguments[0]
      const receiver = node.expression.expression
      const parsesBody = ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression) && BODY_PARSE.test(receiver.expression.name.text)
      const inert = ts.isIdentifier(handler) ? /^(?:noop|undefined)$/.test(handler.text) : (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) && (ts.isBlock(handler.body) ? handler.body.statements.length === 0 && (!commentInside(handler.body, text) || PLACEHOLDER.test(commentInside(handler.body, text))) : isUndefined(handler.body))
      if (inert && !parsesBody) add(node, 'EMPTY_PROMISE_CATCH', node.getText())
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
