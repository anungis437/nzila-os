import { ApiError, withApi } from '@/lib/api/framework'

/**
 * POST for a messaging resource whose rows record a send: a status, provider id, price and delivery times are facts about a
 * message that went out. This route sends nothing, so it must not create such a row; it answers 501 and writes nothing.
 */
export function recordsASendOnly(summary: string, what: string) {
  return withApi(
    {
      auth: { required: true, minRole: 'officer' },
      openapi: { tags: ['Communications'], summary, description: 'Not implemented: this route sends nothing, so it records nothing.' },
    },
    async () => {
      throw ApiError.notImplemented(`${what} are recorded by the messaging service when a message is sent; one cannot be created through this route.`)
    },
  )
}
