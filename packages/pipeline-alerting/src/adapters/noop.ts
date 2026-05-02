import type { PipelineAlert, PipelineAlertResult } from '../types'

/**
 * No-op adapter: records intent only; never makes network calls.
 * Used in CI and test environments.
 */
export function sendNoopAlert(alert: PipelineAlert): PipelineAlertResult {
  // Intentionally does nothing — captures intent for test inspection.
  void alert
  return { delivered: false, channels: [] }
}
