/**
 * @nzila/staging-seed — legacy script runner.
 *
 * Spawns a deprecated seed script as a child process. Streams stdout/stderr
 * through the framework's logger and returns the exit code. No data shape
 * adaptation happens here — the legacy script writes whatever it always
 * wrote. This is purely a unified-entry-point convenience.
 */
import { spawn } from 'node:child_process'
import * as path from 'node:path'

import type { SeedLogger } from '../core/types'
import type { LegacyScript } from './registry'

export interface RunLegacyOptions {
  readonly script: LegacyScript
  readonly repoRoot: string
  readonly logger: SeedLogger
  /** Extra args appended after the script path (e.g. `--reset`). */
  readonly extraArgs?: readonly string[]
}

export interface LegacyRunResult {
  readonly script: string
  readonly app: string
  readonly exitCode: number
  readonly durationMs: number
}

export async function runLegacyScript(
  opts: RunLegacyOptions,
): Promise<LegacyRunResult> {
  const { script, repoRoot, logger, extraArgs = [] } = opts
  const scriptAbs = path.resolve(repoRoot, script.path)
  const command = script.runner === 'tsx' ? 'tsx' : 'node'
  const args = [scriptAbs, ...extraArgs]

  logger.info('legacy seeder: starting', {
    id: script.id,
    app: script.app,
    runner: script.runner,
    path: script.path,
  })
  const startedAt = Date.now()

  return new Promise<LegacyRunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
      env: process.env,
    })

    child.on('error', (err) => {
      logger.error('legacy seeder: spawn failed', {
        id: script.id,
        error: (err as Error).message,
      })
      reject(err)
    })

    child.on('exit', (code) => {
      const exitCode = code ?? 0
      const durationMs = Date.now() - startedAt
      if (exitCode === 0) {
        logger.info('legacy seeder: complete', {
          id: script.id,
          durationMs,
        })
      } else {
        logger.warn('legacy seeder: non-zero exit', {
          id: script.id,
          exitCode,
          durationMs,
        })
      }
      resolve({
        script: script.id,
        app: script.app,
        exitCode,
        durationMs,
      })
    })
  })
}
