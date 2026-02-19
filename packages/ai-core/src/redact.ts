/**
 * @nzila/ai-core — PII Redaction engine
 *
 * Applies redaction based on the profile's redactionMode before
 * sending content to the AI provider. Supports strict, balanced, and off modes.
 */
import type { RedactionMode } from './types'

// ── Patterns ────────────────────────────────────────────────────────────────

const PII_PATTERNS: { label: string; pattern: RegExp; modes: RedactionMode[] }[] = [
  // Strict + balanced
  { label: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, modes: ['strict', 'balanced'] },
  { label: 'SIN', pattern: /\b\d{3}\s?\d{3}\s?\d{3}\b/g, modes: ['strict', 'balanced'] },
  { label: 'CREDIT_CARD', pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, modes: ['strict', 'balanced'] },
  { label: 'EMAIL', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, modes: ['strict', 'balanced'] },
  { label: 'PHONE', pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, modes: ['strict', 'balanced'] },

  // Strict only
  { label: 'DATE_OF_BIRTH', pattern: /\b(?:DOB|date of birth|born)[:\s]*\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/gi, modes: ['strict'] },
  { label: 'IP_ADDRESS', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, modes: ['strict'] },
  { label: 'BANK_ACCOUNT', pattern: /\b\d{8,17}\b/g, modes: ['strict'] }, // overly broad but safe
]

// ── Public API ──────────────────────────────────────────────────────────────

export interface RedactionResult {
  text: string
  redacted: boolean
  redactions: string[]
}

/**
 * Redact PII from text based on the given mode.
 */
export function redactText(text: string, mode: RedactionMode): RedactionResult {
  if (mode === 'off') {
    return { text, redacted: false, redactions: [] }
  }

  let result = text
  const applied: string[] = []

  for (const { label, pattern, modes } of PII_PATTERNS) {
    if (!modes.includes(mode)) continue
    const fresh = new RegExp(pattern.source, pattern.flags)
    if (fresh.test(result)) {
      applied.push(label)
      result = result.replace(new RegExp(pattern.source, pattern.flags), `[REDACTED:${label}]`)
    }
  }

  return {
    text: result,
    redacted: applied.length > 0,
    redactions: applied,
  }
}
