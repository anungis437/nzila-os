import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { ROOT, readContent, relPath, safeJoin, walkSync } from './governance-helpers'

const UE_ROOT = join(ROOT, 'apps', 'union-eyes')
const SERVICE_ROOT = join(UE_ROOT, 'services')
const DOMAINS = ['case-intelligence', 'clc', 'observability', 'pki', 'platform-economics'] as const
const LIB_SERVICE_ROOT = join(UE_ROOT, 'lib', 'services')
const LIB_SERVICE_CLUSTERS = ['ai', 'rewards', 'external-data', 'messaging', 'cba-intelligence'] as const

function collectTsFiles(dir: string): string[] {
  return walkSync(dir, ['.ts', '.tsx'])
    .filter((filePath) => !filePath.endsWith('.test.ts'))
}

describe('Union Eyes service domain boundaries', () => {
  for (const domain of DOMAINS) {
    it(`${domain} does not import other top-level service domains directly`, () => {
      const domainDir = safeJoin(SERVICE_ROOT, domain)
      if (!domainDir) {
        throw new Error(`Invalid domain path: ${domain}`)
      }

      const files = collectTsFiles(domainDir)
      const disallowedDomains = DOMAINS.filter((candidate) => candidate !== domain)
      const violations: string[] = []

      for (const filePath of files) {
        const source = readContent(filePath)
        const relativeFilePath = relPath(filePath)
        const lines = source.split('\n')

        for (let index = 0; index < lines.length; index++) {
          const line = lines[index]
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

          for (const disallowed of disallowedDomains) {
            const pattern = new RegExp(`from\\s+['\"]@/services/${disallowed}(?:/|['\"])`)
            if (pattern.test(line)) {
              violations.push(`${relativeFilePath}:${index + 1} imports ${disallowed}`)
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  }

  for (const cluster of LIB_SERVICE_CLUSTERS) {
    it(`lib/services/${cluster} does not import other selected lib/services clusters directly`, () => {
      const clusterDir = safeJoin(LIB_SERVICE_ROOT, cluster)
      if (!clusterDir) {
        throw new Error(`Invalid cluster path: ${cluster}`)
      }

      const files = collectTsFiles(clusterDir)
      const disallowedClusters = LIB_SERVICE_CLUSTERS.filter((candidate) => candidate !== cluster)
      const violations: string[] = []

      for (const filePath of files) {
        const source = readContent(filePath)
        const relativeFilePath = relPath(filePath)
        const lines = source.split('\n')

        for (let index = 0; index < lines.length; index++) {
          const line = lines[index]
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue

          for (const disallowed of disallowedClusters) {
            const pattern = new RegExp(`from\\s+['\"]@/lib/services/${disallowed}(?:/|['\"])`)
            if (pattern.test(line)) {
              violations.push(`${relativeFilePath}:${index + 1} imports lib/services/${disallowed}`)
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  }
})
