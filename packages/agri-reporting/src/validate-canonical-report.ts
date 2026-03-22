// ---------------------------------------------------------------------------
// @nzila/agri-reporting — Canonical report validator
//
// Thin wrapper around the Zod schema for runtime validation / error
// extraction.  All consuming code (Cora, Agrimo, CoraGov ingestion)
// goes through this — one validation path, zero ad-hoc checks.
// ---------------------------------------------------------------------------

import { type ZodError } from 'zod'
import {
  canonicalReportSchema,
  type CanonicalReport,
} from './canonical-reporting-schema.js'

export interface ValidationOk {
  ok: true
  data: CanonicalReport
}

export interface ValidationFail {
  ok: false
  errors: { path: string; message: string }[]
}

export type ValidationResult = ValidationOk | ValidationFail

/**
 * Validate an unknown payload against the canonical reporting schema.
 * Returns a discriminated result — never throws.
 */
export function validateCanonicalReport(
  input: unknown,
): ValidationResult {
  const result = canonicalReportSchema.safeParse(input)
  if (result.success) {
    return { ok: true, data: result.data }
  }
  return {
    ok: false,
    errors: flattenZodError(result.error),
  }
}

function flattenZodError(
  error: ZodError,
): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}
