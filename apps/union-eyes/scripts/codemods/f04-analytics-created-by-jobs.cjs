const fs = require('fs')
const path = require('path')
fs.writeFileSync('lib/api/computed-resource.ts', `import { ApiError, withApi } from '@/lib/api/framework'

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
      throw ApiError.notImplemented(\`\${what} are produced by the analytics jobs; one cannot be created through this route.\`)
    },
  )
}
`)
const root = 'app/api/analytics'
const converted = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (entry.name === 'route.ts') {
      let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
      const m = s.match(/table: (analyticsMetrics|trendAnalyses),/)
      if (!m || !s.includes('const { GET, POST } = crudRoutes({') || !s.includes('export { GET, POST };')) continue
      const what = m[1] === 'trendAnalyses' ? 'Trend analyses' : 'Analytics metrics'
      s = s.replace('const { GET, POST } = crudRoutes({', 'const { GET } = crudRoutes({')
      s = s.replace('export { GET, POST };', `export { GET };\nexport const POST = createdByJobsOnly('Create ${what.toLowerCase().slice(0, -1)} (not implemented)', '${what}');`)
      s = s.replace(`import { crudRoutes } from '@/lib/api/crud-factory';`, `import { crudRoutes } from '@/lib/api/crud-factory';\nimport { createdByJobsOnly } from '@/lib/api/computed-resource';`)
      fs.writeFileSync(p, s)
      converted.push(path.relative(root, p))
    }
  }
}
walk(root)
console.log('converted', converted.length)
console.log(converted.join('\n'))
