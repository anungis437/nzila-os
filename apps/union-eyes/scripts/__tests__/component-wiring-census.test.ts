/**
 * The component-wiring census (UE-CONV-H-026): components that look finished and are not wired in.
 *
 * Three parts. The first pins how a control that only forwards to an optional prop is read out of a file (lib/frontend-census/component-wiring.ts), the second how the
 * files are joined (what renders what, through imports, default exports and barrels), the third holds the real tree at or below a ceiling that can only fall: a component
 * nothing renders is code that looks like a feature, and a button whose callback no parent passes is a button that does nothing, and neither is visible to a type check or
 * to a test of the component on its own. Closing findings means lowering the ceiling; a new one fails here.
 */
import { describe, expect, it } from 'vitest'
import { resolveSpecifier } from '../lib/env-census/collect'
import { isCensusModule, judgeUnwired, readModule, unrenderedComponents, type ModuleFacts } from '../lib/frontend-census/component-wiring'
import { isFrameworkFile, runCensus } from '../runtime/component-wiring-census'

const controls = (code: string) => readModule('components/x.tsx', code).controls.map(({ component, prop }) => `${component}.${prop}`)

describe('reading a control that only forwards to an optional prop', () => {
  it('finds a button wired straight to, or only calling, an optional callback', () => {
    expect(
      controls(`
        interface Props { onSave?: () => void; onCancel?: (reason: string) => void; label: string }
        export function Form({ onSave, onCancel, label }: Props) {
          return <div><Button onClick={onSave}>{label}</Button><Button onClick={() => onCancel?.('x')}>c</Button></div>
        }`),
    ).toEqual(['Form.onSave', 'Form.onCancel'])
  })

  it('finds the forms of forwarding a handler can take: a guarded call, an if, a block that also stops the event, a props object, a menu item, a form', () => {
    expect(
      controls(`
        type Props = { onA?: () => void; onB?: () => void; onC?: () => void; onD?: () => void; onE?: () => void }
        export function Menu({ onA, onB, onC, onD }: Props) {
          return <div>
            <Button onClick={() => onA && onA()}>a</Button>
            <Button onClick={(e) => { e.stopPropagation(); if (onB) { onB() } }}>b</Button>
            <DropdownMenuItem onSelect={() => { void onC?.() }}>c</DropdownMenuItem>
            <form onSubmit={(e) => { e.preventDefault(); onD?.() }}></form>
          </div>
        }
        export function Card(props: Props) { return <Button onClick={props.onE}>e</Button> }`),
    ).toEqual(['Menu.onA', 'Menu.onB', 'Menu.onC', 'Menu.onD', 'Card.onE'])
  })

  it('reads a props type declared in the file through an interface that extends another, an alias, an intersection', () => {
    expect(
      controls(`
        interface Base { onBase?: () => void }
        interface Props extends Base { onOwn?: () => void }
        type Both = Props & { onMore?: () => void }
        export function A({ onBase, onOwn }: Props) { return <div><Button onClick={onBase}>b</Button><Button onClick={onOwn}>o</Button></div> }
        export function B({ onMore }: Both) { return <Button onClick={onMore}>m</Button> }`),
    ).toEqual(['A.onBase', 'A.onOwn', 'B.onMore'])
  })

  it('does not flag a required callback, a control that does more than forward, a default that does something, or a control that is not offered without the callback', () => {
    expect(
      controls(`
        interface Props { onRequired: () => void; onMore?: () => void; onDefault?: () => void; onGuarded?: () => void; onDisabled?: () => void; onTernary?: () => void }
        export function Form({ onRequired, onMore, onDefault = () => save(), onGuarded, onDisabled, onTernary }: Props) {
          return <div>
            <Button onClick={onRequired}>r</Button>
            <Button onClick={() => { setOpen(false); onMore?.() }}>m</Button>
            <Button onClick={onDefault}>d</Button>
            {onGuarded && <Button onClick={onGuarded}>g</Button>}
            <Button onClick={onDisabled} disabled={!onDisabled}>x</Button>
            {onTernary ? <Button onClick={onTernary}>t</Button> : null}
          </div>
        }`),
    ).toEqual([])
  })

  it('counts a default that does nothing as no default', () => {
    expect(controls(`interface Props { onSave?: () => void } export function A({ onSave = () => {} }: Props) { return <Button onClick={onSave}>s</Button> }`)).toEqual(['A.onSave'])
    expect(controls(`interface Props { onSave?: () => void } export function A({ onSave = noop }: Props) { return <Button onClick={onSave}>s</Button> }`)).toEqual(['A.onSave'])
  })

  it('does not judge what it cannot read: an imported props type, an element that is not a control, an event that is not a click', () => {
    expect(controls(`import type { Props } from './props'; export function A({ onSave }: Props) { return <Button onClick={onSave}>s</Button> }`)).toEqual([])
    expect(controls(`interface Props { onChange?: () => void } export function A({ onChange }: Props) { return <Input onChange={onChange} /> }`)).toEqual([])
    expect(controls(`interface Props { onHover?: () => void } export function A({ onHover }: Props) { return <Button onMouseEnter={onHover}>s</Button> }`)).toEqual([])
  })

  it('reads a component written as an arrow function and one wrapped in memo', () => {
    expect(
      controls(`
        interface Props { onSave?: () => void }
        export const A = ({ onSave }: Props) => <Button onClick={onSave}>s</Button>
        export const B = memo(({ onSave }: Props) => <Button onClick={onSave}>s</Button>)
        function helper({ onSave }: Props) { return <Button onClick={onSave}>s</Button> }`),
    ).toEqual(['A.onSave', 'B.onSave'])
  })
})

const files = (sources: Record<string, string>) => {
  // As the census reads them: a test file is not a place a component is rendered for a person.
  const facts = new Map<string, ModuleFacts>(Object.entries(sources).filter(([file]) => isCensusModule(file)).map(([file, code]) => [file, readModule(file, code)]))
  return { facts, known: new Set(Object.keys(sources)) }
}

const unwired = (sources: Record<string, string>) => {
  const { facts, known } = files(sources)
  return judgeUnwired(facts, known, resolveSpecifier).map(({ component, prop }) => `${component}.${prop}`)
}

const unrendered = (sources: Record<string, string>) => {
  const { facts, known } = files(sources)
  return unrenderedComponents(facts, known, resolveSpecifier, isFrameworkFile).map(({ component }) => component)
}

const DIALOG = `
  interface Props { onSave?: () => void }
  export function SaveDialog({ onSave }: Props) { return <Button onClick={onSave}>Save</Button> }`

describe('joining the files: does any parent wire the callback', () => {
  it('finds the callback no parent passes, and not the one a parent passes', () => {
    expect(unwired({ 'components/dialog.tsx': DIALOG, 'app/page.tsx': `import { SaveDialog } from '@/components/dialog'; export default function P() { return <SaveDialog /> }` })).toEqual(['SaveDialog.onSave'])
    expect(unwired({ 'components/dialog.tsx': DIALOG, 'app/page.tsx': `import { SaveDialog } from '@/components/dialog'; export default function P() { return <SaveDialog onSave={save} /> }` })).toEqual([])
  })

  it('wants one parent to pass it, not every parent', () => {
    expect(
      unwired({
        'components/dialog.tsx': DIALOG,
        'app/a/page.tsx': `import { SaveDialog } from '@/components/dialog'; export default function A() { return <SaveDialog /> }`,
        'app/b/page.tsx': `import { SaveDialog } from '@/components/dialog'; export default function B() { return <SaveDialog onSave={save} /> }`,
      }),
    ).toEqual([])
  })

  it('follows a default import, an alias, a barrel and a star re-export to the component', () => {
    const parent = (importLine: string, tag: string) => ({
      'components/dialog.tsx': DIALOG.replace('export function SaveDialog', 'export default function SaveDialog'),
      'components/index.ts': `export { default as SaveDialog } from './dialog'`,
      'components/all.ts': `export * from './index'`,
      'app/page.tsx': `${importLine}\nexport default function P() { return <${tag} /> }`,
    })
    expect(unwired(parent(`import Whatever from '@/components/dialog'`, 'Whatever'))).toEqual(['SaveDialog.onSave'])
    expect(unwired(parent(`import { SaveDialog as Renamed } from '@/components'`, 'Renamed'))).toEqual(['SaveDialog.onSave'])
    expect(unwired(parent(`import { SaveDialog } from '@/components/all'`, 'SaveDialog'))).toEqual(['SaveDialog.onSave'])
  })

  it('counts a use in the same file', () => {
    expect(unwired({ 'components/dialog.tsx': `${DIALOG}\nexport function Page() { return <SaveDialog /> }` })).toEqual(['SaveDialog.onSave'])
  })

  it('does not judge a component nothing renders, one rendered through a spread, passed as a value, or loaded dynamically', () => {
    expect(unwired({ 'components/dialog.tsx': DIALOG })).toEqual([])
    expect(unwired({ 'components/dialog.tsx': DIALOG, 'app/page.tsx': `import { SaveDialog } from '@/components/dialog'; export default function P(props) { return <SaveDialog {...props} /> }` })).toEqual([])
    expect(unwired({ 'components/dialog.tsx': DIALOG, 'app/page.tsx': `import { SaveDialog } from '@/components/dialog'; const map = { save: SaveDialog }; export default function P() { return <SaveDialog /> }` })).toEqual([])
    expect(unwired({ 'components/dialog.tsx': DIALOG, 'app/page.tsx': `const Lazy = dynamic(() => import('@/components/dialog')); export default function P() { return <Lazy /> }` })).toEqual([])
  })
})

describe('joining the files: does anything render the component', () => {
  const LIST = `export function Row() { return <li>row</li> }\nexport function Table() { return <ul><Row /></ul> }`

  it('finds the exported component that nothing renders', () => {
    expect(unrendered({ 'components/list.tsx': LIST, 'app/page.tsx': `import { Table } from '@/components/list'; export default function P() { return <Table /> }` })).toEqual([])
    expect(unrendered({ 'components/list.tsx': LIST })).toEqual(['Table'])
  })

  it('sees through a barrel: the barrel being imported does not make everything it re-exports used', () => {
    const sources = {
      'components/list.tsx': LIST,
      'components/card.tsx': `export function Card() { return <div /> }`,
      'components/index.ts': `export { Table } from './list'\nexport { Card } from './card'`,
      'app/page.tsx': `import { Table } from '@/components'; export default function P() { return <Table /> }`,
    }
    expect(unrendered(sources)).toEqual(['Card'])
  })

  it('does not count a component only named in a type, a test, or by itself', () => {
    expect(unrendered({ 'components/card.tsx': `export function Card() { return <div /> }\nexport type CardProps = React.ComponentProps<typeof Card>` })).toEqual(['Card'])
    expect(unrendered({ 'components/card.tsx': `export function Card() { return <div /> }`, 'components/card.test.tsx': `import { Card } from './card'; render(<Card />)` })).toEqual(['Card'])
  })

  it('counts a component passed as a value or loaded dynamically as used, and leaves the files Next.js renders alone', () => {
    expect(unrendered({ 'components/card.tsx': `export function Card() { return <div /> }`, 'app/page.tsx': `import { Card } from '@/components/card'; const map = { Card }; export default function P() { return null }` })).toEqual([])
    expect(unrendered({ 'components/card.tsx': `export default function Card() { return <div /> }`, 'app/page.tsx': `const Lazy = lazy(() => import('@/components/card')); export default function P() { return <Lazy /> }` })).toEqual([])
    expect(unrendered({ 'app/dashboard/page.tsx': `export default function Page() { return <div /> }`, 'app/dashboard/layout.tsx': `export default function Layout({ children }) { return <div>{children}</div> }` })).toEqual([])
  })

  it('does not count a function that renders no JSX, or one the file does not export', () => {
    expect(unrendered({ 'lib/format.tsx': `export function Format(x) { return String(x) }\nfunction Inner() { return <i /> }` })).toEqual([])
  })
})

// Components nothing renders, and buttons whose callback no parent passes. The ceiling can only fall; the end is zero.
const CEILING = 0

describe('the frontend against itself', () => {
  it('holds the unwired components at or below the ceiling', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(2000)
    expect(report.components).toBeGreaterThan(500)
    expect(report.forwarding).toBeGreaterThan(0)
    const over = report.findings.length > CEILING ? report.findings.map((found) => `${found.kind} ${found.file}:${found.line}  ${found.component}  ${found.detail}`) : []
    expect(over).toEqual([])
  }, 120_000)
})
