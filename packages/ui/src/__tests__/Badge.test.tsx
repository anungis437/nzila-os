import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../components/Badge'

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('default variant maps to neutral status tokens', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default').className).toContain('var(--color-status-neutral-soft)')
  })

  it('canonical "ok" variant uses ok tokens', () => {
    render(<Badge variant="ok">OK</Badge>)
    expect(screen.getByText('OK').className).toContain('var(--color-status-ok-soft)')
  })

  it('legacy alias "success" still maps to ok', () => {
    render(<Badge variant="success">OK</Badge>)
    expect(screen.getByText('OK').className).toContain('var(--color-status-ok-soft)')
  })

  it('canonical "critical" variant uses critical tokens', () => {
    render(<Badge variant="critical">Error</Badge>)
    expect(screen.getByText('Error').className).toContain('var(--color-status-critical-soft)')
  })

  it('legacy alias "danger" still maps to critical', () => {
    render(<Badge variant="danger">Error</Badge>)
    expect(screen.getByText('Error').className).toContain('var(--color-status-critical-soft)')
  })

  it('warning variant uses warning tokens', () => {
    render(<Badge variant="warning">Warn</Badge>)
    expect(screen.getByText('Warn').className).toContain('var(--color-status-warning-soft)')
  })

  it('info variant uses info tokens', () => {
    render(<Badge variant="info">Info</Badge>)
    expect(screen.getByText('Info').className).toContain('var(--color-status-info-soft)')
  })

  it('accent variant tracks the per-product accent', () => {
    render(<Badge variant="accent">Tag</Badge>)
    expect(screen.getByText('Tag').className).toContain('var(--color-accent-soft)')
  })

  it('renders a leading dot when dot=true', () => {
    const { container } = render(<Badge variant="ok" dot>Live</Badge>)
    const dot = container.querySelector('span > span[aria-hidden="true"]')
    expect(dot).not.toBeNull()
  })

  it('merges custom className', () => {
    render(<Badge className="extra">Styled</Badge>)
    expect(screen.getByText('Styled').className).toContain('extra')
  })

  it('renders as a span element', () => {
    render(<Badge>Tag</Badge>)
    expect(screen.getByText('Tag').tagName).toBe('SPAN')
  })
})
