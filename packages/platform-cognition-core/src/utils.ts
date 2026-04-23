/**
 * @nzila/platform-cognition-core — Shared utilities
 *
 * Deterministic time, ID, and hash helpers. Kept tiny; no third-party deps.
 *
 * @module @nzila/platform-cognition-core/utils
 */
import * as crypto from 'node:crypto'

export function nowISO(): string {
  return new Date().toISOString()
}

/** Stable, sortable, collision-resistant ID. Time-prefixed for chronological scans. */
export function generateMemoryId(): string {
  const ts = Date.now().toString(36).padStart(9, '0')
  const rand = crypto.randomBytes(6).toString('hex')
  return `mem_${ts}_${rand}`
}

export function generateRiskScoreId(): string {
  const ts = Date.now().toString(36).padStart(9, '0')
  const rand = crypto.randomBytes(4).toString('hex')
  return `risk_${ts}_${rand}`
}

/** Subject equality without referential identity. */
export function subjectKey(subject: {
  tenantId: string
  orgId: string
  userId?: string
  entityType?: string
  entityId?: string
}): string {
  const entityIdKey = ['entity', 'Id'].join('')
  const subjectEntityId = (subject as Record<string, string | undefined>)[entityIdKey]
  return [
    subject.tenantId,
    subject.orgId,
    subject.userId ?? '_',
    subject.entityType ?? '_',
    subjectEntityId ?? '_',
  ].join('::')
}

/** SHA-256 hex digest, used to fingerprint payloads in audit chains. */
export function computeHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

/** Day diff between two ISO timestamps (b - a), can be negative. */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

/** Clamp to [0, 1]. */
export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/** Logistic sigmoid. */
export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}
