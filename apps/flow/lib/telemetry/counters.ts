/**
 * Flow — Shared In-Process Telemetry Counters
 *
 * Module-level counters readable from both lib/ (e.g. command-bus) and
 * app/api/ (governance telemetry route). Avoids circular dependency by
 * living in lib/ rather than in the route file.
 */

let _workflowTransitionErrorCount = 0
let _eventEmissionGapCount = 0

export function recordWorkflowTransitionError(): void {
  _workflowTransitionErrorCount++
}

export function recordEventEmissionGap(): void {
  _eventEmissionGapCount++
}

export function getWorkflowTransitionErrorCount(): number {
  return _workflowTransitionErrorCount
}

export function getEventEmissionGapCount(): number {
  return _eventEmissionGapCount
}
