import { ApiError, withApi } from '@/lib/api/framework'

/**
 * POST for a resource whose rows are produced by a job, never typed in: a steward could insert a row that was then served as
 * computed analytics. The route keeps its read and answers every create with 501.
 */
export function createdByJobsOnly(summary: string, what: string) {
  return withApi(
    {
      auth: { required: true, minRole: 'steward' },
      openapi: { tags: ['Analytics'], summary, description: 'Not implemented: the rows are produced by analysis jobs.' },
    },
    async () => {
      throw ApiError.notImplemented(`${what} are produced by the analytics jobs; one cannot be created through this route.`)
    },
  )
}
