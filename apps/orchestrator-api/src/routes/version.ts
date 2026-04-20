import type { FastifyInstance } from 'fastify'
import { nowISO } from '@nzila/platform-utils/time'

export async function versionRoutes(app: FastifyInstance) {
  app.get('/version', async (_req, reply) => {
    return reply.send({
      app: 'orchestrator-api',
      gitSha: process.env.GITHUB_SHA ?? 'local',
      buildTime: process.env.BUILD_TIME ?? 'unknown',
      artifactId: process.env.ARTIFACT_ID ?? 'unknown',
      appVersion: process.env.npm_package_version ?? '0.0.0',
      timestamp: nowISO(),
    })
  })
}