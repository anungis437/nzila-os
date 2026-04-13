/**
 * Action result types — standard response shapes for state-changing operations.
 */

export interface ActionResult<T> {
  success: true
  data: T
  auditId?: string
  correlationId?: string
}

export interface ActionFailure {
  success: false
  error: { code: string; message: string }
  correlationId?: string
}

export type ActionResponse<T> = ActionResult<T> | ActionFailure

export function ok<T>(data: T, opts?: { auditId?: string; correlationId?: string }): ActionResult<T> {
  return { success: true, data, auditId: opts?.auditId, correlationId: opts?.correlationId }
}

export function fail(code: string, message: string, correlationId?: string): ActionFailure {
  return { success: false, error: { code, message }, correlationId }
}
