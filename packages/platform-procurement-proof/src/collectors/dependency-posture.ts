/**
 * @nzila/platform-procurement-proof — Dependency Posture Collector
 *
 * Reads dependency posture from CI artifacts (preferred) or from
 * ops/outputs/ as fallback. Never invents data — marks "not_available"
 * if no scan results are found.
 *
 * @module @nzila/platform-procurement-proof/collectors/dependency-posture
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from '@nzila/os-core/telemetry'
import { nowISO } from '@nzila/platform-utils/time'
import { z } from 'zod'
import type {
  CollectorResult,
  DependencyPostureCollectorData,
} from './types'
import { dependencyPostureCollectorDataSchema } from './types'

const logger = createLogger('collector:dependency-posture')

/** Schema for the CI-produced dependency scan JSON */
const ciScanResultSchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative().optional().default(0),
  low: z.number().int().nonnegative().optional().default(0),
  totalDependencies: z.number().int().nonnegative(),
  scanTimestamp: z.string(),
  toolVersion: z.string().optional().default('unknown'),
  lockfileIntegrity: z.boolean().optional().default(true),
})

/** Candidate paths for dependency scan results (most specific first) */
const SCAN_FILENAMES = [
  'dependency-posture.json',
  'audit-result.json',
] as const

/**
 * Collect dependency posture from available scan artifacts.
 */
export async function collectDependencyPosture(
  orgId: string,
  rootDir?: string,
): Promise<CollectorResult<DependencyPostureCollectorData>> {
  const now = nowISO()
  const source = 'ci:dependency-scan'

  const candidates = rootDir
    ? [
        {
          label: 'ops/outputs/dependency-posture.json',
          fullPath: join(rootDir, 'ops', 'outputs', SCAN_FILENAMES[0]),
        },
        {
          label: 'ops/outputs/audit-result.json',
          fullPath: join(rootDir, 'ops', 'outputs', SCAN_FILENAMES[1]),
        },
        {
          label: 'coverage/dependency-posture.json',
          fullPath: join(rootDir, 'coverage', SCAN_FILENAMES[0]),
        },
      ]
    : [
        {
          label: 'ops/outputs/dependency-posture.json',
          fullPath: join(/* turbopackIgnore: true */ process.cwd(), 'ops', 'outputs', SCAN_FILENAMES[0]),
        },
        {
          label: 'ops/outputs/audit-result.json',
          fullPath: join(/* turbopackIgnore: true */ process.cwd(), 'ops', 'outputs', SCAN_FILENAMES[1]),
        },
        {
          label: 'coverage/dependency-posture.json',
          fullPath: join(/* turbopackIgnore: true */ process.cwd(), 'coverage', SCAN_FILENAMES[0]),
        },
      ]

  try {
    for (const candidate of candidates) {
      if (!existsSync(candidate.fullPath)) continue

      const raw = readFileSync(candidate.fullPath, 'utf-8')
      const parsed = ciScanResultSchema.safeParse(JSON.parse(raw))

      if (!parsed.success) {
        logger.warn('Dependency scan file found but invalid', {
          path: candidate.label,
          errors: parsed.error.flatten(),
        })
        continue
      }

      const scan = parsed.data
      const data: DependencyPostureCollectorData = {
        criticalCount: scan.critical,
        highCount: scan.high,
        mediumCount: scan.medium,
        lowCount: scan.low,
        totalDependencies: scan.totalDependencies,
        scanTimestamp: scan.scanTimestamp,
        toolVersion: scan.toolVersion,
        lockfileIntegrity: scan.lockfileIntegrity,
      }

      // Validate output
      dependencyPostureCollectorDataSchema.parse(data)

      const integrityHash = createHash('sha256')
        .update(raw)
        .digest('hex')

      logger.info('Dependency posture collected', {
        orgId,
        source: candidate.label,
        criticalCount: data.criticalCount,
        highCount: data.highCount,
      })

      return {
        status: 'ok',
        source: `file:${candidate.label}`,
        collectedAt: now,
        data,
        integrityHash,
      }
    }

    // No scan file found
    logger.info('No dependency scan artifacts found', { orgId, candidateCount: candidates.length })

    return {
      status: 'not_available',
      source,
      collectedAt: now,
      data: null,
      reason:
        'No dependency scan artifacts found. ' +
        'Remediation: Run `pnpm audit --json > ops/outputs/dependency-posture.json` ' +
        'or configure your CI pipeline to produce a dependency scan artifact at ' +
        'ops/outputs/dependency-posture.json.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Failed to collect dependency posture', { orgId, error: message })

    return {
      status: 'not_available',
      source,
      collectedAt: now,
      data: null,
      reason: `Dependency posture collection failed: ${message}`,
    }
  }
}
