import { escapeHatchActive, type EnvironmentSource } from './production-guard'

/**
 * Whether the database check at server start is skipped. SKIP_DB_STARTUP_CHECK=true is a developer's convenience: it is honoured on a developer's machine or a
 * test run and ignored on any deployed runtime (lib/runtime/production-guard.ts), so a stray flag cannot start a deployment that never checked its database.
 */
export function skipsDatabaseStartupCheck(env: EnvironmentSource = process.env): boolean {
  return escapeHatchActive('SKIP_DB_STARTUP_CHECK', env)
}
