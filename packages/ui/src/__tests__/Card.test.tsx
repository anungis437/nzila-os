import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card } from '../components/Card'

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default variant styles', () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('border', 'border-gray-200')
  })

  it('applies bordered variant styles', () => {
    render(<Card variant="bordered" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('border-2', 'border-gray-300')
  })

  it('applies elevated variant styles', () => {
    render(<Card variant="elevated" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('shadow-lg')
  })

  it('merges custom className', () => {
    render(<Card className="p-8" data-testid="card">Content</Card>)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('p-8')
  })

  it('renders as a div element', () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId('card').tagName).toBe('DIV')
  })
})

describe('Card.Header', () => {
  it('renders header content', () => {
    render(
      <Card>
        <Card.Header>Title</Card.Header>
      </Card>,
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  it('applies border-b styling', () => {
    render(
      <Card>
        <Card.Header data-testid="header">Title</Card.Header>
      </Card>,
    )
    expect(screen.getByTestId('header')).toHaveClass('border-b', 'border-gray-100')
  })
})

describe('Card.Body', () => {
  it('renders body content', () => {
    render(
      <Card>
        <Card.Body>Body text</Card.Body>
      </Card>,
    )
    expect(screen.getByText('Body text')).toBeInTheDocument()
  })

  it('applies padding styles', () => {
    render(
      <Card>
        <Card.Body data-testid="body">Content</Card.Body>
      </Card>,
    )
    expect(screen.getByTestId('body')).toHaveClass('px-6', 'py-4')
  })
})

describe('Card.Footer', () => {
  it('renders footer content', () => {
    render(
      <Card>
        <Card.Footer>Footer</Card.Footer>
      </Card>,
    )
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('applies border-t styling', () => {
    render(
      <Card>
        <Card.Footer data-testid="footer">Footer</Card.Footer>
      </Card>,
    )
    expect(screen.getByTestId('footer')).toHaveClass('border-t', 'border-gray-100')
  })
})
