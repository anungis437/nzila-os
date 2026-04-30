import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '../components/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('default primary variant uses accent tokens', () => {
    render(<Button>Primary</Button>)
    expect(screen.getByRole('button', { name: 'Primary' }).className).toContain('var(--color-accent)')
  })

  it('secondary variant uses surface + border tokens', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const btn = screen.getByRole('button', { name: 'Secondary' })
    expect(btn.className).toContain('var(--color-surface-1)')
    expect(btn.className).toContain('var(--color-border-strong)')
  })

  it('ghost variant is transparent by default', () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button', { name: 'Ghost' }).className).toContain('bg-transparent')
  })

  it('danger variant uses critical status token', () => {
    render(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button', { name: 'Danger' }).className).toContain('var(--color-status-critical)')
  })

  it('sm size produces a 28px-tall button', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button', { name: 'Small' }).className).toContain('h-7')
  })

  it('lg size produces a 44px-tall button', () => {
    render(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button', { name: 'Large' }).className).toContain('h-11')
  })

  it('loading state sets aria-busy and disables interaction', () => {
    render(<Button loading>Saving</Button>)
    const btn = screen.getByRole('button', { name: /Saving/ })
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn).toBeDisabled()
  })

  it('merges custom className', () => {
    render(<Button className="my-custom">Styled</Button>)
    expect(screen.getByRole('button', { name: 'Styled' }).className).toContain('my-custom')
  })

  it('forwards native button props', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })
})
