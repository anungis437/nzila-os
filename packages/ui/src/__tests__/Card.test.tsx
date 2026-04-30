import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from '../components/Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('default variant uses surface-1 with low shadow', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('var(--color-surface-1)')
    expect(card.className).toContain('var(--shadow-low)')
  })

  it('bordered variant has a stronger border, no shadow', () => {
    render(<Card variant="bordered" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('var(--color-border-strong)')
    expect(card.className).not.toContain('shadow')
  })

  it('elevated variant uses mid shadow', () => {
    render(<Card variant="elevated" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card').className).toContain('var(--shadow-mid)')
  })

  it('merges custom className', () => {
    render(<Card className="custom" data-testid="card">Content</Card>)
    expect(screen.getByTestId('card').className).toContain('custom')
  })
})

describe('Card.Header', () => {
  it('renders children with bottom border using border token', () => {
    render(<Card.Header data-testid="header">Title</Card.Header>)
    const header = screen.getByTestId('header')
    expect(header).toHaveTextContent('Title')
    expect(header.className).toContain('var(--color-border)')
  })
})

describe('Card.Body', () => {
  it('renders children with horizontal padding', () => {
    render(<Card.Body data-testid="body">Body</Card.Body>)
    const body = screen.getByTestId('body')
    expect(body).toHaveTextContent('Body')
    expect(body.className).toContain('px-5')
  })
})

describe('Card.Footer', () => {
  it('renders children with top border', () => {
    render(<Card.Footer data-testid="footer">Footer</Card.Footer>)
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveTextContent('Footer')
    expect(footer.className).toContain('border-t')
  })
})
