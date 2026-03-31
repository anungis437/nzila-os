import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from '../components/Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default variant with border', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('border-border')
  })

  it('applies bordered variant', () => {
    render(<Card variant="bordered" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('border-2')
  })

  it('applies elevated variant', () => {
    render(<Card variant="elevated" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('shadow-lg')
  })

  it('merges custom className', () => {
    render(<Card className="custom" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card.className).toContain('custom')
  })
})

describe('Card.Header', () => {
  it('renders children with border-b', () => {
    render(<Card.Header data-testid="header">Title</Card.Header>)
    const header = screen.getByTestId('header')
    expect(header).toHaveTextContent('Title')
    expect(header.className).toContain('border-b')
  })
})

describe('Card.Body', () => {
  it('renders children with padding', () => {
    render(<Card.Body data-testid="body">Body</Card.Body>)
    const body = screen.getByTestId('body')
    expect(body).toHaveTextContent('Body')
    expect(body.className).toContain('px-6')
  })
})

describe('Card.Footer', () => {
  it('renders children with border-t', () => {
    render(<Card.Footer data-testid="footer">Footer</Card.Footer>)
    const footer = screen.getByTestId('footer')
    expect(footer).toHaveTextContent('Footer')
    expect(footer.className).toContain('border-t')
  })
})
