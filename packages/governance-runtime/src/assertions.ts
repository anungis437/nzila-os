/**
 * @nzila/governance-runtime — Inline governance assertions
 *
 * Small, named, citation-bearing assertions usable inline in product code.
 * Each assertion throws a `DoctrineViolationError` on breach; the consumer
 * is responsible for emitting a corresponding governance event.
 *
 * @module @nzila/governance-runtime/assertions
 */

export interface DoctrineCitation {
  readonly document: string
  readonly section?: string
  readonly policyId?: string
}

export class DoctrineViolationError extends Error {
  readonly assertionName: string
  readonly doctrineCitations: readonly DoctrineCitation[]
  readonly subjectId: string

  constructor(
    assertionName: string,
    subjectId: string,
    doctrineCitations: readonly DoctrineCitation[],
    message: string,
  ) {
    super(`${assertionName} (${subjectId}): ${message}`)
    this.name = 'DoctrineViolationError'
    this.assertionName = assertionName
    this.subjectId = subjectId
    this.doctrineCitations = doctrineCitations
  }
}

export interface PilotIsolationContext {
  readonly subjectId: string
  readonly currentEnvironmentClass: string
  readonly dataOriginEnvironmentClass: string
}

export function assertPilotIsolation(ctx: PilotIsolationContext): void {
  if (
    ctx.currentEnvironmentClass === 'production' &&
    ctx.dataOriginEnvironmentClass === 'pilot'
  ) {
    throw new DoctrineViolationError(
      'assertPilotIsolation',
      ctx.subjectId,
      [{ document: 'docs/nzila-ip/pilot-discipline.md' }],
      'pilot data must not appear on production read paths',
    )
  }
  if (
    ctx.currentEnvironmentClass === 'pilot' &&
    ctx.dataOriginEnvironmentClass === 'production'
  ) {
    throw new DoctrineViolationError(
      'assertPilotIsolation',
      ctx.subjectId,
      [{ document: 'docs/nzila-ip/pilot-discipline.md' }],
      'production data must not be read from pilot surfaces',
    )
  }
}

export interface ExecutiveDensityContext {
  readonly surfaceId: string
  readonly currentDensity: number
  readonly densityBudget: number
}

export function assertExecutiveDensity(ctx: ExecutiveDensityContext): void {
  if (ctx.currentDensity > ctx.densityBudget) {
    throw new DoctrineViolationError(
      'assertExecutiveDensity',
      ctx.surfaceId,
      [
        {
          document: 'docs/nzila-governance/executive-cognitive-governance-standards.md',
        },
      ],
      `density ${ctx.currentDensity} exceeds budget ${ctx.densityBudget}`,
    )
  }
}

export interface HumanAuthorityContext {
  readonly subjectId: string
  readonly act: string
  readonly humanApproved: boolean
}

export function assertHumanAuthority(ctx: HumanAuthorityContext): void {
  if (!ctx.humanApproved) {
    throw new DoctrineViolationError(
      'assertHumanAuthority',
      ctx.subjectId,
      [
        {
          document: 'docs/nzila-governance/continuity-safe-ai-governance.md',
        },
      ],
      `governance-bearing act "${ctx.act}" requires human approval`,
    )
  }
}

export interface AntiSurveillanceContext {
  readonly subjectId: string
  readonly payloadKeys: readonly string[]
}

const FORBIDDEN_KEYS = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'sessionId',
  'session_id',
])

export function assertAntiSurveillancePayload(
  ctx: AntiSurveillanceContext,
): void {
  const offenders = ctx.payloadKeys.filter((k) => FORBIDDEN_KEYS.has(k))
  if (offenders.length > 0) {
    throw new DoctrineViolationError(
      'assertAntiSurveillancePayload',
      ctx.subjectId,
      [{ document: 'docs/nzila-ip/anti-surveillance-doctrine.md' }],
      `payload contains individual-resolving keys: ${offenders.join(', ')}`,
    )
  }
}
