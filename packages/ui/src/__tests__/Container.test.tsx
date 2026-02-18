import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Container } from '../components/Container'

describe('Container', () => {
  it('renders children content', () => {
    render(<Container>Page content</Container>)
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('applies lg size by default', () => {
    render(<Container data-testid="ctr">Content</Container>)
    const ctr = screen.getByTestId('ctr')
    expect(ctr).toHaveClass('max-w-7xl')
  })

  it('applies sm size', () => {
    render(<Container size="sm" data-testid="ctr">Content</Container>)
    expect(screen.getByTestId('ctr')).toHaveClass('max-w-3xl')
  })

  it('applies md size', () => {
    render(<Container size="md" data-testid="ctr">Content</Container>)
    expect(screen.getByTestId('ctr')).toHaveClass('max-w-5xl')
  })

  it('applies xl size', () => {
    render(<Container size="xl" data-testid="ctr">Content</Container>)
    expect(screen.getByTestId('ctr')).toHaveClass('max-w-screen-2xl')
  })

  it('applies full size', () => {
    render(<Container size="full" data-testid="ctr">Content</Container>)
    expect(screen.getByTestId('ctr')).toHaveClass('max-w-full')
  })

  it('applies centering and padding styles', () => {
    render(<Container data-testid="ctr">Content</Container>)
    const ctr = screen.getByTestId('ctr')
    expect(ctr).toHaveClass('mx-auto', 'px-4')
  })

  it('merges custom className', () => {
    render(<Container className="bg-white" data-testid="ctr">Content</Container>)
    expect(screen.getByTestId('ctr')).toHaveClass('bg-white')
  })

  it('renders as a div element', () => {
    render(<Container data-testid="ctr">Content</Container>)
    expect(screen.getByTestId('ctr').tagName).toBe('DIV')
  })
})
