/**
 * Content a screen states that nothing measured (UE-CONV-H-021). Pure: the findings come from one file's source text.
 *
 * A dashboard card that says "+12.3%", a progress bar fixed at 75, or a list built from `SAMPLE_COMPARISONS` looks like data and is not: it never changes, it
 * is the same for every organization, and it is wrong for all of them. No unit test sees it, because the component renders exactly what it was written to
 * render. The anti-theatre scanner (tooling/reality) finds the fakes that are answers (a handler that says "accepted", a status that says "healthy"); this
 * finds the ones that are figures, and the ones that are contacts. Four kinds, each read from the syntax tree of a UI file:
 *   - LITERAL_METRIC: JSX text that states a measurement: a percentage, a latency, a count of people or records, a relative time ("Next post in 2 hours").
 *     Text that is a scale label (`0%`, `100%`) or a policy deadline ("within 72 hours") is not a measurement, and is not matched.
 *   - SAMPLE_DATA: a binding named for what it is (`SAMPLE_`, `mock`, `dummy`, `fake`, `demo`, `placeholder`) that holds a list or a record, in a UI file.
 *   - LITERAL_PROGRESS: a progress, gauge or meter component whose value is a number written in the source.
 *   - INVENTED_ADDRESS: a mailbox written into a UI file that is neither at a domain the product owns (lib/support-contact) nor at one reserved for documentation
 *     (RFC 2606). A screen that tells a person to write to `pilot@nzila.io` sends the mail to nobody; the address comes from where the product keeps it. An example
 *     typed into a field's `placeholder` is not a claim that the mailbox exists, and is not matched.
 * Marketing pages state claims, not data, and are not read.
 */
import ts from 'typescript'

export type FakeKind = 'LITERAL_METRIC' | 'SAMPLE_DATA' | 'LITERAL_PROGRESS' | 'INVENTED_ADDRESS'

export interface FakeFinding {
  kind: FakeKind
  line: number
  text: string
}

const MARKETING = /(?:^|\/)\(marketing\)\/|^components\/marketing\/|\/marketing\//
const SAMPLE_NAME = /^(?:(?:SAMPLE|MOCK|DUMMY|FAKE|DEMO|PLACEHOLDER)(?:_|$)|(?:sample|mock|dummy|fake|demo|placeholder)(?:[A-Z_]|$))/
const PROGRESS_COMPONENTS = new Set(['Progress', 'Gauge', 'Meter', 'CircularProgress', 'RadialProgress', 'ProgressBar'])

const PERCENT = /\d(?:[.,]\d+)?\s?%/
const LATENCY = /\b\d+\s?ms\b/
const COUNT_AT_START = /^[+-]?\d[\d,]*\s+(?:members?|users?|claims?|grievances?|cases?|employers?)\b/i
const RELATIVE_TIME = /^(?:next|last)\b.*\bin\s+\d+\s+(?:minutes?|hours?|days?)\b/i

const ADDRESS = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g
/** The domains an address may be at without being an invention: the one the product owns, and those RFC 2606 reserves for examples. */
const OWNED_OR_RESERVED = /^(?:unioneyes\.app|example\.(?:com|net|org)|[^.]+\.(?:test|example|invalid|localhost))$/i

/** The addresses a piece of text names at a domain that is neither the product's nor reserved. */
export function inventedAddresses(text: string): string[] {
  return [...text.matchAll(ADDRESS)].filter((match) => !OWNED_OR_RESERVED.test(match[1])).map((match) => match[0])
}

/** An example typed into a field (`placeholder="a@b.org"`, `{ placeholder: 'a@b.org' }`) shows the shape of an answer; it does not say the mailbox exists. */
function isPlaceholder(node: ts.Node): boolean {
  const parent = node.parent
  if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) return parent.parent.name.getText() === 'placeholder'
  if (ts.isJsxAttribute(parent)) return parent.name.getText() === 'placeholder'
  return ts.isPropertyAssignment(parent) && parent.initializer === node && /^placeholder$/i.test(parent.name.getText())
}

export function isFakeMetric(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized || /^(?:0|100)\s?%$/.test(normalized)) return false
  return PERCENT.test(normalized) || LATENCY.test(normalized) || COUNT_AT_START.test(normalized) || RELATIVE_TIME.test(normalized)
}

export function isUiFile(file: string): boolean {
  return /\.tsx$/.test(file) && !MARKETING.test(file)
}

export function findFakeContent(file: string, text: string): FakeFinding[] {
  const isTsx = /\.tsx$/.test(file)
  const isUiModule = isTsx || /^components\//.test(file)
  if (!isUiModule || MARKETING.test(file)) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const findings: FakeFinding[] = []
  const add = (node: ts.Node, kind: FakeKind, found: string): void => {
    findings.push({ kind, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: found.replace(/\s+/g, ' ').trim().slice(0, 100) })
  }
  const visit = (node: ts.Node): void => {
    if (isTsx && ts.isJsxText(node) && isFakeMetric(node.getText())) add(node, 'LITERAL_METRIC', node.getText())
    if (
      (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isExportDeclaration(node.parent) &&
      !isPlaceholder(node)
    ) {
      for (const address of inventedAddresses(ts.isJsxText(node) ? node.getText() : node.text)) add(node, 'INVENTED_ADDRESS', address)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && SAMPLE_NAME.test(node.name.text) && node.initializer) {
      const value = node.initializer
      if ((ts.isArrayLiteralExpression(value) && value.elements.length >= 2) || (ts.isObjectLiteralExpression(value) && value.properties.length >= 3)) add(node, 'SAMPLE_DATA', node.name.text)
    } else if (isTsx && (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ts.isIdentifier(node.tagName) && PROGRESS_COMPONENTS.has(node.tagName.text)) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name) || attribute.name.text !== 'value') continue
        const initializer = attribute.initializer
        const literal = initializer && ts.isJsxExpression(initializer) ? initializer.expression : undefined
        if (literal && ts.isNumericLiteral(literal) && !['0', '100'].includes(literal.text)) add(node, 'LITERAL_PROGRESS', `${node.tagName.text} value=${literal.text}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return findings
}
