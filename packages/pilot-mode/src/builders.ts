/**
 * @nzila/pilot-mode — Builders
 *
 * Fluent builders for constructing pilot flags and cohorts.
 *
 * @module @nzila/pilot-mode/builders
 */
import type { PilotFlagDef, PilotCohort, RolloutStrategy } from './types'

// ── Flag Builder ────────────────────────────────────────────────────────────

export class PilotFlagBuilder {
  private _name: string
  private _description?: string
  private _enabled = true
  private _orgIds: string[] = []
  private _userIds: string[] = []
  private _cohortId?: string
  private _percentage?: number
  private _strategy: RolloutStrategy = 'instant'
  private _activatedAt?: string
  private _expiresAt?: string

  constructor(name: string) {
    this._name = name
  }

  description(desc: string): this {
    this._description = desc
    return this
  }

  enabled(value = true): this {
    this._enabled = value
    return this
  }

  disabled(): this {
    this._enabled = false
    return this
  }

  forOrgs(...orgIds: string[]): this {
    this._orgIds.push(...orgIds)
    return this
  }

  forUsers(...userIds: string[]): this {
    this._userIds.push(...userIds)
    return this
  }

  inCohort(cohortId: string): this {
    this._cohortId = cohortId
    return this
  }

  percentage(pct: number): this {
    this._percentage = pct
    return this
  }

  strategy(s: RolloutStrategy): this {
    this._strategy = s
    return this
  }

  activatedAt(iso: string): this {
    this._activatedAt = iso
    return this
  }

  expiresAt(iso: string): this {
    this._expiresAt = iso
    return this
  }

  build(): PilotFlagDef {
    return {
      name: this._name,
      description: this._description,
      enabled: this._enabled,
      orgIds: this._orgIds.length > 0 ? this._orgIds : undefined,
      userIds: this._userIds.length > 0 ? this._userIds : undefined,
      cohortId: this._cohortId,
      percentage: this._percentage,
      strategy: this._strategy,
      activatedAt: this._activatedAt,
      expiresAt: this._expiresAt,
    }
  }
}

// ── Cohort Builder ──────────────────────────────────────────────────────────

export class CohortBuilder {
  private _id: string
  private _name: string
  private _orgIds: string[] = []

  constructor(id: string) {
    this._id = id
    this._name = id
  }

  name(name: string): this {
    this._name = name
    return this
  }

  addOrgs(...orgIds: string[]): this {
    this._orgIds.push(...orgIds)
    return this
  }

  build(): PilotCohort {
    return {
      id: this._id,
      name: this._name,
      orgIds: this._orgIds,
      enrolledAt: new Date().toISOString(),
    }
  }
}

// ── Factory Functions ───────────────────────────────────────────────────────

/** Create a pilot flag builder. */
export function pilotFlag(name: string): PilotFlagBuilder {
  return new PilotFlagBuilder(name)
}

/** Create a cohort builder. */
export function cohort(id: string): CohortBuilder {
  return new CohortBuilder(id)
}
