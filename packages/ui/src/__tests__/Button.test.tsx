import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Button } from '../components/Button'

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('renders as a button element', () => {
    render(<Button>Btn</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-blue-600', 'text-white')
  })

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-white', 'text-blue-600')
  })

  it('applies ghost variant styles', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-transparent', 'text-gray-700')
  })

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-red-600', 'text-white')
  })

  it('applies medium size by default', () => {
    render(<Button>Medium</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('px-4', 'py-2')
  })

  it('applies small size styles', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('px-3', 'py-1.5')
  })

  it('applies large size styles', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('px-6', 'py-3')
  })

  it('merges custom className', () => {
    render(<Button className="mt-4">Custom</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('mt-4')
  })

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('passes through additional HTML attributes', () => {
    render(<Button data-testid="submit-btn" type="submit">Submit</Button>)
    expect(screen.getByTestId('submit-btn')).toHaveAttribute('type', 'submit')
  })
})
