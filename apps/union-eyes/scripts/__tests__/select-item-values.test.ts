/**
 * Radix Select refuses an item whose value is the empty string: the Select throws when it renders, so a screen with one cannot be shown at all. An empty choice ("no parent",
 * "any owner") takes a value of its own. This reads every component and page of the application and holds the number of empty-valued items at zero.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..', '..')
const SKIP = new Set(['node_modules', '.next', 'coverage', '__tests__', 'scripts', 'backend', 'e2e', 'tests', 'dist', 'archive', 'mobile'])

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!SKIP.has(name) && !name.startsWith('.')) files(full, out)
    } else if (/\.tsx$/.test(name) && !/\.(test|spec|stories)\./.test(name)) out.push(full)
  }
  return out
}

/** `<SelectItem value="" />`, `value={''}`, `value={``}` and `value={""}`: the value is an empty string literal. */
export function emptySelectItems(file: string, text: string): number[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines: number[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && /^(SelectItem|Select\.Item|SelectPrimitive\.Item)$/.test(node.tagName.getText(source))) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.getText(source) !== 'value' || !attribute.initializer) continue
        const value = ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : attribute.initializer
        if (value && (ts.isStringLiteralLike(value) && value.text === '')) lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return lines
}

describe('Radix Select items', () => {
  it('finds an empty-valued item, in the three ways it is written', () => {
    expect(emptySelectItems('a.tsx', '<SelectItem value="">None</SelectItem>')).toEqual([1])
    expect(emptySelectItems('a.tsx', "<SelectItem value={''}>None</SelectItem>")).toEqual([1])
    expect(emptySelectItems('a.tsx', '<div>\n<SelectItem value={``} />\n</div>')).toEqual([2])
    expect(emptySelectItems('a.tsx', '<SelectItem value={NO_PARENT}>None</SelectItem><SelectItem value="none" /><Option value="" />')).toEqual([])
  })

  it('has none in the application: the screen that has one does not render', () => {
    const found = files(ROOT).flatMap((file) => emptySelectItems(file, readFileSync(file, 'utf8')).map((line) => `${path.relative(ROOT, file).replace(/\\/g, '/')}:${line}`))
    expect(found).toEqual([])
  })
})
