// @vitest-environment jsdom
/**
 * Select reports what a person chose, never the empty value Radix reads off its hidden native <select>.
 *
 * Inside a form Radix keeps a native <select> in step with `value`; a value no rendered item carries (options that load later, a value that is not in the list)
 * reads as '' there and is reported through onValueChange, which would empty a controlled field before anyone touched it. No item can have the value '' (Radix
 * refuses it at render), so the wrapper drops that report.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

afterEach(cleanup)

// jsdom has no pointer capture or scrolling, which Radix's open menu calls.
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
})

describe('Select', () => {
  it('does not report an empty choice when the value moves to one none of its items carries, inside a form', () => {
    const onValueChange = vi.fn()
    const tree = (value: string) => (
      <form>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger aria-label="Parent">
            <SelectValue placeholder="No parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent</SelectItem>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </form>
    )
    const view = render(tree('a'))
    view.rerender(tree('unlisted-parent'))
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('does not report an empty choice when the value changes to one whose item is not there yet', () => {
    const onValueChange = vi.fn()
    const tree = (value: string, items: string[]) => (
      <form>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger aria-label="Parent">
            <SelectValue placeholder="No parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent</SelectItem>
            {items.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </form>
    )
    const view = render(tree('none', []))
    view.rerender(tree('late', []))
    view.rerender(tree('late', ['late']))
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Parent' })).toHaveTextContent('late')
  })

  it('still reports what a person picks', () => {
    const onValueChange = vi.fn()
    render(
      <form>
        <Select value="none" onValueChange={onValueChange}>
          <SelectTrigger aria-label="Parent">
            <SelectValue placeholder="No parent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No parent</SelectItem>
            <SelectItem value="a">Union A</SelectItem>
          </SelectContent>
        </Select>
      </form>,
    )
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Parent' }), { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('option', { name: 'Union A' }))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith('a')
  })
})
