/**
 * Control-Plane telemetry setup.
 *
 * Configures structured logging and request tracing via @nzila/observability.
 */
import { createAppTelemetry } from '@nzila/observability'

export const telemetry = createAppTelemetry('control-plane')
export const { logger, trackMetric, startTimer, generateRequestId } = telemetry
