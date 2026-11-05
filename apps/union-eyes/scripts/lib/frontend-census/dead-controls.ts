/**
 * Controls a screen offers that do nothing (UE-CONV-H-025). Pure: the findings come from one file's source text.
 *
 * A button with no handler, a menu item that selects nothing, an `onClick` that is an empty function or only raises a toast, a link to `#`: each looks finished and is
 * not, and no unit test sees it, because the component renders exactly what it was written to render and nothing clicks it. The anti-theatre scanner (tooling/reality)
 * finds the handler that answers "accepted" without doing anything; this finds the control that never gets that far. Four kinds, read from the syntax tree of a UI file:
 *   - NO_HANDLER: a `<Button>`, `<button>` or menu item with no `onClick` / `onSelect` / `type` / `href` / `asChild` / spread, that is not inside a form, a trigger, a close
 *     control, a link, or an element that handles the events itself (a hover menu), and that does not declare itself a disclosure (`aria-expanded`, `aria-haspopup`).
 *   - EMPTY_HANDLER: an `on…` attribute whose function has an empty body, has no effect (it only reads a value), or is `noop`.
 *   - FEEDBACK_ONLY_HANDLER: an `on…` function whose only calls are toast, alert or console: it reports a result that nothing produced.
 *   - DEAD_LINK: `href="#"`, `href=""` or `javascript:`.
 * Primitives (components/ui) define the controls and are not read. A control that must stay as written (a preview of what a page builder produces, a dialog that must not
 * close) is accepted by name, with the reason, in ACCEPTED of scripts/runtime/dead-controls-census.ts.
 */
import ts from 'typescript'

export type DeadControlKind = 'NO_HANDLER' | 'EMPTY_HANDLER' | 'FEEDBACK_ONLY_HANDLER' | 'DEAD_LINK'

export interface DeadControl {
  kind: DeadControlKind
  line: number
  text: string
}

const CONTROLS = new Set(['Button', 'button', 'IconButton', 'LoadingButton', 'DropdownMenuItem', 'ContextMenuItem', 'MenubarItem'])
// An attribute that gives the control something to do or somewhere to go, or says that it discloses something.
const ACTS = /^(?:onClick|onSubmit|onSelect|onPress|onKeyDown|onMouseDown|onPointerDown|type|asChild|href|form|formAction|to|download|aria-expanded|aria-haspopup|aria-controls|aria-pressed)$/
// An element that carries the behaviour for the control inside it: a trigger, a close control, a link, a form.
const HANDLING_WRAPPER = /Trigger$|Close$|^(?:Form|form|Link|a|Slot|AlertDialogAction|AlertDialogCancel|CommandItem|SelectItem|RadioGroupItem|ToggleGroupItem|Toggle)$/
// An element that handles the events of what it holds (a hover menu around its button).
const EVENT_OWNER = /^(?:onClick|onMouseEnter|onMouseLeave|onFocus|onBlur|onKeyDown|onPointerEnter|onPointerLeave)$/

export function isUiModule(file: string): boolean {
  return /\.tsx$/.test(file) && !/(?:^|\/)components\/ui\//.test(file) && !/\.(?:test|spec|stories)\./.test(file)
}

const isFeedbackCall = (call: ts.CallExpression): boolean => {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return /^(?:toast|alert|showToast)$/.test(callee.text)
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
    const owner = callee.expression.text
    return owner === 'toast' || owner === 'console' || (owner === 'window' && callee.name.text === 'alert')
  }
  return false
}

const isUndefined = (node: ts.Node): boolean => (ts.isIdentifier(node) && node.text === 'undefined') || (ts.isVoidExpression(node) && ts.isNumericLiteral(node.expression))

/** What a handler's body can do: anything but report (a call that is not feedback, an await, an assignment, an object created, a value returned) is an effect. */
function analyze(body: ts.ConciseBody, inert: RegExp | null): { empty: boolean; effect: boolean; feedback: number } {
  if (ts.isBlock(body) ? body.statements.length === 0 : isUndefined(body) || (ts.isObjectLiteralExpression(body) && body.properties.length === 0)) return { empty: true, effect: false, feedback: 0 }
  let effect = false
  let feedback = 0
  const scan = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (isFeedbackCall(node)) feedback += 1
      else if (inert && ts.isPropertyAccessExpression(node.expression) && inert.test(node.expression.name.text)) feedback += 0
      else effect = true
    } else if (ts.isAwaitExpression(node) || ts.isNewExpression(node) || ts.isThrowStatement(node)) effect = true
    else if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) effect = true
    else if ((ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) effect = true
    else if (ts.isReturnStatement(node) && node.expression && !isUndefined(node.expression)) effect = true
    ts.forEachChild(node, scan)
  }
  scan(body)
  // `() => value` returns something to nobody: an expression body with no call in it has no effect.
  return { empty: false, effect, feedback }
}

export function findDeadControls(file: string, text: string): DeadControl[] {
  if (!isUiModule(file) || !/Button|button|MenuItem|href=|on[A-Z]\w*=\{/.test(text)) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: DeadControl[] = []
  const add = (node: ts.Node, kind: DeadControlKind, shown: string): void => {
    found.push({ kind, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: shown.replace(/\s+/g, ' ').trim().slice(0, 110) })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText()
      const attributes = node.attributes.properties
      const named = attributes.filter(ts.isJsxAttribute).map((attribute) => attribute.name.getText())
      if (CONTROLS.has(tag) && !attributes.some(ts.isJsxSpreadAttribute) && !named.some((name) => ACTS.test(name))) {
        let handled = false
        for (let ancestor: ts.Node | undefined = node.parent; ancestor && !handled; ancestor = ancestor.parent) {
          if (!ts.isJsxElement(ancestor) && !ts.isJsxSelfClosingElement(ancestor)) continue
          const opening = ts.isJsxElement(ancestor) ? ancestor.openingElement : ancestor
          if (opening === node) continue
          handled = HANDLING_WRAPPER.test(opening.tagName.getText()) || opening.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && EVENT_OWNER.test(attribute.name.getText()))
        }
        if (!handled) add(node, 'NO_HANDLER', ts.isJsxOpeningElement(node) ? node.parent.getText() : node.getText())
      }
      for (const attribute of attributes) {
        if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue
        const name = attribute.name.text
        const initializer = attribute.initializer
        if (name === 'href' && initializer && ts.isStringLiteral(initializer) && /^(?:#|javascript:.*|)$/.test(initializer.text)) add(attribute, 'DEAD_LINK', `${tag} href="${initializer.text}"`)
        if (!/^on[A-Z]/.test(name) || !initializer || !ts.isJsxExpression(initializer) || !initializer.expression) continue
        const handler = initializer.expression
        if (ts.isIdentifier(handler) && /^(?:noop|undefined)$/.test(handler.text)) add(attribute, 'EMPTY_HANDLER', `${name}={${handler.text}}`)
        else if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
          // A form's submit handler that only prevents the default does nothing; a click handler that stops propagation does what it says.
          const result = analyze(handler.body, name === 'onSubmit' ? /^(?:preventDefault|stopPropagation)$/ : null)
          if (result.empty || (!result.effect && result.feedback === 0)) add(attribute, 'EMPTY_HANDLER', `${name}=${handler.getText()}`)
          else if (!result.effect) add(attribute, 'FEEDBACK_ONLY_HANDLER', `${name}=${handler.getText()}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
