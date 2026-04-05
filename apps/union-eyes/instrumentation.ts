 
export async function register() {
  // IMPORTANT: OpenTelemetry must be initialized FIRST, before any other imports
  // This ensures auto-instrumentation can wrap all modules correctly
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    // Initialize distributed tracing via @nzila/os-core/telemetry (must be first!)
    try {
      const { initOtel } = await import('@nzila/os-core/telemetry');
      await initOtel({ appName: 'union-eyes' });
    } catch (error) {
      // Log error but don't fail startup - tracing is non-critical
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const { logger: log } = await import('./lib/logger');
      log.error('Failed to initialize OpenTelemetry tracing', errorMessage);
      if (errorStack) log.error('Stack:', errorStack);
    }

    // Initialise os-core metrics (SLO counters for union-eyes)
    try {
      const { initMetrics } = await import('@nzila/os-core/telemetry');
      initMetrics('union-eyes');
    } catch { /* non-critical */ }
  }

  // Skip Sentry initialization during build to prevent "self is not defined" errors
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }

  // Node.js runtime initialization (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize console wrapper for production logging control (Node.js only)
    const { initializeConsoleWrapper } = await import('./lib/console-wrapper');
    initializeConsoleWrapper();
    try {
      const { createLogger } = await import('@nzila/os-core/telemetry');
      const osLogger = createLogger('union-eyes');

      // ── os-core env validation ──────────────────────────────────────
      try {
        const { validateEnv } = await import('@nzila/os-core/config');
        validateEnv('union-eyes');
        osLogger.info('os-core env validation passed');
      } catch (envError) {
        osLogger.warn('os-core env validation issue', { error: envError });
      }

      // ── Legacy env validation (kept for backwards compat) ──────────
      const { logger } = await import('./lib/logger');
      // Import and run comprehensive environment validation
      const { validateEnvironment, printEnvironmentReport: _printEnvironmentReport } = await import('./lib/config/env-validation');
      const envValidation = validateEnvironment();
      
      if (!envValidation.isValid) {
        logger.error('❌ [ERROR] Environment validation failed');
        envValidation.errors.forEach((error, index) => {
          logger.error(`  ${index + 1}. ${error}`);
        });

        // Fail-fast for truly critical variables — without these the app
        // cannot serve any request (no DB, no auth).  Other missing vars
        // only degrade optional features and are handled gracefully.
        const critical = ['DATABASE_URL', 'AUTH_SECRET'];
        const missingCritical = critical.filter(k => !process.env[k]);
        if (missingCritical.length > 0) {
          const msg = `FATAL: missing critical env vars: ${missingCritical.join(', ')}`;
          logger.error(msg);
          throw new Error(msg);
        }

        // Log but do not crash for non-critical gaps — the server should
        // start with degraded functionality so health probes remain reachable.
        logger.warn('⚠️  Continuing with missing env vars — some features may be unavailable');
      } else {
        logger.info('Environment validation passed');
      }

      // Print warnings if any
      if (envValidation.warnings.length > 0) {
        logger.warn('⚠️  [WARN] Environment warnings:');
        envValidation.warnings.forEach((warning, index) => {
          logger.warn(`  ${index + 1}. ${warning}`);
        });
      }

      // Run database startup checks (optional, can be disabled with env var)
      if (process.env.SKIP_DB_STARTUP_CHECK !== 'true') {
        const { runDatabaseStartupChecks } = await import('./lib/db-validator');
        const dbValidation = await runDatabaseStartupChecks();
        
        if (!dbValidation.isHealthy) {
          logger.error('Database startup checks failed', { errors: dbValidation.errors });
          dbValidation.errors.forEach(error => {
            logger.error('Database startup check error', { error });
          });
          
          // In production, warn but don't crash (database might be temporarily unavailable)
          if (process.env.NODE_ENV === 'production') {
            logger.warn('Service starting with database issues - some features may not work');
          }
        } else {
          logger.info('Database startup checks passed');
        }
      }

      // SECURITY FIX: Validate Redis is available for rate limiting
      // Rate limiter fails-closed if Redis unavailable (prevents DoS)
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        try {
          const { Redis } = await import('@upstash/redis');
          const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          
          // Test Redis connection with ping
          await redis.ping();
          logger.info('Redis connection verified - rate limiting enabled');
        } catch (error) {
          logger.error('Redis connection failed - rate limiting will fail-closed', error as Error);
          if (process.env.NODE_ENV === 'production') {
            logger.error('CRITICAL: All rate-limited endpoints will reject requests until Redis is available');
          }
        }
      } else if (process.env.NODE_ENV === 'production') {
        logger.error('Redis not configured - rate limiting will fail-closed in production');
      }
    } catch (error) {
      const { logger } = await import('./lib/logger');
      logger.error('Startup validation error', { error });
      // Do not re-throw — let the server start so health probes and
      // monitoring remain reachable even when config is incomplete.
    }

    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(...args);
};
