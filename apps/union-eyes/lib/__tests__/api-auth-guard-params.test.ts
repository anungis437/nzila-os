import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { withApiAuth } from '../api-auth-guard'

describe('withApiAuth route params', () => {
  it('hands legacy handlers resolved params when Next supplies a Promise', async () => {
    const handler = vi.fn(async (_request: NextRequest, context: Record<string, unknown>) => {
      return Response.json({ id: (context.params as { id: string }).id }) as never
    })
    const wrapped = withApiAuth(handler as never, { requireAuth: false })
    const response = await wrapped(new NextRequest(new URL('http://localhost/api/documents/abc')), {
      params: Promise.resolve({ id: 'abc' }),
    } as never)
    expect(await (response as Response).json()).toEqual({ id: 'abc' })
  })

  it('keeps handlers that await params working and tolerates routes without params', async () => {
    const handler = vi.fn(async (_request: NextRequest, context: Record<string, unknown>) => {
      const params = (await context.params) as { id?: string } | undefined
      return Response.json({ id: params?.id ?? null }) as never
    })
    const wrapped = withApiAuth(handler as never, { requireAuth: false })
    const request = new NextRequest(new URL('http://localhost/api/documents/abc'))
    expect(
      await (
        (await wrapped(request, { params: Promise.resolve({ id: 'x' }) } as never)) as Response
      ).json(),
    ).toEqual({ id: 'x' })
    expect(await ((await wrapped(request, {} as never)) as Response).json()).toEqual({ id: null })
  })
})
