/**
 * Nzila OS — Runtime Boot Assertions
 *
 * Import this module at application startup to enforce structural
 * invariants before the API begins serving traffic.
 *
 * If any assertion fails, the process exits with a clear error message.
 * This is a fail-fast, defense-in-depth measure.
 *
 * Usage in your Next.js instrumentation.ts or startup module:
 *   import '@nzila/os-core/boot-assert'
 *
 * @module @nzila/os-core/boot-assert
 */

/**
 * Validates that the runtime environment meets Nzila OS structural requirements.
 * Called automatically on module import.
 */
function assertBootInvariants(): void {
  const errors: string[] = []

  // 1. DATABASE_URL must be set (lazy validation — db connects on first use)
  // We don't fail here because the db client already handles this lazily.
  // But we warn if it's obviously missing in a server context.
  if (typeof process !== 'undefined' && process.env) {
    const isServer = typeof window === 'undefined'
    if (isServer && !process.env.DATABASE_URL && !process.env.NEXT_PHASE) {
      errors.push(
        'BOOT ASSERTION FAILED: DATABASE_URL is not set. ' +
          'The API cannot function without a database connection.',
      )
    }
  }

  // 2. Verify os-core packages are importable (structural check)
  try {
    // These dynamic imports validate that the platform layer is correctly installed
    require.resolve('@nzila/db/scoped')
  } catch {
    errors.push(
      'BOOT ASSERTION FAILED: @nzila/db/scoped is not resolvable. ' +
        'Scoped DAL must be installed for Org isolation.',
    )
  }

  try {
    require.resolve('@nzila/db/audit')
  } catch {
    errors.push(
      'BOOT ASSERTION FAILED: @nzila/db/audit is not resolvable. ' +
        'Audit module must be installed for automatic audit emission.',
    )
  }

  // 3. Print errors and fail fast
  if (errors.length > 0) {
    console.error('\n' + '═'.repeat(72))
    console.error('NZILA OS — BOOT ASSERTION FAILURES')
    console.error('═'.repeat(72))
    for (const err of errors) {
      console.error(`\n  ✗ ${err}`)
    }
    console.error('\n' + '═'.repeat(72))
    console.error('The API will not serve traffic until all assertions pass.')
    console.error('═'.repeat(72) + '\n')

    // In production, exit immediately. In development, warn loudly.
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  } else {
    console.log('[BOOT] Nzila OS structural assertions passed ✓')
  }
}

// Run assertions on import
assertBootInvariants()

export { assertBootInvariants }
