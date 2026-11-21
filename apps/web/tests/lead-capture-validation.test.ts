/**
 * Web — Lead Capture Validation Tests
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const leadCaptureSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  company: z.string().max(200).optional(),
  phone: z.string().regex(/^\+?[\d\s-]{7,20}$/).optional(),
  message: z.string().max(2000).optional(),
  source: z.enum(['website', 'referral', 'event', 'organic']).default('website'),
})

function sanitizeInput(input: string): string {
  // Linear scan: every '<' opens markup that is skipped to its closing '>', so no tag can survive or be reassembled,
  // and <script>/<style> bodies and comments are dropped with their content.
  const lower = input.toLowerCase()
  const out: string[] = []
  let i = 0
  while (i < input.length) {
    const open = input.indexOf('<', i)
    if (open === -1) { out.push(input.slice(i)); break }
    out.push(input.slice(i, open))
    if (lower.startsWith('<!--', open)) {
      const close = lower.indexOf('-->', open + 4)
      i = close === -1 ? input.length : close + 3
      continue
    }
    const element = ['script', 'style'].find((name) => lower.startsWith(`<${name}`, open) && !/[a-z0-9]/.test(lower.charAt(open + name.length + 1)))
    if (element) {
      const closing = lower.indexOf(`</${element}`, open)
      const end = closing === -1 ? -1 : lower.indexOf('>', closing)
      i = end === -1 ? input.length : end + 1
      continue
    }
    const end = input.indexOf('>', open)
    i = end === -1 ? input.length : end + 1
  }
  return out.join('').replace(/>/g, '').trim()
}

describe('Lead Capture Validation', () => {
  it('accepts valid lead input', () => {
    const result = leadCaptureSchema.safeParse({
      name: 'Jane Doe',
      email: 'jane@example.com',
      company: 'Acme Corp',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = leadCaptureSchema.safeParse({ email: 'a@b.com' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = leadCaptureSchema.safeParse({
      name: 'Test',
      email: 'not-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid phone formats', () => {
    const result = leadCaptureSchema.safeParse({
      name: 'Test',
      email: 'a@b.com',
      phone: '+1 514-555-1234',
    })
    expect(result.success).toBe(true)
  })

  it('enforces message length limit', () => {
    const result = leadCaptureSchema.safeParse({
      name: 'Test',
      email: 'a@b.com',
      message: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('defaults source to website', () => {
    const result = leadCaptureSchema.parse({ name: 'Test', email: 'a@b.com' })
    expect(result.source).toBe('website')
  })

  it('sanitizes HTML from input', () => {
    expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('Hello')
    expect(sanitizeInput('<b>Bold</b> text')).toBe('Bold text')
  })
})
