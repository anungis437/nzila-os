/**
 * The dead-controls census (UE-CONV-H-025): controls a screen offers that do nothing.
 *
 * Two parts. The first pins what counts (lib/frontend-census/dead-controls.ts): a button with no handler, a menu item that selects nothing, a handler that is empty or only
 * raises a toast, a link to `#`; and what does not (a control inside a form, a trigger, a link or an element that handles the events, a disclosure, a spread). The second runs
 * the census over the real tree and holds each kind at or below a ceiling that can only fall: a button that looks clickable and is not is a fake the person finds by clicking
 * it, and no other test sees it. Closing findings means lowering the ceiling; a new dead control fails here.
 */
import { describe, expect, it } from 'vitest'
import { findDeadControls, type DeadControlKind } from '../lib/frontend-census/dead-controls'
import { ACCEPTED, countByKind, runCensus } from '../runtime/dead-controls-census'

const kinds = (source: string, file = 'components/x/card.tsx') => findDeadControls(file, source).map(({ kind }) => kind)

describe('what counts as a control that does nothing', () => {
  it('reads a button, an icon button and a menu item that nothing is attached to', () => {
    expect(kinds(`export const A = () => <div><Button>Save</Button><button className="x">Go</button><DropdownMenuItem>Open</DropdownMenuItem></div>`)).toEqual(['NO_HANDLER', 'NO_HANDLER', 'NO_HANDLER'])
  })

  it('does not read a button that has somewhere to go or something to do', () => {
    expect(kinds(`export const A = () => <div><Button onClick={save}>Save</Button><Button type="submit">Send</Button><Button asChild><Link href="/x">Go</Link></Button><Button {...props}>X</Button><Button disabled aria-expanded={open}>Menu</Button></div>`)).toEqual([])
  })

  it('does not read a control that a form, a trigger, a close control or a link carries for it', () => {
    expect(kinds(`export const A = () => <form><Button>Save</Button></form>`)).toEqual([])
    expect(kinds(`export const A = () => <DialogTrigger><Button>Open</Button></DialogTrigger>`)).toEqual([])
    expect(kinds(`export const A = () => <DialogClose><Button>Close</Button></DialogClose>`)).toEqual([])
    expect(kinds(`export const A = () => <Link href="/x"><button>Go</button></Link>`)).toEqual([])
  })

  it('does not read a control inside an element that handles the events of what it holds, such as a hover menu', () => {
    expect(kinds(`export const A = () => <div onMouseEnter={open} onMouseLeave={close}><button>Solutions</button></div>`)).toEqual([])
  })

  it('reads an empty handler, a handler that has no effect, and a noop', () => {
    expect(kinds(`export const A = () => <div><Input onChange={() => {}} /><Calendar onDateClick={(d) => undefined} /><Dialog onOpenChange={noop} /><Input onChange={(e) => e.target.value} /></div>`)).toEqual(['EMPTY_HANDLER', 'EMPTY_HANDLER', 'EMPTY_HANDLER', 'EMPTY_HANDLER'])
  })

  it('reads a handler that only reports, which is how a result is faked', () => {
    expect(kinds(`export const A = () => <div><Button onClick={() => toast.success('Saved')}>Save</Button><Button onClick={() => { console.log('x'); alert('done') }}>Go</Button></div>`)).toEqual(['FEEDBACK_ONLY_HANDLER', 'FEEDBACK_ONLY_HANDLER'])
  })

  it('does not read a handler that reaches something: a request, state, navigation, another function', () => {
    expect(kinds(`export const A = () => <div><Button onClick={async () => { await fetch('/api/x'); toast.success('ok') }}>A</Button><Button onClick={() => setOpen(true)}>B</Button><Button onClick={() => router.push('/x')}>C</Button><Button onClick={(e) => e.stopPropagation()}>D</Button></div>`)).toEqual([])
  })

  it('reads a form whose submit handler only prevents the default', () => {
    expect(kinds(`export const A = () => <form onSubmit={(e) => e.preventDefault()}><Button type="submit">Send</Button></form>`)).toEqual(['EMPTY_HANDLER'])
    expect(kinds(`export const A = () => <form onSubmit={(e) => { e.preventDefault(); save() }}><Button type="submit">Send</Button></form>`)).toEqual([])
  })

  it('reads a link to nowhere', () => {
    expect(kinds(`export const A = () => <div><a href="#">x</a><Link href="">y</Link><a href="javascript:void(0)">z</a><a href="/real">w</a></div>`)).toEqual(['DEAD_LINK', 'DEAD_LINK', 'DEAD_LINK'])
  })

  it('reads UI modules only: not the primitives that define the controls, not tests, not code that is not a component', () => {
    const source = `export const A = () => <Button>Save</Button>`
    expect(kinds(source, 'components/ui/button.tsx')).toEqual([])
    expect(kinds(source, 'components/x/card.test.tsx')).toEqual([])
    expect(findDeadControls('lib/x.ts', `const a = 1`)).toEqual([])
  })
})

// Controls the frontend offers that do nothing. Each ceiling can only fall; the end is zero.
const CEILING: Record<DeadControlKind, number> = { NO_HANDLER: 0, EMPTY_HANDLER: 0, FEEDBACK_ONLY_HANDLER: 0, DEAD_LINK: 0 }

describe('the frontend against what it offers', () => {
  it('holds every kind at or below its ceiling, and accepts only what is named and reasoned', () => {
    const report = runCensus()
    expect(report.files).toBeGreaterThan(500)
    for (const entry of ACCEPTED) expect(entry.reason.length, `${entry.file} ${entry.text}`).toBeGreaterThan(20)
    const counts = countByKind(report.findings)
    const over = (Object.keys(CEILING) as DeadControlKind[])
      .filter((kind) => counts[kind] > CEILING[kind])
      .map((kind) => `${kind}: ${counts[kind]} > ${CEILING[kind]}\n${report.findings.filter((finding) => finding.kind === kind).map((finding) => `  ${finding.file}:${finding.line}  ${finding.text}`).join('\n')}`)
    expect(over).toEqual([])
  }, 120_000)
})
