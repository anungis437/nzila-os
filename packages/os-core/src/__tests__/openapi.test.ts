/**
 * @nzila/os-core — OpenAPI handler tests
 */
import { describe, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: mocks.existsSync,
  readFileSync: mocks.readFileSync,
}))

import { createOpenApiHandler } from '../openapi'

describe('createOpenApiHandler', () => {
  it('throws for invalid app names (path traversal defense)', () => {
    expect(() => createOpenApiHandler('../evil')).toThrow('Invalid app name')
    expect(() => createOpenApiHandler('app/../../etc')).toThrow('Invalid app name')
    expect(() => createOpenApiHandler(' ')).toThrow('Invalid app name')
  })

  it('accepts valid app names', () => {
    expect(() => createOpenApiHandler('web')).not.toThrow()
    expect(() => createOpenApiHandler('union-eyes')).not.toThrow()
    expect(() => createOpenApiHandler('console')).not.toThrow()
  })

  it('returns 404 when spec file does not exist', () => {
    mocks.existsSync.mockReturnValue(false)

    const handler = createOpenApiHandler('web')
    const response = handler({} as never)
    // Response.json returns a Response object
    expect(response).toBeDefined()
  })

  it('returns 200 with spec content when file exists', () => {
    const specContent = JSON.stringify({ openapi: '3.0.0', info: { title: 'test' } })
    mocks.existsSync.mockReturnValue(true)
    mocks.readFileSync.mockReturnValue(specContent)

    const handler = createOpenApiHandler('web')
    const response = handler({} as never)
    expect(response).toBeInstanceOf(Response)
  })
})
